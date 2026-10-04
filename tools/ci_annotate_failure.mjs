/**
 * ci_annotate_failure.mjs — surface the decisive lines of a failed build log as
 * GitHub Actions error annotations.
 *
 *   node tools/ci_annotate_failure.mjs <log> [<log> ...]
 *
 * Job logs and artifacts are stored in blob storage that some reviewers (and
 * sandboxed agents) cannot reach; annotations are served by the GitHub API
 * itself. This prints at most 10 `::error::` lines (GitHub keeps 10 error
 * annotations per step): the compiler/linker `error:` lines first, then the
 * "The following build commands failed:" summary. Content-free beyond what the
 * build log already contains — no environment, no secrets. Never fails the job.
 */
import { existsSync, readFileSync } from 'node:fs';

const MAX = 10;
const escape = (text) => text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const out = [];
for (const path of process.argv.slice(2)) {
  if (!existsSync(path)) continue;
  const lines = readFileSync(path, 'utf8').split('\n');
  const errors = [...new Set(lines.filter((line) => /(^|\s)(fatal )?error:/i.test(line)).map((line) => line.trim()))];
  for (const line of errors) out.push(`${path}: ${line}`.slice(0, 900));
  const failedAt = lines.findIndex((line) => line.includes('The following build commands failed:'));
  if (failedAt !== -1) out.push(`${path}: ${lines.slice(failedAt, failedAt + 8).map((line) => line.trim()).join(' | ')}`.slice(0, 900));
}
for (const message of out.slice(0, MAX)) console.log(`::error title=build log::${escape(message)}`);
if (out.length === 0) console.log('::error title=build log::no error lines found in the given logs');
