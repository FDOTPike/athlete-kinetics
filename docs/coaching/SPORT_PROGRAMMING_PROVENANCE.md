# Sport and goal-responsive programming — provenance

What the engine does when an athlete states a focus, a goal exercise, a sport
and a weekly sport workload, and where each rule comes from. Code:
`packages/inference/src/sportProfile.ts`, `programEmphasis.ts`, and the
emphasis sections of `blockGenerator.ts`. Checked 2026-10-02.

Two kinds of rule appear below and are never mixed up in the app:

- **Published** — a named study, review or rule book. The app cites it and
  states the finding in plain words.
- **Product rule** — a number or threshold this app chose. The direction may
  be published; the exact value is not. Each is listed under "Owner
  decisions" so it can be changed deliberately.

Nothing in the app promises fewer injuries or better performance.

## Sources

| Key | Citation | What it is used for | How it was checked |
| --- | --- | --- | --- |
| `suchomel2016` | Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. *Sports Med* 2016;46(10):1419–1449. | Leg strength as the supportable gym contribution to jumping, sprinting and change of direction. | Title, authors, journal, volume, pages and the summary finding confirmed by web search (institutional repository records). |
| `markovic2007` | Markovic G. Does plyometric training improve vertical jump height? A meta-analytical review. *Br J Sports Med* 2007;41(6):349–355. | Stating that jump training itself is what improved jump height (about 5–9%), and that the library cannot provide it. | PubMed record 17347316 and the BJSM abstract page. |
| `vanDyk2019` | van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. *Br J Sports Med* 2019;53(21):1362. | Hamstring emphasis for "keep training and playing without long breaks". | BJSM article page and secondary summaries: 15 studies, 8,459 athletes, about 51% lower hamstring injury rate. |
| `haroy2019` | Harøy J, et al. The Adductor Strengthening Programme prevents groin problems among male football players: a cluster-randomised controlled trial. *Br J Sports Med* 2019;53(3):150. | Telling a football athlete that adductor strengthening has trial support **and that this library cannot provide it**. | BJSM article page and PEDro record: 35 teams, groin-problem prevalence 13.5% vs 21.3%. |
| `tyler2002` | Tyler TF, et al. The effectiveness of a preseason exercise program to prevent adductor muscle strains in professional ice hockey players. *Am J Sports Med* 2002;30(5):680–683. | The same statement for ice hockey. | Citation confirmed by web search. Only the paper's conclusion is used; no figure from it is quoted, because the summary figures returned by search were not consistent. |
| `ipfRules` | International Powerlifting Federation, Technical Rules Book. | Powerlifting is contested in the squat, bench press and deadlift. | General knowledge of the sport's rules; no edition-specific detail is relied on. |
| `wilson2012` | Wilson JM, Marin PJ, Rhea MR, Wilson SMC, Loenneke JP, Anderson JC. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. *J Strength Cond Res* 2012;26(8):2293–2307. | The **direction** of the workload rule: more frequent and longer concurrent training, smaller strength, size and power gains. | PEDro record and secondary summaries: 21 studies, 422 effect sizes, negative relationships with frequency and duration. |
| `trebs2010` | Trebs AA, Brandenburg JP, Pitney WA. *J Strength Cond Res* 2010;24(7):1925–1930. | The four incline presses mapped to the upper chest (work order 2, migration 066). | Recorded in work order 2. |

## What each sport outcome changes

| Outcome | Emphasis | Basis | Stated limit |
| --- | --- | --- | --- |
| Jump higher | quads, glutes, calves | `suchomel2016`, `markovic2007` | The library has no jump or plyometric drills, so the plan builds leg strength and does not include jump training itself. |
| Run faster and change direction | hamstrings, glutes, quads | `suchomel2016` | No sprint or agility drills exist in the app. |
| Keep training and playing | hamstrings | `vanDyk2019` (+ `haroy2019` for football, `tyler2002` for ice hockey) | No adductor-strengthening exercise in the library; the Nordic curl is Advanced-tier and is planned only when the tier allows; no promise. |
| Lift more in squat, bench, deadlift | the three competition lifts are promoted as main lifts | `ipfRules` | No peak, taper or maximum test is planned. Not forced for a beginner or a return-to-training plan. |
| Stronger in contact | none | `suchomel2016` (whole-body strength) | No contact drills. |
| Last the whole game | none | `wilson2012` (the gym plan is kept from crowding the sport) | No conditioning is planned by the app. |
| Stronger in striking and the clinch | none | **none found** | The app says it has no reviewed evidence. High-repetition hip-flexor raises (the "25–50 a side" example) are not added: no reviewed source supports a dose. |
| General strength for my sport | none | — | — |

