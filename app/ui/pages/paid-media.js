  /* ---------- Paid Media Fox: channels and the four optimization areas ---------- */
  const CHANNELS = {
    gads: { name: 'Google Ads', kind: 'Search and Performance Max', ep: 'gads' },
    meta: { name: 'Meta', kind: 'Prospecting and retargeting', ep: 'meta' },
  };
  // The four Paid Media areas (measurement belongs to the Data and Engineer foxes). `covered` = channels v1’s rules check.
  // One icon per optimization area (Paid Media page and channel deep-dives)
  const AREA_ICON = {
    setup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h9M19 6h1M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="16" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/></svg>',
    creative: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="m21 15.5-4.5-4.5L7 20"/></svg>',
    audiences: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.3"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16.4 14.2A5 5 0 0 1 21.6 20"/></svg>',
    spend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v5.5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6M5 11.5V17c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5.5"/></svg>',
  };
  const AREAS = [
    { id: 'setup', name: 'Campaign & account setup', q: 'Is the account set up to spend budget well?', covered: ['gads', 'meta'] },
    { id: 'creative', name: 'Creative & landing pages', q: 'Do ads earn attention and convert it?', covered: ['gads', 'meta'] },
    { id: 'audiences', name: 'Audiences & targeting', q: 'Are we reaching the right people, in the right places?', covered: ['gads', 'meta'] },
    { id: 'spend', name: 'Spend & optimization', q: 'Is budget deployed efficiently within the channel?', covered: ['gads', 'meta'] },
  ];
  const areaOf = r => r.area || (r.agent === 'creative' ? 'creative' : r.kind === 'negative' ? 'setup' : 'spend');
  const RULE_NAME = { lc: 'last click, 7-day', lin: 'linear, 28-day', plat: 'as each platform claims' };
  function chanStats(c, id, R, offset = 0) {
    const e = isEcom(c), cs = c.cfg.campaigns.filter(x => x.platform === id);
    const o = { spend: 0, lc: 0, lin: 0, plat: 0, clicks: 0, lost: 0 };
    for (const x of cs) { const w = GF.campWindow(c.data, x.id, R, offset); for (const k of ['spend', 'lc', 'lin', 'plat', 'clicks']) o[k] += w[k]; o.lost += (x.isLost || 0) * w.spend; }
    o.lost = o.spend ? o.lost / o.spend : 0;
    o.kpi = k => e ? (o[k] * c.cfg.aov) / o.spend : o[k] >= 0.5 ? o.spend / o[k] : Infinity; // ROAS or CPL under rule k (no leads: undefined)
    return o;
  }
  const kpiFmt = (c, v) => !isFinite(v) ? '—' : isEcom(c) ? v.toFixed(2) : m(v, c, 0);
  const ruleOf = c => c.cfg.platformOnly ? 'plat' : state.rule; // only the platform's own count is connected
  const ruleOpts = c => Object.entries(RULE_NAME).filter(([k]) => !c.cfg.platformOnly || k === 'plat');
  const kpiName = c => isEcom(c) ? 'ROAS' : 'Cost per lead';
  function chanOpps(c, id) {
    const open = activeRecs(c).filter(r => r.platform === id && r.fox === 'paid');
    const held = c.model.recs.filter(r => r.held && r.platform === id).map(r => ({ title: r.title, text: r.held.text }))
      .concat(c.model.held.filter(h => h.platform === id).map(h => ({ title: h.title, text: h.text })));
    return { open, held, value: open.filter(r => r.unit === 'saved' || r.unit === 'revenue').reduce((s, r) => s + r.valuePerDay, 0) };
  }
  function oppRow(c, r) {
    const imp = r.impactTxt ? r.impactTxt.imp : r.confidence === 'investigate' ? (r.finding ? 'To look into' : 'To investigate') : r.bet ? `${betRange(c, r)}/day` : r.unit === 'cov' ? `+${r.cov} pts coverage` : r.unit === 'dq' ? `+${r.dq} data quality` : `${r.estimate ? '≈ ' : ''}+${m(r.valuePerDay, c)}/day`;
    return `<li><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(r.id)}">${esc(r.title)}</a><div class="s"><span>${esc(AGENT[r.agent])}</span>${confBadge(r)}${checkChip(r)}${r.asOf ? `<span class="asof">${esc(r.asOf)}</span>` : ''}</div></div><div class="imp ${r.confidence === 'investigate' ? 'inv' : ''}">${esc(imp)}<small>${r.impactTxt ? esc(r.impactTxt.sub) : r.unit === 'cov' ? 'Engineer Fox fix' : r.unit === 'dq' ? 'Data Fox fix' : r.unit === 'revenue' ? 'revenue' : r.unit === 'none' ? 'impact unknown' : r.estimate ? 'saved, estimate' : 'saved'}</small></div></li>`;
  }
  function pageMedia(c) {
    const { R, O } = periods(c); const Rn = Math.min(R, c.data.n); const e = isEcom(c), f = FOX.paid;
    const mt = metricFor(c, 'paid'); const { cur, prev } = periods(c);
    const v = mt.total(cur), pv = prev ? mt.total(prev) : null;
    const ids = Object.keys(CHANNELS).filter(id => c.cfg.campaigns.some(x => x.platform === id));
    const totSpend = ids.reduce((s, id) => s + chanStats(c, id, Rn, O).spend, 0);
    const rule = ruleOf(c);
    const cards = ids.map(id => {
      const ch = CHANNELS[id], st = chanStats(c, id, Rn, O), pst = c.data.n >= O + 2 * R ? chanStats(c, id, R, O + R) : null, op = chanOpps(c, id);
      const waste = op.value / (st.spend / Rn);
      const status = op.held.length ? ['warn', 'Partly on hold'] : waste >= 0.05 ? ['warn', 'Needs attention'] : ['good', 'On track'];
      const k = st.kpi(rule), pk = pst ? pst.kpi(rule) : null;
      return `<a class="epcard" href="#paid/${id}">
        <div class="eph"><div><b>${esc(ch.name)}</b><span>${esc(ch.kind)}</span></div><span class="chip ${status[0]}">${status[1]}</span></div>
        <div class="eps"><strong>${kpiFmt(c, k)}</strong><span>${kpiName(c)} ${om('modeled')}</span></div>
        <div class="epcats"><span>Platform claims ${kpiFmt(c, st.kpi('plat'))}</span><span>${m(st.spend, c)} spend ${om('observed')} · ${totSpend ? Math.round(st.spend / totSpend * 100) : 0}% of total</span><span>${n0(st[rule])} ${c.cfg.convNoun} (${esc(RULE_NAME[rule])})</span></div>
        <div class="epm"><span><b style="color:var(--fg)">${op.open.length}</b> open opportunit${op.open.length === 1 ? 'y' : 'ies'}</span><span style="color:var(--good);font-weight:600">${op.value ? '+' + m(op.value, c) + '/day' : ''}</span></div>
        <span class="epgo">Deep-dive ${I.arrow}</span></a>`;
    }).join('');
    // One row per area, the same shape however many channels a brand runs: totals first, then a chip per channel.
    const matrix = `<ul class="areagrid">${AREAS.map(a => {
      const per = ids.map(id => {
        if (!a.covered.includes(id)) return { id, off: true, n: 0, val: 0 };
        const list = chanOpps(c, id).open.filter(r => areaOf(r) === a.id);
        return { id, n: list.length, val: list.filter(r => r.unit === 'saved' || r.unit === 'revenue').reduce((s, r) => s + r.valuePerDay, 0) };
      });
      const n = per.reduce((s, x) => s + x.n, 0), val = per.reduce((s, x) => s + x.val, 0), checked = per.filter(x => !x.off).length;
      const chips = per.map(x => x.off ? `<span class="chip neutral off" title="Not checked in v1">${esc(CHANNELS[x.id].name)} · not checked yet</span>`
        : `<a class="chip ${x.n ? 'warn' : 'good'}" href="#paid/${x.id}">${esc(CHANNELS[x.id].name)} · ${x.n ? `${x.n} open` : 'clear'}</a>`).join('');
      const head = !checked ? `<span class="an off">—</span><small>Not checked yet</small>` : n ? `<span class="an">${n} open</span><small>${val ? `<b>+${m(val, c)}/day</b>` : 'impact to confirm'}</small>` : `<span class="an ok">Nothing found</span><small>${checked} of ${ids.length} channel${ids.length === 1 ? '' : 's'} checked</small>`;
      return `<li class="${n ? 'open' : checked ? 'clear' : 'off'}"><div class="ag-top"><span class="ar-ico ${n ? 'open' : checked ? 'clear' : ''}" aria-hidden="true">${AREA_ICON[a.id] || ''}</span><div class="ar-t"><b>${(t => t ? `<a class="ag-link" href="#paid/${t}" data-area="${a.id}">${esc(a.name)}</a>` : esc(a.name))((per.filter(x => !x.off).sort((p, q) => q.n - p.n)[0] || {}).id)}</b><span>${esc(a.q)}</span></div></div><div class="ar-n">${head}</div><div class="ar-ch">${chips}</div>${(r => r.length ? `<div class="area-checked">Checked: ${r.map(k => esc(GF.PM_CHECKS[k] || k)).join(' · ')}</div>` : '')(c.cfg.real ? (GF.checksRun(c.cfg)[a.id] || []) : [])}</li>`;
    }).join('')}</ul>`;
    const acts = foxActions(c, 'paid');
    const total = acts.filter(a => a.r.confidence !== 'investigate').reduce((s, a) => s + a.r.focus, 0);
    const summary = `${isFinite(v) ? `${mt.label} is ${mt.fmt(v)} over ${perTxt(c)}${pv && isFinite(pv) ? `, ${(e ? v > pv : v < pv) ? 'better' : 'worse'} than the period before` : ''}.` : `No ${c.cfg.convNoun} were recorded over ${perTxt(c)}, so there’s no ${mt.label.toLowerCase()} to show.`} ${ids.length} channel${ids.length === 1 ? '' : 's'}, ${acts.length} open opportunit${acts.length === 1 ? 'y' : 'ies'}.${total ? ` Doing them would ${e ? `add about +${total.toFixed(2)} to blended ROAS` : `cut blended cost per lead by about ${m(-total, c, 2)}`}.` : ''}${!c.model.warm ? ` Trend recommendations start after warmup, in ${c.model.warmLeft} days.` : ''}`;
    const actList = acts.length ? `<ol class="actlist">${acts.map((a, i) => `<li><span class="rank">${i + 1}</span><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(a.r.id)}">${esc(a.r.title)}</a><div class="s"><span>${esc(CHANNELS[a.r.platform] ? CHANNELS[a.r.platform].name : '')}</span><span>${esc(AREAS.find(x => x.id === areaOf(a.r)).name)}</span>${confBadge(a.r)}${checkChip(a.r)}</div></div><div class="imp ${a.score <= 0 ? 'inv' : ''}">${esc(a.imp)}<small>${esc(a.sub)}</small></div></li>`).join('')}</ol>` : '<div class="empty">No open actions.</div>';
    return `<div class="page" style="${foxVars('paid')}">
      <section class="fox-hero" aria-label="Executive summary"><div class="id">${foxSvg('paid', true)}<div><h1>${f.name}</h1><div class="role">${esc(f.role)}</div></div></div>
        <div><span class="eyebrow">Executive summary · today</span><p class="sum">${esc(summary)}</p></div></section>
      <section class="sec" aria-label="Channels">
        <div class="sec-head"><div class="lead"><span class="eyebrow">Channels</span><span>${esc(rangeLabel(c))}. Results under one named rule; platform claims shown beside.</span></div><div class="filters">${rangeSeg()}</div></div>
        <div class="dqhead"><span class="big" style="color:var(--c)">${mt.fmt(v)}</span><span class="of">${esc(mt.label)} ${om('observed')}</span>${dpill(v, pv, mt.invert)}</div>
        ${realNote(c)}
        <div class="epgrid">${cards}</div>
        <div class="callout">Channels are compared here to show where the opportunities are, not where to move budget. Each platform counts ${c.cfg.convNoun} under its own model, so their ${kpiName(c)} figures don’t add up or compare like-for-like.</div>
      </section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Where the opportunities are</span><span>The four optimization areas, across all your channels. Every rule is a draft until our media lead signs it off.${c.cfg.real ? ` Period checks (spend, segment cost, budget-limited search, creative fatigue) scan every day of ${esc(perTxt(c))} and show each time one would have fired; settings checks use the latest settings snapshot. The “Checked” line under each area lists what ran. Not checked yet: falling ROAS (e-commerce only), recent major edits (no settings history before Nov 2026), and the rubric checks not listed there.` : ''}</span></div></div>${matrix}</section>
      <section class="sec" aria-label="Prioritized actions"><div class="sec-head"><div class="lead"><span class="eyebrow">Prioritized actions</span><span>Ranked by expected impact on ${esc(mt.label.replace(/^\w+/, w => /[A-Z]{2}/.test(w) ? w : w.toLowerCase()))} × confidence ÷ effort.</span></div><a href="#recs" style="font-size:15px;font-weight:500">All actions</a></div>${actList}</section>
      ${footnote()}</div>`;
  }
  function pageChannel(c, id) {
    const ch = CHANNELS[id];
    if (!ch || !c.cfg.campaigns.some(x => x.platform === id)) return `<div class="page"><a href="#paid">← Paid Media Fox</a><div class="empty">Channel not found.</div></div>`;
    const { R, O } = periods(c); const Rn = Math.min(R, c.data.n); const e = isEcom(c), rule = ruleOf(c);
    const ids = Object.keys(CHANNELS).filter(k => c.cfg.campaigns.some(x => x.platform === k));
    const st = chanStats(c, id, Rn, O), pst = c.data.n >= O + 2 * R ? chanStats(c, id, R, O + R) : null, op = chanOpps(c, id);
    const tabs = ids.map(k => `<a class="fbtn" href="#paid/${k}" aria-pressed="${k === id}">${esc(CHANNELS[k].name)}<span class="n">${chanOpps(c, k).open.length}</span></a>`).join('');
    const ep = c.data.eps.find(x => x.ep.id === ch.ep), epw = ep ? GF.epWindow(c.data, ch.ep, 7) : null;
    const kpis = `<div class="kpis">
      <div class="kpi"><div class="label">Spend ${om('observed')}</div><div class="value">${m(st.spend, c)}</div>${dpill(st.spend, pst && pst.spend, false, true)}</div>
      <div class="kpi"><div class="label">${e ? 'Orders' : 'Leads'} ${om('modeled')}</div><div class="value">${n0(st[rule])}</div><small>${esc(RULE_NAME[rule])}</small></div>
      <div class="kpi"><div class="label">${kpiName(c)} ${om('modeled')}</div><div class="value">${kpiFmt(c, st.kpi(rule))}</div><small>Platform claims ${kpiFmt(c, st.kpi('plat'))}</small></div>
      ${id === 'gads' ? `<div class="kpi"><div class="label">Impression share lost to budget</div><div class="value">${Math.round(st.lost * 100)}%</div><small>Spend-weighted, search campaigns${c.cfg.real ? ', last 28 days' : ''}</small></div>` : `<div class="kpi"><div class="label">Clicks</div><div class="value">${n0(st.clicks)}</div><small>${m(st.spend / Math.max(1, st.clicks), c, 2)} per click</small></div>`}
      ${epw ? `<a class="kpi" href="#analytics/${ch.ep}" style="text-decoration:none;color:inherit"><div class="label">Data quality</div><div class="value" style="color:${ST_COL[GF.epStatus(epw.score)]}">${Math.round(epw.score)}<span style="font-size:15px;color:var(--muted);font-weight:500">/100</span></div><small>${esc(ep.ep.kind)} · Data Fox →</small></a>` : ''}
    </div>`;
    const areas = AREAS.map((a, i) => {
      const covered = a.covered.includes(id);
      const list = op.open.filter(r => areaOf(r) === a.id);
      const held = [];
      let body;
      if (!covered) body = `<div class="area-empty"><b>Not covered in v1.</b> ${esc((a.later && a.later[id]) || 'Planned for a later version.')}</div>`;
      else if (!list.length && !held.length) body = `<div class="area-empty" style="color:var(--good)">${I.check.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px;margin-right:6px"')}Nothing found in ${perTxt(c)}.</div>`;
      else body = `${held.map(h => `<div class="held" style="margin-bottom:8px">${I.clock}<div><h4>On hold: ${esc(h.title)}</h4><p>${esc(h.text)}</p></div></div>`).join('')}${list.length ? `<ol class="actlist oppl">${list.map(r => oppRow(c, r)).join('')}</ol>` : ''}`;
      const ran = c.cfg.real ? (GF.checksRun(c.cfg)[a.id] || []) : [];
      if (ran.length) body += `<div class="area-checked">Checked: ${ran.map(k => esc(GF.PM_CHECKS[k] || k)).join(' · ')}</div>`;
      return `<div class="area ${covered ? '' : 'off'}" id="area-${a.id}"><div class="area-h"><span class="area-ico ${list.length ? 'open' : covered ? 'clear' : ''}" aria-hidden="true">${AREA_ICON[a.id] || i + 1}</span><div><b>${esc(a.name)}</b><span>${esc(a.q)}</span></div>${covered ? `<span class="chip ${list.length ? 'info' : 'good'}">${list.length} open</span>` : '<span class="chip neutral">Later</span>'}</div>${body}${a.id === 'measurement' && epw ? `<a class="area-link" href="#analytics/${ch.ep}">See the ${esc(ch.name)} endpoint in the Data Fox ${I.arrow}</a>` : ''}</div>`;
    }).join('');
    const cs = c.cfg.campaigns.filter(x => x.platform === id);
    const oppCamps = new Set(op.open.map(r => r.campaign).filter(Boolean).join(', ').split(', '));
    const rowsC = cs.map(x => ({ x, w: GF.campWindow(c.data, x.id, Rn, O) })).sort((a, b) => b.w.spend - a.w.spend);
    const po = c.cfg.platformOnly;
    const camp = `<div class="tbl-wrap"><table><thead><tr><th>Campaign</th><th class="r">Spend ${om('observed')}</th><th class="r">Clicks</th>${po ? `<th class="r">${esc(ch.name)} conversions</th>` : '<th class="r">Last click</th><th class="r">Linear</th><th class="r">Platform claims</th>'}<th class="r">${e ? 'ROAS' : 'CPL'} (${rule === 'lc' ? 'last click' : rule === 'lin' ? 'linear' : 'claimed'})</th></tr></thead><tbody>${rowsC.map(({ x, w }) => {
      const k = e ? (w[rule] * c.cfg.aov) / Math.max(1, w.spend) : w.spend / Math.max(0.01, w[rule]);
      const flag = oppCamps.has(x.name) || oppCamps.has(GF.short(x.name));
      return `<tr><td>${flag ? '<span class="foxdot" style="background:var(--warn);display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px" title="Has an open opportunity"></span>' : ''}${esc(x.name)}<small class="pdesc">${esc(x.type)}${x.status && x.status !== 'ENABLED' ? ' · ' + esc(x.status.toLowerCase()) : ''}</small></td><td class="r">${m(w.spend, c)}</td><td class="r">${n0(w.clicks)}</td>${po ? `<td class="r">${n0(w.plat)}</td>` : `<td class="r">${n0(w.lc)}</td><td class="r">${n0(w.lin)}</td><td class="r">${n0(w.plat)}</td>`}<td class="r"><b>${w[rule] < 0.5 ? '—' : kpiFmt(c, k)}</b></td></tr>`;
    }).join('')}</tbody></table></div>`;
    return `<div class="page" style="${foxVars('paid')}">
      <a href="#paid" style="font-size:15px;font-weight:500;text-decoration:none">← Paid Media Fox</a>
      <div class="ph"><div><h1>${esc(ch.name)} <span style="color:var(--muted);font-weight:500">· ${esc(ch.kind)}</span></h1><p>Optimization opportunities within ${esc(ch.name)}, across the four optimization areas. You make every change; we verify it in the ${esc(ch.name)} change history.</p></div><span class="aside">${asOf()}</span></div>
      <div class="filters" role="group" aria-label="Channel">${tabs}<span style="flex:1"></span><span class="rulepick" style="margin:0"><label for="rule">Rule</label><select id="rule" class="select">${ruleOpts(c).map(([k, l]) => `<option value="${k}" ${k === rule ? 'selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></span>${rangeSeg()}</div>
      ${statusStrip(c)}
      ${kpis}
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Optimization areas</span><span>${op.open.length} open opportunit${op.open.length === 1 ? 'y' : 'ies'}${op.value ? `, worth about +${m(op.value, c)}/day` : ''}. Every rule is a draft until our media lead signs it off.</span></div></div>${(() => { const fx = activeRecs(c).filter(r => r.platform === id && (r.fox === 'analytics' || r.fox === 'engineer')); if (!fx.length && !op.held.length) return ''; return `<div class="callout" style="margin:0 0 14px"><b>Measurement first.</b> ${fx.length ? `${fx.length} open tracking fix${fx.length === 1 ? '' : 'es'} affect${fx.length === 1 ? 's' : ''} ${esc(ch.name)}: ${fx.map(r => `<a href="#recs" data-goto="${r.id}">${esc(r.title)}</a>`).join(', ')}. ` : ''}${op.held.map(h => esc(h.title) + '. ').join('')}They’re handled by the <a href="#analytics/${ch.ep}">Data Fox</a> and the <a href="#engineer">Engineer Fox</a>, and come first in All actions.</div>`; })()}<div class="areas">${areas}</div></section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Campaigns</span><span>${perCap(c)}. ${c.cfg.convNoun[0].toUpperCase() + c.cfg.convNoun.slice(1)} under each rule, so you can see when a verdict depends on the rule.</span></div></div>${camp}</section>
      ${footnote()}</div>`;
  }
