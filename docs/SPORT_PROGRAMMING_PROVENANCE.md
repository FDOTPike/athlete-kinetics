# Sport programming provenance (WO-02 / WO-02B / WO-03)

Generated from the ratified proposals: `SPORT_TAXONOMY_PROPOSAL.json` (v12) and `WO_03_PROPOSAL.json` (v13).
Every research claim below is carried by a row in `docs/provenance/CLAIM_LEDGER.csv`, and every row names a
source in `docs/provenance/SOURCE_LOG.csv`. The pack also records proposal decisions and defaults that are not
research claims, and it cites rulebook sources (federation rules and court specifications) whose access depth is
`rulebook`, not `abstract_only`; all other reads are abstract depth.

- Baseline: `3c64a7f177008a25aee8d5bc3616a336f33da47b`
- Sources: **36**; claims: **42** (ids in the Sources and Claims tables below)
- Sport families: **10**; sports: **22**; offered sport x outcome pairs: **92**
- Proposed emphasis overrides: **22**

## Catalog arithmetic

The branch's compiled catalog has 10 sports and 45 offered pairs. The proposal supplies 14 outcome lists
(56 pairs); the other baseline sports keep their existing lists (36 pairs), giving the proposed 92.

| Sport | Pairs | Source |
| --- | --- | --- |
| `basketball` | 5 | proposal |
| `combat_boxing` | 3 | proposal |
| `combat_mma` | 4 | proposal |
| `court_netball` | 5 | proposal |
| `football_american` | 5 | baseline |
| `football_association` | 4 | baseline |
| `football_australian` | 6 | baseline |
| `football_rugby` | 5 | baseline |
| `grappling_bjj` | 4 | proposal |
| `grappling_judo` | 4 | proposal |
| `grappling_wrestling` | 5 | proposal |
| `hockey_field` | 4 | baseline |
| `hockey_ice` | 4 | baseline |
| `muay_thai` | 4 | proposal |
| `other` | 6 | baseline |
| `powerlifting` | 2 | baseline |
| `racquet_pickleball` | 4 | proposal |
| `racquet_squash` | 4 | proposal |
| `racquet_tennis` | 4 | proposal |
| `running_endurance` | 4 | proposal |
| `running_sprinting` | 3 | proposal |
| `swimming` | 3 | proposal |
| **Total** | **92** | |

This pack documents the **ratified proposals**, not this branch. The branch implements the pre-proposal engine:
10 sports and 45 offered pairs; the proposal delta takes the catalog to 22 sports and 92 pairs,
and that expansion ships in PR-S4, not here. The proposal's user-facing copy is unratified by the owner.

Of the 22 proposed overrides, 3 carry no cited basis (`grappling_wrestling`/`faster_running`, `combat_boxing`/`stay_available`, `combat_mma`/`stay_available`); they are proposal defaults,
not sourced findings.

Source codes appear only in the Sources and Claims tables below and in the two CSVs. They never
appear in runtime UI strings; the check scans the taxonomy proposal's summary, limits and distinction strings.

## Sport families and sports

| Family | Sports |
| --- | --- |
| `court` | `basketball` (Basketball), `court_netball` (Netball) |
| `football` | `football_american` (American football), `football_association` (Football (soccer)), `football_australian` (Australian football (AFL)), `football_rugby` (Rugby) |
| `grappling` | `grappling_bjj` (Brazilian jiu-jitsu), `grappling_judo` (Judo), `grappling_wrestling` (Wrestling) |
| `hockey` | `hockey_field` (Field hockey), `hockey_ice` (Ice hockey) |
| `other` | `other` (Another sport) |
| `racquet` | `racquet_pickleball` (Pickleball), `racquet_squash` (Squash), `racquet_tennis` (Tennis) |
| `running` | `running_endurance` (Distance running), `running_sprinting` (Sprinting) |
| `strength` | `powerlifting` (Powerlifting) |
| `striking` | `combat_boxing` (Boxing), `combat_mma` (Mixed martial arts), `muay_thai` (Muay Thai) |
| `swimming` | `swimming` (Swimming) |

## Emphasis overrides

Each row is a proposed override. The proposal's own summary, limits and basis citations are not reproduced
here; they live in WO_02/WO_03 and in the claim ledger's rows, and no research assertion is made in this table.

