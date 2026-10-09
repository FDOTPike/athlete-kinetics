// AthleteKineticsUITests — real user-interaction checks on the Release
// simulator build (CI: tools/ios_ui_tests.sh). They drive the shipped
// JavaScript bundle through the UI exactly as a person would: onboarding, every
// primary and header destination with Apple's accessibility audit, Dynamic
// Type, Apple Health permission denial and athlete switching, and an encrypted
// backup saved to and restored from Files. Each test launches a freshly
// installed app (the script reinstalls between tests).
//
// Every observation is also printed as an `AKUI` line so CI can publish it as
// an API-visible annotation; on failure the element tree is printed too.
// Nothing here is a mock: these run against real UIKit, HealthKit's real
// permission sheet and the real Files document picker. None of this is a
// signed-device, motion or 4 GB-phone result.
import XCTest

final class AthleteKineticsUITests: XCTestCase {
  private var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication()
  }

  override func tearDownWithError() throws {
    if let run = testRun, run.failureCount > 0 {
      log("FAIL-TREE \(name): app{\(visibleLabels(app))} springboard{\(visibleLabels(XCUIApplication(bundleIdentifier: "com.apple.springboard")))}")
      let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
      shot.name = "failure-\(name)"
      shot.lifetime = .keepAlways
      add(shot)
    }
  }

  // MARK: - helpers

  /// A compact, readable inventory of what is on screen (the raw element tree
  /// is too long for an annotation): buttons, texts, cells, bars and fields.
  private func visibleLabels(_ target: XCUIApplication) -> String {
    let groups: [(String, XCUIElementQuery, Int)] = [
      ("nav", target.navigationBars, 6), ("button", target.buttons, 40), ("cell", target.cells, 20),
      ("field", target.textFields, 8), ("secure", target.secureTextFields, 4), ("text", target.staticTexts, 45),
    ]
    return groups.map { kind, query, limit in
      let labels = query.allElementsBoundByIndex.prefix(limit)
        .map { el -> String in let l = el.label.isEmpty ? el.identifier : el.label; return String(l.prefix(70)) }
        .filter { !$0.isEmpty }
      return "\(kind)[\(labels.joined(separator: "; "))]"
    }.joined(separator: " ")
  }

  private func log(_ message: String) {
    print("AKUI \(message.replacingOccurrences(of: "\n", with: " | "))")
  }

  /// Any element whose accessibility identifier (React Native testID) or label matches.
  private func element(_ key: String) -> XCUIElement {
    app.descendants(matching: .any)
      .matching(NSPredicate(format: "identifier == %@ OR label == %@", key, key)).firstMatch
  }

  private func element(labelBeginsWith prefix: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
  }

  /// The element's label now, or nil when it is absent. A snapshot throws
  /// instead of failing the test when the element vanishes between an
  /// existence check and the read (CI evidence 5032e65: the restore status
  /// disappeared mid-read during the hand-over to the restored athlete).
  private func currentLabel(_ el: XCUIElement) -> String? {
    (try? el.snapshot())?.label
  }

  private func element(labelContains text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
  }

  @discardableResult
  private func wait(_ el: XCUIElement, _ what: String, timeout: TimeInterval = 30,
                    file: StaticString = #filePath, line: UInt = #line) -> XCUIElement {
    if !el.waitForExistence(timeout: timeout) {
      XCTFail("\(what) did not appear within \(Int(timeout)) s", file: file, line: line)
    }
    return el
  }

  /// Scroll until the element is hittable: down the page first, then back up.
  private func reveal(_ el: XCUIElement, _ what: String, file: StaticString = #filePath, line: UInt = #line) {
    wait(el, what, file: file, line: line)
    var tries = 0
    while !el.isHittable && tries < 15 { app.swipeUp(velocity: .slow); tries += 1 }
    tries = 0
    while !el.isHittable && tries < 30 { app.swipeDown(velocity: .slow); tries += 1 }
    if !el.isHittable { XCTFail("\(what) never became hittable", file: file, line: line) }
  }

  private func tap(_ key: String, _ what: String? = nil, file: StaticString = #filePath, line: UInt = #line) {
    let el = element(key)
    reveal(el, what ?? key, file: file, line: line)
    el.tap()
  }

  /// Whether the field, or an element inside it, holds keyboard focus: the
  /// condition XCTest requires before it types. XCTest offers the attribute
  /// to key-value coding only.
  private func holdsKeyboardFocus(_ el: XCUIElement) -> Bool {
    if (el.value(forKey: "hasKeyboardFocus") as? Bool) == true { return true }
    return el.descendants(matching: .any).matching(NSPredicate(format: "hasKeyboardFocus == true")).firstMatch.exists
  }

  /// Taps the field until it holds keyboard focus, as a person does when a
  /// tap is not taken; typing into an unfocused field fails the test (CI
  /// evidence b99d0cb: the backup password field, just scrolled into view,
  /// had no keyboard focus when typing began). Every further tap is recorded.
  private func focus(_ el: XCUIElement, _ what: String, file: StaticString = #filePath, line: UInt = #line) {
    for attempt in 1...3 {
      if attempt > 1 {
        log("FOCUS-RETRY \(what): no keyboard focus 5 s after tap \(attempt - 1); tapping again")
        reveal(el, what, file: file, line: line)
      }
      el.tap()
      let deadline = Date().addingTimeInterval(5)
      while Date() < deadline {
        if holdsKeyboardFocus(el) { return }
        usleep(250_000)
      }
    }
    XCTFail("\(what) did not take keyboard focus after 3 taps", file: file, line: line)
  }

  /// Replaces the field's text, then submits (single-line fields blur on
  /// return, so the keyboard never covers the next control).
  private func enterText(into key: String, _ text: String, submit: Bool = true) {
    let el = element(key)
    reveal(el, key)
    focus(el, key)
    let existing = (el.value as? String) ?? ""
    if !existing.isEmpty {
      el.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
    }
    el.typeText(submit ? text + "\n" : text)
  }

  /// The label once it settles to one beginning with `prefix`.
  @discardableResult
  private func settledLabel(_ el: XCUIElement, beginsWith prefix: String, _ what: String,
                            timeout: TimeInterval = 120) -> String {
    let done = NSPredicate(format: "label BEGINSWITH %@", prefix)
    let result = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: done, object: el)], timeout: timeout)
    let label = el.exists ? el.label : "<absent>"
    log("\(what): \(label.prefix(220))")
    if result != .completed { XCTFail("\(what) did not become '\(prefix)…' within \(Int(timeout)) s; it read: \(label)") }
    return label
  }

  private func launch(_ arguments: [String] = []) {
    app.launchArguments = arguments
    app.launch()
    wait(element("shell-root"), "the app shell", timeout: 90)
  }

  /// The default eight-screen onboarding, through the real UI.
  private func completeOnboarding(_ who: String, createProgram: Bool = false) {
    wait(element("Next"), "onboarding (\(who))", timeout: 60)
    log("onboarding started (\(who)): progress=\(element(labelBeginsWith: "Step ").exists ? element(labelBeginsWith: "Step ").label : "-")")
    for step in 1...6 { tap("Next", "Next (step \(step), \(who))") }
    tap("No, nothing to note")
    tap("Next", "Next to review (\(who))")
    tap("START TRAINING")
    // The program set-up offer: accepted when the flow needs a plan,
    // otherwise kept for later.
    let cancel = element("Cancel")
    if cancel.waitForExistence(timeout: 8) {
      if createProgram {
        let create = element("Create program")
        reveal(create, "Create program (\(who))")
        XCTAssertTrue(create.isEnabled, "Create program is disabled for a default onboarding (\(who))")
        create.tap()
        log("program set-up offer: created (\(who))")
      } else {
        cancel.tap()
        log("program set-up offer: cancelled (\(who))")
      }
    } else if createProgram {
      log("program set-up offer: not shown (\(who))")
    }
    wait(element("shell-primary-tabs"), "the primary tabs after onboarding (\(who))", timeout: 60)
    log("onboarding complete: \(who)")
  }

  /// The Apple Health wording in any state. The failed-request wording begins
  /// "The Apple Health request did not complete", so a plain "Apple Health"
  /// prefix would read that state as absent.
  private func healthWording() -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(
      format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Apple Health", "The Apple Health request")).firstMatch
  }

  /// An athlete without a program is offered set-up whenever it becomes the
  /// active athlete (after onboarding, a switch or a restore); that offer
  /// covers the shell, so it is cancelled before navigating.
  private func dismissSetUpOfferIfShown(_ context: String) {
    if element("Create program").exists && element("Cancel").exists {
      element("Cancel").tap()
      log("program set-up offer: cancelled (\(context))")
    }
  }

  private func openProfile() {
    dismissSetUpOfferIfShown("before opening Profile")
    tap("header-athlete", "Profile")
    wait(element("athlete-screen-shown"), "the Profile screen")
  }

  private func unlockAdvancedTools() {
    if element("advanced-athlete-manager").exists { return }
    let build = element("Build 0.1.0")
    // The label sits at the foot of the full Profile form, beyond reveal()'s
    // fifteen slow swipes; scroll down at normal speed first.
    wait(build, "the build label")
    var tries = 0
    while !build.isHittable && tries < 40 { app.swipeUp(); tries += 1 }
    reveal(build, "the build label")
    for _ in 1...7 { build.tap() }
    wait(element("advanced-athlete-manager"), "the advanced athlete manager after the seven-tap gesture")
  }

  /// Expands Coach Mode and returns its label (with the athlete count).
  private func expandCoachMode() -> String {
    unlockAdvancedTools()
    let coach = element(labelBeginsWith: "Coach mode,")
    reveal(coach, "Coach mode")
    if coach.label.hasSuffix("collapsed") { coach.tap() }
    let label = settledLabel(coach, beginsWith: "Coach mode,", "Coach Mode", timeout: 10)
    return label
  }

  private func healthPermissionButton(_ title: String, in target: XCUIApplication? = nil) -> XCUIElement {
    (target ?? app).buttons.matching(NSPredicate(format: "label IN %@", [title, title.replacingOccurrences(of: "’", with: "'")])).firstMatch
  }

  /// HealthKit's sheet, in the app's hierarchy or (if the system presents it
  /// out of process) SpringBoard's.
  private func findHealthSheetButton(_ title: String, timeout: TimeInterval) -> XCUIElement? {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let deadline = Date().addingTimeInterval(timeout)
    repeat {
      let inApp = healthPermissionButton(title)
      if inApp.exists { log("health sheet: in the app"); return inApp }
      let inSpringboard = healthPermissionButton(title, in: springboard)
      if inSpringboard.exists { log("health sheet: in SpringBoard"); return inSpringboard }
      sleep(1)
    } while Date() < deadline
    return nil
  }

  // MARK: - tests

  /// Onboarding, every primary and header destination, and Apple's
  /// accessibility audit on each of them (all audit types).
  func test1_onboardingNavigationAndAccessibility() throws {
    launch()
    completeOnboarding("first athlete")
    var issues: [String] = []
    let destinations: [(String, String, String)] = [
      ("tab-today", "Today", "shell-primary-tabs"), ("tab-coach", "Plan", "shell-primary-tabs"),
      ("tab-progress", "Progress", "progress-screen"), ("header-readiness", "Ready", "readiness-screen"),
      ("header-session", "Workout", "session-screen-shown"), ("header-library", "Library", "library-list"),
      ("header-athlete", "Profile", "athlete-screen-shown"),
    ]
    for (key, screen, marker) in destinations {
      tap(key, screen)
      wait(element(marker), "the \(screen) screen marker (\(marker))")
      // Today and Plan share a screen marker, so the marker alone does not
      // prove the switch has rendered; the selected state must follow.
      // One lookup on the 300-movement Library took 9.5 s on a loaded runner
      // (CI evidence 31e8bc4), so a 10 s bound allowed a single reading.
      let selected = XCTWaiter.wait(for: [XCTNSPredicateExpectation(
        predicate: NSPredicate(format: "isSelected == true"), object: element(key))], timeout: 30)
      XCTAssertEqual(selected, .completed, "\(screen) control is not marked selected within 30 s of tapping it")
      log("visited \(screen)")
      guard #available(iOS 17.0, *) else {
        XCTFail("the accessibility audit needs iOS 17+; this runtime is older")
        return
      }
      issues += audit(screen)
    }
    XCTAssertTrue(issues.isEmpty, "accessibility audit found \(issues.count) issue(s); first: \(issues.first ?? "")")
  }

  @available(iOS 17.0, *)
  private func audit(_ screen: String) -> [String] {
    var issues: [String] = []
    do {
      try app.performAccessibilityAudit(for: .all) { issue in
        let who = issue.element.map { "\($0.elementType.rawValue)|\($0.identifier)|\($0.label.prefix(80))" } ?? "-"
        // React Native text fields scale their font with the person's text
        // size through RN's own font multiplier, not UIKit's
        // adjustsFontForContentSizeCategory, which is what this audit reads.
        // test2 MEASURES that a text field grows at AX XXXL; only this exact
        // pairing (Dynamic Type x text field) is classified, and it is still
        // reported. Everything else fails the test.
        let fieldTypes: [XCUIElement.ElementType] = [.textField, .secureTextField, .searchField]
        if issue.auditType == .dynamicType, let el = issue.element, fieldTypes.contains(el.elementType) {
          self.log("A11Y-MEASURED \(screen) [dynamicType] RN text field \(el.label.prefix(60)): scaling measured in test2")
          return true
        }
        issues.append("\(screen) [\(issue.auditType.rawValue)] \(issue.compactDescription) @ \(who)")
        return true // collect every issue; the caller fails the test if any exist
      }
    } catch {
      issues.append("\(screen) audit did not complete: \(error)")
    }
    for issue in issues { log("A11Y \(issue)") }
    log("a11y \(screen): \(issues.count) issue(s)")
    return issues
  }

  /// Dynamic Type: the same text is laid out taller at an accessibility size.
  func test2_dynamicTypeScalesText() throws {
    launch(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"])
    let regular = element("WHAT SHOULD I CALL YOU?")
    wait(regular, "the onboarding name prompt (default size)", timeout: 60)
    let regularHeight = regular.frame.height
    let regularField = app.textFields["Your name"]
    wait(regularField, "the name field (default size)")
    let regularFieldHeight = regularField.frame.height
    app.terminate()
    launch(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
    let large = element("WHAT SHOULD I CALL YOU?")
    wait(large, "the onboarding name prompt (AX XXXL)", timeout: 60)
    let largeHeight = large.frame.height
    let largeField = app.textFields["Your name"]
    wait(largeField, "the name field (AX XXXL)")
    let largeFieldHeight = largeField.frame.height
    log("dynamic type: name prompt height \(regularHeight) pt at L, \(largeHeight) pt at AX XXXL")
    log("dynamic type: name text field height \(regularFieldHeight) pt at L, \(largeFieldHeight) pt at AX XXXL")
    XCTAssertGreaterThan(largeHeight, regularHeight * 1.5, "text did not scale with the accessibility text size")
    XCTAssertGreaterThan(largeFieldHeight, regularFieldHeight * 1.3, "a text field did not scale with the accessibility text size")
    XCTAssertTrue(element("Next").isHittable, "Next is unreachable at the largest text size")
  }

  /// Apple Health: the person declines on HealthKit's real sheet. The app must
  /// never claim it can read. Then Coach Mode: a second athlete is added (own
  /// onboarding) and switching athletes never reopens the permission sheet.
  func test3_healthDenialAndAthleteSwitching() throws {
    // -AKUITestTrace: the app logs which branch its permission flow took
    // (content-free; captured from the system log by tools/ios_ui_tests.sh).
    launch(["-AKUITestTrace", "1"])
    completeOnboarding("athlete A")
    openProfile()
    let idle = element(labelBeginsWith: "Apple Health is available.")
    // CI evidence c3e7de5 (Xcode 27 row, iOS 27.0 simulator): 30 s after the
    // Profile opened the app still read "Checking Apple Health…"; the same
    // test had the wording in time on the run before. The wording must still
    // appear; the time it took is recorded and the bound is 2 minutes.
    let idleStart = Date()
    wait(idle, "the Apple Health 'available' wording before any request", timeout: 120)
    log("health availability shown after \(Int(Date().timeIntervalSince(idleStart))) s")
    // CI evidence (5bdc452): the simulator's HealthKit sheet service can start
    // slower than HealthKit's own 10 s authorization session; HealthKit then
    // fails the request ("Authorization session timed out") and the app shows
    // its honest "did not complete — TRY AGAIN" wording. That path is recorded
    // as evidence; the person then taps TRY AGAIN once, as anyone would.
    let healthHint = healthWording()
    var answered = false
    for attempt in 1...2 where !answered {
      let control = "Choose whether to share sleep and resting heart rate from Apple Health"
      tap(control, "Apple Health CONNECT / TRY AGAIN (attempt \(attempt))")
      let started = Date()
      if let dontAllow = findHealthSheetButton("Don’t Allow", timeout: 150) {
        log("health sheet shown (attempt \(attempt)) after \(Int(Date().timeIntervalSince(started))) s: allow=\(healthPermissionButton("Allow").exists)")
        dontAllow.tap()
        log("health sheet: tapped Don't Allow")
      } else {
        log("health sheet not shown within 150 s (attempt \(attempt)); on screen: \(visibleLabels(app).prefix(700))")
      }
      // Every change of the wording for up to 180 s; when the app's own text
      // is not visible, record what is on screen instead (twice).
      var seen = ""
      var inventories = 0
      for second in 0..<180 {
        let now = currentLabel(healthHint).map { String($0.prefix(60)) } ?? "<absent>"
        if now != seen { log("health hint attempt \(attempt) t=\(second)s: \(now)"); seen = now }
        if now == "<absent>" && (second == 20 || second == 90) && inventories < 2 {
          inventories += 1
          log("health hint absent at t=\(second)s; app{\(visibleLabels(app).prefix(700))} springboard{\(visibleLabels(XCUIApplication(bundleIdentifier: "com.apple.springboard")).prefix(300))}")
        }
        for claim in ["Connected", "granted"] where now.contains(claim) {
          XCTFail("the Health wording claimed access ('\(claim)') while the request was open: \(now)")
        }
        if now.hasPrefix("Apple Health access requested") { answered = true; break }
        if now.hasPrefix("The Apple Health request did not complete") { break }
        sleep(1)
      }
      // Only ask again once the first request has visibly settled.
      if !answered && !(healthHint.exists && healthHint.label.hasPrefix("The Apple Health request did not complete")) { break }
    }
    // CI evidence (2580fb6): after the Don't Allow tap the simulator's healthd
    // kept the authorization transaction open until teardown (Code=5) and
    // never answered the app. That alone is not an app defect. The marker
    // below is checked by tools/ios_ui_tests.sh against the app's own trace:
    // it is accepted ONLY when the app provably received no answer ("request
    // settled" absent); an answer the UI failed to show is still a failure.
    if answered {
      // HealthKit never tells an app that reading was denied, so the honest
      // wording is 'requested' plus where to check — never 'connected'.
      let hintA = settledLabel(element(labelBeginsWith: "Apple Health access requested"),
                               beginsWith: "Apple Health access requested", "health wording after denial (A)", timeout: 30)
      XCTAssertTrue(hintA.contains("does not tell apps whether you allowed reading"), "the denial-safe explanation is missing: \(hintA)")
      for claim in ["Connected", "granted"] {
        XCTAssertFalse(hintA.contains(claim), "after a denial the wording claimed access ('\(claim)'): \(hintA)")
      }
    } else if healthHint.exists && healthHint.label.hasPrefix("The Apple Health request did not complete") {
      // CI evidence (c5cf82c): healthd failed both requests with "Authorization
      // session timed out" (Code=100) before any sheet appeared; the app showed
      // its honest failure wording. tools/ios_ui_tests.sh accepts this marker
      // ONLY when healthd's own log shows that timeout.
      log("HEALTH-TIMEOUT-SHOWN healthd timed out the authorization session before showing a sheet; the app showed 'did not complete' and claimed nothing")
    } else {
      log("HEALTH-UNANSWERED HealthKit returned no answer to the app on this simulator; the app kept its request pending and claimed nothing")
    }
    XCTAssertNil(findHealthSheetButton("Don’t Allow", timeout: 2), "the permission sheet stayed open")
    // CI evidence (c4ef71b, 37c6022): when the sheet was answered but healthd
    // never closed the transaction, nothing in the app was hittable afterwards
    // (the build label "never became hittable"); in the run where no sheet
    // appeared, the same steps passed. The stuck system authorization view is
    // recorded and cleared by relaunching the app (data persists on disk). The
    // same sequence on a physical device is an owner check.
    // CI evidence (31e8bc4, iOS 27): the app was still hittable here, and the
    // sheet for this one request (the app's trace shows a single "request
    // start") came up 12.5 minutes later, over the athlete switcher. An
    // unanswered request is therefore always ended by the relaunch, and
    // tools/ios_ui_tests.sh requires the trace to show one request only.
    if !answered {
      let header = element("header-athlete")
      if header.exists && !header.isHittable {
        log("HEALTH-VIEW-STUCK the app was not hittable after the unanswered Health request; relaunching")
      } else {
        log("app hittable after the Health request: \(header.exists ? "yes" : "header absent"); relaunching to end the unanswered request")
      }
      app.terminate()
      launch(["-AKUITestTrace", "1"])
      // The relaunch opens on Today; the steps below start from Profile.
      openProfile()
      log("after relaunch: Profile hittable=\(element("athlete-screen-shown").exists && element("header-athlete").isHittable)")
    }

    let before = expandCoachMode()
    XCTAssertTrue(before.hasPrefix("Coach mode, 1 athletes"), "expected one athlete before adding: \(before)")
    enterText(into: "New athlete's name", "UITest B")
    tap("Add a new athlete")
    completeOnboarding("athlete B")
    openProfile()
    XCTAssertNil(findHealthSheetButton("Don’t Allow", timeout: 5),
                   "a new athlete reopened the Health permission sheet")
    let hintB = element(labelBeginsWith: "Apple Health")
    wait(hintB, "athlete B's Apple Health wording")
    log("health wording (B): \(hintB.label.prefix(160))")
    XCTAssertFalse(hintB.label.contains("Connected"), "athlete B's wording claimed access: \(hintB.label)")

    let afterAdd = expandCoachMode()
    XCTAssertTrue(afterAdd.hasPrefix("Coach mode, 2 athletes"), "expected two athletes after adding: \(afterAdd)")
    XCTAssertTrue(element("Athlete UITest B, active").exists, "the new athlete is not the active one")
    let other = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label BEGINSWITH 'Athlete ' AND label ENDSWITH ', tap to switch'")).firstMatch
    reveal(other, "athlete A in the switcher")
    let otherLabel = other.label
    other.tap()
    log("switched: \(otherLabel)")
    wait(element("shell-root"), "the shell after switching back")
    openProfile()
    XCTAssertNil(findHealthSheetButton("Don’t Allow", timeout: 5),
                   "switching athlete reopened the Health permission sheet")
    let hintBack = answered
      ? settledLabel(element(labelBeginsWith: "Apple Health access requested"),
                     beginsWith: "Apple Health access requested", "health wording after switching back (A)", timeout: 30)
      : { () -> String in
          let el = wait(healthWording(), "athlete A's Apple Health wording after switching back")
          let label = el.exists ? el.label : "<absent>"
          log("health wording after switching back (A, not answered): \(label.prefix(220))")
          return label
        }()
    XCTAssertFalse(hintBack.contains("Connected") || hintBack.contains("granted"), "athlete A's wording claimed access after the switch: \(hintBack)")
    let switched = expandCoachMode()
    XCTAssertTrue(switched.hasPrefix("Coach mode, 2 athletes"), "an athlete was lost across the switch: \(switched)")
    XCTAssertTrue(element("Athlete UITest B, tap to switch").exists, "athlete B is not listed as switchable after switching to A")
  }

  /// An encrypted backup saved to Files, a change, a cancelled Files sheet,
  /// then a restore of the saved .pmbak picked in Files: the preview and the
  /// restored data are the earlier snapshot.
  func test4_backupToFilesAndRestore() throws {
    launch()
    completeOnboarding("backup athlete")
    openProfile()
    let password = "correct horse battery staple"
    enterText(into: "Backup password, at least 12 characters", password)
    enterText(into: "Confirm backup password", password)
    tap("create-backup-button", "CREATE ENCRYPTED BACKUP")
    saveInFiles()
    settledLabel(element("backup-status-message"), beginsWith: "Encrypted backup saved to the location you chose",
                 "backup status after saving")

    // A change after the backup: a second athlete (Coach Mode).
    let before = expandCoachMode()
    XCTAssertTrue(before.hasPrefix("Coach mode, 1 athletes"), "expected one athlete at backup time: \(before)")
    enterText(into: "New athlete's name", "After Backup")
    tap("Add a new athlete")
    completeOnboarding("athlete added after the backup")
    openProfile()
    XCTAssertTrue(expandCoachMode().hasPrefix("Coach mode, 2 athletes"), "the post-backup athlete was not added")

    // Restore. First the person backs out of the Files sheet: nothing changes.
    enterText(into: "Backup password, at least 12 characters", password)
    tap("choose-restore-button", "RESTORE ENCRYPTED BACKUP")
    let cancel = filesControl(["Cancel", "Close"])
    if !cancel.waitForExistence(timeout: 30) { log("files sheet without Cancel: \(filesSheetInventory())") }
    wait(cancel, "the Files sheet's Cancel", timeout: 1)
    cancel.tap()
    settledLabel(element("backup-status-message"), beginsWith: "Restore cancelled. Your data is unchanged.",
                 "status after cancelling the Files sheet", timeout: 30)
    // Then the same password, the saved .pmbak picked in Files, preview, confirm.
    tap("choose-restore-button", "RESTORE ENCRYPTED BACKUP")
    pickBackupInFiles()
    let databases = element(labelBeginsWith: "1 athlete database ")
    wait(databases, "the preview's database count (one athlete at backup time)")
    let names = element(labelBeginsWith: "Athletes: ")
    wait(names, "the preview's athlete list")
    log("restore preview: \(databases.label) / \(names.label)")
    XCTAssertFalse(names.label.contains("After Backup"), "the preview lists an athlete created after the backup: \(names.label)")
    tap("confirm-restore-button", "CONFIRM REPLACE ALL DATA")
    // Restore seals and twice authenticates a recovery copy (scrypt N=65536
    // in JavaScript on Hermes): slow on the CI simulator. Each stage's time is
    // recorded as evidence; the bound is 15 minutes.
    let restoreStatus = element("backup-status-message")
    let restoreStart = Date()
    var lastRestoreStatus = ""
    while Date().timeIntervalSince(restoreStart) < 900 {
      // The restore reopens the app on the restored active athlete; without a
      // program that athlete is offered set-up, which covers the Profile.
      // Checked first: while the offer is up, its text is not a status
      // (CI evidence c5cf82c: "Box Squat — 3×10" was read as the status).
      if element("Cancel").exists && element("Create program").exists {
        log("restore t=\(Int(Date().timeIntervalSince(restoreStart)))s: set-up offered for the restored athlete; cancelled")
        element("Cancel").tap()
        openProfile()
        continue
      }
      let now = currentLabel(restoreStatus) ?? "<absent>"
      if now != lastRestoreStatus {
        log("restore t=\(Int(Date().timeIntervalSince(restoreStart)))s: \(now.prefix(120))")
        lastRestoreStatus = now
      }
      // Only the app's own restore outcomes end the wait; any other text (an
      // overlay read mid-transition) means keep waiting.
      // "Restore cancelled." is the earlier Files-sheet result still on screen.
      if (now.hasPrefix("Restore ") && !now.hasPrefix("Restore cancelled")) || now.hasPrefix("A restored database") { break }
      sleep(2)
    }
    dismissSetUpOfferIfShown("after the restore")
    settledLabel(restoreStatus, beginsWith: "Restore complete.", "status after restore", timeout: 60)
    wait(element("shell-root"), "the app after restore")
    openProfile()
    let after = expandCoachMode()
    XCTAssertTrue(after.hasPrefix("Coach mode, 1 athletes"), "the restore did not bring back the one-athlete snapshot: \(after)")
    XCTAssertFalse(element(labelContains: "After Backup").exists, "the athlete added after the backup survived the restore")
  }

  /// A workout through the real session screen: start, skip preparation, log
  /// the first set, leave the app and come back, then a cold relaunch resumes
  /// the same session at the same next step (the logged set was kept).
  func test5_workoutLogBackgroundAndRelaunch() throws {
    launch()
    completeOnboarding("workout athlete", createProgram: true)
    tap("tab-today", "Today")
    let planned = element("today-primary-start")
    let unplanned = element("today-adhoc-session")
    if planned.waitForExistence(timeout: 15) {
      reveal(planned, "today's planned session"); planned.tap(); log("today: planned session started")
    } else if unplanned.exists {
      reveal(unplanned, "an unplanned session"); unplanned.tap(); log("today: unplanned session started (\(unplanned.label))")
    } else {
      log("today: no start control; workout tab used")
      tap("header-session", "Workout")
      tap("Start a new workout session")
    }
    let skip = element("preparation-skip")
    if skip.waitForExistence(timeout: 20) { reveal(skip, "Skip preparation"); skip.tap(); log("preparation: skipped") }
    else { log("preparation: not offered for this session") }
    let first = element(labelBeginsWith: "Log set 1 for ")
    if !first.waitForExistence(timeout: 30) {
      let empty = element("No movements are planned yet.")
      log("session: no Log set control; empty plan shown=\(empty.exists)")
      XCTFail("the first set's Log set control did not appear within 30 s")
      return
    }
    log("first set: \(first.label)")
    if first.label.hasSuffix("enter a load first") {
      enterText(into: "session-load-input", "20", submit: false)
      let title = element("Your next step")
      if title.exists && title.isHittable { title.tap() } // dismiss the number pad
      log("load entered: 20 kg")
    }
    let reps = element("2 clean reps left")
    if reps.waitForExistence(timeout: 5) { reveal(reps, "2 clean reps left"); reps.tap() }
    let ready = element(labelBeginsWith: "Log set 1 for ")
    reveal(ready, "Log set 1")
    XCTAssertFalse(ready.label.contains("unavailable"), "the first set cannot be logged: \(ready.label)")
    let firstLabel = ready.label
    ready.tap()
    // A logged set starts the rest timer; the person may skip it.
    let readyNow = element("Ready now, skip the rest timer")
    if readyNow.waitForExistence(timeout: 10) {
      log("rest timer shown after the set; skipped with Ready now")
      reveal(readyNow, "Ready now"); readyNow.tap()
    }
    let next = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label BEGINSWITH 'Log set ' AND label != %@", firstLabel)).firstMatch
    wait(next, "the next set after logging the first")
    let nextLabel = next.label.components(separatedBy: ", unavailable")[0]
    log("after logging: \(next.label)")

    // Leave the app and return: the same step is still showing.
    XCUIDevice.shared.press(.home)
    sleep(3)
    app.activate()
    wait(element(labelBeginsWith: nextLabel), "the same next step after returning to the app")
    log("background and return: kept \(nextLabel)")

    // Cold relaunch: the session resumes with the first set kept.
    app.terminate()
    launch()
    let resume = element("today-primary-resume")
    if resume.waitForExistence(timeout: 30) { resume.tap(); log("relaunch: Today offered Resume") }
    else { tap("header-session", "Workout (after relaunch)") }
    let restAgain = element("Ready now, skip the rest timer")
    if restAgain.waitForExistence(timeout: 5) { reveal(restAgain, "Ready now (after relaunch)"); restAgain.tap(); log("relaunch: rest timer skipped") }
    wait(element(labelBeginsWith: nextLabel), "the resumed session at the same next step after relaunch", timeout: 60)
    XCTAssertFalse(element(labelBeginsWith: firstLabel + ",").exists || element(firstLabel).exists,
                   "the logged first set was lost across the relaunch")
    log("relaunch: resumed at \(nextLabel)")
  }

  // MARK: - Files

  /// A control of the Files sheet by its visible name. Up to iOS 26 these are
  /// buttons; on iOS 27 "Save" was on screen with no Button of that name (CI
  /// evidence 3f126c3), so a button is preferred and any element carrying the
  /// name is accepted.
  private func filesControl(_ names: [String]) -> XCUIElement {
    let named = NSPredicate(format: "label IN %@ OR identifier IN %@", names, names)
    let button = app.buttons.matching(named).firstMatch
    return button.exists ? button : app.descendants(matching: .any).matching(named).firstMatch
  }

  /// What the Files sheet exposes: the elements of its bar by type, label and
  /// identifier, and the last buttons in the tree (the sheet's follow the app's).
  private func filesSheetInventory() -> String {
    let bar = app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS 'DocumentManager'")).firstMatch
    let inBar = !bar.exists ? "absent" : bar.descendants(matching: .any).allElementsBoundByIndex.prefix(30)
      .map { "\($0.elementType.rawValue):\($0.label.prefix(30))|\($0.identifier.prefix(30))" }.joined(separator: "; ")
    let lastButtons = app.buttons.allElementsBoundByIndex.suffix(20)
      .map { String(($0.label.isEmpty ? $0.identifier : $0.label).prefix(30)) }.joined(separator: "; ")
    return "bar[\(inBar)] last buttons[\(lastButtons)]"
  }

  private func onMyIPhone() {
    let browse = app.buttons.matching(identifier: "Browse").firstMatch
    if browse.waitForExistence(timeout: 10) && !browse.isSelected { browse.tap() }
    let local = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label == 'On My iPhone' OR label == 'On My iPad'")).firstMatch
    if local.waitForExistence(timeout: 20) {
      local.tap()
    } else {
      // The sheet may already be at its only local location; what it shows is
      // recorded, and the save/pick and final status assertions still decide.
      log("files sheet without 'On My iPhone': app{\(visibleLabels(app))}")
    }
  }

  private func saveInFiles() {
    // Encrypting the snapshot (scrypt) precedes the sheet: wait for the sheet
    // or a final status, up to 5 minutes (150 s was measured on CI, c3e7de5),
    // recording the status as it goes.
    let status = element("backup-status-message")
    let deadline = Date().addingTimeInterval(300)
    var lastStatus = ""
    while Date() < deadline {
      if filesControl(["Save", "Move", "Done", "Open", "Cancel"]).exists { break }
      if status.exists && status.label != lastStatus {
        lastStatus = status.label
        log("backup status while waiting for the Files sheet: \(lastStatus.prefix(160))")
        if !lastStatus.hasPrefix("Creating") { break }
      }
      sleep(2)
    }
    // UIDocumentPickerViewController (export, as a copy) into On My iPhone.
    onMyIPhone()
    for name in ["Save", "Move", "Done", "Open"] {
      let b = filesControl([name])
      if b.waitForExistence(timeout: 5) && b.isEnabled {
        b.tap()
        log("files export: \(name)")
        return
      }
    }
    log("files sheet without an enabled Save/Move action: \(filesSheetInventory()); status=\(element("backup-status-message").exists ? element("backup-status-message").label : "-")")
    XCTFail("the Files export sheet had no enabled Save/Move action")
  }

  private func pickBackupInFiles() {
    onMyIPhone()
    let file = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label BEGINSWITH 'pikeMethods-' AND NOT (label CONTAINS 'recovery')")).firstMatch
    wait(file, "the saved backup file in Files", timeout: 30)
    log("files import: picking \(file.label)")
    file.tap()
    let open = filesControl(["Open"])
    if open.waitForExistence(timeout: 5) && open.isEnabled { open.tap() }
    // Reading the backup derives its key (scrypt in JavaScript on Hermes), the
    // same work as creating it. CI evidence c3e7de5 (Xcode 26 row): creating
    // took 150 s and the preview, bounded at 120 s, arrived after the bound.
    // The time taken is recorded; the bound is 5 minutes.
    let previewStart = Date()
    wait(element("restore-preview"), "the restore preview", timeout: 300)
    log("restore preview shown after \(Int(Date().timeIntervalSince(previewStart))) s")
  }
}
