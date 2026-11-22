  /* ---------- Overview ---------- */
  function pageOverview(c) {
    const { R, O, cur, prev } = periods(c);
    const e = isEcom(c), Rn = Math.min(R, c.data.n);
    const d = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    // 1. How the business is doing
    // Each scorecard is also a chart selector: click one to plot that metric.
    const ratio = (a, b) => sl => sum(sl.map(a)) / Math.max(1e-9, sum(sl.map(b)));
    const MET = e ? {
      revenue: { label: 'Revenue', of: sl => sum(sl.map(x => x.revenue)) / sl.length, fmt: v => m(v, c), axis: v => v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v) + '', total: w => w.revenue, tfmt: v => m(v, c), perDay: true },
      orders: { label: 'Orders', of: sl => sum(sl.map(x => x.conv)) / sl.length, fmt: v => v.toFixed(1), axis: v => Math.round(v) + '', total: w => w.conv, tfmt: n0, perDay: true },
      aov: { label: 'Average order value', of: ratio(x => x.revenue, x => x.conv), fmt: v => m(v, c), axis: v => Math.round(v) + '', total: w => w.revenue / w.conv, tfmt: v => m(v, c) },
      spend: { label: 'Ad spend', of: sl => sum(sl.map(x => x.spend)) / sl.length, fmt: v => m(v, c), axis: v => v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v) + '', total: w => w.spend, tfmt: v => m(v, c), perDay: true, neutral: true },
    } : {
      leads: { label: 'Leads', of: sl => sum(sl.map(x => x.conv)) / sl.length, fmt: v => v.toFixed(1), axis: v => (Math.round(v * 10) / 10) + '', total: w => w.conv, tfmt: n0, perDay: true },
      meetings: { label: 'Booked meetings', of: sl => sum(sl.map(x => x.meetings)) / sl.length, fmt: v => v.toFixed(1), axis: v => (Math.round(v * 10) / 10) + '', total: w => w.meetings, tfmt: n0, perDay: true },
      spend: { label: 'Ad spend', of: sl => sum(sl.map(x => x.spend)) / sl.length, fmt: v => m(v, c), axis: v => Math.round(v) + '', total: w => w.spend, tfmt: v => m(v, c), perDay: true, neutral: true },
      cpl: { label: 'Cost per lead', of: ratio(x => x.spend, x => x.conv), fmt: v => m(v, c, 2), axis: v => m(v, c, 0), total: w => w.spend / w.conv, tfmt: v => m(v, c), invert: true },
    };
    const bm = MET[state.bizMetric] ? state.bizMetric : Object.keys(MET)[0];
    const mt = MET[bm];
    const s1 = series(c, mt.of, R, O), sp = prev ? series(c, mt.of, R, O + R) : null;
    const sers = [{ name: `${mt.label}${mt.perDay ? ' per day' : ''}${R > 7 ? ' (7-day average)' : ''}`, short: 'This period', color: 'var(--primary)', main: true, points: s1 }];
    if (sp) sers.push({ name: `Previous ${R} days`, short: 'Previous', color: 'var(--prev)', points: sp });
    // Actions that were implemented: verified, or adopted and being verified
    const done = ledgerRows(c).filter(r => ['verified', 'adopted', 'requested'].includes(r.status) && !(r.agent === 'connect' && r.status !== 'verified'));
    const asc = done.slice().sort((a, b) => a.at - b.at);
    const idxOf = t => Rn - 1 - Math.max(0, Math.round((GF.END - dayStart(t)) / GF.DAY));
    let k = 0;
    const inRange = asc.filter(r => idxOf(r.at) >= 0).map(r => ({ r, n: ++k, i: Math.min(Rn - 1, idxOf(r.at)) }));
    const numOf = new Map(inRange.map(x => [x.r.id, x.n]));
    const marks = inRange.map(x => ({ i: x.i, n: x.n, color: FOX[x.r.fox] ? FOX[x.r.fox].c : 'var(--muted)', title: `${x.n}. ${d(x.r.at)} · ${x.r.title}` }));
    const chart = lineChart(sers, { axis: mt.axis, fmt: mt.fmt, height: 320, marks });
    const kpis = Object.entries(MET).map(([key, x]) => `<button class="kpi kpibtn" data-act="bizm" data-k="${key}" aria-pressed="${key === bm}"><div class="label">${esc(x.label)} ${om('observed')}</div><div class="value">${x.tfmt(x.total(cur))}</div>${dpill(x.total(cur), prev && x.total(prev), x.invert, x.neutral)}</button>`).join('');
    const business = `<section class="sec" aria-label="How the business is doing">
        <div class="sec-head"><div class="lead"><span class="eyebrow">How the business is doing</span><span>${esc(rangeLabel(c))}. ${e ? `Revenue and orders from ${esc(c.cfg.orderSourceName || 'Shopify')}` : 'Leads from your forms and Calendly'}, spend from platform billing.</span></div><div class="filters">${rangeSeg()}</div></div>
        <div class="kpis" style="margin-bottom:22px">${kpis}</div>
        ${chart}
        ${marks.length ? `<p class="marknote">Numbered markers show when a fox’s action was put in place. Hover one to see which.</p>` : ''}
        <div class="callout"><b>What this does and doesn’t show.</b> ${e ? 'Revenue' : 'Lead volume'} moves for many reasons GrowthFox can’t see, such as ${e ? 'pricing, promotions, seasonality and email' : 'sales activity, events and seasonality'}. So we don’t claim the foxes caused the trend. What we do measure is each action’s own result, verified in the platform (below). Proving an effect on the whole business takes an experiment, such as a holdout.</div>
      </section>`;
    // 2. What the foxes have done
    const verified = done.filter(r => r.status === 'verified');
    const st = ledgerStats(c, ledgerRows(c));
    const items = done.map(r => {
      const n = numOf.get(r.id);
      const f = FOX[r.fox] || { name: 'GrowthFox', c: 'var(--muted)' };
      const res = r.status === 'verified' && r.unit !== 'none' ? `<span class="meas good">${esc(impactText(c, r.unit, r.measuredPerDay))}</span><small>measured ${om(r.unit === 'revenue' ? 'modeled' : 'observed')}</small>` : r.unit === 'none' ? '<span style="color:var(--faint)">—</span>' : `<span class="meas" style="color:var(--ink-2)">${esc(impactText(c, r.unit, r.expectedPerDay))}</span><small>expected</small>`;
      return `<li style="${foxVars(r.fox in FOX ? r.fox : 'paid')}"><span class="dn" style="background:${f.c};width:12px;height:12px;margin:6px 6px 0"></span>
        <div style="min-width:0"><b>${esc(r.title)}</b><div class="s"><span class="foxchip">${esc(f.name)}</span><span>${d(r.at)}</span>${STATUS_CHIP[r.status] ? STATUS_CHIP[r.status](r) : ''}</div></div>
        <div class="res">${res}</div></li>`;
    }).join('');
    const doneSec = `<section class="sec" aria-label="What your foxes have done">
        <details class="donebox" ${state.doneOpen ? 'open' : ''}><summary data-act="doneopen">
          <div class="lead"><span class="eyebrow">What your foxes have done</span><span><b>${done.length}</b> actions put in place · <b>${verified.length}</b> verified · decisioned spend <b>${m(st.decisioned, c)}/month</b></span></div>
          <span class="chev">${I.arrow}</span></summary>
          <ol class="donelist">${items || '<li class="empty">No actions put in place yet.</li>'}</ol>
          <a href="#ledger" class="area-link" style="padding-left:0;margin-top:10px">Full history in the ledger ${I.arrow}</a>
        </details>
      </section>`;
    // 3. The foxes, and what's next
    const cards = ['paid', 'analytics', 'engineer'].map(key => {
      const fm = metricFor(c, key);
      const sv = series(c, fm.of, R, O), spv = prev ? series(c, fm.of, R, O + R) : null;
      const v = fm.now ? fm.now() : fm.total(cur), pv = prev ? fm.total(prev) : null;
      return `<button class="foxcard" data-act="nextfox" data-k="${key}" aria-pressed="${state.nextFox === key}" style="${foxVars(key)}"><span class="who">${foxSvg(key)}<span><b>${FOX[key].name}</b><span>${esc(fm.label)}</span></span></span>
        <span class="v"><strong>${fm.fmt(v)}</strong>${dpill(fm.total(cur), pv, fm.invert)}</span>${spark(sv, spv, FOX[key].c)}</button>`;
    }).join('');
    const nf = state.nextFox && FOX[state.nextFox] ? state.nextFox : null;
    const acts = activeRecs(c).filter(r => !nf || r.fox === nf).slice(0, nf ? 5 : 3);
    // Source problems and warmup, as messages from the fox that owns them (no status strip on the Overview)
    const alerts = [];
    for (const s of c.cfg.sources.filter(x => x.status === 'degraded')) alerts.push({ fox: 'engineer', html: `<p><b style="font-weight:600">${esc(s.name)} is only partly arriving:</b> ${esc(s.issue || 'some events are missing')}${s.since != null ? ` since ${GF.dayLabel(s.since)}` : ''}, so spend on this platform isn’t fully tracked until it’s fixed.</p><div class="row"><span class="chip warn">${I.alert}Degraded</span><a class="pillbtn" href="#engineer">Open Engineer Fox →</a></div>` });
    for (const q of c.cfg.quarantine.filter(x => !c.qdec[x.id])) alerts.push({ fox: 'analytics', html: `<p><b style="font-weight:600">${esc(q.source)} data from ${GF.dayLabel(q.daysAgo)} is quarantined.</b> ${esc(q.what)} It’s held out of every number until you decide. ${esc(q.ask)}</p><div class="row"><span class="chip bad">${I.shield}Quarantined</span><button class="btn" data-act="q-include" data-id="${esc(q.id)}">It’s real, include it</button><button class="btn" data-act="q-exclude" data-id="${esc(q.id)}">Not real, keep it out</button></div>` });
    if (!c.model.warm) alerts.push({ fox: 'paid', html: `<p><b style="font-weight:600">Warming up: ${c.model.warmLeft} days left.</b> Trend recommendations start once there are 4 weeks of data. Spend-Watch and data checks already run.</p><div class="row"><span class="chip info">${I.clock}Warmup</span></div>` });
    const alertHtml = alerts.filter(a => !nf || a.fox === nf).map(a => `<div class="bub-row" style="${foxVars(a.fox)}">${nf ? '' : foxSvg(a.fox, true)}<div class="bubble"${nf ? ' style="border-radius:16px"' : ''}>${nf ? '' : `<span class="name">${FOX[a.fox].name}</span>`}${a.html}</div></div>`).join('');
    const next = acts.map(r => `<div class="bub-row" style="${foxVars(r.fox)}">${nf ? '' : foxSvg(r.fox, true)}<div class="bubble"${nf ? ' style="border-radius:16px"' : ''}>${nf ? '' : `<span class="name">${FOX[r.fox].name}</span>`}<p><b style="font-weight:600">${esc(r.title)}.</b> ${esc(r.means)}</p>
      <div class="row"><span class="impact ${r.confidence === 'investigate' ? 'inv' : ''}">${esc(shortImpact(c, r))}</span><a class="pillbtn" href="#recs" data-goto="${r.id}">Review →</a></div></div></div>`).join('');
    return `<div class="page">
      <div class="ph-tools"><a class="btn primary" href="#brief">${I.download}Download PDF</a>${datePicker(c)}</div>
      <section class="fox-hero" aria-label="Executive summary" style="${foxVars('executive')}"><div class="id">${foxSvg('executive', true)}<div><h1>Executive Fox</h1><div class="role">${esc(FOX.executive.role)}</div></div></div>
        <div><span class="eyebrow">Executive summary · ${esc(rangeText(c, chgRange(c)))}</span><p class="sum">${esc(execSummary(c))}</p></div></section>
      ${realNote(c)}
      ${execSections(c)}
      ${profileSection(c)}
      ${footnote()}</div>`;
  }
