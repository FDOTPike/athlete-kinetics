package com.athletekinetics

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Health Connect's permission contract MUST be registered here, before
    // any permission request: the library stores a lateinit
    // ActivityResultLauncher, and launching it unregistered throws an
    // uncatchable native exception (the v0.11.0 boot crash, 2026-06-13).
    // runCatching: if registration itself ever fails, the app boots and the
    // JS layer simply reports biometrics as unavailable.
    runCatching { HealthConnectPermissionDelegate.setPermissionDelegate(this) }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   *
   * R8 §2.6: MUST equal the `name` in apps/mobile/app.json — that is the string
   * index.js passes to AppRegistry.registerComponent. A mismatch cold-launches
   * into 'Invariant Violation: ... has not been registered' (caught on device,
   * 2026-08-25); verify_store_sql's R8 section pins the parity statically.
   */
  override fun getMainComponentName(): String = "pikeMethods"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
