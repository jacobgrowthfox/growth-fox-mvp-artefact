  const linkCov = (l, daysAgo) => l.since != null && daysAgo < l.since ? l.cov : 1;
  function covDay(cfg, day, daysAgo, fixed) {
    const E = ENGINEER[cfg.id]; if (!E) return 100;
    let sp = 0, tracked = 0;
    for (const [pid, links] of Object.entries(E.links)) {
      const s = cfg.campaigns.filter(c => c.platform === pid).reduce((a, c) => a + day.camps[c.id].spend, 0);
      const cv = Math.min(...links.map(l => fixed && fixed(pid, l) ? 1 : linkCov(l, daysAgo)));
      sp += s; tracked += s * cv;
    }
    return sp ? 100 * tracked / sp : 100;
  }
  // Coverage by platform over the last `len` days; `fixed(pid, link)` simulates a repaired link.
  function coverage(cfg, data, len, offset = 0, fixed) {
    const E = ENGINEER[cfg.id]; const to = data.n - offset, from = Math.max(0, to - len);
    const plats = Object.entries(E.links).map(([pid, links]) => {
      let sp = 0, tr = 0;
      for (let i = from; i < to; i++) {
        const daysAgo = data.n - 1 - i;
        const s = cfg.campaigns.filter(c => c.platform === pid).reduce((a, c) => a + data.days[i].camps[c.id].spend, 0);
        sp += s; tr += s * Math.min(...links.map(l => fixed && fixed(pid, l) ? 1 : linkCov(l, daysAgo)));
      }
      const nowCov = links.map(l => ({ l, cov: linkCov(l, 0) }));
      return { pid, links: nowCov, spend: sp, tracked: tr, cov: sp ? tr / sp : 1 };
    });
    const sp = plats.reduce((a, p) => a + p.spend, 0), tr = plats.reduce((a, p) => a + p.tracked, 0);
    return { plats, spend: sp, tracked: tr, cov: sp ? 100 * tr / sp : 100 };
  }

  /* ---------- Engineer Fox: connection health (PRD) ----------
     Volume: each source's daily count against its normal level, the same weekday over the last 4 weeks.
     A ticket opens when a day is more than ±50% off (editable per source), or when nothing arrives at all.
     Sources below a daily minimum aren't checked, so small counts don't raise false alarms.
     Client vs server: each browser/server pair is judged against its own normal gap (days 8–35 ago).
     A ticket opens when the last 7 days move more than 10 points away from it (editable), or when the
     browser counts more than the server. Sample values, not a client's. */
  const VOL_MIN = 50, VOL_THR = 0.5, GAP_THR = 0.1;
  function engSeries(cfg, data) {
    const E = ENGINEER[cfg.id]; if (!E) return { streams: [], pairs: [] };
    const r = rng(cfg.seed + 101), n = data.n;
    const streams = (E.streams || []).map(st => {
      const vals = data.days.map((d, i) => {
        const daysAgo = n - 1 - i; let f = 1;
        for (const a of st.anomalies || []) if (daysAgo <= a.from && daysAgo >= (a.to || 0)) f *= a.factor;
        const base = st.fromConv ? d.conv * st.fromConv : st.perDay * WEEKDAY[d.date.getDay()];
        return Math.max(0, Math.round(base * (0.92 + 0.16 * r()) * f));
      });
      const normals = vals.map((_, i) => i >= 28 ? (vals[i - 7] + vals[i - 14] + vals[i - 21] + vals[i - 28]) / 4 : null);
      return { s: st, vals, normals };
    });
    const pairs = (E.pairs || []).map(pr => {
      const server = [], client = [];
      data.days.forEach((d, i) => {
        const daysAgo = n - 1 - i, sv = (pr.fromConv ? d.conv * pr.fromConv : pr.perDay * WEEKDAY[d.date.getDay()]) * (0.93 + 0.14 * r());
        const g = pr.change && daysAgo < pr.change.since ? pr.change.gap : pr.gap;
        server.push(sv); client.push(sv * (1 - g) * (0.98 + 0.04 * r()));
      });
      return { p: pr, server, client };
    });
    return { streams, pairs };
  }
  function engHealth(cfg, data, thr = {}) {
    const S = data.engRaw || (data.engRaw = engSeries(cfg, data)), n = data.n;
    const streams = S.streams.map(x => {
      const t = thr[x.s.id] != null ? thr[x.s.id] : VOL_THR;
      const typical = x.normals.slice(-35, -7).filter(v => v != null), level = typical.length ? typical.reduce((a, b) => a + b, 0) / typical.length : 0;
      const checked = level >= VOL_MIN;
      const flags = x.vals.map((v, i) => { const nm = x.normals[i]; if (nm == null || !checked) return null; if (v === 0 && nm > 0) return 'zero'; const dev = v / nm - 1; return dev > t ? 'spike' : dev < -t ? 'dip' : null; });
      let ep = null;
      for (let i = n - 1; i >= n - 14; i--) if (flags[i]) {
        let a = i; while (a - 1 >= n - 14 && flags[a - 1] === flags[i]) a--;
        let v = 0, nm = 0; for (let k = a; k <= i; k++) { v += x.vals[k]; nm += x.normals[k]; }
        ep = { kind: flags[i], start: a, end: i, dev: v / nm - 1, ongoing: i === n - 1, days: i - a + 1, v, nm };
        break;
      }
      return Object.assign({}, x, { t, level, checked, flags, ep });
    });
    const pairs = S.pairs.map(x => {
      const t = thr[x.p.id] != null ? thr[x.p.id] : GAP_THR;
      const gapOf = (a, b) => { let cl = 0, sv = 0; for (let i = a; i < b; i++) { cl += x.client[i]; sv += x.server[i]; } return 1 - cl / sv; };
      const normal = gapOf(n - 35, n - 7), cur = gapOf(n - 7, n), daily = x.server.map((sv, i) => 1 - x.client[i] / sv);
      const off = g => g < 0 || Math.abs(g - normal) > t;
      let since = null; for (let i = n - 1; i >= 0 && off(daily[i]); i--) since = i;
      const flag = cur < 0 ? 'browser' : Math.abs(cur - normal) > t ? 'shift' : null;
      return Object.assign({}, x, { t, normal, cur, daily, flag, since });
    });
    // Connection health per day: the share of checks (sources above the minimum, and pairs) inside their normal band.
    for (let i = 0; i < n; i++) {
      let ok = 0, tot = 0;
      for (const st of streams) if (st.checked) { tot++; if (!st.flags[i]) ok++; }
      for (const pr of pairs) { tot++; const g = pr.daily[i]; if (!(g < 0 || Math.abs(g - pr.normal) > pr.t)) ok++; }
      data.days[i].health = tot ? 100 * ok / tot : 100;
    }
    return { streams, pairs };
  }