| Sport | Outcome |
| --- | --- |
| `basketball` | `faster_running` |
| `basketball` | `jump_higher` |
| `basketball` | `stay_available` |
| `combat_boxing` | `stay_available` |
| `combat_mma` | `stay_available` |
| `combat_mma` | `strength_for_contact` |
| `court_netball` | `faster_running` |
| `court_netball` | `jump_higher` |
| `court_netball` | `stay_available` |
| `grappling_bjj` | `stay_available` |
| `grappling_bjj` | `strength_for_contact` |
| `grappling_judo` | `stay_available` |
| `grappling_judo` | `strength_for_contact` |
| `grappling_wrestling` | `faster_running` |
| `grappling_wrestling` | `stay_available` |
| `grappling_wrestling` | `strength_for_contact` |
| `racquet_pickleball` | `stay_available` |
| `racquet_squash` | `stay_available` |
| `racquet_tennis` | `stay_available` |
| `running_endurance` | `last_the_whole_game` |
| `running_sprinting` | `stay_available` |
| `swimming` | `stay_available` |

## Prehab targets (v13, as ratified in D13)

| Target | Joints | Muscles | Isometric | Slow eccentric | Status |
| --- | --- | --- | --- | --- | --- |
| `elbow_lateral` | elbow, wrist | forearms | 3-5 x 30-45 s at moderate effort; stay at or below 3/10 | 3 x 12-15 reps, 3 s lowering; stay at or below 3/10 | EVIDENCE CAPTURED — eccentric trial in lateral epicondylosis; isometric analgesia extrapolated from patellar tendinopathy |
| `elbow_medial` | elbow, wrist | forearms | 3-5 x 30-45 s at moderate effort; stay at or below 3/10 | 3 x 12-15 reps, 3 s lowering; stay at or below 3/10 | EVIDENCE CAPTURED for eccentric loading in an uncontrolled case series (claim ledger); the app protocol is a proposal default |
| `shoulder_rotator_cuff` | shoulder | shoulders, upper_back | 3 x 30 s hold at moderate effort; stay at or below 3/10 | 3 x 12 slow external rotations | EVIDENCE CAPTURED for a specific eccentric rotator-cuff exercise strategy; the app protocol is not reproduced from the trial |
| `knee_patellar` | knee | quadriceps | 5 x 45 s at 70% effort; stay at or below 3/10 | 4 x 15 reps at 15RM, 3 s lowering, progressing to 6RM; stay at or below 3/10 | EVIDENCE CAPTURED — isometric analgesia and heavy slow resistance both trialled in patellar tendinopathy |
| `ankle_achilles` | ankle | calves | 5 x 45 s at moderate effort; stay at or below 3/10 | 3 x 15 reps, 3 s lowering, straight knee; seated variant for soleus; stay at or below 3/10 | EVIDENCE CAPTURED for eccentric and heavy slow resistance; the sets and repetitions here are a proposal default |
| `hip_groin` | hip | glutes, hamstrings | 3 x 30-45 s adductor squeeze at moderate effort; stay at or below 3/10 | 2-3 x 8-12 Copenhagen adduction reps per side | EVIDENCE CAPTURED for the Copenhagen adduction programme (claim ledger); the app dose is a proposal default and no clinical groin-treatment effect is claimed |
| `lower_back_trunk` | lower_back | core, lower_back | 3 x 20-30 s per position; stay at or below 3/10 | not applicable — endurance holds, no eccentric | EVIDENCE CAPTURED for the stability concept only (narrative review); the protocol is a coach default |

WO-05 names `achilles_calf` and `hamstring_proximal` where D13 ratifies `ankle_achilles` and `hip_groin`; the
ratified D13 ids are used here, and the alias is recorded for the supervisor to resolve before PR-S5.

## Flexibility (v13)

- Pre-session: dynamic mobility only, at most 30 s per continuous movement. Static holds of 60 s or more must not be used immediately before heavy strength, power or sprinting.
- Post-session or standalone: static, PNF (contract-relax), 30–60 s holds.
- Weekly dose: 5–10 min per muscle group. The reviewed evidence says static stretching for at least 5 min per week over at least 5 days a week may be beneficial for range of motion; the proposed 2–3 bouts per week and the 10-minute upper bound are proposal choices.
- Templates: `hips_lower_body`, `thoracic_shoulders`, `ankles_calves`, `wrists_forearms`, `full_body_recovery`

## Multi-sport hybrid rules (v13)

