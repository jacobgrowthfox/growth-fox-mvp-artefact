  /* ---------- Spend & optimization checks, scanned over a period (real clients) ----------
     For every campaign and every day t of the picked period (days without a row count as 0):
     w7 = days t-6..t, base = the 28 days before w7 (t-34..t-7). Draft thresholds, to validate with the media lead.
     Not implemented: pm.2.spend.roas_falling (e-commerce only) and pm.2.spend.recent_major_edit (no settings history before Nov 2026). */
  const SPEND_SCAN = {
    w7: 7, base: 28, mergeGap: 2,                              // firing days at most 2 days apart merge into one episode
    noConv: { maxConv: 0 },                                    // w7 spend ≥ cfg.spendWatchMin and w7 conversions = 0
    cpaRising: { minBaseConv: 30, factor: 1.25 },              // CPA(w7) ≥ 1.25 × CPA(base), w7 conversions > 0
    convFalling: { minBaseConv: 10, ratio: 0.5 },              // conversions/day in w7 ≤ 0.5 × base
    budgetShift: { minBaseSpendPerDay: 50, up: 1.5, down: 0.5 }, // spend/day in w7 ≥ 1.5× or ≤ 0.5× base
    invalidSpike: { minInv: 5, factor: 2 },                    // w7 invalid clicks ≥ 5 and invalid share ≥ 2× base
  };
  const SCAN_IDS = { noConv: 'pm.2.spend.spend_no_conversions', cpaRising: 'pm.2.spend.cpa_rising', convFalling: 'pm.2.spend.conversions_falling', budgetShift: 'pm.2.spend.budget_shift', invalidSpike: 'pm.2.spend.invalid_clicks_spike' };
  // Returns the episodes found between fromT and toT (timestamps of local days), oldest first.
  function scanSpend(cfg, fromT, toT) {
    const R = REAL[cfg.id];
    if (!cfg.real || !R || !isFinite(fromT) || !isFinite(toT) || toT < fromT) return [];
    const T = SPEND_SCAN, pre = T.w7 + T.base - 1, f0 = new Date(fromT);
    const nDays = Math.round((toT - fromT) / DAY) + 1;
    const dateAt = k => new Date(f0.getFullYear(), f0.getMonth(), f0.getDate() + k); // DST-safe day stepping
    const eps = [], tracks = [];
    for (const camp of cfg.campaigns) {
      const rows = R.byDay[camp.id] || {}, A = { cost: [], clicks: [], conv: [], inv: [] }, dates = [];
      const tr = { cid: camp.id, camp: camp.name, days: [] }; tracks.push(tr); // every day of the range, for the finding's chart
      for (let k = -pre; k < nDays; k++) { const d = dateAt(k), x = rows[isoD(d.getTime())]; dates.push(d); for (const f in A) A[f].push(x ? x[f] || 0 : 0); }
      const P = {}; for (const f in A) { let s = 0; P[f] = [0].concat(A[f].map(v => (s += v))); }
      const S = (f, a, b) => P[f][b + 1] - P[f][a];
      let open = {}; // check → the episode it is building
      for (let k = 0; k < nDays; k++) {
        const j = pre + k;
        const x = { spend7: S('cost', j - 6, j), clicks7: S('clicks', j - 6, j), conv7: S('conv', j - 6, j), inv7: S('inv', j - 6, j),
          spendB: S('cost', j - pre, j - 7), clicksB: S('clicks', j - pre, j - 7), convB: S('conv', j - pre, j - 7), invB: S('inv', j - pre, j - 7) };
        tr.days.push({ t: dates[j].getTime(), x, raw: { cost: A.cost[j], clicks: A.clicks[j], conv: A.conv[j], inv: A.inv[j] }, fired: {} });
        if (!(x.spend7 > 0) && !(x.spendB > 0)) continue; // nothing running: nothing to check
        const fire = [];
        if (x.spend7 >= cfg.spendWatchMin && x.conv7 <= T.noConv.maxConv + 1e-9) fire.push(['noConv']);
        if (x.convB >= T.cpaRising.minBaseConv && x.conv7 > 0 && x.spend7 / x.conv7 >= T.cpaRising.factor * (x.spendB / x.convB)) fire.push(['cpaRising']);
        if (x.convB >= T.convFalling.minBaseConv && x.conv7 / T.w7 <= T.convFalling.ratio * x.convB / T.base) fire.push(['convFalling']);
        const bs = x.spendB / T.base, s7 = x.spend7 / T.w7;
        if (bs >= T.budgetShift.minBaseSpendPerDay && (s7 >= T.budgetShift.up * bs || s7 <= T.budgetShift.down * bs)) fire.push(['budgetShift', s7 >= bs ? 'up' : 'down']);
        const shB = x.clicksB + x.invB > 0 ? x.invB / (x.clicksB + x.invB) : null, sh7 = x.clicks7 + x.inv7 > 0 ? x.inv7 / (x.clicks7 + x.inv7) : 0;
        if (x.inv7 >= T.invalidSpike.minInv && shB != null && sh7 >= T.invalidSpike.factor * shB) fire.push(['invalidSpike']);
        for (const [check, dir] of fire) {
          tr.days[k].fired[check] = dir || true;
          const ep = open[check];
          if (ep && k - ep.lastK <= T.mergeGap + 1) { ep.lastK = k; ep.days++; continue; }
          open[check] = { check, checkId: SCAN_IDS[check], cid: camp.id, camp: camp.name, firstK: k, lastK: k, days: 1, dir, x, sh7, shB };
          eps.push(open[check]);
        }
      }
      for (const ep of eps.filter(e => e.cid === camp.id && !e.rows)) {
        ep.firstT = dates[pre + ep.firstK].getTime(); ep.lastT = dates[pre + ep.lastK].getTime();
        ep.startT = dates[pre + ep.firstK - (T.w7 - 1)].getTime(); // the covered period starts with the first firing day's 7-day window
        ep.rows = []; // every day of the covered period: the 7-day window of the first firing day, then the rest of the episode
        for (let j = pre + ep.firstK - 6; j <= pre + ep.lastK; j++) ep.rows.push([dates[j], A.cost[j], A.clicks[j], A.conv[j], A.inv[j]]);
      }
    }
    const out = eps.sort((a, b) => a.firstT - b.firstT || a.check.localeCompare(b.check)); out.tracks = tracks; return out;
  }
  const dFmt = (t, y) => new Date(t).toLocaleDateString('en-GB', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  const spanTxt = (a, b) => isoD(a) === isoD(b) ? dFmt(a, true) : new Date(a).getFullYear() === new Date(b).getFullYear() ? `${dFmt(a)} – ${dFmt(b, true)}` : `${dFmt(a, true)} – ${dFmt(b, true)}`;
  /* ---------- Audiences: segment CPA outlier, scanned over a period (real clients) ----------
     For every campaign, every segment type with 2+ distinct values in the window (device, country, audience) and
     every day t of the picked period, take the 28 days t-27..t (missing days = 0). Campaign totals come from the
     daily docs. Audience rows don't add up to the campaign (only part of the traffic matches an audience); device rows do.
     Draft thresholds, to validate with the media lead. */
  const SEGMENT_SCAN = {
    days: 28, mergeGap: 2,
    minCampConv: 10,          // campaign conversions in the 28 days
    minSpend: 300,            // segment spend ≥ max(300, 10% of the campaign's 28-day spend)
    minSpendShare: 0.1,
    factor: 2,                // segment CPA ≥ 2 × campaign CPA; with 0 conversions, segment spend ≥ 2 × campaign CPA
  };
  const SEGMENT_ID = 'pm.2.audiences.segment_cpa_outlier';
  // Google Ads country criteria (2000 + ISO 3166 numeric). Also the country list in the business profile's markets question.
  const COUNTRY = { 2208: 'Denmark', 2752: 'Sweden', 2578: 'Norway', 2246: 'Finland', 2352: 'Iceland', 2276: 'Germany', 2528: 'Netherlands', 2056: 'Belgium', 2250: 'France',
    2826: 'United Kingdom', 2372: 'Ireland', 2040: 'Austria', 2756: 'Switzerland', 2380: 'Italy', 2724: 'Spain', 2620: 'Portugal', 2616: 'Poland', 2840: 'United States', 2124: 'Canada', 2036: 'Australia' };
  function segName(type, value, label) {
    if (type === 'device') return { MOBILE: 'Mobile', DESKTOP: 'Desktop', TABLET: 'Tablet', CONNECTED_TV: 'Connected TV', OTHER: 'Other devices' }[value] || `Device ${value}`;
    if (type === 'country') return COUNTRY[value] || `Country ${value}`;
    const m = /^uservertical::(\d+)$/.exec(label || '');
    return m ? `Interest audience ${m[1]}` : `Audience ${value}`;
  }
  // Returns the episodes found between fromT and toT (timestamps of local days), oldest first.
  function scanSegments(cfg, fromT, toT) {
    const R = REAL[cfg.id];
    if (!cfg.real || !R || !R.seg || !isFinite(fromT) || !isFinite(toT) || toT < fromT) return [];
    const T = SEGMENT_SCAN, pre = T.days - 1, f0 = new Date(fromT);
    const nDays = Math.round((toT - fromT) / DAY) + 1, L = pre + nDays;
    const keys = []; for (let k = -pre; k < nDays; k++) keys.push(isoD(new Date(f0.getFullYear(), f0.getMonth(), f0.getDate() + k).getTime()));
    const prefix = arr => { let s = 0; return [0].concat(arr.map(v => (s += v))); };
    const S = (P, j) => P[j + 1] - P[j + 1 - T.days]; // the 28 days ending at index j
    const eps = [], tracks = [];
    for (const camp of cfg.campaigns) {
      const types = R.seg[camp.id]; if (!types) continue;
      const day = R.byDay[camp.id] || {};
      const cSpend = prefix(keys.map(k => day[k] ? day[k].cost : 0)), cConv = prefix(keys.map(k => day[k] ? day[k].conv : 0));
      for (const [type, vals] of Object.entries(types)) {
        const segs = Object.entries(vals).map(([value, s]) => ({ value, label: s.label, detail: s.detail,
          spend: prefix(keys.map(k => s.days[k] ? s.days[k].cost : 0)), conv: prefix(keys.map(k => s.days[k] ? s.days[k].conv : 0)),
          clicks: prefix(keys.map(k => s.days[k] ? s.days[k].clicks : 0)), seen: prefix(keys.map(k => s.days[k] ? 1 : 0)) }));
        if (segs.length < 2) continue;
        const open = {}, firedK = {};
        for (let k = 0; k < nDays; k++) {
          const j = pre + k, campSpend = S(cSpend, j), campConv = S(cConv, j);
          if (campConv < T.minCampConv) continue;
          const present = segs.filter(s => S(s.seen, j) > 0);
          if (present.length < 2) continue;
          const campCpa = campSpend / campConv, minSpend = Math.max(T.minSpend, T.minSpendShare * campSpend);
          for (const s of present) {
            const spend = S(s.spend, j), conv = S(s.conv, j);
            if (spend < minSpend) continue;
            if (!(conv > 0 ? spend / conv >= T.factor * campCpa : spend >= T.factor * campCpa)) continue;
            (firedK[s.value] = firedK[s.value] || new Set()).add(k);
            const ep = open[s.value];
            if (ep && k - ep.lastK <= T.mergeGap + 1) { ep.lastK = k; ep.days++; continue; }
            const table = present.map(o => ({ value: o.value, name: segName(type, o.value, o.label), spend: S(o.spend, j), conv: S(o.conv, j), clicks: S(o.clicks, j) })).sort((a, b) => b.spend - a.spend);
            open[s.value] = { check: 'segment', checkId: SEGMENT_ID, cid: camp.id, camp: camp.name, type, value: s.value, label: s.label, detail: s.detail,
              name: segName(type, s.value, s.label), firstK: k, lastK: k, days: 1, spend, conv, clicks: S(s.clicks, j), campSpend, campConv, campCpa, minSpend, table };
            eps.push(open[s.value]);
          }
        }
        // Every day of the range for each segment that fired, for the finding's chart
        const raw = (P, j) => P[j + 1] - P[j];
        for (const [value, ks] of Object.entries(firedK)) {
          const sg = segs.find(o => o.value === value), tr = { key: `${camp.id}|${type}|${value}`, days: [] };
          for (let k = 0; k < nDays; k++) { const j = pre + k;
            tr.days.push({ t: new Date(f0.getFullYear(), f0.getMonth(), f0.getDate() + k).getTime(), x: { spend: S(sg.spend, j), conv: S(sg.conv, j), campSpend: S(cSpend, j), campConv: S(cConv, j) },
              raw: { segSpend: raw(sg.spend, j), segConv: raw(sg.conv, j), campSpend: raw(cSpend, j), campConv: raw(cConv, j) }, fired: ks.has(k) }); }
          tracks.push(tr);
        }
      }
    }
    const t0 = new Date(f0.getFullYear(), f0.getMonth(), f0.getDate());
    for (const ep of eps) { ep.startT = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + ep.firstK - (T.days - 1)).getTime(); ep.firstT = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + ep.firstK).getTime(); ep.lastT = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + ep.lastK).getTime(); }
    const out = eps.sort((a, b) => a.firstT - b.firstT || a.type.localeCompare(b.type) || a.value.localeCompare(b.value)); out.tracks = tracks; return out;
  }
  /* ---------- Campaign setup and creative checks (real clients) ----------
     Two period scans, like the spend scan (episodes, covered period, "fired on N days"):
       pm.1.setup.search_budget_limited (search campaigns, 7-day window) and pm.2.creative_lp.creative_fatigue (per ad, 7 days vs the 21 before).
     Six settings checks, evaluated once on the settings snapshot (settings-now); these are live recommendations.
     Draft thresholds, to validate with the media lead. */
  const SETUP_SCAN = {
    mergeGap: 2,
    budgetLimited: { days: 7, minSpend: 500, minLostShare: 0.1 },              // 7-day spend ≥ 500 kr and impressions lost to budget ≥ 10% of eligible
    fatigue: { days: 7, base: 21, minImp: 100, minImpBase: 300, ratio: 0.7 },   // ad CTR in 7 days ≤ 0.7 × its CTR in the 21 days before
    smartBidding: ['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE', 'TARGET_CPA', 'TARGET_ROAS'],
    target: { days: 28 },                                                       // target CPA below the campaign's own best week in 28 days (GC-5: no universal factor)
  };
  const SETUP_IDS = { budgetLimited: 'pm.1.setup.search_budget_limited', fatigue: 'pm.2.creative_lp.creative_fatigue', broad: 'pm.1.setup.broad_without_smart_bidding',
    conflicts: 'pm.1.setup.keyword_conflicts', target: 'pm.1.setup.target_far_from_actual', notServing: 'pm.1.setup.not_serving', strength: 'pm.2.creative_lp.ad_strength_poor', disapproved: 'pm.2.creative_lp.creative_disapproved' };
  const AD_TYPE = { RESPONSIVE_SEARCH_AD: 'Responsive search ad', EXPANDED_TEXT_AD: 'Expanded text ad', SMART_CAMPAIGN_AD: 'Smart campaign ad', RESPONSIVE_DISPLAY_AD: 'Responsive display ad', CALL_AD: 'Call ad' };
  const adName = (R, id) => { const a = R.settings && R.settings.ads.find(x => x.id === id), t = a && AD_TYPE[a.type]; return t ? `${t} ${id}` : `Ad ${id}`; };
  // Which rubric checks run for this client, by optimization area (shown as "Checked: …" under each area).
  function checksRun(cfg) {
    const R = REAL[cfg.id], o = { setup: [], creative: [], audiences: [], spend: [] };
    if (!cfg.real || !R) return o;
    o.spend.push(SCAN_IDS.noConv, SCAN_IDS.cpaRising, SCAN_IDS.convFalling, SCAN_IDS.budgetShift, SCAN_IDS.invalidSpike);
    if (R.seg && Object.keys(R.seg).length) o.audiences.push(SEGMENT_ID);
    if (Object.values(R.byDay).some(d => Object.values(d).some(x => x.elig > 0))) o.setup.push(SETUP_IDS.budgetLimited);
    if (R.ads && Object.keys(R.ads).length) o.creative.push(SETUP_IDS.fatigue);
    if (R.settings) { o.setup.push(SETUP_IDS.broad, SETUP_IDS.conflicts, SETUP_IDS.target, SETUP_IDS.notServing); o.creative.push(SETUP_IDS.strength, SETUP_IDS.disapproved); }
    return o;
  }
  // Period scan: budget-limited search campaigns and ad fatigue. Returns episodes, oldest first.
  function scanSetup(cfg, fromT, toT) {
    const R = REAL[cfg.id];
    if (!cfg.real || !R || !isFinite(fromT) || !isFinite(toT) || toT < fromT) return [];
    const T = SETUP_SCAN, f0 = new Date(fromT), nDays = Math.round((toT - fromT) / DAY) + 1, eps = [], tracks = [];
    const dateAt = k => new Date(f0.getFullYear(), f0.getMonth(), f0.getDate() + k);
    const prefix = arr => { let s = 0; return [0].concat(arr.map(v => (s += v))); };
    // One series of firing days → merged episodes (gaps up to mergeGap days)
    const merge = (fires, mk) => { let ep = null; for (const f of fires) { if (ep && f.k - ep.lastK <= T.mergeGap + 1) { ep.lastK = f.k; ep.days++; continue; } ep = Object.assign(mk(f), { firstK: f.k, lastK: f.k, days: 1, x: f.x }); eps.push(ep); } };
    // 1. Search campaigns losing impressions to budget
    { const B = T.budgetLimited, pre = B.days - 1, dates = []; for (let k = -pre; k < nDays; k++) dates.push(dateAt(k));
      const setC = R.settings ? R.settings.campaigns : [];
      for (const camp of cfg.campaigns.filter(c => c.type === 'search' || (setC.find(s => s.id === c.id) || {}).channel === 'SEARCH')) {
        const day = R.byDay[camp.id] || {}, get = f => dates.map(d => { const x = day[isoD(d.getTime())]; return x ? x[f] || 0 : 0; });
        const A = { cost: get('cost'), elig: get('elig'), lost: get('lost') }, P = { cost: prefix(A.cost), elig: prefix(A.elig), lost: prefix(A.lost) };
        const S = (f, j) => P[f][j + 1] - P[f][j + 1 - B.days], fires = [];
        for (let k = 0; k < nDays; k++) { const j = pre + k, x = { spend: S('cost', j), elig: S('elig', j), lost: S('lost', j) };
          if (x.spend >= B.minSpend && x.elig > 0 && x.lost / x.elig >= B.minLostShare) fires.push({ k, x }); }
        if (fires.length) { const fk = new Set(fires.map(f => f.k)), tr = { key: `budgetLimited|${camp.id}`, days: [] }; tracks.push(tr);
          for (let k = 0; k < nDays; k++) { const j = pre + k; tr.days.push({ t: dates[j].getTime(), x: { spend: S('cost', j), elig: S('elig', j), lost: S('lost', j) }, raw: { cost: A.cost[j], elig: A.elig[j], lost: A.lost[j] }, fired: fk.has(k) }); } }
        const before = eps.length;
        merge(fires, () => ({ check: 'budgetLimited', checkId: SETUP_IDS.budgetLimited, cid: camp.id, camp: camp.name, back: B.days }));
        for (const ep of eps.slice(before)) { ep.rows = []; for (let j = ep.firstK; j <= pre + ep.lastK; j++) ep.rows.push([dates[j], A.cost[j], A.elig[j], A.lost[j], A.elig[j] ? (100 * A.lost[j] / A.elig[j]).toFixed(1) + '%' : '—']);
          ep.startT = dates[ep.firstK].getTime(); ep.firstT = dates[pre + ep.firstK].getTime(); ep.lastT = dates[pre + ep.lastK].getTime(); }
      } }
    // 2. Ads whose click-through rate falls
    { const F = T.fatigue, pre = F.days + F.base - 1, dates = []; for (let k = -pre; k < nDays; k++) dates.push(dateAt(k));
      for (const [adId, ad] of Object.entries(R.ads || {})) {
        const get = f => dates.map(d => { const x = ad.days[isoD(d.getTime())]; return x ? x[f] || 0 : 0; });
        const A = { imp: get('imp'), clicks: get('clicks') }, P = { imp: prefix(A.imp), clicks: prefix(A.clicks) };
        const S = (f, a, b) => P[f][b + 1] - P[f][a], fires = [];
        for (let k = 0; k < nDays; k++) { const j = pre + k;
          const x = { imp7: S('imp', j - F.days + 1, j), clk7: S('clicks', j - F.days + 1, j), impB: S('imp', j - pre, j - F.days), clkB: S('clicks', j - pre, j - F.days) };
          if (x.imp7 >= F.minImp && x.impB >= F.minImpBase && x.clk7 / x.imp7 <= F.ratio * (x.clkB / x.impB)) fires.push({ k, x }); }
        if (fires.length) { const fk = new Set(fires.map(f => f.k)), tr = { key: `fatigue|${adId}`, days: [] }; tracks.push(tr);
          for (let k = 0; k < nDays; k++) { const j = pre + k; tr.days.push({ t: dates[j].getTime(), x: { imp7: S('imp', j - F.days + 1, j), clk7: S('clicks', j - F.days + 1, j), impB: S('imp', j - pre, j - F.days), clkB: S('clicks', j - pre, j - F.days) }, raw: { imp: A.imp[j], clicks: A.clicks[j] }, fired: fk.has(k) }); } }
        const camp = cfg.campaigns.find(c => c.id === ad.campaign), before = eps.length;
        merge(fires, () => ({ check: 'fatigue', checkId: SETUP_IDS.fatigue, cid: ad.campaign, camp: camp ? camp.name : ad.campaign, adId, adGroup: ad.adGroup, back: F.days + F.base }));
        for (const ep of eps.slice(before)) { ep.rows = []; for (let j = ep.firstK; j <= pre + ep.lastK; j++) ep.rows.push([dates[j], A.imp[j], A.clicks[j], A.imp[j] ? (100 * A.clicks[j] / A.imp[j]).toFixed(1) + '%' : '—']);
          ep.startT = dates[ep.firstK].getTime(); ep.firstT = dates[pre + ep.firstK].getTime(); ep.lastT = dates[pre + ep.lastK].getTime(); }
      } }
    const out = eps.sort((a, b) => a.firstT - b.firstT || a.check.localeCompare(b.check)); out.tracks = tracks; return out;
  }
  // Settings checks on the latest snapshot. Live recommendations, evaluated once (not tied to the picked range).
  const normKw = s => String(s || '').toLowerCase().replace(/["'\[\]+]/g, ' ').replace(/\s+/g, ' ').trim();
  function negBlocks(neg, match, kw) {
    const n = normKw(neg), k = normKw(kw); if (!n || !k) return false;
    if (match === 'EXACT') return n === k;
    if (match === 'PHRASE') return (' ' + k + ' ').includes(' ' + n + ' ');
    const kws = new Set(k.split(' ')); return n.split(' ').every(w => kws.has(w));
  }
  /* What the settings snapshot says, computed once and shared by the settings recommendations below and the
     Stage 1 gates (engine/readiness.js), so a gate never re-implements a check. */
  function settingsFacts(cfg, data) {
    const R = REAL[cfg.id]; if (!cfg.real || !R || !R.settings) return null;
    const S = R.settings, T = SETUP_SCAN;
    const snapT = S.snapshotDate ? new Date(S.snapshotDate + 'T12:00:00').getTime() : null, snap = snapT ? dFmt(snapT, true) : 'the latest snapshot';
    const asOf = `Settings as of ${snap}`;
    const campOn = id => { const c = S.campaigns.find(x => x.id === id); return !!c && c.status === 'ENABLED'; };
    const agOn = id => { const g = S.adGroups.find(x => x.id === id); return !!g && g.status === 'ENABLED'; };
    const cName = id => (S.campaigns.find(x => x.id === id) || cfg.campaigns.find(x => x.id === id) || { name: id }).name;
    const gName = id => (S.adGroups.find(x => x.id === id) || { name: id }).name;
    const live = S.keywords.filter(k => !k.negative && k.status === 'ENABLED' && campOn(k.campaign) && agOn(k.adGroup));
    const bidOf = k => { const g = S.adGroups.find(x => x.id === k.adGroup), c = S.campaigns.find(x => x.id === k.campaign); return (g && g.bidding) || (c && c.bidding) || ''; };
    const broad = live.filter(k => k.match === 'BROAD' && !T.smartBidding.includes(bidOf(k)));
    const conflicts = [];
    for (const k of live) {
      for (const n of S.keywords.filter(x => x.negative && x.status === 'ENABLED' && x.adGroup === k.adGroup)) if (negBlocks(n.text, n.match, k.text)) conflicts.push({ campaign: k.campaign, k, neg: n.text, level: `Ad group (${String(n.match).toLowerCase()})` });
      for (const n of S.campaignNegatives.filter(x => x.status === 'ENABLED' && x.campaign === k.campaign)) if (negBlocks(n.text, 'BROAD', k.text)) conflicts.push({ campaign: k.campaign, k, neg: n.text, level: 'Campaign (treated as broad)' });
    }
    // Target CPA tighter than any week the campaign achieved in the last 28 days (its own results, no universal factor)
    const D = T.target.days, last = data.days.slice(-D), targets = [];
    for (const g of S.adGroups.filter(g => g.status === 'ENABLED' && campOn(g.campaign) && g.targetCpa > 0)) {
      const cs = d => (d.camps[g.campaign] || {}), sp = last.reduce((a, d) => a + (cs(d).spend || 0), 0), cv = last.reduce((a, d) => a + (cs(d).plat || 0), 0);
      const weeks = []; for (let w = 0; w * 7 < last.length; w++) { const sl = last.slice(Math.max(0, last.length - (w + 1) * 7), last.length - w * 7); const ws = sl.reduce((a, d) => a + (cs(d).spend || 0), 0), wc = sl.reduce((a, d) => a + (cs(d).plat || 0), 0); if (wc > 0) weeks.push(ws / wc); }
      if (!(cv > 0) || !weeks.length) continue; // no conversions: no result to compare the target with
      const best = Math.min(...weeks);
      if (g.targetCpa >= best) continue;
      targets.push({ g, campaign: g.campaign, actual: sp / cv, best, spend: sp, conv: cv, weeks: weeks.length });
    }
    const ns = [];
    for (const c of S.campaigns.filter(c => c.status === 'ENABLED' && c.servingStatus && c.servingStatus !== 'SERVING')) ns.push({ campaign: c.id, what: 'Campaign', name: c.name, why: `serving status ${c.servingStatus.toLowerCase().replace(/_/g, ' ')}` });
    for (const g of S.adGroups.filter(g => g.status === 'ENABLED' && campOn(g.campaign) && !S.ads.some(a => a.adGroup === g.id && a.status === 'ENABLED'))) ns.push({ campaign: g.campaign, what: 'Ad group', name: g.name, adGroup: g.id, why: 'no enabled ads' });
    for (const k of live.filter(k => k.serving && k.serving !== 'ELIGIBLE')) ns.push({ campaign: k.campaign, what: 'Keyword', name: k.text, why: `serving status ${k.serving.toLowerCase().replace(/_/g, ' ')}` });
    const poor = S.ads.filter(a => a.status === 'ENABLED' && a.type === 'RESPONSIVE_SEARCH_AD' && a.strength === 'POOR');
    const dis = S.ads.filter(a => a.status === 'ENABLED' && a.approval === 'DISAPPROVED');
    return { R, S, T, asOf, campOn, agOn, cName, gName, live, bidOf, broad, conflicts, targets, ns, poor, dis };
  }
  function settingsRecs(cfg, data) {
    const F = settingsFacts(cfg, data); if (!F) return [];
    const { R, S, T, asOf, cName, gName, live } = F, recs = [], N = cfg.convNoun, N1 = cfg.convNounOne;
    const mk = (id, o) => recs.push(Object.assign({
      id, agent: 'settings', fox: 'paid', platform: 'gads', kind: 'setup', unit: 'none', valuePerDay: 0, spendChangedPerDay: 0, effort: 'low', minutes: 10,
      confidence: 'strong', owner: 'You', verifyDays: 7, labels: { spend: null, conv: 'observed' }, focus: 0, draft: true, bet: false, asOf, score: 0,
      impactTxt: { k: 'Setting to fix', imp: 'Setting to fix', sub: asOf.toLowerCase() },
    }, o));
    const byCamp = list => { const m = {}; for (const x of list) (m[x.campaign] = m[x.campaign] || []).push(x); return Object.entries(m); };
    // 3. Broad match without smart bidding
    for (const [cid, list] of byCamp(F.broad)) {
      const c = S.campaigns.find(x => x.id === cid);
      mk(`set-broad-${cid}`, { area: 'setup', check: SETUP_IDS.broad, campaign: cName(cid),
        title: `${list.length} broad-match keyword${list.length === 1 ? '' : 's'} in ${cName(cid)} run without smart bidding`,
        observe: `${list.length} enabled broad-match keyword${list.length === 1 ? '' : 's'} (e.g. ${list.slice(0, 3).map(k => `“${k.text}”`).join(', ')}) bid with ${String((c && c.bidding) || 'manual bidding').toLowerCase().replace(/_/g, ' ')}. ${asOf}.`,
        means: 'Broad match reaches many loosely related searches. Without smart bidding, every one of them gets the same bid, so spend drifts to searches that rarely convert.',
        action: 'Switch the campaign to Maximize conversions (or Target CPA), or change these keywords to phrase or exact match.',
        expect: 'Spend concentrated on searches that turn into leads.', success: `No enabled broad-match keywords without smart bidding at the next settings check.`,
        rule: `An enabled broad-match keyword in an enabled campaign and ad group whose bidding isn’t ${T.smartBidding.map(b => b.toLowerCase().replace(/_/g, ' ')).join(', ')}. Check ${SETUP_IDS.broad}.`,
        evidence: { cols: ['Keyword', 'Ad group', 'Bidding'], rows: list.map(k => [k.text, gName(k.adGroup), (S.adGroups.find(g => g.id === k.adGroup) || {}).bidding || (c && c.bidding) || '—']), money: [], rules: [], verdict: `${asOf}.` } });
    }
    // 4. Positive keywords blocked by a negative
    for (const [cid, list] of byCamp(F.conflicts)) {
      const kws = [...new Set(list.map(x => x.k.text))];
      mk(`set-conflicts-${cid}`, { area: 'setup', check: SETUP_IDS.conflicts, campaign: cName(cid),
        title: `${kws.length} keyword${kws.length === 1 ? ' is' : 's are'} blocked by negative keywords in ${cName(cid)}`,
        observe: `${kws.length} enabled keyword${kws.length === 1 ? '' : 's'} (e.g. ${kws.slice(0, 3).map(t => `“${t}”`).join(', ')}) match a negative keyword in the same campaign or ad group, so they can’t show. The match type of campaign negatives isn’t in our data, so they’re treated as broad. ${asOf}.`,
        means: 'You pay to manage keywords that can never show, and the searches you meant them for go unserved.',
        action: 'Remove or narrow the negative keyword, or pause the keyword if the negative is intended.',
        expect: 'The keywords start showing for the searches you meant them for.', success: 'No enabled keyword blocked by a negative at the next settings check.',
        rule: `An enabled positive keyword blocked by an enabled negative: exact negatives by the same text, phrase negatives contained in the keyword, broad negatives with all their words in it; campaign negatives treated as broad. Check ${SETUP_IDS.conflicts}.`,
        evidence: { cols: ['Keyword', 'Blocked by', 'Negative level'], rows: list.map(x => [x.k.text, x.neg, x.level]), money: [], rules: [], verdict: `${asOf}.` } });
    }
    // 5. Target CPA tighter than every week the campaign achieved (target ROAS: no conversion values in our data)
    const D = T.target.days;
    for (const x of F.targets) {
      const g = x.g;
      mk(`set-target-${g.id}`, { area: 'setup', check: SETUP_IDS.target, campaign: cName(g.campaign),
        title: `${gName(g.id)} targets ${money(g.targetCpa, cfg)} per ${N1}, below every week it achieved`,
        observe: `Target CPA ${money(g.targetCpa, cfg)}. Over the last ${D} days ${cName(g.campaign)} paid ${money(x.actual, cfg)} per ${N1} (${money(x.spend, cfg)} for ${Math.round(x.conv)} ${N}); its best week was ${money(x.best, cfg)}. Actual cost is campaign-level; we don’t have ad-group conversions. ${asOf}.`,
        means: 'A target below anything the campaign has achieved makes smart bidding hold back, so the campaign may lose auctions it could have won.',
        action: `Raise the target CPA towards ${money(x.best, cfg)} (its best recent week), then lower it gradually as results allow.`,
        expect: 'More auctions entered, at a cost per lead close to today’s.', success: `Target CPA at or above the campaign’s best recent week at the next settings check.`,
        rule: `Target CPA below the campaign’s own lowest weekly cost per conversion over the last ${D} days (weeks with conversions only; target ROAS isn’t checked: no conversion values in our data). Check ${SETUP_IDS.target}.`,
        evidence: { cols: ['Ad group', 'Target CPA', 'Best week CPA', `Actual CPA (${D} days)`], rows: [[gName(g.id), g.targetCpa, x.best, x.actual]], money: [1, 2, 3], rules: [], verdict: `${asOf}.` } });
    }
    // 6. Enabled but not serving
    for (const [cid, list] of byCamp(F.ns)) {
      mk(`set-notserving-${cid}`, { area: 'setup', check: SETUP_IDS.notServing, campaign: cName(cid),
        title: `${list.length} enabled item${list.length === 1 ? '' : 's'} in ${cName(cid)} ${list.length === 1 ? 'isn’t' : 'aren’t'} serving`,
        observe: `${list.map(x => `${x.what} “${x.name}”: ${x.why}`).slice(0, 3).join('; ')}${list.length > 3 ? `; and ${list.length - 3} more` : ''}. ${asOf}.`,
        means: 'These are switched on but can’t show ads, so the traffic you planned for them isn’t arriving.',
        action: 'Fix what stops each one from serving (add an ad, resolve the status in Google Ads), or pause it if it’s no longer needed.',
        expect: 'Everything that’s enabled can show ads.', success: 'No enabled campaign, ad group or keyword that isn’t serving at the next settings check.',
        rule: `An enabled campaign whose serving status isn’t “serving”, an enabled ad group with no enabled ads, or an enabled keyword that isn’t eligible. Check ${SETUP_IDS.notServing}.`,
        evidence: { cols: ['Item', 'Name', 'Why'], rows: list.map(x => [x.what, x.name, x.why]), money: [], rules: [], verdict: `${asOf}.` } });
    }
    // 7. Poor ad strength, 8. Disapproved ads
    const adRows = (list) => list.map(a => [adName(R, a.id), gName(a.adGroup), String(a.strength || '—').toLowerCase(), String(a.approval || '—').toLowerCase()]);
    for (const [cid, list] of byCamp(F.poor)) mk(`set-strength-${cid}`, { area: 'creative', check: SETUP_IDS.strength, campaign: cName(cid), minutes: 30,
      title: `${list.length} responsive search ad${list.length === 1 ? ' has' : 's have'} “Poor” ad strength in ${cName(cid)}`,
      observe: `${list.map(a => adName(R, a.id)).join(', ')}: ad strength “Poor”. ${asOf}.`,
      means: 'Poor ad strength usually means too few or too similar headlines, so Google has little to test and shows the ad less often.',
      action: 'Add distinct headlines (offer, location, proof) and descriptions until ad strength reaches “Good”.',
      expect: 'More impressions and a better click-through rate.', success: 'Ad strength “Good” or better at the next settings check.',
      rule: `An enabled responsive search ad with ad strength “Poor”. Check ${SETUP_IDS.strength}.`,
      evidence: { cols: ['Ad', 'Ad group', 'Strength', 'Approval'], rows: adRows(list), money: [], rules: [], verdict: `${asOf}.` } });
    for (const [cid, list] of byCamp(F.dis)) mk(`set-disapproved-${cid}`, { area: 'creative', check: SETUP_IDS.disapproved, campaign: cName(cid), minutes: 15, confidence: 'certain',
      title: `${list.length} ad${list.length === 1 ? ' is' : 's are'} disapproved in ${cName(cid)}`,
      observe: `${list.map(a => adName(R, a.id)).join(', ')}: disapproved by Google. ${asOf}.`,
      means: 'Disapproved ads can’t show. If they’re the only ads in an ad group, that ad group gets no traffic.',
      action: 'Open the ad in Google Ads, read the policy reason, then edit the ad or appeal.',
      expect: 'The ads show again.', success: 'No enabled disapproved ads at the next settings check.',
      rule: `An enabled ad with approval status “disapproved”. Check ${SETUP_IDS.disapproved}.`,
      evidence: { cols: ['Ad', 'Ad group', 'Strength', 'Approval'], rows: adRows(list), money: [], rules: [], verdict: `${asOf}.` } });
    return recs;
  }
