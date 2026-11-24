# Proposed copy manifest

PROVISIONAL — FOR ANTIGRAVITY & OWNER REVIEW

Baseline `fb539d06`. Existing copy retained verbatim when it moves into a disclosure. Terms use the glossary. Entries below give the original source location and exact proposed replacement.

| Baseline location | Before | Provisional after | Pinned assertion |
| --- | --- | --- | --- |
| `apps/mobile/src/screens/TodayScreen.tsx:401` | Your session is saved exactly where you left it. | Your session is saved. | None in TodayScreen.test.js. SessionScreen.test.js pins the same after text in the workout flow. |
| `apps/mobile/src/screens/ProgressScreen.tsx:124` | What your sessions and measurements say — read straight from your log. | From your training log. | None found. |
| `apps/mobile/src/screens/ProfileScreen.tsx:708` | These choices stay with this profile slot. Session mode changes start with your next session. | Settings apply to this profile. Session mode changes start next workout. | None in ProfileCopyW4.test.js. |
| `apps/mobile/src/components/SportFields.tsx:191` | ${SPORT_INFO[sportId].label.toUpperCase()} — ${SPORT_INFO[sportId].distinction ?? ''} | Sport label in its own control and distinction in its own description. Strip a repeated leading sport name followed by a colon. | SportScreens.test.js pins the Field hockey and Ice hockey accessibility distinctions. |
| `apps/mobile/src/screens/LibraryScreenV2.tsx:405` | Showing the movements available to you. Availability, pattern, equipment and more. | Showing the movements available to you. | No exact-string pin found. |
| `apps/mobile/src/screens/LibraryScreenV2.tsx:406` | Availability, pattern, equipment and more. | Removed. The Filters label and controls name the options. | No exact-string pin found. |

### Sport option strings

The chevron keeps each distinction available. The Judo distinction remains visible because it includes an injury mechanism. The source strings remain in `packages/inference/src/sportProfile.ts`.

