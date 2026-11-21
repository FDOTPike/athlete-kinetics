/**
 * denialGrammar.ts — Whole-sentence symptom-denial grammar ported verbatim
 * from the sealed-holdout-verified `r15/denial-floor` policy lock
 * (gate_lock.json SHA-256 cffb0dfbb8608cf83b8c04bbcde3e24f198dfa5a030ab45fcb74a1b8d4b8da47).
 *
 * A note is dismissed as a harmless denial ONLY when every clause matches one
 * of the anchored whole-sentence shapes start-to-end and at least one clause
 * is explicit denial evidence. Nothing may be left over; there is no word
 * skipping and no wildcard.
 *
 * By construction, this grammar can only turn a non-halt answer into "nothing
 * changes". It never overrides a halt and never invents a guardrail.
 */

export const DENIAL_GRAMMAR_MAX_LENGTH = 200;
export const DENIAL_GRAMMAR_MAX_CLAUSES = 4;

const BODY =
  '(?:back|knee|knees|shoulder|shoulders|hip|hips|elbow|elbows|neck|wrist|wrists|ankle|ankles|spine|hamstring|hamstrings|quad|quads|calf|calves|groin|rib|ribs|achilles|forearm|forearms|bicep|biceps|tricep|triceps|chest|leg|legs|arm|arms|foot|feet|hand|hands|head|glute|glutes|muscle|muscles|joint|joints|body)';
// "Left" and "right" count only directly in front of a body part.
const BODY_PART = `(?:(?:left|right|lower|upper) )?${BODY}`;
const MY = '(?:my |the )?';
const SYMPTOM_NOUN =
  '(?:pain|pains|ache|aches|soreness|stiffness|tightness|dizziness|lightheadedness|sickness|illness|fever|cough|nausea|tiredness|fatigue|exhaustion|weakness|numbness|tingling|swelling|trouble|troubles|issue|issues|problem|problems|niggle|niggles|twinge|twinges|injury|injuries|strain|strains|headache|headaches|symptom|symptoms|discomfort|cramp|cramps|cramping|doms|tenderness)';
const SYMPTOM_ADJECTIVE =
  '(?:painful|sore|stiff|tight|dizzy|lightheaded|faint|sick|ill|unwell|feverish|nauseous|tired|fatigued|exhausted|weak|numb|tingly|swollen|injured|strained|tender|achy|aching|hurting|hurt)';

const WEEKDAY = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
const TIME_NOW =
  '(?:today|tonight|now|right now|at all|anymore|any more|anywhere|currently|so far|whatsoever|this morning|this afternoon|this evening)';
const ACTIVITY =
  '(?:run|session|training|workout|warm up|warmup|squats|deadlifts|lift|lifts|lifting|walk|race|sprints|gym|ride|swim|set|sets|reps|rows|practice|class|rolling|sparring|drilling)';
const WHEN_TRAINING = `(?:during|after|in|from|through|throughout) (?:the |my |that |this |today's |todays |yesterday's |yesterdays |${WEEKDAY}'?s )?(?:whole |entire )?${ACTIVITY}`;
const GOOD_END =
  '(?:all good|all fine|feeling good|feeling fine|feeling great|feel good|feel fine|feel great|ready to train|ready to go|good to go)';
// What may follow the denial itself: when, during what, and a plain "feeling good". Then the clause must end.
const TAIL = `(?: (?:${TIME_NOW}|${WHEN_TRAINING})){0,3}(?: ${GOOD_END})?`;

const SAYING =
  '(?:(?:i (?:have|feel|felt|got)|i am (?:having|feeling)|have|got|feeling|felt|there is|there are|trained|training|ran|lifted|squatted|session) )?';
const NONE_OF = `(?:${SAYING}(?:no more|not any|no|zero|without any|without)|(?:i )?(?:do|did) not have(?: any)?|(?:i am )?not (?:feeling|having|getting) any|(?:i am )?not in(?: any)?)`;
const SAFE_BODY_PART = `(?:(?:left|right|lower|upper) )?(?!chest|head|rib)${BODY}`;
const HAS_GONE =
  '(?:has|have|is|are) (?:all |completely |fully |totally )?(?:gone away|gone|cleared up|cleared|resolved|healed)(?: (?:now|today|completely|fully)){0,2}';
const whole = (body: string): RegExp => new RegExp(`^${body}$`);

