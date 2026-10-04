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

  /// Replaces the field's text, then submits (single-line fields blur on
  /// return, so the keyboard never covers the next control).
  private func enterText(into key: String, _ text: String, submit: Bool = true) {
    let el = element(key)
    reveal(el, key)
    el.tap()
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
  private func completeOnboarding(_ who: String) {
    wait(element("Next"), "onboarding (\(who))", timeout: 60)
    log("onboarding started (\(who)): progress=\(element(labelBeginsWith: "Step ").exists ? element(labelBeginsWith: "Step ").label : "-")")
    for step in 1...6 { tap("Next", "Next (step \(step), \(who))") }
    tap("No, nothing to note")
    tap("Next", "Next to review (\(who))")
    tap("START TRAINING")
    // The program set-up offer is optional; this flow keeps it for later.
    let cancel = element("Cancel")
    if cancel.waitForExistence(timeout: 8) { cancel.tap(); log("program set-up offer: cancelled (\(who))") }
    wait(element("shell-primary-tabs"), "the primary tabs after onboarding (\(who))", timeout: 60)
    log("onboarding complete: \(who)")
  }

  private func openProfile() {
    tap("header-athlete", "Profile")
    wait(element("athlete-screen-shown"), "the Profile screen")
  }

  private func unlockAdvancedTools() {
    if element("advanced-athlete-manager").exists { return }
    let build = element("Build 0.1.0")
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
      XCTAssertTrue(element(key).isSelected, "\(screen) control is not marked selected after tapping it")
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
    launch()
    completeOnboarding("athlete A")
    openProfile()
    let idle = element(labelBeginsWith: "Apple Health is available.")
    wait(idle, "the Apple Health 'available' wording before any request")
    tap("Choose whether to share sleep and resting heart rate from Apple Health", "Apple Health CONNECT")
    guard let dontAllow = findHealthSheetButton("Don’t Allow", timeout: 30) else {
      let hint = element(labelBeginsWith: "Apple Health")
      log("health after CONNECT: no Don't Allow in the app or SpringBoard; hint=\(hint.exists ? String(hint.label.prefix(200)) : "-")")
      XCTFail("HealthKit's permission sheet (Don't Allow) did not appear within 30 s")
      return
    }
    log("health sheet shown: allow=\(healthPermissionButton("Allow").exists) dontAllow=true")
    dontAllow.tap()
    log("health sheet: tapped Don't Allow")
    // HealthKit never tells an app that reading was denied, so the honest
    // wording is 'requested' plus where to check — never 'connected'.
    let hintA = settledLabel(element(labelBeginsWith: "Apple Health access requested"),
                             beginsWith: "Apple Health access requested", "health wording after denial (A)", timeout: 30)
    XCTAssertTrue(hintA.contains("does not tell apps whether you allowed reading"), "the denial-safe explanation is missing: \(hintA)")
    for claim in ["Connected", "granted"] {
      XCTAssertFalse(hintA.contains(claim), "after a denial the wording claimed access ('\(claim)'): \(hintA)")
    }
    XCTAssertFalse(dontAllow.exists, "the permission sheet stayed open")

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
    let hintBack = settledLabel(element(labelBeginsWith: "Apple Health access requested"),
                                beginsWith: "Apple Health access requested", "health wording after switching back (A)", timeout: 30)
    XCTAssertFalse(hintBack.contains("Connected"), "athlete A's wording claimed access after the switch: \(hintBack)")
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
    let cancel = app.buttons["Cancel"]
    wait(cancel, "the Files sheet's Cancel", timeout: 30)
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
    settledLabel(element("backup-status-message"), beginsWith: "Restore complete.", "status after restore", timeout: 180)
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
    completeOnboarding("workout athlete")
    tap("header-session", "Workout")
    tap("Start a new workout session")
    let skip = element("preparation-skip")
    if skip.waitForExistence(timeout: 20) { reveal(skip, "Skip preparation"); skip.tap(); log("preparation: skipped") }
    else { log("preparation: not offered for this session") }
    let first = element(labelBeginsWith: "Log set 1 for ")
    wait(first, "the first set's Log set control", timeout: 30)
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
    wait(element(labelBeginsWith: nextLabel), "the resumed session at the same next step after relaunch", timeout: 60)
    XCTAssertFalse(element(labelBeginsWith: firstLabel + ",").exists || element(firstLabel).exists,
                   "the logged first set was lost across the relaunch")
    log("relaunch: resumed at \(nextLabel)")
  }

  // MARK: - Files

  private func onMyIPhone() {
    let browse = app.buttons["Browse"]
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
    // UIDocumentPickerViewController (export, as a copy) into On My iPhone.
    onMyIPhone()
    for name in ["Save", "Move", "Done", "Open"] {
      let b = app.buttons[name]
      if b.waitForExistence(timeout: 5) && b.isEnabled {
        b.tap()
        log("files export: \(name)")
        return
      }
    }
    XCTFail("the Files export sheet had no enabled Save/Move action")
  }

  private func pickBackupInFiles() {
    onMyIPhone()
    let file = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label BEGINSWITH 'pikeMethods-' AND NOT (label CONTAINS 'recovery')")).firstMatch
    wait(file, "the saved backup file in Files", timeout: 30)
    log("files import: picking \(file.label)")
    file.tap()
    let open = app.buttons["Open"]
    if open.waitForExistence(timeout: 5) && open.isEnabled { open.tap() }
    wait(element("restore-preview"), "the restore preview", timeout: 120)
  }
}