- Up to 2 ranked sports; `priority_rank` 1–2; a rank-1 row is required by trigger.
- Merge order: focus.muscles -> sport[priority_rank=1].muscles -> sport[priority_rank=2].muscles; cap 8 muscles; secondary weight 0.5.
- Workload: sum scheduled sessions across all active sports; fall back to practiceSessionsPerWeek + matchesPerWeek when no schedule exists; mobility_flexibility excluded.
- Interference: endurance or sprinting sport + contact/court/grappling sport + 'strength' objective; accessory −1 at high, −2 at very high; Separate heavy lower-body strength and hard runs or sparring by at least 6-24 hours where possible.

## Sources

| ID | Citation | Design | Access |
| --- | --- | --- | --- |
| `S01` | Andreato LV, Lara FJD, Andrade A, Branco BHM. Physical and Physiological Profiles of Brazilian Jiu-Jitsu Athletes: a Systematic Review. Sports Med Open. 2017;3(1):9. | systematic review of observational fitness studies | abstract_only |
| `S02` | Chaabene H, Negra Y, Bouguezzi R, Mkaouer B, Franchini E, Julio U, Hachana Y. Physical and Physiological Attributes of Wrestlers: An Update. J Strength Cond Res. 2017;31(5):1411-1442. | narrative short review of observational studies | abstract_only |
| `S03` | James LP, Haff GG, Kelly VG, Beckman EM. Towards a Determination of the Physiological Characteristics Distinguishing Successful Mixed Martial Arts Athletes: A Systematic Review of Combat Sport Literature. Sports Med. 2016;46(10):1525-1551. | systematic review comparing competition levels | abstract_only |
| `S04` | Pocecco E, Ruedl G, Stankovic N, et al. Injuries in judo: a systematic literature review including suggestions for prevention. Br J Sports Med. 2013;47(18):1139-1143. | systematic review of prospective and retrospective injury studies | abstract_only |
| `S05` | Scoggin JF 3rd, Brusovanik G, Izuka BH, Zandee van Rilland E, Geling O, Tokumura S. Assessment of Injuries During Brazilian Jiu-Jitsu Competition. Orthop J Sports Med. 2014;2(2):2325967114522184. | descriptive epidemiology study | abstract_only |
| `S06` | Whitehead S, Mackay L, Jones B, Heyward O, Fox AS, Chesson LJ, Scantlebury S, Janse van Rensburg DCC. Injury risk factors and their priority for mitigation in women's netball: a systematic review and Delphi consensus. Br J Sports Med. 2025;59(5):294-305. | systematic review plus three-round Delphi consensus | abstract_only |
| `S07` | Fox AS, Bonacci J, Saunders N. The relationship between performance of a single-leg squat and leap landing task: moving towards a netball-specific anterior cruciate ligament (ACL) injury risk screening method. Sports Biomech. 2020;19(4):493-509. | cross-sectional 3D biomechanics study | abstract_only |
| `S08` | Stojanovic E, Stojiljkovic N, Scanlan AT, Dalbo VJ, Berkelmans DM, Milanovic Z. The Activity Demands and Physiological Responses Encountered During Basketball Match-Play: A Systematic Review. Sports Med. 2018;48(1):111-135. | systematic review of match-play demands | abstract_only |
| `S09` | Collings TJ, Diamond LE, Barrett RS, Saxby DJ, Lloyd DG, Whiteley R, Patterson BE, Crossley KM, Bourne MN. An Evidence-Based and Mechanistic Approach to Reducing the Risk of Anterior Cruciate Ligament Injury: An Exercise and Sport Science Australia Position Statement. Sports Med. 2026;56(10):2389-2411. | position statement synthesising meta-analyses of trials and prospective risk-factor studies (not itself a trial) | abstract_only |
| `S10` | World Netball. Rules of Netball, 2024 Edition. Rules 1 (court), 3 (positions), 11 (playing the ball: held ball, repossession), 13 (footwork). | official federation rulebook (not a study) | rulebook |
| `S11` | FIBA. Official Basketball Rules 2026, v1.1, valid 1 October 2026. Art. 2 (court 28 x 15 m), Art. 24 (dribbling), Art. 25 (travelling: two steps). | official federation rulebook (not a study) | rulebook |
| `S12` | Belcher S, Whatman C, Brughelli M. A systematic video analysis of 21 anterior cruciate ligament injuries in elite netball players during games. Sports Biomech. 2024;23(12):2546-2563. | systematic video analysis of injury mechanism (descriptive) | abstract_only |
| `S13` | Thomas RE, Zamanpour K. Injuries in wrestling: systematic review. Phys Sportsmed. 2018;46(2):168-196. | systematic review of injury rates | abstract_only |
| `S14` | Laaksonen J, Vaajala M, Pakarinen O, Liukkonen R, Kuitunen I. Epidemiology of rugby injuries: a systematic review and meta-analysis. BMJ Open Sport Exerc Med. 2026;12(1):e002787. | systematic review and meta-analysis of injury incidence | abstract_only |
| `S15` | Amor-Salamanca A, et al. Risk Factors and Prevention of Musculoskeletal Injuries in Adolescent and Adult High-Performance Tennis Players: A Systematic Review. Sports (Basel) 2025;13(10):336. | systematic review of epidemiology, risk factors and prevention | abstract_only |
| `S16` | McCartney RV, Fallon T, Heron N. Squash Under Strain: A Systematic Review and Meta-Analysis of Injuries and Illnesses in Squash Players. Sports (Basel) 2026;14(2):79. | systematic review and meta-analysis | abstract_only |
| `S17` | Bellm EJV, Lindish J, Mourad W, Owoeye OBA. Understanding Upper Extremity Injury Prevalence and Risk in Pickleball Players: A Nationwide Survey. JOSPT Open 2026;4(2):174-180. | cross-sectional survey | abstract_only |
| `S18` | Sano Y, et al. Differential muscle activation patterns and kinematics during the nordic hamstring exercise and the maximum-speed single-leg bridge test. J Sports Sci 2026;44(21):3015-3026. | cross-sectional comparison of two hamstring tests | abstract_only |
| `S19` | Denadai BS, et al. Explosive Training and Heavy Weight Training are Effective for Improving Running Economy in Endurance Athletes: A Systematic Review and Meta-Analysis. Sports Med 2017;47(3):545-554. | systematic review and meta-analysis | abstract_only |
| `S20` | Fone L, van den Tillaar R. Effect of Different Types of Strength Training on Swimming Performance in Competitive Swimmers: A Systematic Review. Sports Med Open 2022;8(1):19. | systematic review (27 studies) | abstract_only |
| `S21` | Li D, Liu Y. A 45-year global systematic evaluation of musculoskeletal injuries in swimmers: a systematic review and meta-analysis. J Sports Med Phys Fitness 2026;66(1):82-91. | systematic review and meta-analysis (94 studies) | abstract_only |
| `S22` | Rio E, Kidgell D, Purdam C, Gaida J, Moseley GL, Pearce AJ, Cook J. Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. Br J Sports Med 2015;49(19):1277-1283. | within-subject comparison of isometric vs isotonic contractions | abstract_only |
| `S23` | Tyler TF, Thomas GC, Nicholas SJ, McHugh MP. Addition of isolated wrist extensor eccentric exercise to standard treatment for chronic lateral epicondylosis: a prospective randomized trial. J Shoulder Elbow Surg 2010;19(6):917-922. | prospective randomized trial | abstract_only |
| `S24` | Hoogvliet P, Randsdorp MS, Dingemanse R, Koes BW, Huisstede BM. Does effectiveness of exercise therapy and mobilisation techniques offer guidance for the treatment of lateral and medial epicondylitis? A systematic review. Br J Sports Med 2013;47(17):1112-1119. | systematic review with best-evidence synthesis | abstract_only |
| `S25` | Kongsgaard M, Kovanen V, Aagaard P, et al. Corticosteroid injections, eccentric decline squat training and heavy slow resistance training in patellar tendinopathy. Scand J Med Sci Sports 2009;19(6):790-802. | randomized controlled single-blind trial | abstract_only |
| `S26` | Beyer R, Kongsgaard M, Hougs Kjaer B, Ohlenschlaeger T, Kjaer M, Magnusson SP. Heavy Slow Resistance Versus Eccentric Training as Treatment for Achilles Tendinopathy: A Randomized Controlled Trial. Am J Sports Med 2015;43(7):1704-1711. | randomized controlled trial | abstract_only |
| `S27` | Alfredson H, Pietila T, Jonsson P, Lorentzon R. Heavy-load eccentric calf muscle training for the treatment of chronic Achilles tendinosis. Am J Sports Med 1998;26(3):360-366. | prospective case series | abstract_only |
| `S28` | Haroy J, Thorborg K, Serner A, et al. Including the Copenhagen Adduction Exercise in the FIFA 11+ Provides Missing Eccentric Hip Adduction Strength Effect in Male Soccer Players. Am J Sports Med 2017;45(13):3052-3059. | randomized controlled trial | abstract_only |
| `S29` | Afonso J, et al. Strength Training versus Stretching for Improving Range of Motion: A Systematic Review and Meta-Analysis. Healthcare (Basel) 2021;9(4):427. | systematic review and meta-analysis | abstract_only |
| `S30` | Konrad A, Alizadeh S, Daneshjoo A, et al. Chronic effects of stretching on range of motion with consideration of potential moderating variables: a meta-analysis. J Sport Health Sci 2024;13(3):322-334. | meta-analysis with subgroup analyses | abstract_only |
| `S31` | Schumann M, Feuerbacher JF, Sunkeler M, Freitag N, Ronnestad BR, Doma K, Lundberg TR. Compatibility of Concurrent Aerobic and Strength Training for Skeletal Muscle Size and Function: An Updated Systematic Review and Meta-Analysis. Sports Med 2022;52(3):601-612. | systematic review and meta-analysis | abstract_only |
| `S32` | Robineau J, Babault N, Piscione J, Lacome M, Bigard AX. Specific Training Effects of Concurrent Aerobic and Strength Exercises Depend on Recovery Duration. J Strength Cond Res 2016;30(3):672-683. | randomized controlled trial (0 h, 6 h, 24 h recovery groups) | abstract_only |
| `S33` | Tyler TF, Nicholas SJ, Schmitt BM, Mullaney M, Hogan DE. Clinical outcomes of the addition of eccentrics for rehabilitation of previously failed treatments of golfers elbow. Int J Sports Phys Ther 2014;9(3):365-370. | prospective case series | abstract_only |
| `S34` | Holmgren T, Bjornsson Hallgren H, Oberg B, Adolfsson L, Johansson K. Effect of specific exercise strategy on need for surgery in patients with subacromial impingement syndrome: randomised controlled study. BMJ 2012;344:e787. | randomised controlled study | abstract_only |
| `S35` | Thomas E, Bianco A, Paoli A, Palma A. The Relation Between Stretching Typology and Stretching Duration: The Effects on Range of Motion. Int J Sports Med 2018;39(4):243-254. | quantitative synthesis | abstract_only |
| `S36` | McGill SM. Low back stability: from formal description to issues for performance and rehabilitation. Exerc Sport Sci Rev 2001;29(1):26-31. | narrative review | abstract_only |

