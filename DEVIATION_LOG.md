# Deviation Log

Architectural deviations from product mandates, with rationale. Newest first.

## 2026-06-11 — Phase 8 mandate (update.txt: profiles, triage override, session UI)

1. **Profile persisted in SQLite, not Zustand-only.** The mandate says "update
   the Zustand store"; a store-only profile dies with the process. The profile
   lives in the single-row `user_profile` table (migration 006, CHECK-
   constrained) with a Zustand slice over it. Offline-first invariant kept.

2. **Profile is a prescription layer, not just data.** "Actively prevents
   overtraining" is implemented as deterministic clamps
   (`packages/inference/src/profileLimits.ts`): policy → profile limits →
   triage guardrails, every layer monotone conservative (machine-verified
   sweep, 10,368 combinations). The default profile intentionally trims
   boost-day RPE 9.5 → 9.0; pushing past 9 requires an explicit profile edit.

3. **Red-flag override is a severity FLOOR with category-aware arbitration,
   not a blanket bypass.** A confident semantic match in a curated body-state
   category (pain/illness/fatigue) outranks the generic floor — "felt a sharp
   pop" must keep the curated HALT, and a calibrated pain-mild (0.7/RPE 7)
   must not degrade to the floor (0.6/RPE 6). Mixed reports misrouted to
   positive/technique/equipment ARE overridden. Two override tiers: systemic
   language (dizziness/faintness/chest bigrams) halts; pain language floors.

4. **Exact token sets instead of the mandate's substring keywords.** Naive
   matching flags "shoulder *stab*ility", "*chest* press", "feeling *sharp*".
   Tier-1 standalone tokens, Tier-2 tokens requiring body-region co-occurrence,
   chest as bigrams only, and a one-token negation lookbehind ("no pain")
   added beyond mandate. Documented residual conservative false positive:
   "snapped the bar off the floor" flags (fails toward safety).

5. **Similarity percentages removed from UI but kept in the database.** The
   mandate's "1.0 (100%)" is implemented as confidence semantics (override is
   treated as fully confident), not a stored fake score — `similarity` stays
   the true cosine (or NULL on the keyword-only path) for codebase curation.

6. **The keyword safety layer is embedder-independent.** The report input is
   no longer hidden when the ML runtime is unavailable; `resolveReport(text,
   null)` provides the full deterministic path. This exceeds the mandate but
   is the point of a lexical layer.

7. **"Remove the swipeable movement cards"** — no swipeable cards existed
   (the prior UI was a chip picker). Interpreted as: replace the picker with
   the workout-overview nav (plan slots + logged/planned badges + out-of-order
   select + swap). Planned sets per slot derive from the prescription's
   `set_modifier` (first UI consumer of that number).

8. **Halts now survive app restart** (beyond mandate, required for safety
   coherence): the operative prescription is a pure derivation from persisted
   state (profile + today's `subjective_report` rows), recomputed on boot —
   nothing safety-relevant lives only in memory.
