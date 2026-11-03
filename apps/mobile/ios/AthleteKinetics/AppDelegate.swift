import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // Set by SceneDelegate; kept for native modules that read the delegate's window.
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  /// Builds the React Native factory and keeps the launch options for the
  /// scene. No window is made here: SceneDelegate makes it when the scene
  /// connects.
  /// Clears persisted athlete databases and registry files when a UI test
  /// launches its initial app instance (`-AKUITestResetStorage 1`), so
  /// multi-iteration `xcodebuild -test-iterations` runs start each test from a
  /// clean install state while mid-test relaunches keep their on-disk data.
  private static func resetUITestStorageIfRequested() {
    let args = ProcessInfo.processInfo.arguments
    guard let idx = args.firstIndex(of: "-AKUITestResetStorage"),
          idx + 1 < args.count, args[idx + 1] == "1" else { return }
    let fm = FileManager.default
    if let docDir = fm.urls(for: .documentDirectory, in: .userDomainMask).first,
       let items = try? fm.contentsOfDirectory(at: docDir, includingPropertiesForKeys: nil) {
      for url in items where !url.lastPathComponent.hasPrefix("minilm-") {
        try? fm.removeItem(at: url)
      }
    }
    if let libDir = fm.urls(for: .libraryDirectory, in: .userDomainMask).first,
       let items = try? fm.contentsOfDirectory(at: libDir, includingPropertiesForKeys: nil) {
      for url in items {
        let name = url.lastPathComponent
        if name.hasSuffix(".db") || name.hasSuffix(".db-wal") || name.hasSuffix(".db-shm")
            || name.hasSuffix(".db-journal") || name.hasPrefix(".ak-") || name.hasSuffix(".pmbak") {
          try? fm.removeItem(at: url)
        }
      }
    }
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    Self.resetUITestStorageIfRequested()
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    return true
  }
}

// The UIScene life cycle (declared in Info.plist, UIApplicationSceneManifest).
// An app built with the iOS 27 SDK that has not adopted it is stopped at launch
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, seen on the
// Xcode 27 CI row), so the window is made for the scene and React Native
// starts in it. One scene only; the app handles no incoming links.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  /// Makes the app's one window for the connecting scene, points the app
  /// delegate's window at it, and starts React Native in it with the launch
  /// options the app delegate kept.
  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "pikeMethods", // must equal app.json "name" (AppRegistry) and Android getMainComponentName
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
