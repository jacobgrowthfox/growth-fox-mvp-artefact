// Stage 1 readiness tests: runs the page's engine files in Node against the Hue Therapy-shaped fixture
// (tools/fixtures/hue-therapy.js) and checks the expected gate and category states. Run:  node tools/readiness-test.js
// The fixture is invented test data; the comparison against real Hue Therapy data has to be done in claude.ai.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDocs, PROFILE_FULL } = require('./fixtures/hue-therapy');

const APP = path.join(__dirname, '..', 'app');
const ENGINE = ['engine/core.js', 'data/clients.js', 'data/endpoints.js', 'data/engineer.js', 'engine/engineer.js', 'engine/real-data.js', 'engine/generate.js',
  'engine/rules.js', 'engine/rubric.js', 'engine/scans.js', 'engine/period-findings.js', 'engine/readiness.js', 'engine/format.js'];

function engine() {
  const ctx = vm.createContext({ console, Date, Math, Intl });
  for (const f of ENGINE) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx, { filename: f });
  return vm.runInContext('GF', ctx);
}
const clone = o => JSON.parse(JSON.stringify(o));
function run(opts, profile) {
  const GF = engine(), cfg = GF.CLIENTS.find(c => c.id === 'hue-therapy');
  if (!GF.setReal(cfg.id, makeDocs(Object.assign({ endT: GF.END }, opts)))) throw new Error('fixture rejected by setReal');
  GF.setProfile(cfg.id, profile === undefined ? clone(PROFILE_FULL) : profile);
  const data = GF.generate(cfg), model = GF.build(cfg, data), prof = GF.profileOf(cfg.id);
  const rd = GF.readiness(cfg, data, prof, model.recs);
  const gate = id => rd.gates.find(g => g.id === id), cat = id => rd.categories.find(c => c.id === id);
  return { GF, cfg, rd, gate, cat, prof, recs: GF.applyEligibility(model.recs.concat(GF.gateRecs(cfg, rd)), prof) };
}

let failed = 0, passed = 0;
function expect(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++; else { failed++; console.log(`FAIL ${name}\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`); }
}
const states = r => Object.fromEntries(r.rd.gates.map(g => [g.id, g.status]));
const cats = r => Object.fromEntries(r.rd.categories.map(c => [c.id, c.state]));

// 1. Today's export, every question answered. Expected findings written in Build notes (QA-1 groundwork).
const base = run({});
expect('1 gates, current export', states(base), { 'DF-1': 'critical', 'GC-1': 'not_assessed', 'GC-2': 'attention', 'GC-3': 'attention', 'GC-4': 'attention', 'GC-5': 'not_assessed' });
expect('1 categories', cats(base), { conversion: 'critical', structure: 'attention', delivery: 'attention' });
expect('1 GC-1 waits for data, not the profile', base.gate('GC-1').missing, { profile: [], data: ['conversion actions (primary or secondary, and their kind)'] });
expect('1 GC-4 names the ad group', base.gate('GC-4').evidence.rows, [['Hue Leads Search', 'Couples therapy', 'No responsive search ad']]);
expect('1 GC-3 cites campaigns', base.gate('GC-3').evidence.campaigns, ['Hue Leads Search', 'Hue Brand']);
expect('1 categories cite contributing checks', base.rd.categories.map(c => c.contributing), [['DF-1'], ['GC-3', 'GC-4'], ['GC-2']]);
expect('1 stage 1, provisional', [base.rd.stage.stage, base.rd.stage.provisional], [1, true]);
expect('1 every advisory check is tagged', base.rd.advisory.every(a => a.kind === 'advisory' && a.category), true);
expect('1 gate recs', base.recs.filter(r => r.gate).map(r => r.id).sort(), ['gate-ask-export', 'gate-df-1-conv', 'gate-gc-2-blockers', 'gate-gc-3-markets', 'gate-gc-4-rsa']);

// 2. No profile at all: only the checks that need an answer become Not Assessed.
const none = run({}, null);
const s1 = states(base), s2 = states(none);
expect('2 GC-1 and GC-3 Not Assessed for the profile', [none.gate('GC-1').missing.profile, none.gate('GC-3').missing.profile], [['objectives'], ['markets']]);
expect('2 nothing else changes', ['DF-1', 'GC-2', 'GC-4', 'GC-5'].map(k => s2[k]), ['DF-1', 'GC-2', 'GC-4', 'GC-5'].map(k => s1[k]));
expect('2 structure still judged on GC-4', cats(none).structure, 'attention');
expect('2 an action asks for each missing answer', none.recs.filter(r => /^gate-ask-/.test(r.id)).map(r => r.id).sort(), ['gate-ask-export', 'gate-ask-markets', 'gate-ask-objectives']);
expect('2 baseline actions rank above the rest', none.recs.filter(r => r.gate).every(r => r.score >= 2e8), true);

// 3. "Not sure" and "skipped" are not answers.
for (const st of ['unsure', 'skipped']) {
  const p = clone(PROFILE_FULL); p.markets = { state: st }; const r = run({}, p);
  expect(`3 markets ${st} → GC-3 Not Assessed`, [r.gate('GC-3').status, r.gate('GC-3').missing.profile], ['not_assessed', ['markets']]);
  expect(`3 markets ${st} keeps its state`, r.prof.fields.markets.state, st);
}

