/**
 * ios_sim_select.mjs — choose a runtime/device pair that CoreSimulator can
 * actually create: the newest available iOS runtime and an iPhone that this
 * runtime itself lists in supportedDeviceTypes.
 *
 *   xcrun simctl list -j runtimes devicetypes > inventory.json
 *   node tools/ios_sim_select.mjs inventory.json   ->  "<runtimeId> <deviceTypeId>"
 *
 * Exits non-zero (with the reason on stderr) when no such pair exists.
 */
import { readFileSync } from 'node:fs';

const inventory = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const runtimes = (inventory.runtimes ?? []).filter((r) => r.isAvailable && r.platform === 'iOS')
  .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
if (runtimes.length === 0) {
  console.error('no available iOS simulator runtime');
  process.exit(1);
}
const runtime = runtimes.at(-1);
const phones = (runtime.supportedDeviceTypes ?? []).filter((t) => /^iPhone/.test(t.name) && t.productFamily !== 'iPad');
const plain = phones.filter((t) => /^iPhone \d+( Pro)?$/.test(t.name));
const pick = (plain.length ? plain : phones).at(-1);
if (!pick) {
  console.error(`runtime ${runtime.identifier} lists no supported iPhone`);
  process.exit(1);
}
process.stdout.write(`${runtime.identifier} ${pick.identifier}\n`);
