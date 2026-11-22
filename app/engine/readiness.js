  /* ---------- Paid Fox Stage 1 (Establish Baseline): business profile, check results, readiness ----------
     Google Ads only. Every account is Stage 1 for now (exit and progression are deferred). Only the deterministic
     gates set a category's state; every other check is advisory. No AI: every result comes from code. */

  /* ---- Business profile (BP-1). Owned by Executive Fox, one shared record per business at
     clients/<client>/profile/business. Each field is { state, value }: state is 'answered', 'skipped', 'unsure'
     (I'm not sure) or 'empty' (never asked or cleared). Only 'answered' counts as an answer. ---- */
  const PROFILE_FIELDS = ['services', 'priorities', 'objectives', 'customers', 'markets', 'customerValue'];
  const PROFILE_STATES = ['answered', 'skipped', 'unsure', 'empty'];
  // The five questions, in plain words (no ad-platform terms). Question 4 asks two fields.
  const PROFILE_QUESTIONS = [
    { n: 1, fields: ['services'], q: 'What products or services does your business offer?' },
    { n: 2, fields: ['priorities'], q: 'Which of them do you want to prioritize?' },
    { n: 3, fields: ['objectives'], q: 'What are your main business goals?' },
    { n: 4, fields: ['customers', 'markets'], q: 'Who are your customers, and where can you serve them?' },
    { n: 5, fields: ['customerValue'], q: 'What is a new customer worth to your business?' },
  ];
  const FIELD_LABEL = { services: 'your services', priorities: 'your priority services', objectives: 'your business goals', customers: 'who your customers are', markets: 'where you can serve customers', customerValue: 'what a new customer is worth' };
  const fieldQ = f => PROFILE_QUESTIONS.find(x => x.fields.includes(f));
  // Business goals, and the Google Ads conversion categories that count as reaching each one (GC-1).
  const OBJECTIVES = {
    enquiries: { label: 'More enquiries (contact forms, emails)', cats: ['SUBMIT_LEAD_FORM', 'CONTACT', 'REQUEST_QUOTE', 'IMPORTED_LEAD', 'QUALIFIED_LEAD', 'CONVERTED_LEAD'] },
    bookings: { label: 'More booked appointments', cats: ['BOOK_APPOINTMENT', 'IMPORTED_LEAD', 'QUALIFIED_LEAD', 'CONVERTED_LEAD'] },
    calls: { label: 'More phone calls', cats: ['PHONE_CALL_LEAD'] },
    sales: { label: 'More online sales', cats: ['PURCHASE', 'SUBSCRIBE_PAID', 'STORE_SALE'] },
    visits: { label: 'More visits to a shop or clinic', cats: ['STORE_VISIT', 'GET_DIRECTIONS'] },
  };
  const COUNTRY_NAMES = Object.values(COUNTRY);
  const PROFILES = {};
  function setProfile(id, doc) { PROFILES[id] = doc && typeof doc === 'object' ? doc : null; }
  // The one function Paid Fox reads the profile through. Shared data is untrusted, so every value is checked here.
  function profileOf(id) {
    const raw = PROFILES[id] || {}, str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
    const clean = {
      services: v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && str(x.name, 80)).slice(0, 40).map(x => ({ name: str(x.name, 80), priority: x.priority === true })) : [],
      priorities: () => null, // the answer is the priority flag on each service
      objectives: v => Array.isArray(v) ? [...new Set(v.filter(k => Object.prototype.hasOwnProperty.call(OBJECTIVES, k)))] : [],
      customers: v => str(v, 300),
      markets: v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && str(x.name, 80) && COUNTRY_NAMES.includes(x.country)).slice(0, 40).map(x => ({ name: str(x.name, 80), country: x.country })) : [],
      customerValue: v => v && typeof v === 'object' && +v.amount > 0 && isFinite(+v.amount) ? { amount: +v.amount } : null,
    };
    const has = (f, v) => f === 'priorities' ? true : Array.isArray(v) ? v.length > 0 : !!v;
    const fields = {};
    for (const f of PROFILE_FIELDS) {
      const x = raw[f] && typeof raw[f] === 'object' ? raw[f] : {}, value = clean[f](x.value);
      let st = PROFILE_STATES.includes(x.state) ? x.state : 'empty';
      if (st === 'answered' && !has(f, value)) st = 'empty'; // an "answer" with nothing valid in it is no answer
      fields[f] = { state: st, value };
    }
    // Priorities can only be answered once services are.
    if (fields.priorities.state === 'answered' && fields.services.state !== 'answered') fields.priorities.state = 'empty';
    const answered = f => fields[f].state === 'answered';
    return { fields, answered, missing: list => (list || []).filter(f => !answered(f)), updatedAt: +raw.updatedAt || null };
  }

  /* ---- Input map (BP-3): the profile fields each gate and advisory check needs. A missing required field makes that
     check Not Assessed and nothing else. Optional fields sharpen a check but never block it. ---- */
  const CHECK_INPUTS = {
    'DF-1': { required: [], optional: [] }, 'GC-1': { required: ['objectives'], optional: [] }, 'GC-2': { required: [], optional: [] },
    'GC-3': { required: ['markets'], optional: [] }, 'GC-4': { required: [], optional: [] }, 'GC-5': { required: [], optional: [] },
    // Keyword intelligence (Part 3); declared now so the prompts and Not Assessed states have one source.
    'KW-2': { required: ['services'], optional: ['priorities'] }, 'KW-3': { required: ['services'], optional: [] },
    'KW-4': { required: ['services'], optional: ['priorities'] }, 'KW-5': { required: ['services'], optional: ['priorities'] }, 'KW-7': { required: ['services'], optional: [] },
  };
  const checkInputs = id => CHECK_INPUTS[id] || { required: [], optional: [] }; // advisory pm.* checks need no profile field

  /* ---- Categories and gates (RE-2) ---- */
  const CATEGORIES = {
    conversion: { name: 'Conversion Readiness', q: 'Are campaigns optimizing toward the right business outcomes?' },
    structure: { name: 'Campaign Structure & Relevance', q: 'Are we targeting the right demand with the right message?' },
    delivery: { name: 'Delivery Readiness', q: 'Are campaigns set up to deliver and collect useful data?' },
  };
  const GATES = [
    { id: 'DF-1', check: 'gf.conversion_sanity', category: 'conversion', name: 'Primary conversion is recording (interim)', spec: 'GF-BASE-01', interim: true },
    { id: 'GC-1', check: 'pm.1.setup.bidding_conversion', category: 'conversion', name: 'Bidding on the right conversions', spec: 'GF-BASE-02' },
    { id: 'GC-2', check: 'pm.1.setup.not_serving', category: 'delivery', name: 'Nothing blocks delivery', spec: 'GF-BASE-03' },
    { id: 'GC-3', check: 'pm.1.setup.location_presence_interest', category: 'structure', name: 'Ads reach only the areas you serve', spec: 'GF-BASE-04' },
    { id: 'GC-4', check: 'pm.2.creative_lp.no_rsa_in_ad_group', category: 'structure', name: 'Every search ad group has a usable ad', spec: 'GF-BASE-12' },
    { id: 'GC-5', check: 'pm.1.setup.target_far_from_actual', category: 'delivery', name: 'Bidding set up to deliver', spec: 'GF-BASE-13' },
  ];
  const STATUS_RANK = { critical: 3, attention: 2, not_assessed: 1, ok: 0 };

  /* ---- Check result (RE-1): what every gate and advisory check returns. Evidence is stored with the result
     (campaign names, rows, the profile fields used), never recomputed in the UI. ---- */
  function checkResult(o) {
    return Object.assign({ id: null, check: null, kind: 'gate', category: null, name: '', status: 'not_assessed', summary: '', parts: [],
      evidence: { campaigns: [], cols: [], rows: [], profileFields: [] }, missing: { profile: [], data: [] }, asOf: null, interim: false }, o);
  }
  // A gate made of parts: a failing part decides; all parts passing = ok; passing parts beside unassessed ones = Not Assessed.
  function combineParts(parts) {
    const ran = parts.filter(p => p.status !== 'not_assessed');
    if (ran.some(p => p.status === 'critical')) return 'critical';
    if (ran.some(p => p.status === 'attention')) return 'attention';
    return ran.length && ran.length === parts.length ? 'ok' : 'not_assessed';
  }
  const uniq = a => [...new Set(a.filter(Boolean))];
  const lastDays = (cfg, n) => { // ISO days of the n days ending at the last day of data
    const end = cfg.dataThrough ? new Date(cfg.dataThrough + 'T12:00:00') : new Date(END), out = [];
    for (let k = n - 1; k >= 0; k--) out.push(isoD(new Date(end.getFullYear(), end.getMonth(), end.getDate() - k).getTime()));
    return out;
  };

  /* ---- DF-1 interim conversion sanity (INTERIM: Data Fox owns tracking reliability and replaces this later).
     The primary conversion exists, is enabled and recorded a conversion in the last 7 days of data. Nothing deeper.
     Expect false alarms on low-volume accounts; revisit the window if it fires wrongly. ---- */
  const SANITY_DAYS = 7;
  function conversionSanity(cfg) {
    const R = REAL[cfg.id];
    if (!R) return { status: 'unknown', why: 'No Google Ads data loaded.' };
    const days = lastDays(cfg, SANITY_DAYS), S = R.settings;
    let conv = 0; for (const c of cfg.campaigns) for (const d of days) conv += ((R.byDay[c.id] || {})[d] || {}).conv || 0;
    const rows = [], dt = x => new Date(x + 'T12:00:00').getTime(), span = `in ${spanTxt(dt(days[0]), dt(days[days.length - 1]))}`;
    if (S && S.has && S.has.conversions) {
      const prim = S.conversionActions.filter(a => a.primary), on = prim.filter(a => a.status === 'ENABLED');
      for (const a of prim) rows.push([a.name, a.category.toLowerCase().replace(/_/g, ' '), a.status.toLowerCase()]);
      if (!prim.length) return { status: 'unreliable', why: 'No conversion action is set as primary, so nothing counts as a conversion.', rows, conv, span };
      if (!on.length) return { status: 'unreliable', why: `The primary conversion action${prim.length === 1 ? ' is' : 's are'} not enabled.`, rows, conv, span };
    }
    if (conv > 0) return { status: 'reliable', why: `${Math.round(conv * 10) / 10} conversions recorded ${span}.${S && S.has && S.has.conversions ? '' : ' Google Ads counts primary conversions only, so a primary conversion exists and is enabled.'}`, rows, conv, span };
    return { status: 'unreliable', why: `No conversion recorded ${span}${cfg.lastConversion ? ` (the last one was on ${spanTxt(dt(cfg.lastConversion), dt(cfg.lastConversion))})` : ''}.`, rows, conv, span };
  }
  /* ---- DF-2 reliability interface: the one place Paid Fox reads measurement reliability. Returns
     { status: 'reliable' | 'unreliable' | 'unknown', source: 'data-fox' | 'interim', why }. When Data Fox monitors the
     Google Ads conversion endpoint, its finding is the source; otherwise the interim sanity check. Unknown stays unknown. ---- */
  function reliability(cfg, data) {
    const ep = data && Array.isArray(data.eps) && data.eps.find(e => e.ep.id === 'gads');
    if (ep) {
      const w = epWindow(data, 'gads', SANITY_DAYS);
      if (!w) return { status: 'unknown', source: 'data-fox', why: 'Data Fox has no recent data for the Google Ads conversion endpoint.' };
      return { status: epStatus(w.score) === 'bad' ? 'unreliable' : 'reliable', source: 'data-fox', why: `Data Fox scores the Google Ads conversion endpoint ${Math.round(w.score)}/100.` };
    }
    return Object.assign({ source: 'interim' }, conversionSanity(cfg));
  }

  /* ---- The gates ---- */
  function evalGates(cfg, data, profile) {
    const R = REAL[cfg.id], F = settingsFacts(cfg, data), S = F && F.S, has = (S && S.has) || {};
    const out = [];
    for (const g of GATES) {
      const base = { id: g.id, check: g.check, kind: 'gate', category: g.category, name: g.name, interim: !!g.interim, asOf: F ? F.asOf : null };
      const need = profile.missing(checkInputs(g.id).required);
      if (need.length) { out.push(checkResult(Object.assign(base, { status: 'not_assessed', missing: { profile: need, data: [] }, summary: `Needs your answer: ${need.map(f => FIELD_LABEL[f]).join(', ')}.` }))); continue; }
      if (g.id !== 'DF-1' && !F) { out.push(checkResult(Object.assign(base, { status: 'not_assessed', missing: { profile: [], data: ['account settings'] }, summary: 'No settings snapshot in the Google Ads export.' }))); continue; }
      out.push(checkResult(Object.assign(base, GATE_EVAL[g.id](cfg, data, profile, F, S, has, R))));
    }
    return out;
  }
  const naPart = (id, label, what) => ({ id, label, status: 'not_assessed', note: `Not in the Google Ads export yet: ${what}.`, data: what });
  const spendIn = (R, cid, days) => days.reduce((a, d) => a + (((R.byDay[cid] || {})[d] || {}).cost || 0), 0);
  const GATE_EVAL = {
    'DF-1': (cfg, data) => {
      const r = reliability(cfg, data);
      const status = r.status === 'reliable' ? 'ok' : r.status === 'unreliable' ? 'critical' : 'not_assessed';
      return { status, summary: r.why, reliability: r, missing: { profile: [], data: status === 'not_assessed' ? ['conversions'] : [] },
        evidence: { campaigns: [], cols: r.rows && r.rows.length ? ['Primary conversion action', 'Kind', 'Status'] : [], rows: r.rows || [], profileFields: [] } };
    },
    'GC-1': (cfg, data, profile, F, S, has) => {
      const objs = profile.fields.objectives.value, ok = new Set(objs.flatMap(k => OBJECTIVES[k].cats));
      const used = { profileFields: ['objectives'] };
      if (!has.conversions) return { status: 'not_assessed', missing: { profile: [], data: ['conversion actions (primary or secondary, and their kind)'] }, summary: 'The Google Ads export has no list of conversion actions yet, so we can’t see what campaigns bid on.', evidence: Object.assign({ campaigns: [], cols: [], rows: [] }, used) };
      const acts = S.conversionActions, primary = acts.filter(a => a.primary && a.status === 'ENABLED'), rows = [], flagged = [];
      let worst = 'ok';
      for (const c of S.campaigns.filter(c => c.status === 'ENABLED')) {
        const goal = c.goalActions && c.goalActions.length ? acts.filter(a => c.goalActions.includes(a.id)) : primary;
        if (!goal.length) continue; // nothing to bid on: DF-1 covers a missing primary conversion
        for (const a of goal) {
          const secondary = !a.primary, low = !ok.has(a.category);
          if (!secondary && !low) continue;
          rows.push([c.name, a.name, a.category.toLowerCase().replace(/_/g, ' '), secondary ? 'Secondary action used for bidding' : 'Doesn’t match your goals']);
        }
        const bad = goal.filter(a => !a.primary || !ok.has(a.category));
        if (!bad.length) continue;
        flagged.push(c.name);
        const st = bad.length === goal.length ? 'critical' : 'attention'; // nothing it bids on matches your goals → critical
        if (STATUS_RANK[st] > STATUS_RANK[worst]) worst = st;
      }
      return { status: worst, summary: flagged.length ? `${flagged.length} campaign${flagged.length === 1 ? ' bids' : 's bid'} on a secondary action or one that doesn’t match your goals (${objs.map(k => OBJECTIVES[k].label.toLowerCase()).join(', ')}).` : `Every enabled campaign bids on conversions that match your goals.`,
        evidence: Object.assign({ campaigns: flagged, cols: ['Campaign', 'Conversion action', 'Kind', 'Why'], rows }, used) };
    },
    'GC-2': (cfg, data, profile, F, S, has, R) => {
      const days30 = lastDays(cfg, 30), parts = [], rows = [], camps = [];
      const add = (part, list, why) => { parts.push(part); for (const x of list) { rows.push([x.camp, x.what, x.name, x.why || why]); camps.push(x.camp); } };
      const ns = F.ns.map(x => ({ camp: F.cName(x.campaign), what: x.what, name: x.name, why: x.why }));
      add({ id: 'serving', label: 'Enabled campaigns, ad groups and keywords can serve', status: ns.length ? 'attention' : 'ok', check: 'pm.1.setup.not_serving' }, ns);
      const dis = F.dis.map(a => ({ camp: F.cName(a.campaign), what: 'Ad', name: adName(R, a.id), why: 'disapproved' }));
      add({ id: 'disapproved', label: 'No disapproved ads', status: dis.length ? 'attention' : 'ok', check: 'pm.2.creative_lp.creative_disapproved' }, dis);
      const paused = S.campaigns.filter(c => c.status === 'PAUSED' && spendIn(R, c.id, days30) > 0).map(c => ({ camp: c.name, what: 'Campaign', name: c.name, why: `paused, but spent ${money(spendIn(R, c.id, days30), cfg)} in the last 30 days of data` }));
      add({ id: 'paused', label: 'No recently active campaign paused', status: paused.length ? 'attention' : 'ok' }, paused);
      if (has.account) {
        const A = S.account, bad = [];
        if (A.status && A.status !== 'ENABLED') bad.push({ camp: 'Account', what: 'Account', name: 'Google Ads account', why: `status ${A.status.toLowerCase()}` });
        if (A.billingOk === false) bad.push({ camp: 'Account', what: 'Account', name: 'Billing', why: 'billing problem' });
        if (A.policyHold === true) bad.push({ camp: 'Account', what: 'Account', name: 'Policy', why: 'account on a policy hold' });
        add({ id: 'account', label: 'Account, billing and policy', status: bad.length ? 'critical' : 'ok' }, bad);
      } else parts.push(naPart('account', 'Account, billing and policy', 'account status, billing and policy holds'));
      if (has.urls) {
        const br = S.ads.filter(a => a.status === 'ENABLED' && a.finalUrlError).map(a => ({ camp: F.cName(a.campaign), what: 'Ad', name: adName(R, a.id), why: `final URL: ${a.finalUrlError}` }));
        add({ id: 'urls', label: 'Final URLs work', status: br.length ? 'attention' : 'ok', check: 'pm.2.creative_lp.landing_page_error' }, br);
      } else parts.push(naPart('urls', 'Final URLs work', 'final URL errors per ad'));
      if (has.eu) {
        const eu = S.campaigns.filter(c => c.status === 'ENABLED' && (!c.euPolitical || c.euPolitical === 'UNSPECIFIED' || c.euPolitical === 'UNKNOWN')).map(c => ({ camp: c.name, what: 'Campaign', name: c.name, why: 'EU political advertising declaration missing' }));
        add({ id: 'eu', label: 'EU political advertising declared', status: eu.length ? 'attention' : 'ok', check: 'pm.1.setup.eu_declaration_missing' }, eu);
      } else parts.push(naPart('eu', 'EU political advertising declared', 'the EU political advertising declaration per campaign'));
      // Critical when nothing can serve: no enabled, serving campaign with an enabled ad group holding an enabled, approved ad.
      const serves = S.campaigns.some(c => c.status === 'ENABLED' && (!c.servingStatus || c.servingStatus === 'SERVING')
        && S.adGroups.some(g => g.campaign === c.id && g.status === 'ENABLED' && S.ads.some(a => a.adGroup === g.id && a.status === 'ENABLED' && a.approval !== 'DISAPPROVED')));
      const blocked = !serves || (S.account && (S.account.billingOk === false || S.account.policyHold === true || (S.account.status && S.account.status !== 'ENABLED')));
      let status = combineParts(parts); if (blocked) status = 'critical';
      const nBad = rows.length;
      return { status, parts, summary: blocked ? 'Nothing in the account can serve ads right now.' : nBad ? `${nBad} blocker${nBad === 1 ? '' : 's'} in ${uniq(camps).length} campaign${uniq(camps).length === 1 ? '' : 's'}.` : 'Nothing found that blocks delivery in the parts we can check.',
        missing: { profile: [], data: parts.filter(p => p.data).map(p => p.data) }, evidence: { campaigns: uniq(camps).filter(x => x !== 'Account'), cols: ['Campaign', 'Item', 'Name', 'Why'], rows, profileFields: [] } };
    },
    'GC-3': (cfg, data, profile, F, S, has, R) => {
      const markets = profile.fields.markets.value, mNames = new Set(markets.map(m => m.name.toLowerCase())), mCountries = new Set(markets.map(m => m.country));
      const wholeCountry = new Set(markets.filter(m => m.name.toLowerCase() === m.country.toLowerCase()).map(m => m.country));
      const parts = [], rows = [], camps = [];
      // 1. Spend by country over the last 30 days of data (country is the finest level in the export)
      const days30 = lastDays(cfg, 30), by = {}; let tot = 0;
      for (const [cid, t] of Object.entries(R.seg || {})) for (const [v, o] of Object.entries(t.country || {})) {
        const sp = days30.reduce((a, d) => a + ((o.days[d] || {}).cost || 0), 0); if (!sp) continue;
        const name = segName('country', v, o.label); (by[name] = by[name] || { spend: 0, camps: new Set() }).spend += sp; by[name].camps.add(cid); tot += sp;
      }
      if (!R.seg || !Object.values(R.seg).some(t => t.country)) parts.push(naPart('spend', 'Spend stays inside your markets', 'spend by country'));
      else {
        const out = Object.entries(by).filter(([n]) => !mCountries.has(n)), outSp = out.reduce((a, [, o]) => a + o.spend, 0), share = tot ? outSp / tot : 0;
        for (const [n, o] of Object.entries(by).sort((a, b) => b[1].spend - a[1].spend)) rows.push([n, mCountries.has(n) ? 'Inside your markets' : 'Outside your markets', o.spend, tot ? `${(100 * o.spend / tot).toFixed(1)}%` : '—']);
        for (const [, o] of out) for (const cid of o.camps) camps.push(F.cName(cid));
        parts.push({ id: 'spend', label: 'Spend stays inside your markets', status: share > 0.1 ? 'critical' : outSp > 0 ? 'attention' : 'ok', note: `${(100 * share).toFixed(1)}% of ${money(tot, cfg)} in the last 30 days of data went outside your markets (country level).`, share });
      }
      // 2. Targeted locations (exclusions considered) against the markets
      if (has.locations) {
        const off = [];
        for (const c of S.campaigns.filter(c => c.status === 'ENABLED' && c.locations)) {
          const excl = new Set(c.locations.filter(l => l.negative).map(l => l.name.toLowerCase()));
          for (const l of c.locations.filter(l => !l.negative && !excl.has(l.name.toLowerCase()))) {
            const inside = mNames.has(l.name.toLowerCase()) || (l.country && wholeCountry.has(l.country)) || (wholeCountry.has(l.name));
            if (!inside) { off.push([c.name, l.name]); camps.push(c.name); }
          }
        }
        parts.push({ id: 'targets', label: 'Targeted locations are inside your markets', status: off.length ? 'attention' : 'ok', note: off.length ? off.map(([c, l]) => `${c} targets ${l}`).join('; ') + '.' : 'Every targeted location is inside your markets.' });
      } else parts.push(naPart('targets', 'Targeted locations are inside your markets', 'targeted and excluded locations per campaign'));
      // 3. Presence or interest (reconciles pm.1.setup.location_presence_interest)
      if (has.geoType) {
        const pi = S.campaigns.filter(c => c.status === 'ENABLED' && c.geoTargetType === 'PRESENCE_OR_INTEREST');
        for (const c of pi) camps.push(c.name);
        parts.push({ id: 'presence', label: 'Ads shown only to people in your markets', status: pi.length ? 'attention' : 'ok', check: 'pm.1.setup.location_presence_interest', note: pi.length ? `${pi.map(c => c.name).join(', ')} also show ads to people only interested in your locations.` : 'Every campaign targets people in or regularly in your locations.' });
      } else parts.push(naPart('presence', 'Ads shown only to people in your markets', 'the “presence or interest” location setting'));
      const status = combineParts(parts);
      return { status, parts, summary: parts.filter(p => p.status !== 'not_assessed' && p.note).map(p => p.note).join(' ') || 'Not enough targeting data to judge yet.',
        missing: { profile: [], data: parts.filter(p => p.data).map(p => p.data) }, evidence: { campaigns: uniq(camps), cols: ['Country', 'Where', 'Spend (30 days)', 'Share'], money: [2], rows, profileFields: ['markets'] } };
    },
    'GC-4': (cfg, data, profile, F, S, has, R) => {
      const search = S.adGroups.filter(g => g.status === 'ENABLED' && F.campOn(g.campaign) && (g.type === 'SEARCH_STANDARD' || ((S.campaigns.find(c => c.id === g.campaign) || {}).channel === 'SEARCH' && !g.type)));
      const rows = [], camps = [];
      for (const g of search) {
        const ads = S.ads.filter(a => a.adGroup === g.id && a.status === 'ENABLED'), rsa = ads.filter(a => a.type === 'RESPONSIVE_SEARCH_AD');
        if (rsa.some(a => a.approval !== 'DISAPPROVED')) continue;
        const why = !ads.length ? 'No enabled ads (also listed under delivery blockers)' : !rsa.length ? 'No responsive search ad' : 'Its responsive search ads are all disapproved';
        rows.push([F.cName(g.campaign), g.name, why, !ads.length]); camps.push(F.cName(g.campaign));
      }
      return { status: rows.length ? 'attention' : 'ok', summary: rows.length ? `${rows.length} search ad group${rows.length === 1 ? ' has' : 's have'} no usable responsive search ad.` : `All ${search.length} enabled search ad group${search.length === 1 ? ' has' : 's have'} a usable responsive search ad.`,
        evidence: { campaigns: uniq(camps), cols: ['Campaign', 'Ad group', 'Why'], rows: rows.map(r => r.slice(0, 3)), noAds: rows.filter(r => r[3]).map(r => r[1]), profileFields: [] } };
    },
    'GC-5': (cfg, data, profile, F, S, has) => {
      const parts = [], rows = [], camps = [], N1 = cfg.convNounOne;
      for (const x of F.targets) { rows.push([F.cName(x.campaign), F.gName(x.g.id), `Target CPA ${money(x.g.targetCpa, cfg)}`, `Best week ${money(x.best, cfg)}, 28 days ${money(x.actual, cfg)} per ${N1}`]); camps.push(F.cName(x.campaign)); }
      parts.push({ id: 'target', label: 'Targets the campaign can reach', status: F.targets.length ? 'attention' : 'ok', check: 'pm.1.setup.target_far_from_actual' });
      const broad = {}; for (const k of F.broad) (broad[k.campaign] = broad[k.campaign] || []).push(k.text);
      for (const [cid, list] of Object.entries(broad)) { rows.push([F.cName(cid), `${list.length} broad-match keyword${list.length === 1 ? '' : 's'}`, `Bidding ${String(F.bidOf(F.broad.find(k => k.campaign === cid)) || 'manual').toLowerCase().replace(/_/g, ' ')}`, 'Broad match without smart bidding']); camps.push(F.cName(cid)); }
      parts.push({ id: 'broad', label: 'Broad match only with smart bidding', status: Object.keys(broad).length ? 'attention' : 'ok', check: 'pm.1.setup.broad_without_smart_bidding' });
      if (has.bidCaps) {
        const capped = S.campaigns.filter(c => c.status === 'ENABLED' && SETUP_SCAN.smartBidding.includes(c.bidding) && (c.bidCeiling > 0 || c.bidFloor > 0));
        for (const c of capped) { rows.push([c.name, String(c.bidding).toLowerCase().replace(/_/g, ' '), [c.bidCeiling > 0 ? `ceiling ${money(c.bidCeiling, cfg, 2)}` : '', c.bidFloor > 0 ? `floor ${money(c.bidFloor, cfg, 2)}` : ''].filter(Boolean).join(', '), 'Bid cap or floor on smart bidding']); camps.push(c.name); }
        parts.push({ id: 'caps', label: 'No bid caps on smart bidding', status: capped.length ? 'attention' : 'ok', check: 'pm.1.setup.bid_cap_on_smart_bidding' });
      } else parts.push(naPart('caps', 'No bid caps on smart bidding', 'bid caps and floors on smart bidding strategies'));
      return { status: combineParts(parts), parts, summary: rows.length ? `${rows.length} bidding finding${rows.length === 1 ? '' : 's'}, each against the campaign’s own target and results.` : 'No bidding setup that conflicts with delivery in the parts we can check.',
        missing: { profile: [], data: parts.filter(p => p.data).map(p => p.data) }, evidence: { campaigns: uniq(camps), cols: ['Campaign', 'Setting', 'Value', 'Why'], rows, profileFields: [] } };
    },
  };

  /* ---- Advisory results (GC-6): every other check that runs, tagged with its category. Never changes a state. ---- */
  function advisoryResults(cfg, recs) {
    const ran = checksRun(cfg), ids = uniq([].concat(ran.setup, ran.creative, ran.audiences, ran.spend));
    return ids.filter(id => PM_TAGS[id] && PM_TAGS[id].kind === 'advisory').map(id => {
      const hit = (recs || []).filter(r => r.check === id);
      return checkResult({ id, check: id, kind: 'advisory', category: PM_TAGS[id].category, name: PM_CHECKS[id] || id, status: hit.length ? 'attention' : 'ok',
        summary: hit.length ? `${hit.length} finding${hit.length === 1 ? '' : 's'}.` : 'Nothing found.', evidence: { campaigns: uniq(hit.map(r => r.campaign)), cols: [], rows: [], profileFields: [] } });
    });
  }

  /* ---- Category state (RE-3): Critical Issues beats Needs Attention beats Ready, never averaged. Ready only when every
     gate is assessed and passed; passed gates beside unassessed ones = Not Assessed. The state cites its checks. ---- */
  const CAT_STATE = { critical: 'Critical Issues', attention: 'Needs Attention', ready: 'Ready', not_assessed: 'Not Assessed' };
  function categoryState(gates) {
    const st = gates.some(g => g.status === 'critical') ? 'critical' : gates.some(g => g.status === 'attention') ? 'attention'
      : gates.length && gates.every(g => g.status === 'ok') ? 'ready' : 'not_assessed';
    const cites = st === 'critical' ? gates.filter(g => g.status === 'critical') : st === 'attention' ? gates.filter(g => g.status === 'attention') : gates.filter(g => g.status === 'ok');
    return { state: st, label: CAT_STATE[st], contributing: cites.map(g => g.id), passed: gates.filter(g => g.status === 'ok').map(g => g.id), notAssessed: gates.filter(g => g.status === 'not_assessed').map(g => g.id) };
  }
  /* ---- Account stage (RE-4): every account is Stage 1 for now. No ad-group-count condition, no exit or progression. ---- */
  function accountStage(gates) {
    const na = gates.filter(g => g.status === 'not_assessed').map(g => g.id);
    return { stage: 1, name: 'Establish Baseline', reason: 'Every account starts in Stage 1 while its baseline is checked. Moving on to Stage 2 isn’t built yet.', provisional: na.length > 0, notAssessed: na };
  }
  // Everything the UI needs for Stage 1, for a client with Google Ads data. recs = the model's recommendations (for advisory results).
  function readiness(cfg, data, profile, recs) {
    if (!cfg.real || !REAL[cfg.id]) return null;
    const gates = evalGates(cfg, data, profile), advisory = advisoryResults(cfg, recs);
    const categories = Object.keys(CATEGORIES).map(k => Object.assign({ id: k }, CATEGORIES[k], categoryState(gates.filter(g => g.category === k)), { gates: gates.filter(g => g.category === k), advisory: advisory.filter(a => a.category === k) }));
    return { stage: accountStage(gates), categories, gates, advisory };
  }

  /* ---- Recommendations for gate findings that no existing check already raises (so they can be acted on). ---- */
  function gateRecs(cfg, rd) {
    if (!rd) return [];
    const recs = [], asOf = (rd.gates.find(g => g.asOf) || {}).asOf || null;
    const mk = (g, key, o) => recs.push(Object.assign({ id: `gate-${g.id.toLowerCase()}-${key}`, agent: 'settings', fox: 'paid', platform: 'gads', kind: 'setup', area: 'setup', unit: 'none', valuePerDay: 0,
      spendChangedPerDay: 0, effort: 'low', minutes: 10, confidence: 'strong', owner: 'You', verifyDays: 7, labels: { spend: null, conv: 'observed' }, focus: 0, draft: true, bet: false, asOf, score: 0,
      check: g.check, gate: g.id, intent: 'corrective', impactTxt: { k: 'Baseline gate', imp: 'Baseline gate', sub: g.name.toLowerCase() },
      expect: 'The gate passes at the next check.', success: 'The gate passes at the next check.', rule: `Stage 1 gate ${g.id} (${g.name}). ${g.summary}`,
      evidence: { cols: g.evidence.cols, rows: g.evidence.rows, money: g.evidence.money || [], rules: [], verdict: asOf ? `${asOf}.` : 'From the latest Google Ads data.' } }, o));
    const G = id => rd.gates.find(g => g.id === id);
    const df = G('DF-1');
    if (df && df.status === 'critical') mk(df, 'conv', { title: 'Google Ads hasn’t recorded a conversion in the last 7 days', confidence: 'moderate', area: 'spend',
      observe: df.summary, means: 'Without recorded conversions, smart bidding has nothing to aim for and every cost-per-lead number is unreliable. On a low-volume account a quiet week can also cause this.',
      action: 'Check in Google Ads that the primary conversion action is enabled and still records (submit a test enquiry), then fix the tag or the action.' });
    const g1 = G('GC-1');
    if (g1 && (g1.status === 'critical' || g1.status === 'attention')) for (const camp of g1.evidence.campaigns) mk(g1, camp.replace(/\W+/g, '_'), { campaign: camp, minutes: 10,
      title: `${camp} bids on conversions that don’t match your goals`, observe: g1.evidence.rows.filter(r => r[0] === camp).map(r => `${r[1]} (${r[2]}): ${r[3].toLowerCase()}`).join('; ') + '.',
      means: 'Smart bidding chases whatever it is told counts as a conversion. If that isn’t a real business outcome, budget drifts to cheap actions that don’t become customers.',
      action: 'Make the action that matches your goal the only primary conversion for this campaign, and set the others to secondary.' });
    const g3 = G('GC-3');
    if (g3 && (g3.status === 'critical' || g3.status === 'attention')) mk(g3, 'markets', { campaign: g3.evidence.campaigns.join(', ') || null, minutes: 15,
      title: g3.status === 'critical' ? 'More than 10% of spend went outside the areas you serve' : 'Ads reach people outside the areas you serve',
      observe: g3.summary, means: 'Clicks from places you can’t serve can’t become customers.',
      action: 'Target only your markets, exclude the rest, and set location targeting to people in or regularly in your locations.' });
    const g4 = G('GC-4');
    if (g4 && g4.status === 'attention') { const only = g4.evidence.rows.filter(r => !(g4.evidence.noAds || []).includes(r[1])); // no-ads groups are already raised by the not-serving check
      if (only.length) mk(g4, 'rsa', { campaign: uniq(only.map(r => r[0])).join(', '), minutes: 30, area: 'creative',
        title: `${only.length} search ad group${only.length === 1 ? ' has' : 's have'} no usable responsive search ad`, observe: only.map(r => `${r[1]} (${r[0]}): ${r[2].toLowerCase()}`).join('; ') + '.',
        means: 'Responsive search ads are the standard search ad. Without an approved one, the ad group shows less often or not at all.',
        action: 'Add a responsive search ad with distinct headlines to each of these ad groups, or fix the disapproval.', evidence: { cols: ['Campaign', 'Ad group', 'Why'], rows: only.map(r => r.slice(0, 3)), money: [], rules: [], verdict: asOf ? `${asOf}.` : '' } }); }
    const g2 = G('GC-2');
    if (g2) { const extra = g2.evidence.rows.filter(r => /^paused|^status|billing|policy|final URL|EU political/.test(r[3])); // serving and disapprovals have their own checks
      if (extra.length) mk(g2, 'blockers', { campaign: uniq(extra.map(r => r[0]).filter(x => x !== 'Account')).join(', ') || null, minutes: 15,
        title: g2.status === 'critical' ? 'Nothing in the account can serve ads' : `${extra.length} more delivery blocker${extra.length === 1 ? '' : 's'} to check`,
        observe: extra.map(r => `${r[2]}: ${r[3]}`).join('; ') + '.', means: 'Blocked items can’t show ads, so the traffic you planned for them isn’t arriving.',
        action: 'Resolve each blocker in Google Ads, or confirm it is intended.', evidence: { cols: ['Campaign', 'Item', 'Name', 'Why'], rows: extra, money: [], rules: [], verdict: asOf ? `${asOf}.` : '' } }); }
    const g5 = G('GC-5');
    if (g5) { const caps = g5.evidence.rows.filter(r => r[3] === 'Bid cap or floor on smart bidding');
      if (caps.length) mk(g5, 'caps', { campaign: caps.map(r => r[0]).join(', '), title: `${caps.length} smart-bidding campaign${caps.length === 1 ? ' has' : 's have'} a bid cap or floor`,
        observe: caps.map(r => `${r[0]}: ${r[1]}, ${r[2]}`).join('; ') + '.', means: 'A cap or floor stops smart bidding from adjusting bids, which can stop the campaign from delivering.',
        action: 'Remove the cap or floor, or move it to a portfolio strategy only where it’s needed.', evidence: { cols: ['Campaign', 'Bidding', 'Cap', 'Why'], rows: caps, money: [], rules: [], verdict: asOf ? `${asOf}.` : '' } }); }
    return recs;
  }

  /* ---- Eligibility (EL-1): each recommendation declares whether it is proactive growth or corrective, and the profile
     fields it needs. Evaluated per recommendation. A growth item missing a needed answer is held, with the reason; a
     corrective item is never held, only qualified (shown, with the answer that would sharpen it). ---- */
  const GROWTH_CHECKS = ['pm.1.setup.search_budget_limited', 'pm.2.spend.cpa_rising', 'pm.2.audiences.segment_cpa_outlier', 'pm.2.spend.budget_shift'];
  function recIntent(r) {
    if (r.intent === 'growth' || r.intent === 'corrective') return r.intent;
    return GROWTH_CHECKS.includes(r.check) || /^ps-realloc-/.test(r.id) || r.kind === 'reallocate' || r.kind === 'scale' ? 'growth' : 'corrective';
  }
  const recNeeds = r => Array.isArray(r.needs) ? r.needs.filter(f => PROFILE_FIELDS.includes(f)) : [];
  function eligibility(r, profile) {
    const intent = recIntent(r), miss = profile.missing(recNeeds(r));
    if (!miss.length) return { intent, state: 'eligible', missing: [] };
    const what = miss.map(f => `“${fieldQ(f).q}”`).join(' and ');
    return intent === 'growth' ? { intent, state: 'held', missing: miss, text: `On hold until you answer ${what} in your business profile.` }
      : { intent, state: 'qualified', missing: miss, text: `Shown without your answer to ${what}; answering it would sharpen this.` };
  }
  // Returns copies of the recommendations with intent, eligibility and (for held growth items) a hold reason.
  function applyEligibility(recs, profile) {
    return recs.map(r => {
      const e = eligibility(r, profile), o = Object.assign({}, r, { intent: e.intent, eligibility: e });
      if (e.state === 'held' && !r.held) o.held = { reason: 'profile', text: e.text, missing: e.missing };
      return o;
    });
  }
