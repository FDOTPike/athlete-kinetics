/**
 * macho_entitlements.mjs — print the simulated entitlements a simulator build
 * carries in its Mach-O `__TEXT,__entitlements` section.
 *
 *   node tools/macho_entitlements.mjs <executable>
 *
 * Simulator builds keep their entitlements in that section (what the simulator
 * enforces, e.g. HealthKit) rather than in the code signature, so
 * `codesign -d --entitlements` shows an empty dict for them. Exits 1 when the
 * section is absent. Thin and fat (universal) 64-bit binaries are handled.
 */
import { readFileSync } from 'node:fs';

const buffer = readFileSync(process.argv[2]);
const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const LC_SEGMENT_64 = 0x19;
const cstr = (offset, length) => buffer.toString('latin1', offset, offset + length).replace(/\0.*$/s, '');

function slices() {
  if (buffer.readUInt32BE(0) !== FAT_MAGIC) return [0];
  const count = buffer.readUInt32BE(4);
  return Array.from({ length: count }, (_, i) => buffer.readUInt32BE(8 + i * 20 + 8));
}

function entitlementsAt(base) {
  if (buffer.readUInt32LE(base) !== MH_MAGIC_64) return null;
  const ncmds = buffer.readUInt32LE(base + 16);
  let cursor = base + 32;
  for (let i = 0; i < ncmds; i += 1) {
    const cmd = buffer.readUInt32LE(cursor);
    const size = buffer.readUInt32LE(cursor + 4);
    if (cmd === LC_SEGMENT_64 && cstr(cursor + 8, 16) === '__TEXT') {
      const nsects = buffer.readUInt32LE(cursor + 64);
      for (let s = 0; s < nsects; s += 1) {
        const sect = cursor + 72 + s * 80;
        if (cstr(sect, 16) === '__entitlements') {
          const length = Number(buffer.readBigUInt64LE(sect + 40));
          const offset = buffer.readUInt32LE(sect + 48);
          return buffer.toString('utf8', base + offset, base + offset + length);
        }
      }
    }
    cursor += size;
  }
  return null;
}

const found = slices().map(entitlementsAt).find((text) => text !== null);
if (found === undefined) {
  console.error('no __TEXT,__entitlements section');
  process.exit(1);
}
process.stdout.write(found);
