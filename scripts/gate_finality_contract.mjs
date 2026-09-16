#!/usr/bin/env node
/**
 * SP-RACE-1 regression gate — no dependencies, no network, no browser.
 *
 * The bug this exists to stop: the signing gate released the caller at the
 * transaction-kit phase `decided` (statusName ACCEPTED onward) while every
 * contract read in this app asks for `TransactionHashVariant.LATEST_FINAL`,
 * which only sees FINALIZED state. The write succeeded on chain and the UI
 * reported "Finalized create did not produce expected agreement state", with
 * the agreement id thrown away. Observed on SP-DEMO-05.
 *
 * Three invariants, checked against the real source files:
 *   1. reads are LATEST_FINAL  =>  the gate must track to "finalized"
 *   2. every post-write verification goes through readJsonSettled, not readJson
 *   3. the create flow publishes the derived agreement id BEFORE it submits,
 *      and the UI lock is a depth counter an inner scope cannot release
 *
 *   node scripts/gate_finality_contract.mjs
 */
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pass = [];
const fail = [];
const check = (name, ok, detail = '') =>
  (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : ''));

const gate = read('src/TxGate.tsx');
const gl = read('src/genlayer.ts');
const app = read('src/App.tsx');

// ---- 1. finality contract -------------------------------------------------
const readsAreFinal = gl.includes('TransactionHashVariant.LATEST_FINAL');
check('[1] reads request LATEST_FINAL', readsAreFinal);

const trackUntil = gate.match(/trackUntil=(?:"([a-z]+)"|\{'([a-z]+)'\})/);
const tracked = trackUntil ? (trackUntil[1] ?? trackUntil[2]) : '(absent)';
check(
  '[1] gate tracks to finalized, matching the reads',
  !readsAreFinal || tracked === 'finalized',
  `trackUntil=${tracked}; "decided" returns at ACCEPTED and cannot be seen by a LATEST_FINAL read`,
);

// ---- 2. every postcondition polls ----------------------------------------
const bareAfterWrite = [];
const lines = app.split('\n');
let armed = -1;
lines.forEach((line, i) => {
  if (/await withWrite\(/.test(line)) armed = i;
  if (armed >= 0 && i > armed && i - armed <= 6 && /await readJson</.test(line) && !/readJsonSettled</.test(line)) {
    bareAfterWrite.push(`line ${i + 1}: ${line.trim().slice(0, 72)}`);
  }
});
check(
  '[2] no bare readJson postcondition follows a write',
  bareAfterWrite.length === 0,
  bareAfterWrite.join(' | '),
);
check('[2] readJsonSettled exists and is exported', /export async function readJsonSettled/.test(gl));
check(
  '[2] readJsonSettled actually retries',
  /for \(let attempt = 0; attempt < attempts/.test(gl) && /setTimeout/.test(gl),
);
const settledCalls = (app.match(/readJsonSettled</g) || []).length;
check('[2] all six write flows verify through it', settledCalls >= 6, `found ${settledCalls}`);

// ---- 3. the id survives, the lock holds ----------------------------------
const idPos = app.indexOf('setAgreementId(derived)');
const writePos = app.indexOf("withWrite('create_agreement'");
check(
  '[3] agreement id is published before create_agreement is submitted',
  idPos > 0 && writePos > 0 && idPos < writePos,
  `setAgreementId@${idPos}, withWrite@${writePos}`,
);
check('[3] busy lock is a depth counter', /const busy = busyDepth > 0/.test(app));
check(
  '[3] no boolean setBusy survives',
  !/setBusy\(/.test(app),
  'setBusy(false) in an inner finally re-enables the button mid-flight',
);
const guarded = ['create', 'accept', 'propose', 'resolve', 'grantBudget', 'finalize'].filter(
  fn => new RegExp(`async function ${fn}\\([^)]*\\) \\{\\n\\s*enterBusy\\(\\);`).test(app),
);
check('[3] all six handlers take the lock', guarded.length === 6, `guarded: ${guarded.join(', ')}`);

// ---- 4. no silent refusal -------------------------------------------------
// SP-UX-1: a disabled primary action must be accompanied by a reason the
// operator can act on. SP-DEMO-06 stalled because "Evaluate substitute" was
// dark with nothing on screen explaining that a proposal was awaiting the buyer.
for (const name of ['createBlocked', 'proposeBlocked', 'finalizeBlocked', 'buyerBlocked']) {
  check(`[4] ${name} is computed`, new RegExp(`const ${name} = useMemo`).test(app));
  check(`[4] ${name} is rendered`, new RegExp(`<Blocked text=\\{[^}]*${name}`).test(app));
}
check('[4] Blocked component exists', /function Blocked\(/.test(app));
check(
  '[4] every disabled primary action carries a reason',
  (app.match(/<Blocked text=/g) || []).length >= 5,
  `found ${(app.match(/<Blocked text=/g) || []).length}`,
);
check(
  '[4] propose no longer hides its refusal behind a raw status test',
  !/disabled=\{busy \|\| role !== 'Provider' \|\| agreement\.status !== 'ACTIVE'\}/.test(app),
);

// SP-UX-2: the pre-flight verdict must compare against the ORIGINAL manifest,
// which is the contract's anchor — resetting to the ACTIVE manifest would
// reproduce the exact drift that lost the run.
check('[4] CandidateVerdict is rendered on the propose page', /<CandidateVerdict diffs=/.test(app));
check(
  '[4] "Reset to original" resets to original_manifest',
  /setCandidate\(cloneManifest\(agreement\.original_manifest\)\)/.test(app),
);
check(
  '[4] the verdict states whether the model will be called',
  /will NOT be called/.test(app) && /spends one semantic call/.test(app),
);

for (const l of pass) console.log('PASS  ' + l);
for (const l of fail) console.log('FAIL  ' + l);
const total = pass.length + fail.length;
console.log('');
console.log(fail.length ? `GATE: ${fail.length}/${total} FAILED` : `GATE: ${total}/${total} PASS`);
process.exit(fail.length ? 1 : 0);
