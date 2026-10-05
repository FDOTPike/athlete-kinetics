#!/usr/bin/env bash
# test_inspect_elf_alignment.sh — focused tool tests for the 16 KB ELF
# alignment auditor (AUD-A16 / agent.md Task 1).
#
# The tests exercise the REAL auditor script end-to-end against REAL fixtures:
#   - ELF64 shared libraries compiled with the NDK r28 clang at controlled
#     max-page-size (0x1000 / 0x4000 / 0x8000)
#   - one fixture patched so its PT_LOAD segments genuinely MIX 0x4000 and
#     0x1000 alignments in a single file
#   - APKs assembled with the JDK jar.exe and aligned with build-tools
#     zipalign exactly as the auditor requires
#   - isolated failure fixtures: zipalign failure, unaligned library, mixed
#     library, zero native libraries, valid ELF64 + garbage .so, corrupt APK
#
# PATH RULE: bash builtins use $WORK (MSYS). Windows-native tools (clang,
# jar, zipalign, llvm-readelf) MUST receive $WIN_WORK paths — they cannot
# resolve MSYS /tmp/... paths.
#
# Usage: bash tools/test_inspect_elf_alignment.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDITOR="$ROOT/tools/inspect_elf_alignment.sh"
GRADLE_FILE="$ROOT/apps/mobile/android/build.gradle"

[ -n "${ANDROID_HOME:-}" ] || { echo "ERROR: ANDROID_HOME not set" >&2; exit 2; }
[ -n "${JAVA_HOME:-}" ] || { echo "ERROR: JAVA_HOME not set" >&2; exit 2; }

