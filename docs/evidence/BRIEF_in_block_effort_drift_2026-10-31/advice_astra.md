1. **The implementation facts are substantially correct; the policy interpretation needs narrowing.** Calibration §1’s neutral-indicator permission concerns ACWR; §3 concerns hard sets and whole-session RPE. The [progression decision](docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md:118) explicitly distinguishes progression measurements from already-authorized execution/tolerance feedback. These are not blanket prohibitions on per-set RPE-error adaptation, but neither authorizes C’s new cadence. The safety brief recommends; it ratifies nothing. Completion dormancy and the stability disclaimer are accurately cited.

   Two implementation qualifications: positive RPE authority is **one +0.5 grant across patterns per eligible block**, applied to one slot; reductions affect every eligible occurrence. Also, `detectFlaws` uses only the state-vector array’s **length**, not its physiological fields—it is not comprehensive athlete-state or goal tracking.

   **The side finding is confirmed:** [the getter](apps/mobile/src/state/useStore.ts:5994) returns active-block attribution, while BlockScreen describes future changes and renders raw reason tokens per slot. The test’s free-text reasons violate the schema domain.

2. **For closed beta, recommend A’s observational portion, without the next-block promise.** Show recorded effort versus frozen targets, dates, coverage, and insufficient-data wording. This supplies visibility without introducing unvalidated intervention timing, although it only partially satisfies the owner’s automatic-realignment objective. B adds prescription-changing authority despite athlete initiation and requires interaction the owner does not want. C should remain a separately versioned shadow proposal pending an explicit decision. Persisted shadow logging needs its own specification; it cannot share A’s absolute no-write invariant.

3. **C has a plausible feedback-cycle risk, but the proposed causal explanation has the sign wrong.** Holding actual RPE constant, lowering target RPE makes ΔE **more positive**. Negative ΔE requires actual effort to fall sufficiently—possibly through recovery or fewer sets. Thus rebound is possible, not mechanically guaranteed.

   The mitigation is inadequate: `rpeRaisePermitted` is currently global, suppresses only RPE raises, and leaves set raises and planned progression intact. One-block suppression may merely delay rebound. Excluding eased observations only from N biases the detector toward reductions and changes its frozen semantics.

   Additional risks include persistent-reporting-bias ratchets; repeated reductions across blocks; sparse/selective logging; movement substitutions; arbitrary seven-day segment alignment across deloads; thin first-block evidence; and retry/start-session races. Preserve historical targets and exclude deload/locomotion destinations. A source column alone is insufficient: existing attribution has one row per slot and bounded deltas, so overlapping boundary/mid-block adjustments need explicit composition and provenance.

   Replay must check mixed drift, downward saturation and cumulative reductions—not just cycles. C6B rejected 3.0 despite zero cycles. Real-log shadow replay cannot establish athletes’ counterfactual response to applied easing.

4. **A’s observation-only form does not inherently breach the cited boundaries.** However, φ is dimensionless: “about 1 RPE harder” needs a separately computed, clearly defined observed average. A read-only action preview is prospective decision information, beyond a neutral trend indicator. `deriveControlAction` alone cannot promise the final generator outcome.

5. **Suggested owner ruling:**

   > Authorize a versioned shadow evaluation of reduction-only mid-block effort adjustment; authorize no live dose changes yet. The candidate uses non-deload week-2/3 checkpoints, at most one ease per pattern/block, five valid observation days, existing floors and guards, and excludes started/logged sessions and locomotion. Require evidence, provenance, migration, idempotency, recovery/rebound rules, and predeclared replay gates before a separate activation decision. No stability claim is authorized.

Read-only inspection completed; no files changed and no tests or simulations run.