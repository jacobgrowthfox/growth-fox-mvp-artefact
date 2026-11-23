  /* ---------- Fox pages ---------- */
  const EW = { low: 1, med: 1.6, high: 2.5 };
  function foxActions(c, kind) {
    const e = isEcom(c);
    const nPlat = GF.dqByPlatform(c.cfg, c.data).length;
    return activeRecs(c).filter(r => {
      if (kind === 'paid') return r.fox === 'paid';
      if (kind === 'engineer') return r.fox === 'engineer';
      if (kind === 'analytics') return r.fox === 'analytics';
      return r.fox === 'commercial' || r.alsoFox === 'commercial' || (r.agent === 'tracking' && ['shop', 'crm', 'app'].includes(r.platform));
    }).map(r => {
      let imp, sub, score;
      if (r.impactTxt) { imp = r.impactTxt.imp; sub = r.impactTxt.sub; score = r.gate ? r.score : 0; } // baseline actions keep their rank (first)
      else if (r.confidence === 'investigate') { imp = r.finding ? 'To look into' : 'Investigate'; sub = r.finding ? 'found in period' : 'impact unknown'; score = -1; }
      else if (kind === 'engineer') { imp = r.ticket ? r.devTxt : `+${r.cov} pts`; sub = r.ticket ? shortImpact(c, r).replace(r.devTxt + ' ', '') : 'coverage'; score = r.score; }
      else if (kind === 'commercial' && r.agent === 'tracking') { const lost = sum(c.data.days.slice(-7).map(x => x.conv)) * (0.31 - 0.19); imp = `+${Math.round(lost)} leads/wk`; sub = 'recorded, not new'; score = lost; }
      else if (kind === 'analytics') { imp = `+${ptsTxt(r.dq / nPlat)} pts`; sub = `+${ptsTxt(r.dq)} on ${GF.PLATFORMS[r.platform]}`; score = r.dq / EW[r.effort]; }
      else if (kind === 'commercial') { imp = `+${m(r.revPerDay || 0, c)}`; sub = 'revenue per day'; score = r.revPerDay || 0; }
      else if (e) { imp = r.bet ? `≈ +${(r.focus * 0.6).toFixed(2)}–${(r.focus * 1.25).toFixed(2)}` : `+${r.focus.toFixed(2)}`; sub = 'blended ROAS'; score = r.focus * GF.CONF_W[r.confidence] / EW[r.effort]; }
      else if (!r.focus) { imp = r.valuePerDay ? `${r.estimate ? '≈ ' : ''}+${m(r.valuePerDay, c)}` : '—'; sub = r.estimate ? 'saved per day, estimate' : 'saved per day'; score = (r.valuePerDay || 0) * GF.CONF_W[r.confidence] / EW[r.effort]; } // no leads in the window: show the saving
      else { imp = `−${m(-r.focus, c, 2)}`; sub = 'blended cost per lead'; score = -r.focus * GF.CONF_W[r.confidence] / EW[r.effort]; }
      return { r, imp, sub, score };
    }).sort((a, b) => b.score - a.score);
  }
  function pageFox(c, kind) {
    const { R, O, cur, prev, clamped } = periods(c); const e = isEcom(c);
    const mt = metricFor(c, kind); const f = FOX[kind];
    const acts = foxActions(c, kind);
    const v = mt.now ? mt.now() : mt.total(cur), pv = prev ? mt.total(prev) : null;
    const s1 = series(c, mt.of, R, O), sp = prev ? series(c, mt.of, R, O + R) : null;
    const sers = [{ name: mt.perDay + (R > 7 ? ' (7-day average)' : ''), short: 'This period', color: f.c, main: true, points: s1 }];
    if (sp) sers.push({ name: `Previous ${R} days`, short: 'Previous', color: 'var(--prev)', points: sp });
    let beneath = '', drivers = [], summary;
    if (kind === 'paid') {
      const platV = e ? cur.plat * c.cfg.aov / cur.spend : cur.spend / cur.plat;
      sers.push({ name: 'Platform-reported, for diagnosis', short: 'Platforms say', color: '#8FA9E3', points: series(c, sl => e ? sum(sl.map(x => x.plat)) * c.cfg.aov / sum(sl.map(x => x.spend)) : sum(sl.map(x => x.spend)) / sum(sl.map(x => x.plat)), R, O) });
      beneath = `<span class="eyebrow" style="display:flex;gap:6px;align-items:center">Platform-reported ${om('modeled')}</span><div class="beneath"><b>${mt.fmt(platV)}</b><span>${e ? 'Total revenue ÷ total ad spend.' : 'Total ad spend ÷ total leads.'} Platforms report ${e ? 'higher' : 'lower'} because each claims the same ${c.cfg.convNoun}.</span></div>`;
      const gads = c.cfg.campaigns.filter(x => x.platform === 'gads').reduce((s, x) => s + GF.campWindow(c.data, x.id, R, O).spend, 0);
      drivers = [['Ad spend', m(cur.spend, c), 'observed', dpill(cur.spend, prev && prev.spend, false, true)], [e ? 'Revenue' : 'Leads', e ? m(cur.revenue, c) : n0(cur.conv), 'observed', dpill(e ? cur.revenue : cur.conv, prev && (e ? prev.revenue : prev.conv))], ['Platforms over-claim', Math.round((cur.plat / cur.conv - 1) * 100) + '%', 'modeled', '<span class="delta">claims vs observed total</span>'], ['Google Ads / Meta', `${Math.round(gads / cur.spend * 100)} / ${100 - Math.round(gads / cur.spend * 100)}`, 'observed', '<span class="delta">share of spend</span>']];
      const total = acts.filter(a => a.r.confidence !== 'investigate').reduce((s, a) => s + a.r.focus, 0);
      const sw = c.model.recs.find(r => r.agent === 'spend-watch' && !recState(c, r));
      summary = `${mt.label} is ${mt.fmt(v)} over ${esc(rangeLabel(c).split(' vs ')[0].split(' · ')[0])}${pv ? `, ${(e ? v > pv : v < pv) ? 'better' : 'worse'} than the period before` : ''}. The platforms report ${mt.fmt(platV)} because they each claim the same ${c.cfg.convNoun}, so I don’t trust their numbers alone. ${sw ? `One campaign spent ${m(GF.campWindow(c.data, sw.id.slice(3), 7).spend, c)} in 7 days without a single ${c.cfg.convNounOne}. ` : ''}${total ? `Doing the actions below would ${e ? `add about +${total.toFixed(2)} to blended ROAS` : `cut blended cost per lead by about ${m(-total, c, 2)}`}.` : ''}${!c.model.warm ? ` Trend recommendations start after warmup, in ${c.model.warmLeft} days.` : ''}`;
    } else if (kind === 'analytics') {
      drivers = GF.dqByPlatform(c.cfg, c.data).map(p => [GF.PLATFORMS[p.platform], p.score + '', 'observed', `<span class="delta">${p.fails ? `<span style="color:var(--bad)">${p.fails} failing</span>` : p.warns ? `${p.warns} to improve` : '<span style="color:var(--good)">All checks pass</span>'}</span>`]);
      const worst = GF.dqByPlatform(c.cfg, c.data).sort((a, b) => a.score - b.score)[0];
      const fails = c.cfg.checks.filter(x => x.status === 'fail').length;
      const top = acts[0];
      summary = `Your data quality score is ${v} out of 100. ${fails ? `${fails} check${fails > 1 ? 's fail' : ' fails'}` : 'No checks fail'} and ${c.cfg.checks.filter(x => x.status === 'warn').length} need attention. ${GF.PLATFORMS[worst.platform]} is the weakest at ${worst.score}.${top ? ` Start with “${top.r.title}”: it lifts ${GF.PLATFORMS[top.r.platform]} by ${top.r.dq} points.` : ''}`;
    } else if (e) {
      const aov = cur.revenue / cur.conv, pAov = prev && prev.revenue / prev.conv;
      drivers = [['Orders', n0(cur.conv), 'observed', dpill(cur.conv, prev && prev.conv)], ['Average order value', m(aov, c), 'observed', dpill(aov, pAov)], ['Credited to ads', Math.round(cur.lc / cur.conv * 100) + '%', 'modeled', '<span class="delta">of orders, last click</span>'], ['Ad spend', m(cur.spend, c), 'observed', dpill(cur.spend, prev && prev.spend, false, true)]];
      const d = prev ? (cur.revenue - prev.revenue) / prev.revenue : null;
      const best = acts.find(a => a.r.confidence !== 'investigate');
      summary = `Revenue was ${m(cur.revenue, c)} over ${perTxt(c)}${d != null ? `, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d * 100).toFixed(1)}% on the period before` : ''}. Orders are steady, but average order value slipped in the last two weeks and I can’t yet tell why, so I’ve asked the team to look into it.${best ? ` My best lever right now: “${best.r.title}”.` : ''}`;
    } else {
      drivers = [['Form submits', n0(cur.conv - cur.meetings), 'observed', ''], ['Booked meetings', n0(cur.meetings), 'observed', `<span class="delta">${Math.round(cur.meetings / cur.conv * 100)}% of leads</span>`], ['Credited to ads', Math.round(cur.lc / cur.conv * 100) + '%', 'modeled', '<span class="delta">of leads, last click</span>'], ['Revenue', 'V2', null, '<span class="delta">Needs CRM data</span>']];
      summary = `You got ${n0(cur.conv)} leads in ${perTxt(c)}. I can’t show revenue yet: that needs CRM and closed-won data, which comes in V2. Booked meetings dropped as a share of leads, and the Calendly check is failing, so the likelier cause is tracking rather than fewer bookings.`;
    }
    const chart = lineChart(sers, { axis: mt.axis, fmt: mt.dayFmt, height: 300 });
    const actList = acts.length ? `<ol class="actlist">${acts.map((a, i) => `<li><span class="rank">${i + 1}</span><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(a.r.id)}">${esc(a.r.title)}</a><div class="s">${a.r.minutes ? `<span>~${a.r.minutes} min</span>` : ''}<span>${a.r.effort === 'low' ? 'Low effort' : a.r.effort === 'med' ? 'Medium effort' : 'High effort'}</span>${confBadge(a.r)}</div></div><div class="imp ${a.score <= 0 ? 'inv' : ''}">${esc(a.imp)}<small>${esc(a.sub)}</small></div></li>`).join('')}</ol>` : '<div class="empty">No open actions.</div>';
    return `<div class="page" style="${foxVars(kind)}">
      <section class="fox-hero" aria-label="Executive summary"><div class="id">${foxSvg(kind, true)}<div><h1>${f.name}</h1><div class="role">${esc(f.role)}</div></div></div>
        <div><span class="eyebrow">Executive summary · today</span><p class="sum">${esc(summary)}</p></div></section>
      ${statusStrip(c)}
      <section class="sec" aria-label="Focus metric">
        <div class="sec-head"><div class="lead"><span class="eyebrow">Focus metric</span><span>${esc(rangeLabel(c))}</span></div>${rangeSeg()}</div>
        <div class="focus"><div class="left"><span class="eyebrow" style="display:flex;gap:6px;align-items:center">${esc(mt.label)} ${om('observed')}</span><span class="big">${mt.fmt(v)}</span><span>${dpill(mt.total(cur), pv, mt.invert)}</span><span style="font-size:14px;color:var(--muted)">${pv != null ? `vs ${mt.fmt(pv)} in the previous ${R} days` : clamped ? `Only ${c.data.n} days of data so far` : ''}</span>${beneath ? `<div class="rule"></div>${beneath}` : ''}</div><div style="min-width:0">${chart}</div></div>
      </section>
      <div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">What’s driving it</span><div class="drivers">${drivers.map(([l, val, k, d]) => `<div class="kpi"><div class="label">${esc(l)} ${k ? om(k) : ''}</div><div class="value">${val}</div>${d}</div>`).join('')}</div></div>
      <section class="sec" aria-label="Prioritized actions"><div class="sec-head"><div class="lead"><span class="eyebrow">Prioritized actions</span><span>Ranked by expected impact on ${esc(mt.label.replace(/^\w+/, w => /[A-Z]{2}/.test(w) ? w : w.toLowerCase()))} × confidence ÷ effort.</span></div><a href="#recs" style="font-size:15px;font-weight:500">All actions</a></div>${actList}</section>
      ${footnote()}</div>`;
  }