resolve_single() {
  local key="$1" count val
  count=$(grep -cE "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"[^\"]+\"" "$GRADLE_FILE" || true)
  [ "$count" -eq 1 ] || { echo "ERROR: expected exactly one ${key}, found $count" >&2; exit 2; }
  grep -E "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"[^\"]+\"" "$GRADLE_FILE" \
    | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"([^\"]+)\".*/\1/"
}
NDK_VERSION="$(resolve_single ndkVersion)"
BUILD_TOOLS_VERSION="$(resolve_single buildToolsVersion)"
CLANG="$ANDROID_HOME/ndk/$NDK_VERSION/toolchains/llvm/prebuilt/windows-x86_64/bin/clang.exe"
READELF="$ANDROID_HOME/ndk/$NDK_VERSION/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-readelf.exe"
ZIPALIGN="$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/zipalign.exe"
JAR="$JAVA_HOME/bin/jar.exe"
for bin in "$CLANG" "$READELF" "$ZIPALIGN" "$JAR"; do
  [ -x "$bin" ] || { echo "ERROR: missing $bin" >&2; exit 2; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
WIN_WORK="$(cygpath -w "$WORK" 2>/dev/null || echo "$WORK")"

PASS=0; FAIL=0
t() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  PASS  $label (exit $actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label (expected exit $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}
contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label (missing '$needle')"
    FAIL=$((FAIL + 1))
  fi
}

echo "[building fixtures]"
cat > "$WORK/shim.c" <<'C'
int shim_value(void) { return 42; }
C

compile() { # $1=out.so $2=max-page-size
  "$CLANG" -shared -fPIC -o "$WIN_WORK\\$1" "$WIN_WORK\\shim.c" \
    --target=aarch64-none-linux-android26 \
    -Wl,-z,max-page-size="$2" >/dev/null 2>&1 || { echo "ERROR: clang failed for $1" >&2; exit 2; }
}
compile libaligned.so 16384
compile libstrong.so  32768   # stronger than 0x4000 must also pass
compile libbad.so     4096    # 0x1000 must fail

# Build a genuinely MIXED library: compile at 0x1000, then patch the first
# PT_LOAD's p_align to 0x4000 so one file has 0x4000 AND 0x1000 segments.
cp "$WORK/libbad.so" "$WORK/libmixed.so"
python3 - "$WIN_WORK\\libmixed.so" <<'PY'
import struct, sys
path = sys.argv[1]
with open(path, 'r+b') as f:
    data = bytearray(f.read())
    # ELF64 header: e_phoff @32 (8), e_phentsize @54 (2), e_phnum @56 (2)
    e_phoff = struct.unpack_from('<Q', data, 32)[0]
    e_phentsize = struct.unpack_from('<H', data, 54)[0]
    e_phnum = struct.unpack_from('<H', data, 56)[0]
    patched = 0
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        p_type = struct.unpack_from('<I', data, off)[0]      # 1 = PT_LOAD
        p_align = struct.unpack_from('<Q', data, off + 48)[0]
        if p_type == 1 and p_align == 0x1000 and patched == 0:
            struct.pack_into('<Q', data, off + 48, 0x4000)   # first LOAD -> 0x4000
            patched += 1
    if patched != 1:
        print(f'ERROR: expected to patch exactly one PT_LOAD, patched {patched}', file=sys.stderr)
        sys.exit(2)
    f.seek(0); f.write(data)
print('patched mixed library: first PT_LOAD p_align -> 0x4000, remaining stay 0x1000')
PY

# Verify fixture alignments with the real readelf.
seg_aligns() { "$READELF" -l "$WIN_WORK\\$1" 2>/dev/null | awk '/LOAD/ {print $NF}' | sort -u | tr '\n' ',' | sed 's/,$//'; }
echo "  aligned: $(seg_aligns libaligned.so)"
echo "  strong:  $(seg_aligns libstrong.so)"
echo "  bad:     $(seg_aligns libbad.so)"
echo "  mixed:   $(seg_aligns libmixed.so)"

# Assemble isolated APKs. Plain jar zips are not 16 KB page aligned; each APK
# used for an ELF assertion is zipaligned before the auditor sees it.
MODEL_SRC="$ROOT/packages/inference/assets/minilm/model_quantized.onnx"
[ -f "$MODEL_SRC" ] || { echo "ERROR: missing model source at $MODEL_SRC" >&2; exit 2; }

zap() { # $1=in.apk $2=out.apk (Windows paths)
  "$ZIPALIGN" -P 16 -f 4 "$1" "$2" >/dev/null 2>&1
}

# aligned-only APK (must PASS)
mkdir -p "$WORK/apkA/lib/arm64-v8a" "$WORK/apkA/assets"
cp "$WORK/libaligned.so" "$WORK/apkA/lib/arm64-v8a/"
cp "$MODEL_SRC" "$WORK/apkA/assets/minilm.onnx"
(cd "$WORK/apkA" && "$JAR" cf0 "$WIN_WORK\\A_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\A_raw.apk" "$WIN_WORK\\A.apk"

# strong-only APK (must PASS)
mkdir -p "$WORK/apkS/lib/arm64-v8a" "$WORK/apkS/assets"
cp "$WORK/libstrong.so" "$WORK/apkS/lib/arm64-v8a/"
cp "$MODEL_SRC" "$WORK/apkS/assets/minilm.onnx"
(cd "$WORK/apkS" && "$JAR" cf0 "$WIN_WORK\\S_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\S_raw.apk" "$WIN_WORK\\S.apk"

# ordinary 0x1000-only APK (must FAIL independently on ELF alignment)
mkdir -p "$WORK/apkB/lib/arm64-v8a" "$WORK/apkB/assets"
cp "$WORK/libbad.so" "$WORK/apkB/lib/arm64-v8a/"
cp "$MODEL_SRC" "$WORK/apkB/assets/minilm.onnx"
(cd "$WORK/apkB" && "$JAR" cf0 "$WIN_WORK\\B_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\B_raw.apk" "$WIN_WORK\\B.apk"

# mixed 0x1000/0x4000-only APK (must FAIL independently on ELF alignment)
mkdir -p "$WORK/apkM/lib/arm64-v8a" "$WORK/apkM/assets"
cp "$WORK/libmixed.so" "$WORK/apkM/lib/arm64-v8a/"
cp "$MODEL_SRC" "$WORK/apkM/assets/minilm.onnx"
(cd "$WORK/apkM" && "$JAR" cf0 "$WIN_WORK\\M_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\M_raw.apk" "$WIN_WORK\\M.apk"

# aligned APK with MISSING minilm.onnx (must FAIL model gate, exit 1)
mkdir -p "$WORK/apkNoModel/lib/arm64-v8a"
cp "$WORK/libaligned.so" "$WORK/apkNoModel/lib/arm64-v8a/"
(cd "$WORK/apkNoModel" && "$JAR" cf0 "$WIN_WORK\\NoModel_raw.apk" lib >/dev/null 2>&1)
zap "$WIN_WORK\\NoModel_raw.apk" "$WIN_WORK\\NoModel.apk"

# aligned APK with TRUNCATED minilm.onnx (must FAIL model gate, exit 1)
mkdir -p "$WORK/apkTruncModel/lib/arm64-v8a" "$WORK/apkTruncModel/assets"
cp "$WORK/libaligned.so" "$WORK/apkTruncModel/lib/arm64-v8a/"
head -c 1024 "$MODEL_SRC" > "$WORK/apkTruncModel/assets/minilm.onnx"
(cd "$WORK/apkTruncModel" && "$JAR" cf0 "$WIN_WORK\\TruncModel_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\TruncModel_raw.apk" "$WIN_WORK\\TruncModel.apk"

# aligned APK with CORRUPT SHA minilm.onnx (must FAIL model gate, exit 1)
mkdir -p "$WORK/apkCorruptModel/lib/arm64-v8a" "$WORK/apkCorruptModel/assets"
cp "$WORK/libaligned.so" "$WORK/apkCorruptModel/lib/arm64-v8a/"
cp "$MODEL_SRC" "$WORK/apkCorruptModel/assets/minilm.onnx"
# Corrupt 1 byte in place while preserving exact length
printf 'X' | dd of="$WORK/apkCorruptModel/assets/minilm.onnx" bs=1 seek=100 count=1 conv=notrunc >/dev/null 2>&1
(cd "$WORK/apkCorruptModel" && "$JAR" cf0 "$WIN_WORK\\CorruptModel_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\CorruptModel_raw.apk" "$WIN_WORK\\CorruptModel.apk"

# empty APK (zero native libraries -> exit 2) — from a genuinely empty dir
mkdir -p "$WORK/emptyDir"
(cd "$WORK/emptyDir" && "$JAR" cf0 "$WIN_WORK\\empty.apk" . >/dev/null 2>&1)
# aligned ELF64 decoy under assets/ but no lib/<ABI>/ tree: this is not a
# packaged native library and must not satisfy the zero-native-library gate.
mkdir -p "$WORK/apkD/assets"
cp "$WORK/libaligned.so" "$WORK/apkD/assets/not-a-native-library.so"
(cd "$WORK/apkD" && "$JAR" cf0 "$WIN_WORK\\D_raw.apk" assets >/dev/null 2>&1)
zap "$WIN_WORK\\D_raw.apk" "$WIN_WORK\\D.apk"

# one valid ELF64 plus garbage .so: proves readelf failure itself fails closed,
# rather than relying on the zero-inspected-library gate
mkdir -p "$WORK/apkG/lib/arm64-v8a" "$WORK/apkG/assets"
cp "$WORK/libaligned.so" "$WORK/apkG/lib/arm64-v8a/"
cp "$MODEL_SRC" "$WORK/apkG/assets/minilm.onnx"
echo "this is not an ELF file" > "$WORK/apkG/lib/arm64-v8a/libgarbage.so"
(cd "$WORK/apkG" && "$JAR" cf0 "$WIN_WORK\\G_raw.apk" lib assets >/dev/null 2>&1)
zap "$WIN_WORK\\G_raw.apk" "$WIN_WORK\\G.apk"

# existing but corrupt APK: reaches and must fail jar extraction (exit 2)
printf 'this is not a zip archive\n' > "$WORK/corrupt.apk"

echo
echo "[running auditor on fixtures]"
set +e
bash "$AUDITOR" "$WORK/A.apk"               >/dev/null 2>&1; a_rc=$?
bash "$AUDITOR" "$WORK/S.apk"               >/dev/null 2>&1; s_rc=$?
bash "$AUDITOR" "$WORK/B.apk"               >/dev/null 2>&1; b_rc=$?
bash "$AUDITOR" "$WORK/M.apk"               >/dev/null 2>&1; m_rc=$?
bash "$AUDITOR" "$WORK/NoModel.apk"         >/dev/null 2>&1; nomodel_rc=$?
bash "$AUDITOR" "$WORK/TruncModel.apk"      >/dev/null 2>&1; trunc_rc=$?
bash "$AUDITOR" "$WORK/CorruptModel.apk"    >/dev/null 2>&1; corruptmodel_rc=$?
bash "$AUDITOR" "$WORK/A_raw.apk"           >/dev/null 2>&1; raw_rc=$?
bash "$AUDITOR" "$WORK/empty.apk"           >/dev/null 2>&1; e_rc=$?
bash "$AUDITOR" "$WORK/D.apk"               >/dev/null 2>&1; d_rc=$?
bash "$AUDITOR" "$WORK/G.apk"               >/dev/null 2>&1; g_rc=$?
bash "$AUDITOR" "$WORK/corrupt.apk"         >"$WORK/corrupt.out" 2>&1; c_rc=$?
corrupt_output="$(<"$WORK/corrupt.out")"
bash "$AUDITOR" /nonexistent.apk             >/dev/null 2>&1; n_rc=$?
set -e

t "aligned-only APK with model (0x4000) passes"           0 "$a_rc"
t "stronger-than-required APK with model (0x8000) passes"  0 "$s_rc"
t "0x1000-only APK fails independently on ELF alignment"  1 "$b_rc"
t "mixed-only 0x1000/0x4000 APK fails independently"      1 "$m_rc"
t "missing model asset fails closed"                      1 "$nomodel_rc"
t "truncated model asset fails closed"                    1 "$trunc_rc"
t "corrupt-SHA model asset fails closed"                  1 "$corruptmodel_rc"
t "raw jar zip fails zipalign -P 16 check"                1 "$raw_rc"
t "APK with zero native libraries fails closed"           2 "$e_rc"
t "assets-only ELF64 decoy is not a native library"        2 "$d_rc"
t "valid ELF64 plus garbage .so fails on readelf error"    1 "$g_rc"
t "existing corrupt APK fails extraction"                 2 "$c_rc"
contains "corrupt APK reports extraction error" "$corrupt_output" "ERROR: jar extraction failed"
t "missing APK fails closed"                              2 "$n_rc"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || { echo "TOOL TESTS FAILED" >&2; exit 1; }
echo "TOOL TESTS PASSED"
