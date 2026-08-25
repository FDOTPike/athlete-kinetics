#!/usr/bin/env bash
# inspect_elf_alignment.sh — per-library ELF PT_LOAD alignment audit for a
# debug/release APK (Android 16 KB page-size compatibility, AUD-A16).
#
# FAIL-CLOSED by design:
#   - toolchain versions are resolved from apps/mobile/android/build.gradle
#     (exactly one ndkVersion and one buildToolsVersion; exit 2 otherwise)
#   - extraction uses $JAVA_HOME/bin/jar.exe (exit 2 if unavailable)
#   - extraction happens in a unique temp dir removed via EXIT trap
#   - zipalign -P 16 failure, readelf failure, malformed/absent LOAD
#     alignment, zero native libraries, and zero inspected ELF64 libraries
#     each exit non-zero
#   - every ELF64 PT_LOAD alignment is parsed numerically; any segment below
#     0x4000 (16384) fails the library, even in a mixed 0x1000,0x4000 file
#   - ELF32/32-bit libraries are reported as informational only and are NOT
#     counted in the ELF64 certification
#
# Usage: bash tools/inspect_elf_alignment.sh <apk-path>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-}"
if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "ERROR: APK path required and must exist: '$APK'" >&2
  exit 2
fi
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set" >&2
  exit 2
fi
if [ -z "${JAVA_HOME:-}" ]; then
  echo "ERROR: JAVA_HOME is not set (needed for jar.exe extraction)" >&2
  exit 2
fi

# --- resolve exactly one ndkVersion / buildToolsVersion from build.gradle ---
GRADLE_FILE="$ROOT/apps/mobile/android/build.gradle"
if [ ! -f "$GRADLE_FILE" ]; then
  echo "ERROR: cannot find $GRADLE_FILE" >&2
  exit 2
