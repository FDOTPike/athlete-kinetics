#!/bin/bash
# ios_simulator_smoke.sh — install and launch the unsigned simulator build in a
# fresh simulator with -AKNativeSmoke 1, then collect and assert the in-app
# native smoke report (apps/mobile/src/diagnostics/nativeSmoke.ts).
#
#   tools/ios_simulator_smoke.sh <App.app> <bundle-id> <out-dir>
#
# Fails closed: no report within the timeout, a report with ok=false, or the
# app exiting early are all failures. Evidence (report, console capture,
# simulator identity) is written to <out-dir> for upload.
set -euo pipefail
APP="$1"; BUNDLE_ID="$2"; OUT="$3"
TIMEOUT_S="${AK_SMOKE_TIMEOUT_S:-600}"  # above the in-app bound (each step <= 90 s)
mkdir -p "$OUT"
# Any failing command is published as an API-visible annotation (job logs and
# artifacts are not reachable from every reviewer environment).
trap 'code=$?; echo "::error title=native smoke::line $LINENO exit $code: $BASH_COMMAND"' ERR

# The newest available iOS runtime, and an iPhone that runtime itself lists as
# supported (an arbitrary device type may not run on the newest runtime).
# The full inventory is kept as evidence of what the runner offered.
xcrun simctl list -j runtimes devicetypes > "$OUT/simctl-inventory.json"
read -r RUNTIME DEVICE_TYPE < <(node tools/ios_sim_select.mjs "$OUT/simctl-inventory.json")
echo "runtime=$RUNTIME deviceType=$DEVICE_TYPE"
printf '{"runtime":"%s","deviceType":"%s"}\n' "$RUNTIME" "$DEVICE_TYPE" > "$OUT/simulator-selection.json"
if ! UDID=$(xcrun simctl create ak-smoke-device "$DEVICE_TYPE" "$RUNTIME" 2> "$OUT/simctl-create.err"); then
  echo "::error title=native smoke::simctl create failed for $DEVICE_TYPE on $RUNTIME: $(tr '\n' ' ' < "$OUT/simctl-create.err" | cut -c1-600)"
  exit 1
fi
cleanup() { xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true; xcrun simctl delete "$UDID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
printf '{"runtime":"%s","deviceType":"%s","udid":"%s"}\n' "$RUNTIME" "$DEVICE_TYPE" "$UDID" > "$OUT/simulator.json"

xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
# Console capture runs in the background; the report file is the primary signal.
xcrun simctl launch --console --terminate-running-process "$UDID" "$BUNDLE_ID" -AKNativeSmoke 1 \
  > "$OUT/console.log" 2>&1 &
LAUNCH_PID=$!

DATA=""
REPORT=""
for ((i = 0; i < TIMEOUT_S; i += 2)); do
  if [ -z "$DATA" ]; then DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data 2>/dev/null || true); fi
  if [ -n "$DATA" ] && [ -f "$DATA/Documents/ak-native-smoke.json" ]; then REPORT="$DATA/Documents/ak-native-smoke.json"; break; fi
  if ! kill -0 "$LAUNCH_PID" 2>/dev/null && ! grep -q "ak-native-smoke" "$OUT/console.log"; then
    echo "error: the app exited before producing a smoke report" >&2
    break
  fi
  sleep 2
done
kill "$LAUNCH_PID" >/dev/null 2>&1 || true

