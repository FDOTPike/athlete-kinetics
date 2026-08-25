/**
 * verify_ci_structure.mjs — PURE, falsifiable assertions about the CI workflow's
 * SHAPE (Hermes audit r5, advisory H-2).
 *
 * Why this module exists. The structure gate used to live inline in
 * `verify_store_sql.mjs` and matched strings against the workflow text. It
 * proved the candidate APK was BUILT, GATED and UPLOADED in that order — but
 * GitHub Actions has several ways to keep those strings in place while removing
 * their effect, and the inline gate saw none of them:
 *
 *   - `continue-on-error: true` on the gate step: the command runs, fails, and
 *     the job succeeds anyway;
 *   - `continue-on-error: true` on the job: the job fails and the workflow
 *     succeeds anyway;
 *   - a job-level `if:`: the job never runs at all;
 *   - a step-level `if:` on the gate: the gate is skipped while every other
 *     assertion still passes.
 *
 * Hermes reproduced the first two. All four are now rejected, and — the reason
 * this is a module rather than more inline strings — each one has a permanent
 * fixture in `test_verify_ci_structure.mjs`. A gate with no falsifiers is a
 * gate nobody has tried to break.
 *
 * Everything here is a pure function of workflow TEXT: no filesystem, no YAML
 * dependency (the repo has none, and adding one to read a file we already
 * parse structurally would be its own supply-chain decision).
 */

/** The command that gates the real candidate artifact. */
export const GATE_COMMAND = 'npm run verify:qa-candidate';
/** The artifact that command gates. */
export const CANDIDATE_ARTIFACT = 'apk/qa/app-qa.apk';
/** The suite the prerequisite job must run, and the ones it must NOT. */
export const PREREQ_COMMAND = 'npm run verify:ci';

/**
 * Remove `#` comments. Comments are prose: a step that RUNS something and a
 * comment that MENTIONS it must never be confused, in either direction.
 */
export function stripYamlComments(text) {
  return String(text ?? '').split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .join('\n');
}

/**
 * Split a workflow into its jobs. Jobs are two-space keys under `jobs:`; job
 * keys sit at four spaces, steps are six-space list items.
 */
export function splitJobs(yamlText) {
  const text = String(yamlText ?? '');
  const jobsAt = text.indexOf('\njobs:');
  const out = new Map();
  if (jobsAt === -1) return out;
  const headers = [...text.matchAll(/\n {2}([A-Za-z0-9_-]+):\s*\n/g)]
    .filter((m) => m.index > jobsAt);
  headers.forEach((m, i) => {
    const start = m.index;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    out.set(m[1], text.slice(start, end));
  });
  return out;
}

/** Split a job body into its step blocks (six-space `- ` list items). */
export function splitSteps(jobBody) {
  const text = String(jobBody ?? '');
  const marks = [...text.matchAll(/\n {6}- /g)];
  return marks.map((m, i) => {
    const start = m.index;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    return text.slice(start, end);
  });
}

/** A step whose (comment-stripped) text contains `needle`. */
const stepContaining = (steps, needle) => steps.find((s) => s.includes(needle));

/**
 * A step or job is NEUTRALISED when it still contains its command but cannot
 * fail the build: `continue-on-error` swallows the failure, `if:` can skip it
 * entirely. Both are legitimate Actions features and both are fatal here.
 */
function neutralisers(block, { level }) {
  const found = [];
  // Job keys sit at 4 spaces; step keys at 8.
  const indent = level === 'job' ? ' {4}' : ' {8}';
  if (new RegExp(`\\n${indent}continue-on-error:`).test(block)) found.push('continue-on-error');
  if (new RegExp(`\\n${indent}if:`).test(block)) found.push('if');
  return found;
}

/**
 * Assert the workflow genuinely builds, gates and publishes the candidate.
 *
 * @param {string} yamlText raw `.github/workflows/ci.yml`
 * @param {{gateCount?: number|null}} [opts] expected documented gate count
 * @returns {{ok: boolean, problems: string[], observed: object}}
 */