// Every pattern is anchored at both ends. "X or Y" shares a denial; "X and Y" is split into two clauses that must each stand alone.
const EVIDENCE: readonly RegExp[] = [
  // "no knee pain today", "trained without any pain in the shoulder", "no dizziness or chest pain"
  whole(
    `(?:${MY}${BODY_PART} )?${NONE_OF} (?:${BODY_PART} )?${SYMPTOM_NOUN}(?: (?:or|nor) (?:any )?(?:${BODY_PART} )?${SYMPTOM_NOUN})*(?: in ${MY}${BODY_PART})?${TAIL}`,
  ),
  // "not dizzy", "i am not feeling sick or dizzy today"
  whole(`(?:(?:i am|i feel|i felt|am|feeling|felt) )?not (?:feeling )?${SYMPTOM_ADJECTIVE}(?: (?:or|nor) ${SYMPTOM_ADJECTIVE})*${TAIL}`),
  // "my knee is not sore today", "hamstring is not bothering me any more"
  whole(`${MY}${BODY_PART} (?:is|are|feels|feel) not (?:${SYMPTOM_ADJECTIVE}|bothering me)(?: (?:or|nor) ${SYMPTOM_ADJECTIVE})*${TAIL}`),
  // "my knee does not hurt anymore"
  whole(`${MY}${BODY_PART} (?:does|do|did) not (?:hurt|ache|bother me)${TAIL}`),
  // "pain free", "my ankle is pain free today", "pain free shoulder today"
  whole(`(?:(?:i am|am|feeling|felt|completely|totally|${MY}${BODY_PART} (?:is|feels|felt)) )*(?:pain|symptom|injury) free(?: ${MY}${BODY_PART})?${TAIL}`),
  // "the soreness has cleared up": aches only. Danger signs (chest, head, ribs) are excluded.
  // "Settled" is deliberately excluded: it can mean eased, not gone.
  whole(`${MY}(?:${SAFE_BODY_PART} )?(?:ache|aches|soreness|stiffness|niggle|niggles|doms|cramp|cramps|tenderness) ${HAS_GONE}`),
  whole(`${MY}${SAFE_BODY_PART} (?:pain|pains|tightness|twinge|discomfort|strain) ${HAS_GONE}`),
  // "the traffic is a pain in the neck": only these non-body subjects, nothing else in the clause.
  whole(
    `(?:the |this |that |my )?(?:spreadsheet|paperwork|admin|traffic|queue|commute|parking|tax return|taxes|boss|meeting|software|wifi|internet|weather|app)(?: at work| at the gym| for the squat rack| for the rack)? (?:is|was) (?:a|such a) (?:real |right |total |massive |bit of a )?pain(?: in the (?:neck|arse|ass|backside|butt))?`,
  ),
];

// A clause that is not evidence may only be one of these plain remarks.
const REMARK: readonly RegExp[] = [
  whole(
    `(?:(?:so|i am|i feel|am|feeling|all|everything is|everything feels|body is|body feels) )*(?:(?:really|very|completely|totally|perfectly|absolutely) )?(?:fine|good|great|ok|okay|well|strong|fresh|healthy|normal)(?: (?:today|now|to go)){0,2}`,
  ),
  whole('(?:(?:i am|am|feeling) )?ready(?: to (?:train|go|lift|run))?'),
  whole('(?:great|good|solid|strong) (?:session|workout|run|training)(?: today)?'),
];

const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[\u2019`]/g, "'")
    .replace(/\bcan'?t\b/g, 'cannot')
    .replace(/\bwon'?t\b/g, 'will not')
    .replace(/\b(do|does|did|is|are|was|were|has|have|had|would|could|should)n'?t\b/g, '$1 not')
    .replace(/\bi'?m\b/g, 'i am')
    .replace(/\bi'?ve\b/g, 'i have')
    .replace(/([a-z])-([a-z])/g, '$1 $2');

// Symbols that carry no complaint (checkmark, thumbs-up, flexed biceps, variation selector).
// Any other character outside [a-z' .,;!] leaves the note alone.
const PLAIN_SYMBOLS = /[\u2705\u{1F44D}\u{1F4AA}\uFE0F]/gu;

/**
 * True only when every clause of the note is, word for word, one of the listed
 * shapes, and at least one clause is explicit denial evidence.
 */
export function isHarmlessDenial(text: string): boolean {
  if (typeof text !== 'string' || text.length > DENIAL_GRAMMAR_MAX_LENGTH) return false;
  const t = normalise(text).replace(PLAIN_SYMBOLS, ' ');
  if (!/^[a-z' .,;!]+$/.test(t)) return false;
  const clauses = t
    .split(/[.,;!]+|\s+(?:and|but)\s+/)
    .map((c) => c.trim().replace(/ +/g, ' '))
    .filter((c) => c.length > 0);
  if (clauses.length === 0 || clauses.length > DENIAL_GRAMMAR_MAX_CLAUSES) return false;
  let evidence = 0;
  for (const clause of clauses) {
    if (EVIDENCE.some((p) => p.test(clause))) evidence += 1;
    else if (!REMARK.some((p) => p.test(clause))) return false;
  }
  return evidence > 0;
}
