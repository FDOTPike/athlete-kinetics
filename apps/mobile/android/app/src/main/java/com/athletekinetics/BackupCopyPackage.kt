package com.athletekinetics

import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

class BackupCopyPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
      listOf(BackupCopyModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class BackupCopyModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()

  override fun getName() = "AKBackupCopy"

  @ReactMethod
  fun copyBackup(sourceUri: String, promise: Promise) {
    worker.execute {
      try {
        val uri = Uri.parse(sourceUri)
        require(uri.scheme == "content" || uri.scheme == "file")
        // This exact cache name is also recognized by startup backup cleanup.
        val destination = File(reactApplicationContext.cacheDir,
            "ak-portable-${UUID.randomUUID().toString().replace("-", "")}.pmbak")
        BoundedBackupCopy.copy(reactApplicationContext.contentResolver.openInputStream(uri), destination)
        promise.resolve(destination.absolutePath)
      } catch (error: Exception) {
        promise.reject("BACKUP_COPY_FAILED", "The selected backup could not be copied safely.", error)
      }
    }
  }

  override fun invalidate() {
    worker.shutdownNow()
    super.invalidate()
  }
}