// 4. Full export with problems, conversions recording.
const full = run({ variant: 'full', lastConvDaysAgo: 0 });
expect('4 gates, full export', states(full), { 'DF-1': 'ok', 'GC-1': 'attention', 'GC-2': 'attention', 'GC-3': 'attention', 'GC-4': 'attention', 'GC-5': 'ok' });
expect('4 GC-1 flags the page-view goal', full.gate('GC-1').evidence.rows, [['Hue Leads Search', 'Booking page viewed', 'page view', 'Doesn’t match your goals']]);
expect('4 GC-3 parts', full.gate('GC-3').parts.map(p => [p.id, p.status]), [['spend', 'attention'], ['targets', 'attention'], ['presence', 'attention']]);
const far = run({ variant: 'full', lastConvDaysAgo: 0, outsideShare: 0.2 });
expect('4 >10% of spend outside the markets → critical', far.gate('GC-3').status, 'critical');

// 5. Objective nothing bids on → critical.
{ const p = clone(PROFILE_FULL); p.objectives = { state: 'answered', value: ['calls'] }; const r = run({ variant: 'full', lastConvDaysAgo: 0 }, p);
  expect('5 no primary action matches the goal → critical', r.gate('GC-1').status, 'critical'); }

// 6. Broken primary conversion → Conversion Readiness critical.
{ const r = run({ variant: 'full', lastConvDaysAgo: 0, tweak: d => { for (const a of d['settings-now'].conversionActions) a.status = 'REMOVED'; } });
  expect('6 primary conversion not enabled', [r.gate('DF-1').status, r.cat('conversion').state], ['critical', 'critical']); }

// 7. Nothing can serve → GC-2 critical.
{ const r = run({ tweak: d => { d['settings-now'].campaigns[0].servingStatus = 'ENDED'; } });
  expect('7 nothing can serve', [r.gate('GC-2').status, r.cat('delivery').state], ['critical', 'critical']); }

// 8. Everything fine → Ready everywhere, stage not provisional.
const fine = d => { const S = d['settings-now'];
  S.conversionActions = S.conversionActions.filter(a => a.id !== 'c2');
  S.campaigns[0].geoTargetType = 'PRESENCE'; S.campaigns[0].locations = S.campaigns[0].locations.filter(l => l.name !== 'Malmö'); S.campaigns[1].status = 'ENABLED';
  S.ads[1].type = 'RESPONSIVE_SEARCH_AD'; };
const ready = run({ variant: 'full', lastConvDaysAgo: 0, outsideShare: 0, tweak: fine });
expect('8 all ready', cats(ready), { conversion: 'ready', structure: 'ready', delivery: 'ready' });
expect('8 not provisional', ready.rd.stage.provisional, false);

// 9. Passed gates beside an unassessed one → Not Assessed, with the passed gates listed.
{ const r = run({ variant: 'full', lastConvDaysAgo: 0, outsideShare: 0, tweak: d => { fine(d); for (const c of d['settings-now'].campaigns) { delete c.locations; } } });
  const s = r.cat('structure'); expect('9 structure Not Assessed, GC-4 passed', [s.state, s.passed, s.notAssessed], ['not_assessed', ['GC-4'], ['GC-3']]); }

// 10. Eligibility (EL-1): growth held for a missing answer, corrective never held.
{ const { GF } = base, p = GF.profileOf('hue-therapy');
  GF.setProfile('hue-therapy', Object.assign(clone(PROFILE_FULL), { customerValue: { state: 'unsure' } }));
  const prof = GF.profileOf('hue-therapy');
  const g = GF.eligibility({ id: 'x', check: 'pm.2.spend.cpa_rising', needs: ['customerValue'] }, prof);
  const c = GF.eligibility({ id: 'y', check: 'pm.1.setup.not_serving', needs: ['customerValue'] }, prof);
  const e = GF.eligibility({ id: 'z', check: 'pm.2.spend.cpa_rising' }, prof);
  expect('10 growth held', [g.intent, g.state], ['growth', 'held']);
  expect('10 corrective qualified, not held', [c.intent, c.state], ['corrective', 'qualified']);
  expect('10 no needs → eligible', e.state, 'eligible');
  expect('10 applied hold carries the reason', !!GF.applyEligibility([{ id: 'x', check: 'pm.2.spend.cpa_rising', needs: ['customerValue'] }], prof)[0].held.text, true);
  expect('10 every rec has an intent', base.recs.every(r => r.intent === 'growth' || r.intent === 'corrective'), true); void p; }

// 11. Profile model: invalid answers are not answers; no "number of services" field.
{ const { GF } = base;
  GF.setProfile('hue-therapy', { services: { state: 'answered', value: [] }, markets: { state: 'answered', value: [{ name: 'Moon', country: 'Mars' }] }, numberOfServices: 7 });
  const p = GF.profileOf('hue-therapy');
  expect('11 empty answers become empty', [p.fields.services.state, p.fields.markets.state], ['empty', 'empty']);
  expect('11 profile fields', Object.keys(p.fields), ['services', 'priorities', 'objectives', 'customers', 'markets', 'customerValue']); }

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