fi
resolve_single() {
  local key="$1" count val
  count=$(grep -cE "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"[^\"]+\"" "$GRADLE_FILE" || true)
  if [ "$count" -ne 1 ]; then
    echo "ERROR: expected exactly one ${key} in $GRADLE_FILE, found $count" >&2
    exit 2
  fi
  val=$(grep -E "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"[^\"]+\"" "$GRADLE_FILE" \
        | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"([^\"]+)\".*/\1/")
  if [ -z "$val" ]; then
    echo "ERROR: could not extract a non-empty ${key} from $GRADLE_FILE" >&2
    exit 2
  fi
  echo "$val"
}
NDK_VERSION="$(resolve_single ndkVersion)"
BUILD_TOOLS_VERSION="$(resolve_single buildToolsVersion)"

READELF="$ANDROID_HOME/ndk/$NDK_VERSION/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-readelf.exe"
ZIPALIGN="$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/zipalign.exe"
JAR="$JAVA_HOME/bin/jar.exe"
for bin in "$READELF" "$ZIPALIGN" "$JAR"; do
  if [ ! -x "$bin" ]; then
    echo "ERROR: missing required binary: $bin" >&2
    exit 2
  fi
done
for tool in awk sed grep find sort; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: missing required tool: $tool" >&2; exit 2; }
done

# --- unique temp dir + EXIT trap (never a fixed repo directory) -------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
WIN_WORK="$(cygpath -w "$WORK" 2>/dev/null || echo "$WORK")"
# Windows-native tools (jar.exe, zipalign.exe) cannot resolve MSYS paths.
# Absolutize first: cygpath -w of a RELATIVE path stays relative and jar
# would then resolve it against the temp extraction cwd.
APK_ABS="$(cd "$(dirname "$APK")" 2>/dev/null && pwd)/$(basename "$APK")"
APK_WIN="$(cygpath -w "$APK_ABS" 2>/dev/null || echo "$APK_ABS")"

echo "=== APK: $APK ==="
echo "=== toolchain: NDK $NDK_VERSION / build-tools $BUILD_TOOLS_VERSION ==="

# --- extraction (validated) ---------------------------------------------------
if ! (cd "$WORK" && "$JAR" xf "$APK_WIN" >/dev/null 2>&1); then
  echo "ERROR: jar extraction failed for $APK" >&2
  exit 2
fi
LIB_ROOT="$WORK/lib"
if [ ! -d "$LIB_ROOT" ]; then
  echo "ERROR: APK contains ZERO native libraries -- cannot certify alignment" >&2
  exit 2
fi
# Android packages native libraries only at lib/<ABI>/*.so. Do not allow a
# same-named file under assets/ (or elsewhere in the archive) to satisfy the
# native-library and ELF64 certification counts.
mapfile -t LIBS < <(find "$LIB_ROOT" -mindepth 2 -maxdepth 2 -type f -name '*.so' | sort)
if [ "${#LIBS[@]}" -eq 0 ]; then
  echo "ERROR: APK contains ZERO native libraries — cannot certify alignment" >&2
  exit 2
fi
echo "Native libraries found: ${#LIBS[@]}"

# --- zipalign -P 16 (fail closed) ----------------------------------------------
if "$ZIPALIGN" -c -P 16 4 "$APK_WIN" >/dev/null 2>&1; then
  echo "zipalign -P 16: PASS"
else
  echo "zipalign -P 16: FAIL" >&2
  exit 1
fi
echo

# --- verified model asset (fail closed) ---------------------------------------
EXPECTED_MODEL_SIZE=22972370
EXPECTED_MODEL_SHA256="afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1"

MODEL_FILE=""
if [ -f "$WORK/assets/minilm.onnx" ]; then
  MODEL_FILE="$WORK/assets/minilm.onnx"
elif [ -f "$WORK/base/assets/minilm.onnx" ]; then
  MODEL_FILE="$WORK/base/assets/minilm.onnx"
fi

if [ -z "$MODEL_FILE" ]; then
  echo "ERROR: packaged minilm.onnx model asset is MISSING from APK/AAB" >&2
  exit 1
fi

MODEL_SIZE=$(wc -c < "$MODEL_FILE" | tr -d '[:space:]')
if [ "$MODEL_SIZE" -ne "$EXPECTED_MODEL_SIZE" ]; then
  echo "ERROR: packaged minilm.onnx size $MODEL_SIZE != expected $EXPECTED_MODEL_SIZE" >&2
  exit 1
fi

MODEL_SHA256=$(sha256sum "$MODEL_FILE" | awk '{print $1}')
if [ "$MODEL_SHA256" != "$EXPECTED_MODEL_SHA256" ]; then
  echo "ERROR: packaged minilm.onnx SHA-256 $MODEL_SHA256 != expected $EXPECTED_MODEL_SHA256" >&2
  exit 1
fi
echo "Model asset (minilm.onnx): PASS (size $MODEL_SIZE, sha256 $MODEL_SHA256)"
echo

# --- per-library ELF64 PT_LOAD alignment ---------------------------------------
echo "=== per-library PT_LOAD alignment (ELF64 requires every segment >= 0x4000) ==="
printf '%-55s %-10s %-6s %s\n' "LIBRARY" "WORST" "OK?" "CLASS/MACHINE"

FAIL=0
INSPECTED=0
for so in "${LIBS[@]}"; do
  rel="${so#"$WORK"/}"
  win="$WIN_WORK/${rel//\//\\}"
  header=""
  if ! header=$("$READELF" -h "$win" 2>/dev/null); then
    echo "ERROR: readelf header inspection failed for $rel — cannot certify" >&2
    FAIL=1
    printf '%-55s %-10s %-6s %s\n' "$rel" "n/a" "NO" "UNKNOWN/UNKNOWN (header failure)"
    continue
  fi
  elfclass=$(awk '/Class:/ {print $2; exit}' <<< "$header")
  machine=$(awk '/Machine:/ {print $2; exit}' <<< "$header")

  if [ -z "$elfclass" ] || [ -z "$machine" ]; then
    echo "ERROR: malformed readelf header for $rel — cannot certify" >&2
    FAIL=1
    printf '%-55s %-10s %-6s %s\n' "$rel" "n/a" "NO" "${machine:-UNKNOWN}/${elfclass:-UNKNOWN} (malformed header)"
    continue
  fi
  if [ "$elfclass" = "ELF32" ]; then
    printf '%-55s %-10s %-6s %s\n' "$rel" "n/a" "n/a" "$machine/$elfclass (informational)"
    continue
  fi
  if [ "$elfclass" != "ELF64" ]; then
    echo "ERROR: unknown ELF class '$elfclass' for $rel — cannot certify" >&2
    FAIL=1
    printf '%-55s %-10s %-6s %s\n' "$rel" "n/a" "NO" "$machine/$elfclass (unknown class)"
    continue
  fi
  INSPECTED=$((INSPECTED + 1))

  aligns=$("$READELF" -l "$win" 2>/dev/null | awk '/LOAD/ {print $NF}')
  if [ -z "$aligns" ]; then
    echo "ERROR: readelf produced no LOAD segments for $rel — cannot certify" >&2
    FAIL=1
    printf '%-55s %-10s %-6s %s\n' "$rel" "NONE" "NO" "$machine"
    continue
  fi

  ok="YES"
  worst_dec=2147483647
  for a in $aligns; do
    if [[ ! "$a" =~ ^0x[0-9a-fA-F]+$ ]]; then
      echo "ERROR: malformed LOAD alignment '$a' for $rel" >&2
      FAIL=1; ok="NO"; break
    fi
    dec=$((a))
    if [ "$dec" -lt "$worst_dec" ]; then worst_dec=$dec; fi
    if [ "$dec" -lt 16384 ]; then FAIL=1; ok="NO"; fi
  done
  printf '%-55s %-10s %-6s %s\n' "$rel" "$(printf '0x%x' "$worst_dec")" "$ok" "$machine"
done

echo
if [ "$INSPECTED" -eq 0 ]; then
  echo "ERROR: zero ELF64 libraries inspected — cannot certify" >&2
  exit 1
fi
if [ "$FAIL" = "1" ]; then
  echo "RESULT: FAIL — 16 KB INCOMPATIBLE (or inspection incomplete)" >&2
  exit 1
fi
echo "RESULT: PASS — all $INSPECTED ELF64 libraries are 16 KB-aligned"