## Claims

| ID | Source | Claim | Status |
| --- | --- | --- | --- |
| `C01` | `S01` | Brazilian jiu-jitsu is intermittent, with high, moderate and low intensity actions interspersed during matches, and athletes may compete in four to six matches on a competition day. | EVIDENCE CAPTURED |
| `C02` | `S01` | BJJ athletes show VO2max values between 42 and 52 mL/kg/min, and aerobic fitness does not appear to discriminate between competitive levels. | EVIDENCE CAPTURED |
| `C03` | `S01` | Maximal dynamic, isometric and endurance strength can be associated with sporting success in BJJ athletes. | EVIDENCE CAPTURED |
| `C04` | `S02` | In wrestling, anaerobic power and capacity discriminate successful from less successful athletes, and maximal dynamic strength, isometric strength, explosive strength and strength endurance are closely related to high-level performance; flexibility is not a key variable. | EVIDENCE CAPTURED |
| `C05` | `S03` | In a review comparing combat athletes of different competition levels, more successful grappling athletes were characterised by high-force demands and an upward-shifted force-velocity relationship attributed to greater maximal strength, while more successful striking athletes showed smaller differences in maximal force and more notable lighter-load, higher-velocity qualities. | EVIDENCE CAPTURED |
| `C06` | `S03` | Anaerobic capabilities largely distinguish higher- from lower-level combat athletes; longer-term anaerobic efforts seem to define successful grappling athletes while superior striking athletes tend to dominate shorter-term measures. | EVIDENCE CAPTURED |
| `C07` | `S04` | At the 2008 and 2012 Olympic Games judo carried an average injury risk of about 11-12%; sprains, strains and contusions of the knee, shoulder and fingers were most frequent, and being thrown was the most common mechanism. | EVIDENCE CAPTURED |
| `C08` | `S05` | BJJ competition injury incidence was 9.2 per 1000 match exposures in one Hawaiian tournament series; the elbow was the most commonly injured joint and the arm bar the most common mechanism. | EVIDENCE CAPTURED |
| `C09` | `S05` | In that comparison BJJ competitors were at substantially lower injury risk than judo, taekwondo, wrestling and mixed martial arts competitors. | EVIDENCE CAPTURED |
| `C10` | `S06` | In women's netball, poor landing technique/mechanics had the highest mitigation priority (median 5) in a systematic review and Delphi consensus study of injury risk factors. | EVIDENCE CAPTURED |
| `C11` | `S07` | In 32 female netballers, single-leg squat biomechanics were associated with netball-specific leap-landing kinematics linked to ACL loading and injury risk, supporting its use as a movement screen. | EVIDENCE CAPTURED |
| `C12` | `S08` | Across 25 studies, basketball players travelled 5-6 km during live playing time in 40-minute matches at average physiological intensities above lactate threshold and 85% of maximal heart rate, with guards sprinting and shuffling more than forwards and centres and a decline in vigorous activity in the fourth quarter. | EVIDENCE CAPTURED |
| `C13` | `S09` | Structured neuromuscular warm-up programmes combining plyometric, strength, balance/proprioception, mobility and agility exercises for 10-30 minutes, 2-3 times a week, are reported to reduce ACL injury risk by about 60% in adolescent female soccer, basketball and handball players. | EVIDENCE CAPTURED |
| `C14` | `S10` | World Netball rules: a player in possession must pass or shoot within three seconds (Held ball), and after releasing the ball may not touch it again before it touches another player or rebounds from the goalpost (Repossession) — so there is no self-dribble. | EVIDENCE CAPTURED |
| `C15` | `S10` | World Netball footwork: after a one-foot landing a player may step with the second foot in any direction, lift the landing foot, and must pass or shoot before the landing foot is regrounded; the landing foot may not be dragged or slid and hopping is not allowed. | EVIDENCE CAPTURED |
| `C16` | `S11` | FIBA rules: a dribble is legal and may continue, and a player who catches the ball while progressing may take two steps in coming to a stop, passing or shooting; the court is 28 m by 15 m. | EVIDENCE CAPTURED |
| `C17` | `S12` | In elite netball, 17 of 21 ACL injuries occurred from jump-landing actions and only two from cutting; the common scenario was rapid deceleration after jumping to receive a high pass, a wide-base double-footed landing, and deceleration applied predominantly through the injured leg. | EVIDENCE CAPTURED |
| `C18` | `S13` | Weighted average competition injury rate in wrestling is 16.3 per 1000 athletic encounters (AE, the unit the abstract defines) across 8 of 11 competition studies; 5 of 27 database studies give 69.5 per 1000 AE. | EVIDENCE CAPTURED |
| `C19` | `S14` | Pooled time-loss injury incidence is lower in Rugby Union than Rugby League: 19.9 (95% CI 14.2-27.7) vs 24.3 (95% CI 9.1-64.4) per 1000 player hours. | EVIDENCE CAPTURED |
| `C20` | `S15` | High-performance tennis exposes players to repetitive high-load strokes and abrupt directional changes, which raises musculoskeletal injury risk. | EVIDENCE CAPTURED |
| `C21` | `S16` | Pooled squash injury rate is 0.74 per 365 athlete-days (95% CI 0.26-2.07) and 2.01 per 1000 athlete-days (95% CI 0.72-5.67), with very high heterogeneity; lower-limb soft-tissue injuries are most common. | EVIDENCE CAPTURED |
| `C22` | `S17` | 39.0% of 1758 surveyed pickleball players reported at least one upper-extremity injury in 12 months; 16.2% reported time-loss injuries. | EVIDENCE CAPTURED |
| `C23` | `S18` | In 17 healthy male recreational athletes, the maximum-speed single-leg bridge test produced greater peak semitendinosus activation than the Nordic hamstring exercise, with activation and external force at longer hamstring lengths. | EVIDENCE CAPTURED |
| `C24` | `S19` | Explosive and heavy weight training improve running economy in endurance athletes (-4.83% and -3.65%), while isometric training did not reach significance. | EVIDENCE CAPTURED |
| `C25` | `S20` | Across 27 studies no single strength-training method was clearly best for swimming performance; combined swimming and strength training seemed to have a better effect than a swim-only approach to training. | EVIDENCE CAPTURED |
| `C26` | `S21` | Across 94 studies and 10,973 swimmers, shoulder injuries were reported in 70.2% of studies, knee in 36.1% and arm/forearm in 21.2%. | EVIDENCE CAPTURED |
| `C27` | `S22` | Isometric contractions reduced pain more than isotonic contractions in patellar tendinopathy (single-leg decline squat pain 7.0 to 0.17 vs 6.33 to 3.75) and released cortical inhibition, while isotonic contractions did not change inhibition. | EVIDENCE CAPTURED |
| `C28` | `S23` | Adding isolated eccentric wrist extensor exercise to standard treatment produced larger improvements than standard treatment alone (DASH 76% vs 13%, VAS 81% vs 22%). | EVIDENCE CAPTURED |
| `C29` | `S24` | In lateral epicondylitis, moderate evidence supports stretching plus strengthening over ultrasound plus friction massage; the included RCTs cover lateral epicondylitis only. | EVIDENCE CAPTURED |
| `C30` | `S25` | Heavy slow resistance training produced good short- and long-term clinical effects in patellar tendinopathy, and HSR was the most satisfied group at the half-year follow-up. | EVIDENCE CAPTURED |
| `C31` | `S26` | Heavy slow resistance and eccentric training did not differ significantly in clinical or structural improvement in Achilles tendinopathy over 12 weeks and at 52 weeks; this is no detected difference, not proof of equivalence. | EVIDENCE CAPTURED |
| `C32` | `S27` | After 12 weeks of heavy-load eccentric calf training, all 15 recreational athletes with chronic Achilles tendinosis returned to full running, with pain down and injured-side calf strength no longer significantly different from the uninjured side. | EVIDENCE CAPTURED |
| `C33` | `S28` | In U19 elite male soccer players, adding the Copenhagen adduction exercise to FIFA 11+ produced a between-group difference of 0.29 Nm/kg (8.9%) in eccentric hip adduction strength change; the standard group showed no significant within-group change. | EVIDENCE CAPTURED |
| `C34` | `S29` | No difference was detected between strength training and stretching for range of motion, although the included studies were highly heterogeneous; this does not establish equivalence. | EVIDENCE CAPTURED |
| `C35` | `S30` | Stretch training increases range of motion with a moderate overall effect, and PNF and static stretching produced greater gains than ballistic or dynamic stretching. | EVIDENCE CAPTURED |
| `C36` | `S31` | Across 43 studies, concurrent aerobic and strength training showed no statistically significant difference in maximal strength (SMD -0.06, 95% CI -0.20 to 0.09, p = 0.446) or hypertrophy (SMD -0.01, 95% CI -0.16 to 0.18, p = 0.919); the intervals allow effects in either direction. | EVIDENCE CAPTURED |
| `C37` | `S31` | Explosive strength was significantly attenuated under concurrent training (SMD -0.28, 95% CI -0.48 to -0.08, p = 0.007), and the attenuation was more pronounced when both qualities were trained in the same session. | EVIDENCE CAPTURED |
| `C38` | `S32` | Strength development under concurrent training depends on the recovery delay: daily training without a recovery period, and to a lesser extent training twice a day (6 h), is not optimal. | EVIDENCE CAPTURED |
| `C39` | `S33` | In 20 patients with chronic medial epicondylosis, DASH improved from 34.7 to 7.9 and the sports module (18 patients) from 73.9 to 13.2 after isolated eccentric exercise was added to treatment (both p<.001); this is an uncontrolled case series reporting improvement observed after treatment, not proof of a causal effect. | EVIDENCE CAPTURED |
| `C40` | `S34` | A specific exercise strategy focusing on eccentric rotator-cuff and scapular strengthening produced a greater Constant-Murley improvement than a control programme (24 vs 9 points) and more successful outcomes. | EVIDENCE CAPTURED |
| `C41` | `S35` | In a review of long-term stretching, static stretching of at least 5 minutes per week over at least 5 days per week may be beneficial for range of motion, and weekly frequency was positively associated with range-of-motion gains. | EVIDENCE CAPTURED |
| `C42` | `S36` | The low-back stability framework aims to challenge muscle systems to achieve functional stability while sparing the spine excessive load. | EVIDENCE CAPTURED |
