#!/bin/bash
# ios_ui_tests.sh — run the XCUITest user-interaction suite
# (apps/mobile/ios/AthleteKineticsUITests) against the Release simulator build
# on a fresh simulator, one test per freshly installed app.
#
#   tools/ios_ui_tests.sh <file.xctestrun> <App.app> <bundle-id> <out-dir>
#
# Every test runs even when an earlier one fails; the script fails closed at
# the end if any test failed, produced no result, or the app opened a network
# socket. Evidence: one .xcresult and log per test, the AKUI observation lines,
# and the per-second socket samples of the app process. Results are also
# published as annotations (job logs and artifacts are not reachable from
# every reviewer environment).
set -euo pipefail
XCTESTRUN="$1"; APP="$2"; BUNDLE_ID="$3"; OUT="$4"
TESTS=(
  test1_onboardingNavigationAndAccessibility
  test2_dynamicTypeScalesText
  test3_healthDenialAndAthleteSwitching
  test4_backupToFilesAndRestore
  test5_workoutLogBackgroundAndRelaunch
)
mkdir -p "$OUT"
trap 'code=$?; echo "::error title=ui tests::line $LINENO exit $code: $BASH_COMMAND"' ERR

xcrun simctl list -j runtimes devicetypes > "$OUT/simctl-inventory.json"
read -r RUNTIME DEVICE_TYPE < <(node tools/ios_sim_select.mjs "$OUT/simctl-inventory.json")
if ! UDID=$(xcrun simctl create ak-uitest-device "$DEVICE_TYPE" "$RUNTIME" 2> "$OUT/simctl-create.err"); then
  echo "::error title=ui tests::simctl create failed for $DEVICE_TYPE on $RUNTIME: $(tr '\n' ' ' < "$OUT/simctl-create.err" | cut -c1-600)"
  exit 1
fi
SAMPLER_PID=""
cleanup() {
  [ -n "$SAMPLER_PID" ] && kill "$SAMPLER_PID" >/dev/null 2>&1 || true
  xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
  xcrun simctl delete "$UDID" >/dev/null 2>&1 || true
}
trap cleanup EXIT
printf '{"runtime":"%s","deviceType":"%s","udid":"%s"}\n' "$RUNTIME" "$DEVICE_TYPE" "$UDID" > "$OUT/simulator.json"
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b

# Offline evidence: once a second, every internet socket the app process holds
# (TCP or UDP, any state). The simulator shares the host's network, so this
# observes behaviour rather than enforcing isolation.
(
  while true; do
    for pid in $(pgrep -f 'AthleteKinetics\.app/AthleteKinetics( |$)' 2>/dev/null || true); do
      echo "sample $(date -u +%H:%M:%S) pid=$pid"
      lsof -nP -a -i -p "$pid" 2>/dev/null | tail -n +2 | sed 's/^/socket /' || true
    done
    sleep 1
  done
) > "$OUT/network-samples.log" 2>&1 &
SAMPLER_PID=$!

FAILED=0
for test in "${TESTS[@]}"; do
  # A fresh install per test: no state carries between tests.
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$UDID" "$APP"
  echo "== $test"
  # System log for the app and HealthKit during the test (evidence for the
  # permission flow; content-free system messages).
  xcrun simctl spawn "$UDID" log stream --style compact --level debug \
    --predicate 'process == "AthleteKinetics" OR process == "healthd" OR subsystem BEGINSWITH "com.apple.healthkit"' \
    > "$OUT/$test.system.log" 2>&1 &
  LOG_PID=$!
  # A failing test is reported once, by the annotator below (not the ERR trap).
  code=0
  xcodebuild test-without-building -xctestrun "$XCTESTRUN" \
    -destination "id=$UDID" -resultBundlePath "$OUT/$test.xcresult" \
    -only-testing:"AthleteKineticsUITests/AthleteKineticsUITests/$test" \
    > "$OUT/$test.log" 2>&1 || code=$?
  kill "$LOG_PID" >/dev/null 2>&1 || true
  echo "$test exit=$code"
  if [ "$code" -ne 0 ] && [ "$test" = test3_healthDenialAndAthleteSwitching ]; then
    grep -iE 'authoriz|requestAuth|prompt|HKHealthStore|ak-health' "$OUT/$test.system.log" | tail -25 | cut -c1-240 > "$OUT/$test.health-excerpt.txt" || true
    echo "::warning title=ui $test system log (HealthKit)::$(tr '\n' '~' < "$OUT/$test.health-excerpt.txt" | cut -c1-5500)"
  fi
  [ "$code" -eq 0 ] || FAILED=1
  node tools/ios_ui_annotate.mjs "$test" "$code" "$OUT/$test.log"
  if [ -d "$OUT/$test.xcresult" ]; then
    xcrun xcresulttool get test-results summary --path "$OUT/$test.xcresult" --compact > "$OUT/$test.summary.json" 2>/dev/null \
      || xcrun xcresulttool get test-results summary --path "$OUT/$test.xcresult" > "$OUT/$test.summary.json" 2>/dev/null || true
  fi
done

kill "$SAMPLER_PID" >/dev/null 2>&1 || true
SAMPLER_PID=""
SAMPLES=$(grep -c '^sample ' "$OUT/network-samples.log" || true)
SOCKETS=$(grep -c '^socket ' "$OUT/network-samples.log" || true)
printf '{"samples":%s,"socketLines":%s}\n' "${SAMPLES:-0}" "${SOCKETS:-0}" > "$OUT/network-summary.json"
if [ "${SAMPLES:-0}" -eq 0 ]; then
  echo "::error title=ui tests offline::the socket sampler never observed the app process"
  FAILED=1
elif [ "${SOCKETS:-0}" -gt 0 ]; then
  grep '^socket ' "$OUT/network-samples.log" | sort -u | head -8 | cut -c1-300 \
    | while IFS= read -r line; do echo "::error title=ui tests offline::$line"; done
  FAILED=1
else
  echo "::notice title=ui tests offline::$SAMPLES once-a-second samples of the app process across all UI tests: no internet socket (TCP/UDP) held at any sample"
fi
exit "$FAILED"
