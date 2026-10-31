import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

// Small ZIP writer permits lying expansion sizes as well as genuine compressed bombs.
function zip(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const { name, bytes = Buffer.from('fixture'), declaredSize = bytes.length } of entries) {
    const filename = Buffer.from(name), compressed = deflateRawSync(bytes);
    const local = Buffer.alloc(30), cd = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(filename.length, 26);
    cd.writeUInt32LE(0x02014b50); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc32(bytes), 16);
    cd.writeUInt32LE(compressed.length, 20); cd.writeUInt32LE(declaredSize, 24);
    cd.writeUInt16LE(filename.length, 28); cd.writeUInt32LE(offset, 42);
    locals.push(local, filename, compressed); central.push(cd, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const root = mkdtempSync(join(tmpdir(), 'ak-extraction-test-'));
let checks = 0;
try {
  const extract = process.argv.includes('--baseline')
    ? (apk, out) => execFileSync(join(process.env.JAVA_HOME, 'bin', 'jar.exe'), ['xf', apk], { cwd: out })
    : (await import('./extract_alignment_inputs.mjs')).extractAlignmentInputs;
  const run = (entries) => {
    const apk = join(root, 'fixture.apk'), out = mkdtempSync(join(root, 'out-'));
    writeFileSync(apk, zip(entries));
    return { apk, out };
  };
  let fixture = run([{ name: 'lib/arm64-v8a/bomb.so', bytes: Buffer.alloc(129 * 1024 * 1024) }]);
  assert.throws(() => extract(fixture.apk, fixture.out), /byte budget/);
  assert.equal(existsSync(join(fixture.out, 'lib')), false);
  console.log(`  [${++checks}] PASS oversized compressed library rejected before writing`);

  fixture = run(Array.from({ length: 5 }, (_, i) => ({ name: `lib/arm64-v8a/lib${i}.so`, declaredSize: 110 * 1024 * 1024 })));
  assert.throws(() => extract(fixture.apk, fixture.out), /byte budget/);
  console.log(`  [${++checks}] PASS aggregate declared expansion rejected before writing`);

  fixture = run([{ name: 'lib/arm64-v8a/forged.so', bytes: Buffer.alloc(129 * 1024 * 1024), declaredSize: 1 }]);
  assert.throws(() => extract(fixture.apk, fixture.out), /larger than|byte budget/);
  console.log(`  [${++checks}] PASS lying size cannot bypass actual inflate limit`);

  fixture = run([
    { name: 'lib/arm64-v8a/libok.so' }, { name: 'assets/minilm.onnx' },
    { name: 'assets/irrelevant.bin', bytes: Buffer.alloc(1024 * 1024) },
    { name: '../escaped.so' }, { name: 'lib/../escaped.so' },
  ]);
  extract(fixture.apk, fixture.out);
  assert.equal(readFileSync(join(fixture.out, 'lib/arm64-v8a/libok.so'), 'utf8'), 'fixture');
  assert.equal(readFileSync(join(fixture.out, 'assets/minilm.onnx'), 'utf8'), 'fixture');
  assert.equal(existsSync(join(fixture.out, 'assets/irrelevant.bin')), false);
  assert.equal(existsSync(join(fixture.out, 'escaped.so')), false);
  assert.equal(existsSync(join(root, 'escaped.so')), false);
  console.log(`  [${++checks}] PASS only native libraries and the model are extracted`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`Alignment extraction tests complete: ${checks} checks passed.`);
