# W4 — C6 and Release Preparation

> ## ⚠ NOT INDEPENDENTLY AUDITED
>
> This document was written by Claude Opus 5 acting as **executor**, at the owner's explicit direction, in the
> same context that audited W1–W3. **There is no independent auditor for it.** Every prior round in this queue
> used separate executor and auditor roles, and that separation produced real findings — three P2s in W2, eight
> in W3, and the auditor's own self-correction in Entry 0088. None of that check applies here.
>
> `W4_OPUS_AUDIT.md` has deliberately **not** been written. Do not treat this as a reviewed deliverable, and do
> not let it clear any gate on its own.

**Completion token:** `C6 PREPARATION READY — PHYSICAL GATE NOT RUN`
**C6 status:** **NOT EVALUATED.** Nothing in this document changes that.
**Prepared:** 2026-09-05. Branch `codex/rpe-familiarisation`, HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`.
**Device interaction:** none. The physical Pixel was not touched, per the controlling work order §7 line 39
("No owner-phone interaction is authorized here. Use isolated synthetic QA only.").

---

## 1. The executable contracts, as they actually exist

These are the real files and commands, not a description of an intended design.

| Contract | Command | What it proves | What it does **not** prove |
| :--- | :--- | :--- | :--- |
| Memory gate fixtures | `npm run verify:memory-fixtures` | The gate's own logic is correct — parser, lifecycle correlator and gate maths all pass their falsifiers | Nothing about this app's actual memory use |
| Memory contract | `npm run verify:memory-contract` (`tools/memory-audit/audit.mjs`) | Whether the modelled envelope fits the ratified ceiling, and whether a sound physical-evidence packet exists | It is a **contract check on a conservative envelope**, not a measurement |
| QA artifact gate | `npm run verify:qa-candidate` | The APK's packaging, signing class, alignment, native libs, and its provenance recomputed against the **live worktree** | Nothing about runtime memory or device behaviour |
| Release chain | `npm run verify:release` | `verify:ci` **and** `verify:memory-contract` **and** `verify:qa-candidate` together | — |

Supporting modules under `tools/memory-audit/`: `memory_gate.mjs` (pure gate logic), `meminfo_parser.mjs`,
`lifecycle_correlator.mjs`, `meminfo_harness.mjs` (device driver), `evidence_provenance.mjs` (binds gate `[D]`
to sealed raw bytes), `budget.json`.

### 1.1 Measured current state — run for this document, not inherited

```
npm.cmd run verify:memory-fixtures   → exit 0   ALL MEMORY GATE FIXTURES PASSED
npm.cmd run verify:memory-contract   → exit 1   2 CHECK(S) FAILED
```

The memory contract's per-check result:

| Check | State | Detail |
| :--- | :--- | :--- |
| `[A]` envelope within ceiling | **FAIL** | envelope exceeds the preferred target |
| `[B]` verdict independent of MB vs MiB reading | PASS | 536,870,912 B → pass; 512,000,000 B → pass |
| `[C]` envelope includes every component | PASS | steady 367,078,400 + embedder 104,857,600 |
| `[D]` measured physical evidence exists and is sound | **FAIL** | "no authorized-device evidence packet supplied" |
| `[E]` no declared estimate lowered below its floor | PASS | all components at or above ratified floors |
| `[F]` one ceiling for every device tier | PASS | 3 tiers, no per-tier override |
| `[G]` packet claims re-derivable from sealed bytes | PASS | `NOT_REQUIRED` (no packet) |

**The numbers that matter:**

```
steady dirty        367,078,400 B
embedder transient  104,857,600 B
envelope            471,936,000 B
preferred target    450,000,000 B     ← envelope is ABOVE this
hard ceiling        536,870,912 B     ← envelope is BELOW this
```

Per the ratified decision of 2026-08-24, an envelope **between** those two bounds is permitted **only** with
physical-device evidence `[D]` **and** an explicit review record naming that exact envelope value — and that
record goes stale the moment the envelope moves. Both are currently absent.

**Consequence, stated plainly:** `verify:release` cannot pass today, because `verify:memory-contract` exits 1.
This is a verified result, not a projection. Any release readiness claim that does not account for it is wrong.

### 1.2 What the gate deliberately refuses to do

Two design properties are worth surfacing, because they constrain how C6 can legitimately be closed:

- **A conservative envelope may not pass itself off as measurement.** `[A]` and `[D]` are separate, and a sound
  evidence packet "can never satisfy `[A]` on the envelope's behalf". A sampled maximum is treated as a *lower
  bound* unless the packet's own cadence analysis supports a peak claim.
- **Lowering an estimate to go green is blocked outright by `[E]`.** The envelope has to actually come down,
  with allocation and lifetime evidence.

`evidence_provenance.mjs` exists because a fifteen-line hand-written JSON once satisfied `[D]` and turned the
whole gate green with zero device data. Every scalar the gate relies on is now re-derived from the raw
`logcat-epoch.txt` and `sample-NNN-*.txt` bytes and compared against the packet's claims. A packet whose claims
are not reproducible from its own bytes is rejected.

---

## 2. The three-way separation

Kept strictly apart, because conflating them is how a preparation document turns into a false readiness claim.

### 2.1 Ready and runnable today — no device, no decisions

- `npm run verify:memory-fixtures` — passing.
- `npm run verify:ci` — passing (23 gates; reproduced during W3, Entry 0085).
- `npm run verify:qa-candidate` — passing against APK `3777054f…` at its build boundary (inherited from the W2
  pre-doc Codex run; **note** it recomputes provenance against the *live* worktree, so it will report a stale
  fingerprint now that documentation has moved on — that is expected drift, not an APK regression).
- The full measurement harness: `meminfo_harness.mjs start | sample | watch | finish`.
- The provenance binder, correlator and parser, all fixture-tested.

### 2.2 Missing — obtainable only from an authorized physical device run

This is the entirety of what blocks C6.

**Required:** a `session.json` produced by `meminfo_harness finish`, supplied to the gate as
`AK_MEM_EVIDENCE_SESSION=<path>`, satisfying:

1. **Device class — a physical 4 GB reference device.** Emulator success is explicitly not 4 GB evidence. A
   Pixel 9 Pro is not this device class; offering it does not unblock C6.
2. **Explicit package targeting** — the QA application id, never a guessed package.
3. **Raw retention** — the raw `adb shell dumpsys meminfo -d <pkg>` output for *every* sample, not just parsed
   summaries.
4. **Continuous epoch logcat** captured in a separate shell for the whole session
   (`adb logcat -v epoch > "$AK_LOGCAT_FILE"`), so lifecycle markers cannot rotate out of the ring buffer
   before `finish` reads them.
5. **Lifecycle correlation** — at least one request id carrying session + inference + disposal + completion,
   all `ok=1`, with cumulative counters proving the created session was the disposed one, inside one continuous
   sampling segment with no clock slack. `finish` fails if no request qualifies.
6. **Measured cadence** — per-sample capture start, completion and duration recorded, so the achieved cadence
   is measured rather than assumed; a maximum is not reported as a peak unless cadence supports it.
7. **Evidence stored outside the repository** (`AK_MEM_EVIDENCE_DIR` or OS temp), never in the worktree.
8. **Re-derivability** — every claimed scalar reproducible from the packet's own sealed raw bytes.

**Not yet attempted.** No such packet exists anywhere in this repository.

### 2.3 Owner-only decisions

Not technical work, and not mine to make:

- **The review record for the envelope band.** Even with a sound `[D]` packet, an envelope of 471,936,000 B
  needs an explicit review record naming that exact value. That is a ratified owner decision, and it expires if
  the envelope moves.
- **Whether to reduce the envelope instead.** The alternative to the band is bringing the envelope under
  450,000,000 B with real allocation/lifetime evidence — a scope decision, not a documentation fix.
- **Which physical 4 GB device** serves as the reference, and when it is run.
- **F7** — shared `InfoTip` nominal 42 dp effective target vs `theme.touch.min = 56`. Documentation corrected;
  fix or waiver not authorized.
- **O1** — raw `LINEAR` / `APRE` identifiers rendered as tooltip titles.
- **O3** — slot-role chip row clipping `ACC` at the screen edge under `font_scale 1.30`, no horizontal scroll.
- **W3-09** — `FREEZE_INVENTORY_W2.json` was regenerated during Path A (disclosed in Entry 0081), so the
  `af3a46f4…` hash cited in `W2_OPUS_AUDIT_R3.md:21` and the Path A work order no longer resolves. Closable by
  a documentation append; no artifact regression.
- Publication, signing, merge, release, and any scope expansion.

---

## 3. Release-gate inventory

| Gate | Current state | Ever run against the current candidate? |
| :--- | :--- | :--- |
| `verify:ci` (23 gates) | **PASS**, exit 0 | Yes — reproduced by Opus during W3 (Entry 0085) |
| `verify:components` | **PASS**, 20 suites / 282 tests | Yes — same run |
| `typecheck` | **PASS**, exit 0 | Yes — same run |
| `verify:blocks` | **PASS** | Yes — same run |
| `verify:memory-fixtures` | **PASS**, exit 0 | Yes — run for this document |
| `verify:memory-contract` | **FAIL**, exit 1 (`[A]`, `[D]`) | Yes — run for this document |
| `verify:qa-candidate` | **PASS** at build boundary | Yes — Codex, W2 pre-doc snapshot; expected stale-fingerprint drift now |
| `verify:release` | **CANNOT PASS** while `verify:memory-contract` fails | No |
| **C6 physical qualification** | **NOT EVALUATED** | **No — never attempted** |
| C7 / publication | Owner-only | No |
| On-device owner verification | Not performed | No — standing rule: no push until the owner installs and verifies on-device |

---

## 4. What this preparation does not establish

- It does **not** qualify C6, and no document produced without a 4 GB device run can.
- It does **not** establish release readiness. `verify:release` currently fails.
- It does **not** carry an independent audit — see the banner.
- It does **not** speak to aggregate merge readiness beyond what `W3_OPUS_AUDIT_R2.md` established.
- The `verify:qa-candidate` result is inherited from a prior snapshot, not re-run here.

---

## 5. Authority boundary

Preparation only. No physical device was touched, no stress run executed, no memory threshold changed, no
signing secret accessed, no store submission made, no APK rebuilt, no emulator started, and no product code,
migration, schema, dependency, native file or CI gate modified. Nothing was staged, committed, pushed, merged,
signed or released.

```text
C6 PREPARATION READY — PHYSICAL GATE NOT RUN
```
