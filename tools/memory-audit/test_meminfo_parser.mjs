/**
 * test_meminfo_parser.mjs — fixture tests for the dumpsys meminfo parser
 * (WO remediation E2). Uses representative Android 15 raw output and proves:
 *   - the TOTAL table row is parsed BY COLUMN, all five metrics separate;
 *   - kB -> bytes conversion is explicit (value * 1024) with raw kB preserved;
 *   - REGRESSION: a later "TOTAL PSS:" summary line can NEVER overwrite the
 *     table-row Private Dirty value;
 *   - missing/odd captures fail honestly (totalRowFound=false, no invention).
 *
 * Run: node tools/memory-audit/test_meminfo_parser.mjs
 */
import { parseMeminfoDump, parseSummaryLine, privateDirtyBytes } from './meminfo_parser.mjs';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// Representative Android 15 `dumpsys meminfo -d com.athletekinetics.qa` shape
// (values realistic for the QA app mid-inference; structure faithful).
const ANDROID15_DUMP = `
Applications Memory Usage (in Kilobytes):
Uptime: 123456789 Realtime: 234567890

** MEMINFO in pid 12345 [com.athletekinetics.qa] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                Total    Dirty    Clean    Dirty    Total     Size    Alloc      Free
------- ------ ------ ------ ------ ------ ------ ------ ------ ------ ------
  Native Heap    48213    47908        4        0    48340   102400    98112    42880
  Dalvik Heap    15672    15420       12        0    15988    24576    21004     3572
 Dalvik Other     8210     8196        4        0     8300
        Stack      128      128        0        0      132
       Ashmem      412      380        0        0     1200
    Other dev       88       12       64        0      200
     .so mmap     5432     1020     3104        0    21400
    .jar mmap        8        0        8        0      144
    .apk mmap      124        0      116        0      512
    .ttf mmap       44        0       44        0      160
    .dex mmap     3220        0     3208        0     3400
    .oat mmap      212        0      208        0      800
   .art mmap      1840     1408      232        0     6100
   Other mmap      912      216      660        0     3300
   EGL mtrack      640      640        0        0      640
    GL mtrack     2816     2816        0        0     2816
      Unknown     6644     6560       76        0     6900
        TOTAL    94600    85144     7540        0   130900   126976   119116     46452

 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:    17512                           -
         Native Heap:    47908                           -
                Code:     3556                           -
               Stack:      128                           -
            Graphics:     3456                            -
       Private Other:     7544
              System:    14952
             Unknown:                                    -

             TOTAL PSS:    94600            TOTAL RSS:   130900       TOTAL SWAP PSS:        0
`;

// Same capture but WITHOUT the table's TOTAL row (e.g. truncated output).
const TRUNCATED_DUMP = ANDROID15_DUMP.replace(/^        TOTAL.*$/m, '');

// Adversarial variant: summary line appears with DIFFERENT values than the
// table row (simulates the historical overwrite bug feeding from the wrong
// source). The parser must keep reporting the TABLE numbers.
const ADVERSARIAL_DUMP = ANDROID15_DUMP.replace(
  'TOTAL PSS:    94600',
  'TOTAL PSS:    12345',
);

function metric(parsed, name) {
  return parsed.samples.find((s) => s.metric === name);
}

console.log('=== meminfo parser fixtures ===');

{
  const p = parseMeminfoDump(ANDROID15_DUMP);
  check('TOTAL table row found', p.totalRowFound);
  check('app name captured', p.appName === 'com.athletekinetics.qa', String(p.appName));
  const pd = metric(p, 'Private Dirty');
  check('Private Dirty from TABLE row', !!pd && pd.kB === 85144 && pd.bytes === 85144 * 1024,
    pd ? `${pd.kB} kB / ${pd.bytes} B` : 'missing');
  const pt = metric(p, 'Pss Total');
  check('Pss Total separate from Private Dirty', !!pt && pt.kB === 94600 && pt.bytes === 94600 * 1024,
    pt ? `${pt.kB} kB` : 'missing');
  const pc = metric(p, 'Private Clean');
  check('Private Clean separate', !!pc && pc.kB === 7540);
  const sd = metric(p, 'SwapPss Dirty');
  check('SwapPss Dirty separate', !!sd && sd.kB === 0);
  const rss = metric(p, 'Rss Total');
  check('Rss Total separate', !!rss && rss.kB === 130900);
  check('all five metrics present exactly once',
    p.samples.length === 5 && new Set(p.samples.map((s) => s.metric)).size === 5,
    JSON.stringify(p.samples.map((s) => s.metric)));
  check('summary line parsed independently (informational)',
    p.summary !== null && p.summary.totalPssKb === 94600 && p.summary.totalPssBytes === 94600 * 1024,
    p.summary ? String(p.summary.totalPssKb) : 'none');
}

{
  const p = parseMeminfoDump(TRUNCATED_DUMP);
  check('truncated dump reports totalRowFound=false honestly', !p.totalRowFound && p.samples.length === 0);
  check('privateDirtyBytes() returns null rather than inventing data',
    privateDirtyBytes(p) === null);
}

{
  const p = parseMeminfoDump(ADVERSARIAL_DUMP);
  const pd = privateDirtyBytes(p);
  check('REGRESSION: "TOTAL PSS:" summary cannot overwrite TABLE Private Dirty',
    pd === 85144 * 1024, `${pd} B`);
  const pt = metric(p, 'Pss Total');
  check('REGRESSION: Pss Total still from TABLE row, not summary line',
    !!pt && pt.kB === 94600, pt ? String(pt.kB) : 'missing');
}

{
  // Direct summary-line unit behavior (parser contract: trimmed line input,
  // exactly as parseMeminfoDump feeds it).
  const s = parseSummaryLine('TOTAL PSS:    12345            TOTAL RSS:   99999');
  check('parseSummaryLine converts kB to bytes explicitly',
    s !== null && s.totalPssBytes === 12345 * 1024 && s.totalPssKb === 12345);
  const s2 = parseSummaryLine('             TOTAL PSS:    12345'.trim());
  check('parseSummaryLine accepts unit-less values after trim',
    s2 !== null && s2.totalPssKb === 12345 && s2.totalPssBytes === 12345 * 1024);
  check('parseSummaryLine rejects non-summary lines', parseSummaryLine('Native Heap 100') === null);
}

console.log(`\n${fail === 0 ? 'ALL PARSER FIXTURES PASSED' : `${fail} PARSER FIXTURE(S) FAILED`}`);
process.exit(fail ? 1 : 0);
