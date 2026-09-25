package com.athletekinetics.speech

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import java.util.Locale

@ReactModule(name = SpeechCueModule.NAME)
class SpeechCueModule(private val context: ReactApplicationContext) :
    NativeSpeechCueSpec(context), LifecycleEventListener {

  private data class ActiveUtterance(
      val id: String,
      val chunkIds: Set<String>,
      val lastChunkId: String,
      var started: Boolean = false)

  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val audioAttributes =
      AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANT)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
      UiThreadUtil.runOnUiThread { stopActive(true) }
    }
  }

  private var engine: TextToSpeech? = null
  private var available: Boolean? = null
  private var generation = 0
  private val waiting = mutableListOf<(TextToSpeech?) -> Unit>()
  private var focusRequest: AudioFocusRequest? = null
  private var activeUtterance: ActiveUtterance? = null

  private val progressListener =
      object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String) {
          UiThreadUtil.runOnUiThread {
            val active = activeUtterance ?: return@runOnUiThread
            if (utteranceId !in active.chunkIds || active.started) return@runOnUiThread
            active.started = true
            emit("start", active.id)
          }
        }

        override fun onDone(utteranceId: String) {
          UiThreadUtil.runOnUiThread {
            val active = activeUtterance ?: return@runOnUiThread
            if (utteranceId == active.lastChunkId) finish(active, "done", false)
          }
        }

        @Deprecated("Android reports an error code on supported API levels")
        override fun onError(utteranceId: String) = handleError(utteranceId)

        override fun onError(utteranceId: String, errorCode: Int) = handleError(utteranceId)

        override fun onStop(utteranceId: String, interrupted: Boolean) {
          UiThreadUtil.runOnUiThread {
            val active = activeUtterance ?: return@runOnUiThread
            if (utteranceId in active.chunkIds) finish(active, "stopped", false)
          }
        }

        private fun handleError(utteranceId: String) {
          UiThreadUtil.runOnUiThread {
            val active = activeUtterance ?: return@runOnUiThread
            if (utteranceId in active.chunkIds) finish(active, "error", true)
          }
        }
      }

  init {
    context.addLifecycleEventListener(this)
  }

  override fun isAvailable(promise: Promise) {
    withEngine { promise.resolve(it != null) }
  }

  override fun speak(text: String, utteranceId: String, promise: Promise) {
    if (text.isBlank()) {
      promise.reject("speech_empty", "Speech text is empty")
      return
    }
    withEngine { tts ->
      if (tts == null) {
        emit("error", utteranceId)
        promise.reject("speech_unavailable", "No offline English voice is available")
        return@withEngine
      }
      val chunks = splitText(text, TextToSpeech.getMaxSpeechInputLength())
      if (chunks.isEmpty()) {
        promise.reject("speech_empty", "Speech text is empty")
        return@withEngine
      }

      stopActive(true)
      if (!requestAudioFocus()) {
        emit("error", utteranceId)
        promise.reject("speech_focus", "Audio focus was not granted")
        return@withEngine
      }

      val chunkIds = chunks.indices.map { "$utteranceId:$it" }
      activeUtterance = ActiveUtterance(utteranceId, chunkIds.toSet(), chunkIds.last())
      for (index in chunks.indices) {
        val queueMode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
        val result = runCatching {
          tts.speak(chunks[index], queueMode, null, chunkIds[index])
        }.getOrDefault(TextToSpeech.ERROR)
        if (result == TextToSpeech.ERROR) {
          activeUtterance?.let { finish(it, "error", true) }
          promise.reject("speech_enqueue", "The speech engine rejected the utterance")
          return@withEngine
        }
      }
      promise.resolve(null)
    }
  }

  override fun stop(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      stopActive(true)
      promise.resolve(null)
    }
  }

  private fun withEngine(callback: (TextToSpeech?) -> Unit) {
    UiThreadUtil.runOnUiThread {
      val current = engine
      when {
        available == true && current != null -> callback(current)
        available == false -> callback(null)
        else -> {
          waiting.add(callback)
          if (current == null) initializeEngine()
        }
      }
    }
  }

  private fun initializeEngine() {
    val attempt = ++generation
    try {
      engine = TextToSpeech(context) { status ->
        UiThreadUtil.runOnUiThread {
          val current = engine
          if (generation != attempt || current == null) return@runOnUiThread
          val ready = status == TextToSpeech.SUCCESS &&
              runCatching { configureOfflineEnglishVoice(current) }.getOrDefault(false)
          available = ready
          if (!ready) {
            current.shutdown()
            engine = null
          }
          resolveWaiting(if (ready) current else null)
        }
      }
    } catch (_error: RuntimeException) {
      available = false
      engine = null
      resolveWaiting(null)
    }
  }

  private fun resolveWaiting(tts: TextToSpeech?) {
    val callbacks = waiting.toList()
    waiting.clear()
    callbacks.forEach { it(tts) }
  }

  private fun configureOfflineEnglishVoice(tts: TextToSpeech): Boolean {
    val offlineEnglish =
        tts.voices
            ?.filter { it.locale.language.equals("en", true) && !it.isNetworkConnectionRequired }
            ?.sortedBy { it.name }
            .orEmpty()
    if (offlineEnglish.isEmpty()) return false

    val preferences = buildList {
      Locale.getDefault().takeIf { it.language.equals("en", true) }?.let { add(it) }
      add(Locale("en", "AU"))
      add(Locale.UK)
      add(Locale.US)
    }.distinctBy { it.toLanguageTag().lowercase(Locale.ROOT) }
    val ordered = preferences.flatMap { preferred ->
      offlineEnglish.filter { it.locale.toLanguageTag().equals(preferred.toLanguageTag(), true) }
    } + offlineEnglish

    for (voice in ordered.distinctBy { it.name }) {
      val language = tts.setLanguage(voice.locale)
      if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) continue
      if (tts.setVoice(voice) == TextToSpeech.SUCCESS && tts.setAudioAttributes(audioAttributes) == TextToSpeech.SUCCESS) {
        tts.setOnUtteranceProgressListener(progressListener)
        return true
      }
    }
    return false
  }

  private fun requestAudioFocus(): Boolean {
    abandonAudioFocus()
    val request =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(audioAttributes)
            .setOnAudioFocusChangeListener(focusListener)
            .build()
    focusRequest = request
    val granted = runCatching {
      audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }.getOrDefault(false)
    if (!granted) focusRequest = null
    return granted
  }

  private fun abandonAudioFocus() {
    focusRequest?.let(audioManager::abandonAudioFocusRequest)
    focusRequest = null
  }

  private fun stopActive(emitStopped: Boolean) {
    val active = activeUtterance
    activeUtterance = null
    engine?.stop()
    abandonAudioFocus()
    if (emitStopped && active != null) emit("stopped", active.id)
  }

  private fun finish(active: ActiveUtterance, type: String, cancelQueue: Boolean) {
    if (activeUtterance !== active) return
    activeUtterance = null
    if (cancelQueue) engine?.stop()
    abandonAudioFocus()
    emit(type, active.id)
  }

  private fun emit(type: String, utteranceId: String) {
    emitOnSpeechEvent(
        Arguments.createMap().apply {
          putString("type", type)
          putString("utteranceId", utteranceId)
        })
  }

  private fun shutdownEngine(emitStopped: Boolean) {
    UiThreadUtil.runOnUiThread {
      ++generation
      stopActive(emitStopped)
      engine?.shutdown()
      engine = null
      available = null
      val callbacks = waiting.toList()
      waiting.clear()
      callbacks.forEach { it(null) }
    }
  }

  override fun onHostResume() = Unit

  override fun onHostPause() = shutdownEngine(true)

  override fun onHostDestroy() = shutdownEngine(false)

  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    shutdownEngine(false)
    super.invalidate()
  }

  override fun getName(): String = NAME

  companion object {
    const val NAME = "NativeSpeechCue"

    internal fun splitText(text: String, maxLength: Int): List<String> {
      val source = text.trim()
      if (source.isEmpty()) return emptyList()
      if (source.length <= maxLength) return listOf(source)

      val chunks = mutableListOf<String>()
      var current = ""
      for (sentence in source.split(Regex("(?<=[.!?])\\s+"))) {
        if (sentence.length > maxLength) {
          if (current.isNotEmpty()) {
            chunks.add(current)
            current = ""
          }
          var remaining = sentence
          while (remaining.length > maxLength) {
            val splitAt = remaining.lastIndexOf(' ', maxLength).takeIf { it > 0 } ?: maxLength
            chunks.add(remaining.substring(0, splitAt).trim())
            remaining = remaining.substring(splitAt).trimStart()
          }
          current = remaining
        } else if (current.isEmpty()) {
          current = sentence
        } else if (current.length + 1 + sentence.length <= maxLength) {
          current += " $sentence"
        } else {
          chunks.add(current)
          current = sentence
        }
      }
      if (current.isNotEmpty()) chunks.add(current)
      return chunks
    }
  }
}