export function checkWorkflowStructure(yamlText, { gateCount = null } = {}) {
  const problems = [];
  const raw = String(yamlText ?? '');
  const text = stripYamlComments(raw);
  const jobs = splitJobs(text);
  const observed = { jobNames: [...jobs.keys()], prereq: null, gateCount: null };

  const android = jobs.get('android-apk');
  if (!android) {
    problems.push('no `android-apk` job: the candidate artifact is not built by CI at all');
    return { ok: false, problems, observed };
  }

  // --- the job must be reachable and able to fail -------------------------
  const androidNeutralised = neutralisers(android, { level: 'job' });
  if (androidNeutralised.length > 0) {
    problems.push(`android-apk carries job-level ${androidNeutralised.join(' and ')}: the job `
      + 'can be skipped or its failure swallowed while every other assertion still passes');
  }

  const needs = android.match(/\n {4}needs:\s*([A-Za-z0-9_-]+)/);
  observed.prereq = needs ? needs[1] : null;
  if (!needs) {
    problems.push('android-apk declares no `needs:` prerequisite');
  } else {
    const prereq = jobs.get(needs[1]);
    if (!prereq) {
      problems.push(`android-apk needs \`${needs[1]}\`, which is not a job in this workflow`);
    } else {
      if (!prereq.includes(PREREQ_COMMAND)) {
        problems.push(`the prerequisite job \`${needs[1]}\` does not run \`${PREREQ_COMMAND}\`, `
          + 'so the candidate is built on top of an unverified tree');
      }
      if (/npm run verify:(release|all)\b/.test(prereq)) {
        problems.push(`the prerequisite job \`${needs[1]}\` runs verify:release/verify:all, which `
          + 'no runner can satisfy honestly (it needs an authorized device packet) — the job '
          + 'would never go green and android-apk would never run');
      }
      const prereqNeutralised = neutralisers(prereq, { level: 'job' });
      if (prereqNeutralised.length > 0) {
        problems.push(`the prerequisite job \`${needs[1]}\` carries job-level `
          + `${prereqNeutralised.join(' and ')}: it cannot gate anything`);
      }
    }
  }

  // --- build -> gate -> publish, each genuinely effective -----------------
  const steps = splitSteps(android);
  const iAssemble = android.indexOf('assembleQa');
  const iGate = android.indexOf(GATE_COMMAND);
  const iUpload = android.indexOf(CANDIDATE_ARTIFACT);

  if (iAssemble === -1) problems.push('android-apk never runs `assembleQa`: no candidate is built');
  if (iGate === -1) problems.push(`android-apk never runs \`${GATE_COMMAND}\`: the candidate is ungated`);
  if (iUpload === -1) problems.push(`android-apk never uploads \`${CANDIDATE_ARTIFACT}\``);

  if (iAssemble !== -1 && iGate !== -1 && iUpload !== -1) {
    if (!(iAssemble < iGate && iGate < iUpload)) {
      problems.push(`order must be assembleQa -> ${GATE_COMMAND} -> upload ${CANDIDATE_ARTIFACT} `
        + `(saw ${iAssemble}, ${iGate}, ${iUpload}) — publishing before gating publishes an `
        + 'unverified artifact');
    }
  }

  const gateStep = stepContaining(steps, GATE_COMMAND);
  if (gateStep) {
    // The run body must BE the command. `echo '<cmd>'` prints it; `<cmd> || true`
    // discards its exit code. Both leave the string in place.
    const runsIt = new RegExp(`\\n\\s*run:\\s*${GATE_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\n|$)`)
      .test(gateStep);
    if (!runsIt) {
      const line = (gateStep.match(/\n\s*run:.*/) ?? ['(no run: line)'])[0].trim();
      problems.push(`the gate step does not RUN the command as its whole run body: ${line.slice(0, 80)}`);
    }
    const gateNeutralised = neutralisers(gateStep, { level: 'step' });
    if (gateNeutralised.length > 0) {
      problems.push(`the gate step carries ${gateNeutralised.join(' and ')}: it runs but cannot `
        + 'fail the build, which is indistinguishable from not gating at all');
    }
  }

  for (const [label, needle] of [['assembleQa', 'assembleQa'], ['candidate upload', CANDIDATE_ARTIFACT]]) {
    const step = stepContaining(steps, needle);
    if (!step) continue;
    const n = neutralisers(step, { level: 'step' });
    if (n.length > 0) {
      problems.push(`the ${label} step carries ${n.join(' and ')}: it can be skipped or fail silently`);
    }
  }

  const uploadStep = stepContaining(steps, CANDIDATE_ARTIFACT);
  if (uploadStep && !/if-no-files-found:\s*error/.test(uploadStep)) {
    problems.push('the candidate upload does not set `if-no-files-found: error`, so a missing '
      + 'artifact publishes nothing and still succeeds');
  }

  // --- documented gate count stays in lockstep ----------------------------
  const counts = [...raw.matchAll(/\((\d+)\s+gates/g)].map((m) => Number(m[1]));
  observed.gateCount = counts;
  if (gateCount !== null) {
    if (counts.length === 0) problems.push('ci.yml documents no gate count');
    else if (!counts.every((c) => c === gateCount)) {
      problems.push(`ci.yml documents gate counts ${counts.join(',')} but verify:ci runs ${gateCount}`);
    }
  }

  return { ok: problems.length === 0, problems, observed };
}