if [ -z "$REPORT" ]; then
  # Diagnostics for a missing report, each published as an annotation: did the
  # smoke start, is the app still running, did it crash, what did it log.
  DATA=${DATA:-$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data 2>/dev/null || true)}
  if [ -n "$DATA" ] && [ -f "$DATA/Documents/ak-native-smoke.started" ]; then STARTED=yes; else STARTED=no; fi
  RUNNING=$(xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -c "$BUNDLE_ID" || true)
  echo "::error title=native smoke::no report within ${TIMEOUT_S}s (smoke started=$STARTED, app processes running=$RUNNING)"
  xcrun simctl spawn "$UDID" log show --last 20m --style compact \
    --predicate "process == \"AthleteKinetics\" OR eventMessage CONTAINS \"ak-native-smoke\"" > "$OUT/app-system-log.txt" 2>&1 || true
  grep -iE "ak-native-smoke|fault|error|exception|terminat" "$OUT/app-system-log.txt" | tail -6 | cut -c1-400 \
    | while IFS= read -r line; do echo "::error title=native smoke app log::$line"; done || true
  mkdir -p "$OUT/crash-reports"
  find "$HOME/Library/Logs/DiagnosticReports" -name 'AthleteKinetics*' -newer "$OUT/simulator-selection.json" -exec cp {} "$OUT/crash-reports/" \; 2>/dev/null || true
  for crash in "$OUT"/crash-reports/*; do
    [ -f "$crash" ] || continue
    grep -E '"exception"|"termination"|"type"|"signal"|"codes"|Exception Type|Termination Reason|Crashed Thread' "$crash" | head -6 | cut -c1-400 \
      | while IFS= read -r line; do echo "::error title=native smoke crash::$(basename "$crash"): $line"; done || true
  done
  # Fallback channel: the console marker.
  if grep -o '\[ak-native-smoke\] .*' "$OUT/console.log" | head -1 | sed 's/^\[ak-native-smoke\] //' > "$OUT/native-smoke.json" && [ -s "$OUT/native-smoke.json" ]; then
    echo "report recovered from the console marker"
  else
    echo "error: no native smoke report within ${TIMEOUT_S}s" >&2
    tail -50 "$OUT/console.log" >&2 || true
    tail -5 "$OUT/console.log" 2>/dev/null | cut -c1-400 | while IFS= read -r line; do echo "::error title=native smoke console::$line"; done
    exit 1
  fi
else
  cp "$REPORT" "$OUT/native-smoke.json"
fi

# Real resource values of the app's own data directories, read back from the
# simulator container on the host by Foundation (the same on-disk flag iOS
# backup honours), after the app's startup exclusion ran. The raw extended
# attributes are kept as evidence.
if [ -z "$DATA" ]; then DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data 2>/dev/null || true); fi
if [ -z "$DATA" ]; then echo "error: app data container not found" >&2; exit 1; fi
cat > "$OUT/backup-exclusion.swift" <<'SWIFT'
import Foundation
var ok = true
var rows: [String] = []
for path in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: path, isDirectory: true)
  let excluded = (try? url.resourceValues(forKeys: [.isExcludedFromBackupKey]))?.isExcludedFromBackup
  if excluded != true { ok = false }
  rows.append("{\"path\":\"\(url.lastPathComponent)\",\"isExcludedFromBackup\":\(excluded.map { String($0) } ?? "null")}")
}
print("{\"schema\":\"ak.ios-backup-exclusion/1\",\"ok\":\(ok),\"directories\":[\(rows.joined(separator: ","))]}")
exit(ok ? 0 : 1)
SWIFT
xattr -l "$DATA/Documents" "$DATA/Library" > "$OUT/backup-exclusion.xattr.txt" 2>&1 || true
if xcrun swift "$OUT/backup-exclusion.swift" "$DATA/Documents" "$DATA/Library" > "$OUT/backup-exclusion.json"; then
  echo "BACKUP EXCLUSION VERIFIED: $(cat "$OUT/backup-exclusion.json")"
  echo "::notice title=native smoke backup exclusion::$(cat "$OUT/backup-exclusion.json")"
else
  echo "error: Documents/Library are not excluded from backup: $(cat "$OUT/backup-exclusion.json")" >&2
  exit 1
fi

node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const c of r.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}  [${c.detail}]`);
  for (const c of r.checks.filter((x) => !x.ok)) console.log(`::error title=native smoke check::${c.name}: ${String(c.detail).slice(0, 400)}`);
  // Passed checks too, so the result is readable through the API, not only the artifact.
  for (const c of r.checks.filter((x) => x.ok)) console.log(`::notice title=native smoke check::PASS ${c.name}: ${String(c.detail).slice(0, 300)}`);
  // Every expected check must be present: a dropped check is a failure, not a pass.
  const required = ["sqlite math functions", "fresh migration chain", "embedder inference + routing",
    "native CSPRNG (backup provider)", "device backup exclusion at startup", "Files import types resolve natively", "store boot"];
  const missing = required.filter((name) => !r.checks.some((c) => c.name === name));
  for (const name of missing) console.log(`::error title=native smoke check::missing check: ${name}`);
  if (r.schema !== "ak.native-smoke/1" || r.ok !== true || missing.length > 0) { console.error("NATIVE SMOKE FAILED"); process.exit(1); }
  console.log("NATIVE SMOKE PASSED");
' "$OUT/native-smoke.json"
