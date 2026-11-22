
  /* ---------- Business history for the Overview ----------
     On connection we import Shopify / lead-source and ad-platform history (sample: about two years), so the
     Overview can compare 6 months, 12 months and year to date. The last days are exactly the live daily data;
     earlier days are backfilled with growth and seasonality, joined to the level of the first live fortnight. */
  function buildHist(cfg, data) {
    if (cfg.real) { // every day from the first spend (or the 90-day window, if later) to the latest day: all real
      const first = cfg.firstSpend ? new Date(cfg.firstSpend + 'T00:00:00').getTime() : GF.END;
      const N = Math.max(data.n, Math.round((GF.END - first) / GF.DAY) + 1), days = [];
      for (let i = 0; i < N; i++) {
        const t = GF.END - (N - 1 - i) * GF.DAY, x = GF.realDay(cfg, t);
        days.push({ i, t, date: new Date(t), revenue: 0, conv: x.conv, spend: x.spend, lc: x.conv, clicks: x.clicks, meetings: 0, dq: null, sessions: 0, newRev: 0, retRev: 0, appRev: 0, webRev: 0 });
      }
      return { days, n: N };
    }
    const N = 800, days = [], live = data.days, n = data.n, off = N - n;
    let seed = cfg.seed * 7919 + 13;
    const r = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const WD = [0.86, 1.05, 1.06, 1.02, 1.0, 0.96, 0.88];
    const ecom = cfg.route === 'ecom';
    // The parts revenue can be split into (sessions, new vs returning, app vs web), with a little day-to-day noise.
    const jit = (i, k) => { const v = Math.sin((i + 1) * 12.9898 + k * 78.233 + cfg.seed) * 43758.5453; return v - Math.floor(v); };
    const extra = d => {
      d.sessions = d.conv / ((cfg.cr0 || 0.02) * (0.93 + 0.14 * jit(d.i, 1)));
      d.newRev = d.revenue * (cfg.ns0 || 0.4) * (0.9 + 0.2 * jit(d.i, 2)); d.retRev = d.revenue - d.newRev;
      d.appRev = d.revenue * (cfg.as0 || 0.5) * (0.95 + 0.1 * jit(d.i, 3)); d.webRev = d.revenue - d.appRev;
      return d;
    };
    const season = d => { // day-of-year shape: summer dip, autumn build, Black Friday week, December gifting, January lull
      const m = d.getMonth(), dd = d.getDate();
      let f = [0.9, 0.93, 0.98, 1.0, 1.0, 0.96, 0.9, 0.91, 0.98, 1.02, 1.1, 1.18][m];
      if (!ecom) f = [1.02, 1.04, 1.05, 1.02, 1.0, 0.95, 0.85, 0.88, 1.02, 1.05, 1.03, 0.9][m];
      if (ecom && m === 10 && dd >= 24 && dd <= 30) f *= 1.45;
      return f;
    };
    const grow = i => Math.pow(1 + (ecom ? 0.18 : 0.12), (i - off) / 365); // growth per year, relative to the join
    const first = live.slice(0, Math.min(14, n)), avg = k => sum(first.map(x => x[k] || 0)) / first.length;
    const wdAvg = sum(first.map(x => WD[x.date.getDay()])) / first.length, s0 = season(live[0].date);
    const base = { rev: avg('revenue') / wdAvg / s0, conv: avg('conv') / wdAvg / s0, spend: avg('spend') / wdAvg / s0, lc: avg('lc') / wdAvg / s0, meet: avg('meetings') / wdAvg / s0 };
    for (let i = 0; i < N; i++) {
      const t = GF.END - (N - 1 - i) * GF.DAY, date = new Date(t);
      if (i >= off) { const d = live[i - off]; days.push(extra({ i, t, date, revenue: d.revenue || 0, conv: d.conv, spend: d.spend, lc: d.lc, meetings: d.meetings || 0, dq: d.dq })); continue; }
      const k = WD[date.getDay()] * season(date) * grow(i), nz = () => 0.9 + 0.2 * r();
      const conv = base.conv * k * nz();
      days.push(extra({ i, t, date, conv, revenue: ecom ? conv * (base.rev / base.conv) * (0.95 + 0.1 * r()) : 0, spend: base.spend * k * (0.92 + 0.16 * r()) * (season(date) > 1.05 ? 1.1 : 1), lc: base.lc * k * nz(), meetings: ecom ? 0 : conv * (base.meet / base.conv) * nz() }));
    }
    return { days, n: N };
  }
  function ctx() {
    const cfg = GF.CLIENTS.find(c => c.id === state.clientId) || GF.CLIENTS[0];
    if (!cache[cfg.id]) { const data = GF.generate(cfg); cache[cfg.id] = { cfg, data, model0: GF.build(cfg, data), thrKey: '{}', hist: buildHist(cfg, data) }; }
    const c = cache[cfg.id];
    c.status = S(cfg.id).status;
    const thr = {}; for (const [k, v] of Object.entries(c.status)) if (k.startsWith('thr-') && v && v.value != null) thr[k.slice(4)] = v.value;
    const tk = JSON.stringify(thr); if (c.thrKey !== tk) { c.model0 = GF.build(cfg, c.data, { thr }); c.thrKey = tk; c.scanKey = null; }
    // Real clients: Spend & optimization checks scanned over the picked range, memoized per range (the model above doesn't depend on it).
    if (cfg.real) {
      const R0 = chgRange(c), key = `${R0.from}-${R0.to}`;
      if (c.scanKey !== key) {
        c.scanMemo = c.scanMemo || {};
        if (!c.scanMemo[key]) { let found = []; try { const a = c.hist.days[R0.from].t, b = c.hist.days[R0.to].t; found = GF.periodRecs(cfg, a, b); } catch (e) { found = []; } c.scanMemo[key] = found; }
        c.modelBase = Object.assign({}, c.model0, { recs: c.model0.recs.concat(c.scanMemo[key]).sort((a, b) => b.score - a.score) });
        c.scanKey = key;
      }
    } else c.modelBase = c.model0;
    // Stage 1 (Paid Fox): the business profile, eligibility of every recommendation, and readiness for clients with Google Ads data.
    const rk = profVer[cfg.id] || 0;
    if (c.rdKey !== rk || c.lastBase !== c.modelBase) {
      const profile = GF.profileOf(cfg.id), base = c.modelBase;
      let rd = null; try { rd = GF.readiness(cfg, c.data, profile, base.recs); } catch (e) { rd = null; }
      const extra = GF.gateRecs(cfg, rd);
      c.model = Object.assign({}, base, { recs: GF.applyEligibility(base.recs.concat(extra), profile).sort((a, b) => b.score - a.score) });
      c.readiness = rd; c.profile = profile; c.lastBase = base; c.rdKey = rk;
    }
    c.qdec = S(cfg.id).qdec;
    return c;
  }
  function setStatus(c, id, val) {
    if (val) c.status[id] = val; else delete c.status[id];
    writeDoc(c.cfg.id, 'ledger', id, val || null);
  }
  function setDecision(c, id, val) {
    if (val) c.qdec[id] = val; else delete c.qdec[id];
    writeDoc(c.cfg.id, 'decisions', id, val ? { value: val, at: Date.now(), by: uid } : null);
  }
  function recState(c, r) {
    const s = c.status[r.id] || (r.doneKey && c.status[r.doneKey]);
    if (!s) return null;
    if (s.status === 'promoted') return null; // an optional improvement the user added to actions: open
    if (s.status === 'snoozed' && Date.now() > s.until) return null; // snooze over: back in the backlog
    if (s.status === 'expected' && r.compNow != null && r.compNow < s.baseline - 0.005) return null; // fell below its expected level: the action is back
    return s;
  }
  // What the ledger stores about an action when someone acts on it, so the record stays readable
  // even after the rule engine stops producing that action.
  function ledgerEntry(c, r, status, extra = {}) {
    const now = Date.now();
    return Object.assign({
      status, at: now, by: uid,
      title: r.title, fox: r.fox, agent: r.agent, kind: r.kind, platform: r.platform, owner: r.owner || 'You',
      confidence: r.confidence, unit: r.unit, expectedPerDay: r.unit === 'dq' ? r.dq : r.unit === 'cov' ? r.cov : r.valuePerDay,
      spendChangedPerDay: r.spendChangedPerDay || 0, success: r.success || '', bet: !!r.bet, lo: r.lo || null, hi: r.hi || null, area: r.area || null, rule: r.rule || null,
      verifyDays: r.verifyDays || 7, verifyDue: now + (r.verifyDays || 7) * GF.DAY,
    }, extra);
  }
  const promoted = (c, r) => !!(c.status[r.id] && c.status[r.id].status === 'promoted');
  const activeRecs = c => c.model.recs.filter(r => !r.held && !recState(c, r) && (!r.optional || promoted(c, r)));
  const PAGES = ['param', 'action', 'brief', 'overview', 'engineer', 'paid', 'analytics', 'recs', 'ledger'];

  /* ---------- Formatting ---------- */
  const m = (v, c, d) => GF.money(v, c.cfg, d);
  const n0 = v => Math.round(v).toLocaleString('en');
  const ptsTxt = v => v > 0 && v < 0.1 ? '<0.1' : String(Math.round(v * 10) / 10); // data quality points, never shown as +0.0
  const isEcom = c => c.cfg.route === 'ecom';
  const om = k => k === 'observed' ? '<span class="om o" title="Observed: recorded directly, matched by ID. Doesn’t depend on any rule.">O</span>'
    : k === 'modeled' ? '<span class="om m" title="Modeled: comes from a rule or inference. Changes when the rule changes.">M</span>' : '';
  // neutral: a change that is neither good nor bad (ad spend), shown grey whatever its direction.
  function dpill(cur, prev, invert = false, neutral = false) {
    if (prev != null && isFinite(prev) && prev !== 0 && !isFinite(cur)) return '<span class="dpill flat">No comparison</span>';
    if (prev == null || !isFinite(prev) || prev === 0) return '<span class="dpill flat">No earlier period yet</span>';
    const d = (cur - prev) / Math.abs(prev);
    if (Math.abs(d) < 0.005) return '<span class="dpill flat">± 0%</span>';
    const good = invert ? d < 0 : d > 0;
    return `<span class="dpill ${neutral ? 'flat' : good ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d * 100).toFixed(1)}%</span>`;
  }
  // Every page follows the one date range picked in the header picker (shared with the Overview).
  // The fox pages work on the daily platform data (the last c.data.n days), so the range is clamped to it:
  // R = days in the range, O = days between its end and the latest day.
  // What the range is compared with: the previous period of the same length, the same dates last year, or nothing.
  const cmpOf = r => r.cmp || (r.preset === 'ytd' ? 'yoy' : 'prev');
  const CMP_TXT = { prev: 'Previous period', yoy: 'Same period last year', none: 'No comparison' };
  function periods(c) {
    const n = c.data.n, R0 = chgRange(c), H = c.hist.n, live0 = H - n;
    const to = Math.max(live0, Math.min(R0.to, H - 1)) - live0, from = Math.max(live0, R0.from) - live0;
    const R = Math.max(1, to - Math.min(from, to) + 1), O = n - 1 - to;
    const cm = cmpOf(R0), po = cm === 'yoy' ? O + 365 : O + R;
    return { R, O, clamped: R0.from < live0, cur: GF.win(c.data, R, O), prev: cm !== 'none' && n >= po + R ? GF.win(c.data, R, po) : null };
  }
  function rangeLabel(c) {
    const { R, O, clamped, prev } = periods(c), lo = c.hist.n - c.data.n;
    const txt = rangeText(c, { from: lo + c.data.n - O - R, to: lo + c.data.n - 1 - O });
    if (clamped) return `${txt} · platform data starts ${fmtD(c, lo, true)}`;
    return `${txt}${prev ? ' vs the period before' : ''}`;
  }
  const rangeSeg = () => datePicker(ctx());
  // "the last 30 days" when the range ends today, otherwise its dates.
  function perTxt(c) { const { R, O } = periods(c), lo = c.hist.n - c.data.n; return O === 0 ? `the last ${R} day${R === 1 ? '' : 's'}` : rangeText(c, { from: lo + c.data.n - O - R, to: lo + c.data.n - 1 - O }); }
  const perCap = c => { const t = perTxt(c); return t[0].toUpperCase() + t.slice(1); };
