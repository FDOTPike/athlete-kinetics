package com.athletekinetics.speech

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class SpeechCuePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == SpeechCueModule.NAME) SpeechCueModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        SpeechCueModule.NAME to
            ReactModuleInfo(
                SpeechCueModule.NAME,
                SpeechCueModule.NAME,
                false,
                false,
                false,
                true))
  }
}
