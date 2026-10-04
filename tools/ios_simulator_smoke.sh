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
TIMEOUT_S="${AK_SMOKE_TIMEOUT_S:-240}"
mkdir -p "$OUT"

RUNTIME=$(xcrun simctl list runtimes -j | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    const rs=JSON.parse(s).runtimes.filter(r=>r.isAvailable&&r.platform==="iOS")
      .sort((a,b)=>a.version.localeCompare(b.version,undefined,{numeric:true}));
    if(!rs.length){console.error("no available iOS simulator runtime");process.exit(1);}
    process.stdout.write(rs.at(-1).identifier);
  });')
DEVICE_TYPE=$(xcrun simctl list devicetypes -j | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    const ts=JSON.parse(s).devicetypes.filter(t=>/^iPhone \d+( Pro)?$/.test(t.name));
    if(!ts.length){console.error("no iPhone device type");process.exit(1);}
    process.stdout.write(ts.at(-1).identifier);
  });')
UDID=$(xcrun simctl create ak-native-smoke "$DEVICE_TYPE" "$RUNTIME")
cleanup() { xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true; xcrun simctl delete "$UDID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
printf '{"runtime":"%s","deviceType":"%s","udid":"%s"}\n' "$RUNTIME" "$DEVICE_TYPE" "$UDID" > "$OUT/simulator.json"

xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
# Console capture runs in the background; the report file is the primary signal.
xcrun simctl launch --console-pty --terminate-running-process "$UDID" "$BUNDLE_ID" -AKNativeSmoke 1 \
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
  # Fallback channel: the console marker.
  if grep -o '\[ak-native-smoke\] .*' "$OUT/console.log" | head -1 | sed 's/^\[ak-native-smoke\] //' > "$OUT/native-smoke.json" && [ -s "$OUT/native-smoke.json" ]; then
    echo "report recovered from the console marker"
  else
    echo "error: no native smoke report within ${TIMEOUT_S}s" >&2
    tail -50 "$OUT/console.log" >&2 || true
    exit 1
  fi
else
  cp "$REPORT" "$OUT/native-smoke.json"
fi

node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const c of r.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}  [${c.detail}]`);
  if (r.schema !== "ak.native-smoke/1" || r.ok !== true) { console.error("NATIVE SMOKE FAILED"); process.exit(1); }
  console.log("NATIVE SMOKE PASSED");
' "$OUT/native-smoke.json"
