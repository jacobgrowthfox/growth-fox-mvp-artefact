  /* ---------- Real clients: data from BigQuery, delivered through the shared store ----------
     setReal() takes the exported documents (meta, terms, daily-<year>) and fills the client's campaigns,
     search terms and a day-by-campaign index. Every value is coerced to a number or string here, because
     shared data is untrusted. Google Ads' own conversion count is used for every attribution rule. */
  const REAL = {};
  const isoD = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function setReal(id, docs) {
    const cfg = CLIENTS.find(c => c.id === id);
    const meta = docs && docs.meta;
    if (!cfg || !meta || !Array.isArray(meta.campaigns)) return false;
    const byDay = {};
    for (const [k, v] of Object.entries(docs)) {
      if (!k.startsWith('daily-') || !v || typeof v.camps !== 'object') continue;
      for (const [cid, s] of Object.entries(v.camps)) {
        if (!s || !Array.isArray(s.d)) continue;
        const o = byDay[cid] = byDay[cid] || {};
        s.d.forEach((d, j) => { o[String(d)] = { cost: +(s.cost || [])[j] || 0, clicks: +(s.clicks || [])[j] || 0, conv: +(s.conv || [])[j] || 0, imp: +(s.imp || [])[j] || 0, inv: +(s.inv || [])[j] || 0, elig: +(s.elig || [])[j] || 0, lost: +(s.lost || [])[j] || 0 }; });
      }
    }
    cfg.campaigns = meta.campaigns.map(c => ({ id: String(c.id), name: String(c.name || c.id), platform: 'gads', type: String(c.type || 'search'), status: String(c.status || ''), isLost: +c.lostIs28 || 0, cpc: +c.cpc28 || 0 }));
    const known = new Set(cfg.campaigns.map(c => c.id));
    cfg.searchTerms = ((docs.terms && Array.isArray(docs.terms.rows)) ? docs.terms.rows : [])
      .filter(r => Array.isArray(r) && known.has(String(r[1])) && !(+r[4] > 0))
      .map(r => ({ term: String(r[0]), campaign: String(r[1]), spend28: +r[2] || 0, clicks: +r[3] || 0 }));
    const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    cfg.dataThrough = day(meta.dataThrough); cfg.firstSpend = day(meta.firstSpend); cfg.lastConversion = day(meta.lastConversion);
    // Segments (device, country, audience) per campaign and day, from segments-<year> docs: {cols, rows}.
    const seg = {}, num = v => +v || 0;
    for (const [k, v] of Object.entries(docs)) {
      if (!k.startsWith('segments-') || !v || !Array.isArray(v.rows)) continue;
      const cols = Array.isArray(v.cols) ? v.cols.map(String) : ['date', 'campaign', 'type', 'value', 'label', 'detail', 'cost', 'clicks', 'conv'];
      const ix = n => cols.indexOf(n), I = { date: ix('date'), campaign: ix('campaign'), type: ix('type'), value: ix('value'), label: ix('label'), detail: ix('detail'), cost: ix('cost'), clicks: ix('clicks'), conv: ix('conv') };
      if (I.date < 0 || I.campaign < 0 || I.type < 0 || I.value < 0) continue;
      for (const r of v.rows) {
        if (!Array.isArray(r)) continue;
        const d = day(String(r[I.date])), cid = String(r[I.campaign]), type = String(r[I.type]), value = String(r[I.value]);
        if (!d || !known.has(cid) || !['device', 'country', 'audience'].includes(type) || !/^[\w.:-]{1,64}$/.test(value)) continue;
        const t = ((seg[cid] = seg[cid] || {})[type] = seg[cid][type] || {});
        const o = t[value] = t[value] || { label: I.label >= 0 && r[I.label] != null ? String(r[I.label]).slice(0, 80) : null, detail: I.detail >= 0 && r[I.detail] != null ? String(r[I.detail]).slice(0, 40) : null, days: {} };
        o.days[d] = { cost: I.cost >= 0 ? num(r[I.cost]) : 0, clicks: I.clicks >= 0 ? num(r[I.clicks]) : 0, conv: I.conv >= 0 ? num(r[I.conv]) : 0 };
      }
    }
    // Daily stats per ad, from ads-<year> docs: {cols, rows}
    const ads = {};
    for (const [k, v] of Object.entries(docs)) {
      if (!/^ads-\d{4}$/.test(k) || !v || !Array.isArray(v.rows)) continue;
      const cols = Array.isArray(v.cols) ? v.cols.map(String) : ['date', 'campaign', 'adGroup', 'ad', 'imp', 'clicks', 'cost', 'conv'], ix = n => cols.indexOf(n);
      const I = { date: ix('date'), campaign: ix('campaign'), adGroup: ix('adGroup'), ad: ix('ad'), imp: ix('imp'), clicks: ix('clicks'), cost: ix('cost'), conv: ix('conv') };
      if (I.date < 0 || I.ad < 0) continue;
      for (const r of v.rows) {
        if (!Array.isArray(r)) continue;
        const d = day(String(r[I.date])), aid = String(r[I.ad]), cid = I.campaign >= 0 ? String(r[I.campaign]) : '';
        if (!d || !/^\d{1,20}$/.test(aid) || !known.has(cid)) continue;
        const o = ads[aid] = ads[aid] || { campaign: cid, adGroup: I.adGroup >= 0 ? String(r[I.adGroup]) : '', days: {} };
        o.days[d] = { imp: I.imp >= 0 ? num(r[I.imp]) : 0, clicks: I.clicks >= 0 ? num(r[I.clicks]) : 0, cost: I.cost >= 0 ? num(r[I.cost]) : 0, conv: I.conv >= 0 ? num(r[I.conv]) : 0 };
      }
    }
    // Account settings as of one snapshot date (settings-now). No history before that date exists.
    let settings = null; const sn = docs['settings-now'];
    if (sn && typeof sn === 'object') {
      const str = v => v == null ? '' : String(v).slice(0, 200), arr = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
      settings = {
        snapshotDate: day(sn.snapshotDate),
        campaigns: arr(sn.campaigns).map(c => ({ id: str(c.id), name: str(c.name), status: str(c.status), servingStatus: str(c.servingStatus), channel: str(c.channel), bidding: str(c.bidding), targetRoas: num(c.targetRoas), budget: num(c.budget),
          // Optional fields for the Stage 1 gates (absent from the export today; each gate part is Not Assessed without them)
          goalActions: Array.isArray(c.goalActions) ? c.goalActions.map(str) : null, geoTargetType: c.geoTargetType == null ? null : str(c.geoTargetType),
          locations: Array.isArray(c.locations) ? arr(c.locations).map(l => ({ name: str(l.name), country: str(l.country), negative: l.negative === true })) : null,
          euPolitical: c.euPolitical == null ? null : str(c.euPolitical), bidCeiling: c.bidCeiling == null ? null : num(c.bidCeiling), bidFloor: c.bidFloor == null ? null : num(c.bidFloor) })),
        adGroups: arr(sn.adGroups).map(g => ({ campaign: str(g.campaign), id: str(g.id), name: str(g.name), status: str(g.status), type: str(g.type), targetCpa: num(g.targetCpa), targetRoas: num(g.targetRoas), bidding: str(g.bidding) })),
        keywords: arr(sn.keywords).map(k => ({ campaign: str(k.campaign), adGroup: str(k.adGroup), id: str(k.id), text: str(k.text), match: str(k.match), negative: k.negative === true, status: str(k.status), approval: str(k.approval), serving: str(k.serving), qs: num(k.qs) })),
        campaignNegatives: arr(sn.campaignNegatives).map(n => ({ campaign: str(n.campaign), text: str(n.text), status: str(n.status) })),
        ads: arr(sn.ads).map(a => ({ campaign: str(a.campaign), adGroup: str(a.adGroup), id: str(a.id), type: str(a.type), strength: str(a.strength), approval: str(a.approval), status: str(a.status), finalUrlError: a.finalUrlError == null ? null : str(a.finalUrlError) })),
        conversionActions: Array.isArray(sn.conversionActions) ? arr(sn.conversionActions).map(a => ({ id: str(a.id), name: str(a.name), category: str(a.category), primary: a.primary === true, status: str(a.status) })) : null,
        account: sn.account && typeof sn.account === 'object' ? { status: str(sn.account.status), billingOk: sn.account.billingOk == null ? null : sn.account.billingOk === true, policyHold: sn.account.policyHold == null ? null : sn.account.policyHold === true } : null,
      };
      // Which optional parts the export carries (a gate part without its data is Not Assessed, never assumed fine)
      const some = (list, k) => list.some(x => x[k] != null);
      settings.has = { conversions: !!settings.conversionActions, locations: some(settings.campaigns, 'locations'), geoType: some(settings.campaigns, 'geoTargetType'),
        eu: some(settings.campaigns, 'euPolitical'), bidCaps: some(settings.campaigns, 'bidCeiling') || some(settings.campaigns, 'bidFloor'), urls: some(settings.ads, 'finalUrlError'), account: !!settings.account };
    }
    REAL[id] = { byDay, seg, ads, settings };
    return true;
  }
  // One day of a real client, summed over its campaigns.
  function realDay(cfg, t) {
    const R = REAL[cfg.id], key = isoD(t), o = { spend: 0, conv: 0, clicks: 0, inv: 0, camps: {} };
    for (const c of cfg.campaigns) {
      const x = R ? (R.byDay[c.id] || {})[key] : null;
      const spend = x ? x.cost : 0, conv = x ? x.conv : 0, clicks = x ? x.clicks : 0, inv = x ? x.inv || 0 : 0;
      o.camps[c.id] = { spend, lc: conv, lin: conv, plat: conv, clicks, rev: 0 };
      o.spend += spend; o.conv += conv; o.clicks += clicks; o.inv += inv;
    }
    return o;
  }
  // Every day from the first spend to the latest day (at least the usual 90), so the tables follow any picked range.
  function realData(cfg) {
    const first = cfg.firstSpend ? new Date(cfg.firstSpend + 'T00:00:00').getTime() : NaN;
    const n = Math.max(Math.min(90, cfg.daysConnected), isFinite(first) ? Math.round((END - first) / DAY) + 1 : 0), days = [];
    for (let i = 0; i < n; i++) {
      const t = END - (n - 1 - i) * DAY, x = realDay(cfg, t);
      days.push({ i, t, date: new Date(t), camps: x.camps, spend: x.spend, lc: x.conv, lin: x.conv, plat: x.conv, adRev: 0, clicks: x.clicks,
        conv: x.conv, meetings: 0, forms: x.conv, dq: null, cov: null });
    }
    return { n, days, eps: [], real: true };
  }
