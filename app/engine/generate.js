  /* ---------- Daily data generation ---------- */
  function generate(cfg) {
    if (cfg.real) return realData(cfg);
    const r = rng(cfg.seed);
    const n = Math.min(90, cfg.daysConnected);
    const days = [];
    for (let i = 0; i < n; i++) {
      const t = END - (n - 1 - i) * DAY;
      const date = new Date(t);
      const wf = WEEKDAY[date.getDay()];
      const prog = i / Math.max(1, n - 1);
      const day = { i, t, date, camps: {}, spend: 0, lc: 0, lin: 0, plat: 0, adRev: 0 };
      for (const c of cfg.campaigns) {
        const daysAgo = n - 1 - i;
        if (c.activeDays && daysAgo >= c.activeDays) { day.camps[c.id] = { spend: 0, lc: 0, lin: 0, plat: 0, clicks: 0, rev: 0 }; continue; }
        const cpcMult = c.cpcRise ? 1 + c.cpcRise * Math.max(0, (prog - 0.6) / 0.4) : 1;
        const spend = c.spend * wf * (0.88 + 0.24 * r()) * (c.cpcRise ? 1 + 0.5 * c.cpcRise * Math.max(0, (prog - 0.6) / 0.4) : 1);
        const lc = c.cpa === Infinity ? 0 : (spend / c.cpa) * (0.78 + 0.44 * r()) * (1 + cfg.revTrend * prog * 0.5);
        const lin = lc * c.lin;
        const plat = lc * c.claim * (0.9 + 0.2 * r());
        const clicks = spend / (c.cpc * cpcMult);
        const rev = cfg.route === 'ecom' ? lc * cfg.aov * (0.9 + 0.2 * r()) : 0;
        day.camps[c.id] = { spend, lc, lin, plat, clicks, rev };
        day.spend += spend; day.lc += lc; day.lin += lin; day.plat += plat; day.adRev += rev;
      }
      const organic = cfg.organicPerDay * wf * (0.8 + 0.4 * r()) * (1 + cfg.revTrend * prog);
      day.conv = day.lc + organic; // observed total (orders or leads)
      if (cfg.route === 'ecom') {
        // AOV dip in last 14 days (anomaly)
        const aovMult = n - 1 - i < 14 ? 0.93 : 1;
        day.revenue = day.conv * cfg.aov * aovMult * (0.94 + 0.12 * r());
      } else {
        const ms = n - 1 - i < 9 ? 0.19 : 0.31;
        day.meetings = day.conv * ms;
        day.forms = day.conv - day.meetings;
      }
      days.push(day);
    }
    // Endpoint data quality per day (the PULSE model): each endpoint's parameters, each param's completion,
    // event volumes, and the weighted score. The Data Fox's score per day = the average endpoint score.
    const eps = (ENDPOINTS[cfg.id] || []).map(ep => ({ ep, days: [] }));
    for (const d of days) {
      const daysAgo = n - 1 - d.i, wf = WEEKDAY[d.date.getDay()];
      let tot = 0;
      for (const e of eps) {
        const ep = e.ep;
        const events = ['shop', 'crm', 'app'].includes(ep.id) ? d.conv : ep.perDay * wf * (0.9 + 0.2 * r());
        const comp = {};
        for (const p of ep.params) {
          const base = p.issue && daysAgo < p.issue.since ? p.issue.to : p.base;
          comp[p.key] = Math.min(1, Math.max(0, base * (1 + (r() - 0.5) * (base < 0.999 ? 0.02 : 0)))) * (p.inv ? 1 - p.inv * (0.85 + 0.3 * r()) : 1); // present AND valid: an invalid value counts as missing
        }
        const score = epScore(ep, comp);
        e.days.push({ events, comp, score });
        tot += score;
      }
      d.dq = eps.length ? tot / eps.length : 100;
      d.cov = covDay(cfg, d, daysAgo);
    }
    return { n, days, eps };
  }

  /* ---------- Endpoint scoring (PULSE) ----------
     Each parameter is critical, warning or optional. Category completeness = average share of events
     carrying each of its parameters. Score = 60% critical + 30% warning + 10% optional.
     A failed event is one missing at least one critical parameter. */
  const CAT_W = { critical: 0.6, warning: 0.3, optional: 0.1 };
  const CATS = ['critical', 'warning', 'optional'];
  function epCats(ep, comp) {
    const o = {};
    for (const k of CATS) { const ps = ep.params.filter(p => p.cat === k); o[k] = ps.length ? ps.reduce((s, p) => s + comp[p.key], 0) / ps.length : 1; }
    return o;
  }
  function epScore(ep, comp) { const c = epCats(ep, comp); return 100 * (CAT_W.critical * c.critical + CAT_W.warning * c.warning + CAT_W.optional * c.optional); }
  // Share of events missing at least one parameter in a category (parameters treated as independent).
  // Share of events missing at least one parameter in a category. On an event-based endpoint (GA4) a
  // parameter only applies to its own event, so each miss is scaled by that event's share of volume.
  function missAny(ep, comp, cat) {
    const ps = ep.params.filter(p => p.cat === cat);
    if (ep.evShare) return Math.min(1, ps.reduce((s, p) => s + (1 - comp[p.key]) * (ep.evShare[p.ev] || 0), 0));
    return 1 - ps.reduce((s, p) => s * comp[p.key], 1);
  }
  // Aggregate one endpoint over the last `len` days (offset = days back from the end).
  function epWindow(data, epId, len, offset = 0) {
    const e = data.eps.find(x => x.ep.id === epId); if (!e) return null;
    const to = data.n - offset, from = Math.max(0, to - len);
    if (to <= 0) return null;
    const sl = e.days.slice(from, to);
    const events = sl.reduce((s, x) => s + x.events, 0) || 1;
    const comp = {};
    for (const p of e.ep.params) comp[p.key] = sl.reduce((s, x) => s + x.comp[p.key] * x.events, 0) / events;
    const failed = sl.reduce((s, x) => s + x.events * missAny(e.ep, x.comp, 'critical'), 0);
    return { ep: e.ep, events, failed, comp, cats: epCats(e.ep, comp), score: epScore(e.ep, comp), len: sl.length };
  }
  function epTrend(data, epId, len, offset = 0) {
    const e = data.eps.find(x => x.ep.id === epId); if (!e) return [];
    const to = data.n - offset, from = Math.max(0, to - len);
    return e.days.slice(from, to).map((x, i) => ({
      d: data.days[from + i].date, events: x.events, score: x.score,
      ...(() => { const k = epCats(e.ep, x.comp); return { critical: 100 * (1 - k.critical), warning: 100 * (1 - k.warning), optional: 100 * (1 - k.optional) }; })(),
    }));
  }
  const epStatus = s => s >= 90 ? 'good' : s >= 75 ? 'warn' : 'bad';

  /* ---------- Aggregation ---------- */
  function sumRange(days, from, to, fn) { let s = 0; for (let i = Math.max(0, from); i < to; i++) s += fn(days[i]); return s; }
  function win(data, len, offset = 0) {
    const to = data.n - offset, from = to - len;
    if (from < 0) return null;
    const d = data.days;
    const w = {
      len, from, to,
      spend: sumRange(d, from, to, x => x.spend),
      conv: sumRange(d, from, to, x => x.conv),
      revenue: sumRange(d, from, to, x => x.revenue || 0),
      plat: sumRange(d, from, to, x => x.plat),
      lc: sumRange(d, from, to, x => x.lc),
      lin: sumRange(d, from, to, x => x.lin),
      dq: sumRange(d, from, to, x => x.dq) / len,
      cov: sumRange(d, from, to, x => x.cov) / len,
      health: sumRange(d, from, to, x => x.health == null ? 100 : x.health) / len,
      meetings: sumRange(d, from, to, x => x.meetings || 0),
    };
    return w;
  }
  function campWindow(data, cid, len, offset = 0) {
    const to = data.n - offset, from = Math.max(0, to - len);
    const d = data.days; const o = { spend: 0, lc: 0, lin: 0, plat: 0, clicks: 0, rev: 0 };
    for (let i = from; i < to; i++) { const c = d[i].camps[cid]; for (const k in o) o[k] += c[k]; }
    return o;
  }

  /* ---------- Data quality scores ---------- */
  // Per-endpoint score over the last 7 days, plus how many setup checks fail or warn on that endpoint.
  function dqByPlatform(cfg, data) {
    return data.eps.map(e => {
      const w = epWindow(data, e.ep.id, 7);
      const chs = cfg.checks.filter(ch => ch.platform === e.ep.id);
      return { platform: e.ep.id, score: Math.round(w.score), fails: chs.filter(x => x.status === 'fail').length, warns: chs.filter(x => x.status === 'warn').length };
    });
  }
  function dqOverall(cfg, data) {
    const list = dqByPlatform(cfg, data);
    return Math.round(list.reduce((s, p) => s + p.score, 0) / list.length);
  }