| Baseline caller | Before | Provisional after (selection / description) | Pinned assertion |
| --- | --- | --- | --- |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 79) | BASKETBALL — Basketball: you can dribble continuously and, when you catch the ball while moving or after ending a dribble, take two steps to stop, pass or shoot; all five players may use the whole 28 m by 15 m floor, and the backboard keeps rebounding in the game. | BASKETBALL / you can dribble continuously and, when you catch the ball while moving or after ending a dribble, take two steps to stop, pass or shoot; all five players may use the whole 28 m by 15 m floor, and the backboard keeps rebounding in the game. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 80) | NETBALL — Netball: you must pass or shoot within three seconds; after releasing the ball you cannot touch it again until it touches another player or rebounds from the goalpost, so there is no dribbling; on a one-foot landing you may step with the other foot and pivot on the landing foot, but cannot put the landing foot back down; the court is three equal thirds with each of the seven positions restricted to its own areas, and the goal is a ring on a post with no backboard. | NETBALL / you must pass or shoot within three seconds; after releasing the ball you cannot touch it again until it touches another player or rebounds from the goalpost, so there is no dribbling; on a one-foot landing you may step with the other foot and pivot on the landing foot, but cannot put the landing foot back down; the court is three equal thirds with each of the seven positions restricted to its own areas, and the goal is a ring on a post with no backboard. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 81) | FOOTBALL (SOCCER) — Association football: round ball, played with the feet. | FOOTBALL (SOCCER) / Association football: round ball, played with the feet. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 82) | AUSTRALIAN FOOTBALL (AFL) — Australian rules: oval ball, marking and kicking, an oval field. | AUSTRALIAN FOOTBALL (AFL) / Australian rules: oval ball, marking and kicking, an oval field. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 83) | RUGBY — Rugby union or rugby league: oval ball, tackling, no forward pass. | RUGBY / Rugby union or rugby league: oval ball, tackling, no forward pass. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 84) | AMERICAN FOOTBALL — Gridiron: downs, pads and helmets. | AMERICAN FOOTBALL / Gridiron: downs, pads and helmets. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 85) | FIELD HOCKEY — Played on grass or turf. | FIELD HOCKEY / Played on grass or turf. | SportScreens.test.js pins the full accessibility label. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 86) | ICE HOCKEY — Played on ice, on skates. | ICE HOCKEY / Played on ice, on skates. | SportScreens.test.js pins the full accessibility label. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 87) | BRAZILIAN JIU-JITSU — Brazilian jiu-jitsu: the fight continues on the ground and being on your back is a position you can attack from (the guard); matches end by submission or points. | BRAZILIAN JIU-JITSU / the fight continues on the ground and being on your back is a position you can attack from (the guard); matches end by submission or points. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 88) | WRESTLING — Wrestling: pinning both shoulders ends the match, the bottom position is only a way out, and the contest is built on standing level changes, penetration steps, takedowns and sprawls in short high-intensity periods. | WRESTLING / pinning both shoulders ends the match, the bottom position is only a way out, and the contest is built on standing level changes, penetration steps, takedowns and sprawls in short high-intensity periods. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 89) | JUDO — Judo: standing throws from a gi grip are the main scoring action, with short groundwork transitions; being thrown is the most common injury mechanism. | JUDO / standing throws from a gi grip are the main scoring action, with short groundwork transitions; being thrown is the most common injury mechanism. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 90) | MUAY THAI — Muay Thai: punches, kicks, knees and elbows, with a clinch. | MUAY THAI / punches, kicks, knees and elbows, with a clinch. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 91) | BOXING — Boxing: punches only, with footwork and trunk rotation; no kicks or clinch knees. | BOXING / punches only, with footwork and trunk rotation; no kicks or clinch knees. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 92) | MIXED MARTIAL ARTS — Mixed martial arts: striking plus cage wrestling and ground grappling, so both the striking and the grappling demands apply at once. | MIXED MARTIAL ARTS / striking plus cage wrestling and ground grappling, so both the striking and the grappling demands apply at once. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 93) | POWERLIFTING — squat, bench press and deadlift | POWERLIFTING / squat, bench press and deadlift | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 94) | OLYMPIC WEIGHTLIFTING — snatch and clean & jerk | OLYMPIC WEIGHTLIFTING / snatch and clean & jerk | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 95) | STRONGMAN — events, carries and overhead | STRONGMAN / events, carries and overhead | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 97) | TENNIS — Tennis: a net divides a 23.77 m by 8.23 m singles court, there is no player-to-player contact and no elevated target; points are built from serves, groundstrokes and net approaches. | TENNIS / a net divides a 23.77 m by 8.23 m singles court, there is no player-to-player contact and no elevated target; points are built from serves, groundstrokes and net approaches. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 98) | SQUASH — Squash: two players share an enclosed four-wall court 9.75 m by 6.40 m and must hit the front wall above the tin, so the ball stays in play off the walls and rallies are continuous. | SQUASH / two players share an enclosed four-wall court 9.75 m by 6.40 m and must hit the front wall above the tin, so the ball stays in play off the walls and rallies are continuous. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 99) | PICKLEBALL — Pickleball: a 20 ft by 44 ft court with a 7 ft (2.13 m) non-volley zone on each side of the net, where volleying the ball out of the air is a fault. | PICKLEBALL / a 20 ft by 44 ft court with a 7 ft (2.13 m) non-volley zone on each side of the net, where volleying the ball out of the air is a fault. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 100) | SPRINTING — Sprinting: short maximal-speed efforts where acceleration and top speed decide the result, not aerobic capacity. | SPRINTING / short maximal-speed efforts where acceleration and top speed decide the result, not aerobic capacity. | No exact-string pin found. |
| `apps/mobile/src/components/SportFields.tsx:191` (source line 101) | DISTANCE RUNNING — Distance running: sustained aerobic running where running economy and aerobic capacity decide the result. | DISTANCE RUNNING / sustained aerobic running where running economy and aerobic capacity decide the result. | No exact-string pin found. |

