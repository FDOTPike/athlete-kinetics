#!/usr/bin/env bash
# inspect_elf_alignment.sh — per-library ELF PT_LOAD alignment audit for a
# debug/release APK (Android 16 KB page-size compatibility, AUD-A16).
# FAIL-CLOSED: exits non-zero unless zipalign passes, at least one 64-bit
# library is inspected, and every PT_LOAD segment in every inspected library
# has alignment 0x4000 (16384).
#
# Usage: bash tools/inspect_elf_alignment.sh <apk-path>
set -euo pipefail

APK="${1:-}"
if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "ERROR: APK path required and must exist: '$APK'" >&2
  exit 2
fi
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set" >&2
  exit 2
fi

# --- dependency checks -------------------------------------------------------
for tool in unzip awk sort find sed tr; do
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
WINAPK="$(cygpath -w "$APK" 2>/dev/null || echo "$APK")"
cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT
rm -rf "$WORK"
mkdir -p "$WORK"

# --- extraction (validated) --------------------------------------------------
if ! unzip -q "$APK" 'lib/*/*.so' -d "$WORK" 2>/dev/null; then
  echo "ERROR: failed to extract lib/*/*.so from APK" >&2
  exit 2
fi

mapfile -t LIBS < <(find "$WORK" -name '*.so' | sort)
if [ "${#LIBS[@]}" -eq 0 ]; then
  echo "ERROR: APK contains ZERO native libraries — cannot certify alignment" >&2
  exit 2
fi
echo "Inspected APK: $APK"
echo "Native libraries found: ${#LIBS[@]}"
echo

FAIL=0
echo "=== zipalign -P 16 check ==="
if "$ZIPALIGN" -c -P 16 4 "$WINAPK" 2>&1; then
  echo "zipalign -P 16: PASS"
else
  echo "zipalign -P 16: FAIL" >&2
  FAIL=1
fi
echo

# --- per-library ELF PT_LOAD alignment ---------------------------------------
echo "=== per-library PT_LOAD alignment (64-bit ABIs require 0x4000) ==="
printf '%-55s %-12s %-6s %s\n' "LIBRARY" "ALIGN" "OK?" "MACHINE"

INSPECTED=0
for so in "${LIBS[@]}"; do
  rel="${so#"$WORK"/}"
  win="$WINROOT/${rel//\//\\}"

  if ! elf_header=$("$READELF" -h "$win" 2>/dev/null); then
    echo "ERROR: readelf failed to inspect $rel" >&2
    FAIL=1
    printf '%-55s %-12s %-6s %s\n' "$rel" "ERROR" "NO" "UNKNOWN"
    continue
  fi
  machine=$(printf '%s\n' "$elf_header" | awk '/Machine:/ {print $2}')
  elfclass=$(printf '%s\n' "$elf_header" | awk '/Class:/ {print $2}')
  machine="${machine:-UNKNOWN}"
  elfclass="${elfclass:-UNKNOWN}"

  case "$elfclass" in
    ELF64) INSPECTED=$((INSPECTED + 1)) ;;
    ELF32)
      printf '%-55s %-12s %-6s %s\n' "$rel" "n/a" "n/a" "$machine/$elfclass (32-bit, out of scope)"
      continue
      ;;
    *)
      echo "ERROR: unknown ELF class for $rel — cannot certify" >&2
      FAIL=1
      printf '%-55s %-12s %-6s %s\n' "$rel" "UNKNOWN" "NO" "$machine/$elfclass"
      continue
      ;;
  esac

  if ! program_headers=$("$READELF" -l "$win" 2>/dev/null); then
    echo "ERROR: readelf failed to inspect LOAD segments for $rel" >&2
    FAIL=1
    printf '%-55s %-12s %-6s %s\n' "$rel" "ERROR" "NO" "$machine/$elfclass"
    continue
  fi
  mapfile -t load_aligns < <(printf '%s\n' "$program_headers" | awk '/LOAD/ {print $NF}')
  if [ "${#load_aligns[@]}" -eq 0 ]; then
    echo "ERROR: readelf returned no LOAD segments for $rel — cannot certify" >&2
    FAIL=1
    printf '%-55s %-12s %-6s %s\n' "$rel" "NONE" "NO" "$machine/$elfclass"
    continue
  fi

  align=$(printf '%s\n' "${load_aligns[@]}" | sort -u | tr '\n' ',' | sed 's/,$//')
  ok="YES"
  for segment_align in "${load_aligns[@]}"; do
    if [ "$segment_align" != "0x4000" ]; then
      ok="NO"
      FAIL=1
    fi
  done
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
  echo "RESULT: PASS — zipalign passed and all $INSPECTED 64-bit libraries are 16 KB-aligned"
fi
exit "$FAIL"