"Another sport" always works: the athlete names it, picks an outcome from the
general list, and the weekly sessions count like any other sport.

## How the emphasis reaches the plan

Fixed precedence, enforced by where the generator consults the emphasis:

1. safety, capability, equipment and experience-tier gates;
2. the session time limit;
3. the athlete's explicit exercise choice for a slot;
4. an exercise one of the athlete's goals names;
5. the objective's own laws (strength main lifts, loaded-first, bodybuilding
   and power ordering);
6. the focus, then the sport emphasis.

Mechanisms:

- **Selection.** For a slot whose movement is the engine's default, another
  movement of the *same pattern* that is primary for an emphasised muscle may
  be chosen. It must keep the default's loading class and compound class. On
  the first two slots (the main lifts) it must also still be primary for
  everything the default is primary for — an incline press may replace a flat
  press; a glute-only "kneeling squat" never replaces the squat.
- **Weekly allocation.** When an emphasised muscle a day can train has had no
  direct work that week, the session's *last accessory slot* is given to it —
  only if the movement it displaces is trained on another day, has not
  already been displaced that week, and is not itself the session's only
  direct work for an emphasised muscle. A session with a free slot inside its
  budget takes the exercise as an extra instead. Nothing is added beyond the
  slot budget, so the time contract is unaffected.
- **Goal exercise.** A goal may name one exercise. It takes its pattern's
  slot when the gates allow, or one spare accessory slot a week when no
  session has that pattern; it is exempt from the workload set reduction and
  is trimmed last. When the gates do not allow it, the report says which.
- **Workload.** See below.
- **Held movements.** Ids 135 and 187 are never newly prescribed by the
  emphasis (the same list the preparation policy uses).

Everything applied and everything that could not be applied is written to an
`EmphasisReport`, shown on the program preview and frozen with the block
(`block_emphasis`).

## Scheduled sport workload

Evidence, in order:

1. **The Activities schedule** (`activity_series`, migration 064): every
   weekly series in effect on the block's start date, except gym strength
   training and activities the athlete marked as low demand. Each is named in
   the explanation.
2. **The numbers stated with the sport answer**, only when the schedule has
   no such series.

They are never added together. An unknown duration stays unknown: no
duration is estimated and **no cross-sport load score is computed** — the
workload is sessions per week, with known minutes shown beside it.

| Weekly sport sessions | Effect on a NEW block |
| --- | --- |
| 0 | none; the athlete is told how to add sessions |
| 1–2 | none, and the plan says so |
| 3–4 | one set fewer on each accessory of strength days (weeks 1–3) |
| 5 or more | two sets fewer (never below one), and week 3 repeats week 2 |

Main lifts, the deload week, sport/conditioning days and movement selection
are never changed by workload, and nothing is ever raised. With the hybrid
objective the larger of the hybrid tax and the workload cut applies; they are
not added.

## A competition date

Stored with the sport answer and shown back. It changes nothing in the plan:
no peak, no taper, no maximum test. This is tested by generating two plans
that differ only in the date and comparing them row for row.

## Owner decisions (product rules, not published values)

1. Workload cut points: 3 sessions = high, 5 = very high.
2. Workload effects: −1 / −2 accessory sets; week 3 held at 5+.
3. Which schedule entries count: everything weekly except `strength_training`
   and `demand_class = 'low'`. An entry of unknown demand counts.
4. The emphasis may displace one accessory pattern once a week per pattern.
5. A goal exercise outranks the strength objective's main-lift anchor for its
   slot (a "front squat" goal replaces the competition squat).
6. Muscles per outcome (table above) — in particular whether "stronger in
   contact" should carry an emphasis; today it deliberately does not.
7. Rugby is one answer; union and league are not told apart.
8. The hybrid objective's sport-day rounds are still named "BJJ Sparring
   Round" for every sport. That naming predates this work and is not changed
   here.

## Content gaps recorded for the movement library (not invented around)

- No jump, plyometric, sprint or agility drills.
- No adductor-strengthening exercise (for example the Copenhagen adduction).
- `inner_thighs` and `outer_hips` have no movement that is primary for them.
- `rear_shoulders` has a single primary movement.
