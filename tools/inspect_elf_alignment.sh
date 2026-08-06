#!/usr/bin/env bash
# inspect_elf_alignment.sh — per-library ELF PT_LOAD alignment audit for a
# debug/release APK (Android 16 KB page-size compatibility, AUD-A16).
# FAIL-CLOSED: exits non-zero unless it actually inspected >= 1 library and
# every inspected 64-bit library has a LOAD alignment of 0x4000 (16384).
#
# Usage: bash tools/inspect_elf_alignment.sh <apk-path>
set -euo pipefail

APK="${1:-}"
if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "ERROR: APK path required and must exist: '$APK'" >&2
  exit 2
fi

# --- dependency checks -------------------------------------------------------
for tool in unzip tail awk sort grep find; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: missing required tool: $tool" >&2; exit 2; }
done
READELF="$ANDROID_HOME/ndk/27.1.12297006/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-readelf.exe"
ZIPALIGN="$ANDROID_HOME/build-tools/36.0.0/zipalign.exe"
for bin in "$READELF" "$ZIPALIGN"; do
  [ -x "$bin" ] || { echo "ERROR: missing required binary: $bin" >&2; exit 2; }
done

ROOT="$(pwd)"
WORK="$ROOT/.audit-apk"
WINROOT="$(cygpath -w "$WORK" 2>/dev/null || echo "$WORK")"
rm -rf "$WORK"
mkdir -p "$WORK"

# --- extraction (validated) ---------------------------------------------------
if ! unzip -q "$APK" 'lib/*/*.so' -d "$WORK" 2>/dev/null; then
  echo "ERROR: failed to extract lib/*/*.so from APK" >&2
  rm -rf "$WORK"
  exit 2
fi

mapfile -t LIBS < <(find "$WORK" -name '*.so' | sort)
if [ "${#LIBS[@]}" -eq 0 ]; then
  echo "ERROR: APK contains ZERO native libraries — cannot certify alignment" >&2
  rm -rf "$WORK"
  exit 2
fi
echo "Inspected APK: $APK"
echo "Native libraries found: ${#LIBS[@]}"
echo

echo "=== zipalign -P 16 check ==="
if "$ZIPALIGN" -c -P 16 4 "$APK" 2>&1; then
  echo "zipalign -P 16: PASS"
else
  echo "zipalign -P 16: FAIL" >&2
fi
echo

# --- per-library ELF PT_LOAD alignment ----------------------------------------
echo "=== per-library PT_LOAD alignment (64-bit ABIs require 0x4000) ==="
printf '%-55s %-12s %-6s %s\n' "LIBRARY" "ALIGN" "OK?" "MACHINE"

FAIL=0
INSPECTED=0
for so in "${LIBS[@]}"; do
  rel="${so#"$WORK"/}"
  win="$WINROOT/${rel//\//\\}"

  # Machine class: only 64-bit ABIs are subject to Android's 16 KB requirement.
  machine=$("$READELF" -h "$win" 2>/dev/null | awk '/Machine:/ {print $2}') || machine="UNKNOWN"
  elfclass=$("$READELF" -h "$win" 2>/dev/null | awk '/Class:/ {print $2}') || elfclass="UNKNOWN"
  # All distinct LOAD p_align values, comma-joined.
  align=$("$READELF" -l "$win" 2>/dev/null | awk '/LOAD/ {print $NF}' | sort -u | tr '\n' ',' | sed 's/,$//')

  if [ -z "$align" ]; then
    echo "ERROR: readelf returned no LOAD segments for $rel — cannot certify" >&2
    FAIL=1
    printf '%-55s %-12s %-6s %s\n' "$rel" "NONE" "NO" "$machine/$elfclass"
    continue
  fi

  # 32-bit ABIs are legacy (16 KB devices are 64-bit-only); flag them but do
  # not fail the 64-bit certification on them.
  case "$elfclass" in
    ELF64) INSPECTED=$((INSPECTED + 1)) ;;
    *)     printf '%-55s %-12s %-6s %s\n' "$rel" "$align" "n/a" "$machine/$elfclass (32-bit, out of scope)"; continue ;;
  esac

  ok="NO"
  case "$align" in
    *0x4000*) ok="YES" ;;
    *) FAIL=1 ;;
  esac
  printf '%-55s %-12s %-6s %s\n' "$rel" "$align" "$ok" "$machine"
done

echo
if [ "$INSPECTED" -eq 0 ]; then
  echo "ERROR: zero 64-bit libraries inspected — cannot certify" >&2
  FAIL=1
fi
if [ "$FAIL" = "1" ]; then
  echo "RESULT: FAIL — 16 KB INCOMPATIBLE (or inspection incomplete)" >&2
else
  echo "RESULT: PASS — all $INSPECTED 64-bit libraries are 16 KB-aligned"
fi
rm -rf "$WORK"
exit $FAIL