### Added control copy

- `DESCRIPTIONS`, `COMPACT`, `SHOW ALL`, `Research basis`, and `Effort guide` come from the work order.
- `Show details for <label>` and `Hide details for <label>` come from the work order. They apply to chevrons that have a separate heading or a selectable row.

### Disclosure and visibility inventory

The line-by-line companion C:/codex-sol-compact-evidence/copy-inventory-classified.md lists muted JSX text and protected notices across these files. It records exact baseline locations and whether the work changed their presentation.

| Surface | Collapsed with a chevron | Glossary | Always visible when the surrounding feature is shown |
| --- | --- | --- | --- |
| Onboarding | Goal, experience and equipment option descriptions | Existing option InfoTips | Required answers, review facts, errors and limits |
| Program Setup | Optional weekly schedule and movement selection explanations | Existing glossary tips where present | Recommendation, time and capacity facts, limits and errors |
| Today | Workout resume description | — | Dates, prescribed and completed work, safety, availability, errors |
| Plan | Ordinary pause explanation and block changes intro | Existing phase tips | Calendar cells, status, safety, required steps and action outcomes |
| Workout | Optional effort cue and breathing guidance | Existing RIR and effort tips | Stop guidance, discomfort reporting, active load validation, RIR question and answers, effort ceiling notice |
| Readiness | Recommendation explanation stays in its existing disclosure | HRV | Halt, readiness status, reports, dates and ordinary navigation |
| Progress | Training log explanation | — | Results, measures and empty/error states |
| Profile | Session and display, equipment and band ladder explanations | Existing 1RM and ATP-PC tips | Settings, athlete identity, save and reset errors, reset scope and confirmation |
| Library | Availability explanation under filters | — | Search, counts, availability restrictions, movement instructions and cues |
| Activities | Whole-activity effort explanation | — | Dates, durations, input errors, activity and medical scope notices |
| Sport fields | Research citations and optional workload explanation | — | Selected outcome summary and evidence limits, validation, competition and duplicate-workload notes |
| Focus goal fields | How exercise-linked goals are used | — | Required inputs, validation, feasibility and uncertainty, safety and schedule priorities |
| Focus goals | When a focus change takes effect | — | Saved focus and targets, observations, errors and discard confirmation |
| Preparation | — | Preparation | Exercise instructions, suitability, reductions, restrictions, stop and skip controls |
| Subjective report | Optional report prompt explanation | — | Report prompt, semantic availability and safety notices, results and errors |
| Backup and transfer | What an encrypted backup includes, with exact wording pinned by `BackupTransferPanel.test.js` | — | Password, storage, capacity, restore scope and error warnings |

Other muted labels, metadata, generated facts, empty states and action guidance continue to render where they already appeared. A text color alone does not make that copy optional.

### Pixel layout copy

| Source | Before | Provisional after | Pinned assertion |
| --- | --- | --- | --- |
| `apps/mobile/src/screens/BlockScreen.tsx:671` | No persistent instruction beside the week rows. | Swipe across a week to see all seven days. | `FocusScreens.test.js` checks the text at a narrow measured width and its absence when the rail fits. |
| `apps/mobile/src/screens/OnboardingScreen.tsx:1128` | Finish the sport questions to continue, or choose "Skip this" to plan general gym training. | Prepend the first applicable validator message. Examples exercised are `Choose your sport.`, `Choose what you want from your training for this sport.`, and `Choose how long you have played.` The original skip guidance follows it. | `SportScreens.test.js` asserts the existing guidance and the exact required-answer messages. |

The existing `START TRAINING` label moves into the Review footer. Today uses the existing locale-aware date formatter.
