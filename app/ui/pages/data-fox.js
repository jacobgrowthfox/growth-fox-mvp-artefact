  /* ---------- Data Fox: data quality per endpoint (the PULSE model) ---------- */
  const ST_TXT = { good: 'Good', warn: 'Needs work', bad: 'Critical' };
  const ST_COL = { good: 'var(--good)', warn: 'var(--dot)', bad: 'var(--bad)' };
  const ST_CHIP = { good: 'good', warn: 'warn', bad: 'bad' };
  const CAT = { critical: { name: 'Critical', col: 'var(--bad)', soft: 'var(--bad-soft)', ink: 'var(--bad)', why: 'Without it the event fails: it can’t be attributed, deduplicated or counted.' },
    warning: { name: 'Warning', col: '#C2410C', soft: '#FDEBDD', ink: '#9A3412', why: 'The event still counts, but matching, value or attribution suffers.' },
    optional: { name: 'Optional', col: '#7C8380', soft: 'var(--seg)', ink: 'var(--ink-2)', why: 'Nice to have: extra matching keys and reporting detail.' } };
  const pct1 = v => (v * 100 >= 99.95 ? '100' : (v * 100).toFixed(1)) + '%';
  const compCol = v => v >= 0.95 ? 'var(--good)' : v >= 0.8 ? 'var(--warn-ink)' : 'var(--bad)';
  const prettyKey = k => k.replace('.', ' · ');
  function epRows(c, R) {
    const n = c.data.n, O = periods(c).O;
    return c.data.eps.map(e => ({ ep: e.ep, w: GF.epWindow(c.data, e.ep.id, Math.min(R, n), O), p: n >= O + 2 * R ? GF.epWindow(c.data, e.ep.id, R, O + R) : null }));
  }
  // The parameter that costs an endpoint the most score points (missing share × its category weight).
  function worstParams(ep, w) {
    return ep.params.map(p => {
      const nCat = ep.params.filter(x => x.cat === p.cat).length;
      return { p, comp: w.comp[p.key], cost: 100 * GF.CAT_W[p.cat] * (1 - w.comp[p.key]) / nCat };
    }).sort((a, b) => b.cost - a.cost);
  }
  function deltaPts(cur, prev) {
    if (prev == null) return '<span class="dpill flat">No earlier period yet</span>';
    const d = cur - prev;
    if (Math.abs(d) < 0.05) return '<span class="dpill flat">± 0 pts</span>';
    return `<span class="dpill ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)} pts</span>`;
  }
  // Overall score as a full ring around the number; the ring's colour follows the bands (red < 75, amber 75–89, green 90+).
  function dqGauge(v) {
    const R = 80, C = 2 * Math.PI * R, t = Math.max(0, Math.min(1, v / 100)), col = ST_COL[GF.epStatus(v)];
    const tick = f => { const a = -Math.PI / 2 + 2 * Math.PI * f, x1 = 100 + (R - 13) * Math.cos(a), y1 = 100 + (R - 13) * Math.sin(a), x2 = 100 + (R + 13) * Math.cos(a), y2 = 100 + (R + 13) * Math.sin(a); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#FFFFFF" stroke-width="3"/>`; };
    return `<div class="dqgauge"><svg viewBox="0 0 200 200" role="img" aria-label="Data quality ${Math.round(v)} out of 100">
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--seg)" stroke-width="18"/>
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="${col}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${(C * t).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 100 100)"/>
      <text x="100" y="108" text-anchor="middle" font-size="54" font-weight="600" letter-spacing="-2" fill="var(--fg)">${Math.round(v)}</text>
      <text x="100" y="134" text-anchor="middle" font-size="14" fill="var(--muted)">out of 100</text>
    </svg></div>`;
  }
  // Where the points come from: each category's share of its weight, averaged over endpoints.
  function dqBreakdown(rows) {
    return `<div class="dqbk">${GF.CATS.map(k => {
      const comp = rows.reduce((s, r) => s + r.w.cats[k], 0) / rows.length, max = GF.CAT_W[k] * 100, got = comp * max;
      return `<div class="dqbk-row"><span><i style="background:${CAT[k].col}"></i>${CAT[k].name}</span><span class="dqbk-bar"><i style="width:${(comp * 100).toFixed(1)}%;background:${CAT[k].col}"></i></span><b>${got.toFixed(1)}<small> / ${max}</small></b></div>`;
    }).join('')}</div>`;
  }
  function pageData(c) {
    const { R } = periods(c);
    const f = FOX.analytics;
    const rows = epRows(c, R);
    const overall = rows.reduce((s, r) => s + r.w.score, 0) / rows.length;
    const prevOverall = rows.every(r => r.p) ? rows.reduce((s, r) => s + r.p.score, 0) / rows.length : null;
    const worst = rows.slice().sort((a, b) => a.w.score - b.w.score)[0];
    const wp = worstParams(worst.ep, worst.w).filter(x => !(x.p.exp && x.comp >= x.p.exp - 0.005))[0] || worstParams(worst.ep, worst.w)[0]; // skip parameters at their expected level
    const acts = foxActions(c, 'analytics');
    const fails = c.cfg.checks.filter(x => x.status === 'fail' && x.group !== 'tags').length;
    const summary = `Your data quality score is ${Math.round(overall)} out of 100 across ${rows.length} endpoints. ${worst.ep.name} is the weakest at ${Math.round(worst.w.score)}: only ${pct1(wp.comp)} of its ${worst.ep.unit} carry ${prettyKey(wp.p.key)}, a ${wp.p.cat} parameter. ${fails ? `${fails} setup check${fails > 1 ? 's fail' : ' fails'}, so recommendations built on that data are held back.` : 'Every setup check passes.'}${acts[0] ? ` Start with “${acts[0].r.title}”.` : ''}`;

    const cards = rows.map(({ ep, w, p }) => {
      const st = GF.epStatus(w.score);
      return `<a class="epcard" href="#analytics/${ep.id}">
        <div class="eph"><div><b>${esc(ep.name)}</b></div><span class="chip ${ST_CHIP[st]}">${ST_TXT[st]}</span></div>
        <div class="eps"><strong style="color:${ST_COL[st]}">${Math.round(w.score)}</strong><span>/100</span>${deltaPts(w.score, p && p.score)}</div>
        <span class="meter"><i style="width:${w.score}%;background:${ST_COL[st]}"></i></span>
        <div class="epcats">${GF.CATS.map(k => `<span><i style="background:${CAT[k].col}"></i>${CAT[k].name} ${pct1(w.cats[k])}</span>`).join('')}</div>
        <div class="epm"><span>${n0(w.events)} ${esc(ep.unit)}</span><span>${n0(w.failed)} failed (${(w.failed / w.events * 100).toFixed(1)}%)</span></div>
        <span class="epgo">Deep-dive ${I.arrow}</span></a>`;
    }).join('');



    // 1. Data fixes: critical and warning parameters below 100% (or failing their value check), setup-check fixes,
    //    and optional improvements the user added. Ranked by the score points each wins back; top 10, then "Show more".
    const TOP = 10;
    // Sort: by points, or critical first (then warning, setup checks, optional), each group by points.
    const dataSort = state.dataSort || store.get('dataSort', 'points');
    const SEV = { critical: 0, warning: 1, optional: 3 }, sev = r => r.param ? SEV[r.cat] : 2;
    const dataAll = acts.slice().sort((x, y) => (dataSort === 'critical' ? sev(x.r) - sev(y.r) : 0) || (y.r.dq || 0) - (x.r.dq || 0));
    const dataActs = state.dataMore ? dataAll : dataAll.slice(0, TOP);
    const stat = r => r.param ? `<span>${pct1(r.present)} present${r.valid ? ` · ${pct1(1 - r.invalid)} valid` : ''}</span>` : '';
    const more = (n, on, act) => n > TOP ? `<button class="btn ghost morebtn" data-act="${act}" aria-expanded="${!!on}">${on ? 'Show fewer' : `Show ${n - TOP} more`}</button>` : '';
    const offTbl = dataActs.length ? `<ol class="actlist">${dataActs.map((a, i) => `<li><span class="rank">${i + 1}</span><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(a.r.id)}">${esc(a.r.title)}</a><div class="s">${a.r.param ? `<span class="catchip ${a.r.cat}">${CAT[a.r.cat].name}</span><span><code>${esc(a.r.param)}</code></span>` : `<span class="catchip setup">Setup check</span>`}<span>${esc(GF.PLATFORMS[a.r.platform] || '')}</span>${stat(a.r)}${a.r.optional ? `<span>Added by you · <button type="button" class="linkbtn" data-act="unpromote" data-id="${esc(a.r.id)}">Remove</button></span>` : ''}</div></div><div class="imp">${esc(a.imp)}<small>${esc(a.sub)}</small></div></li>`).join('')}</ol>${more(dataAll.length, state.dataMore, 'datamore')}` : '<div class="empty">Nothing to fix. Every critical and warning parameter is complete and valid.</div>';
    // 2. Optional improvements: listed here only. "Add to actions" moves one into Data fixes and All actions.
    const optAll = c.model.recs.filter(r => r.optional && !c.status[r.id]).sort((x, y) => y.dq - x.dq);
    const optional = state.optMore ? optAll : optAll.slice(0, TOP);
    const optList = optional.length ? `<ol class="actlist">${optional.map((r, i) => `<li><span class="rank">${i + 1}</span><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(r.id)}">${esc(r.title)}</a><div class="s"><span class="catchip optional">Optional</span><span><code>${esc(r.param)}</code></span><span>${esc(GF.PLATFORMS[r.platform] || '')}</span>${stat(r)}</div></div><div class="imp opt-imp"><span>+${ptsTxt(r.dq / rows.length)} pts<small>+${ptsTxt(r.dq)} on ${esc(GF.PLATFORMS[r.platform] || '')}</small></span>${ledgerMode === 'readonly' ? '' : `<button class="btn" data-act="promote" data-id="${esc(r.id)}">Add to actions</button>`}</div></li>`).join('')}</ol>${more(optAll.length, state.optMore, 'optmore')}` : '<div class="empty">Every optional parameter is complete.</div>';
    const userExp = Object.entries(c.status).filter(([id, v]) => v && v.status === 'expected' && id.startsWith('dq-'));
    const atExp = [];
    // 3. Expected levels: known in advance (sample) or marked by you. Below its baseline, a parameter becomes an action again.
    for (const { ep, w } of rows) for (const p of ep.params) if (p.exp && w.comp[p.key] >= p.exp - 0.005) atExp.push({ ep, p, comp: w.comp[p.key], base: p.exp, why: p.expWhy, sample: true });
    for (const [id, v] of userExp) { const r = rows.find(x => id.startsWith(`dq-${x.ep.id}-`)); if (!r) continue; const key = id.slice(`dq-${r.ep.id}-`.length), p = r.ep.params.find(x => x.key === key); if (p) atExp.push({ ep: r.ep, p, comp: r.w.comp[key], base: v.baseline, why: `Marked by you on ${new Date(v.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`, id }); }
    const expList = atExp.length ? `<div class="tbl-wrap"><table class="ltbl"><thead><tr><th>Parameter</th><th>Category</th><th class="r">Expected level</th><th class="r">Last 7 days</th><th>Why</th><th class="r"></th></tr></thead><tbody>${atExp.map(x => { const below = x.comp < x.base - 0.005; return `<tr><td><code>${esc(x.p.key)}</code><small class="pdesc">${esc(x.ep.name)}</small></td><td><span class="catchip ${x.p.cat}">${CAT[x.p.cat].name}</span></td><td class="r">${pct1(x.base)}</td><td class="r" style="color:${below ? 'var(--bad)' : 'var(--good)'};font-weight:600">${pct1(x.comp)}${below ? '<small>below: back in actions</small>' : ''}</td><td style="color:var(--ink-2)">${esc(x.why || '')}</td><td class="r">${x.id && ledgerMode !== 'readonly' ? `<button class="btn ghost" data-act="undo" data-id="${esc(x.id)}">Remove</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '';

    const actList = acts.length ? `<ol class="actlist">${acts.map((a, i) => `<li><span class="rank">${i + 1}</span><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(a.r.id)}">${esc(a.r.title)}</a><div class="s"><span>${esc(GF.PLATFORMS[a.r.platform] || '')}</span>${a.r.minutes ? `<span>~${a.r.minutes} min</span>` : ''}${confBadge(a.r)}</div></div><div class="imp ${a.score <= 0 ? 'inv' : ''}">${esc(a.imp)}<small>${esc(a.sub)}</small></div></li>`).join('')}</ol>` : '<div class="empty">No open actions.</div>';

    return `<div class="page" style="${foxVars('analytics')}">
      <section class="fox-hero" aria-label="Executive summary"><div class="id">${foxSvg('analytics', true)}<div><h1>${f.name}</h1><div class="role">${esc(f.role)}</div></div></div>
        <div><span class="eyebrow">Executive summary · today</span><p class="sum">${esc(summary)}</p></div></section>
      ${statusStrip(c)}
      ${(() => { const held = c.model.held.map(h => heldCard(c, h)).join(''); return held ? `<div style="display:grid;gap:10px">${held}</div>` : ''; })()}
      <section class="sec" aria-label="Data quality by endpoint">
        <div class="sec-head">${rangeSeg()}</div>
        <div class="dqhero">${dqGauge(overall)}
          <div class="dqhero-r">
            <div class="dqhero-top"><div><span class="eyebrow">Overall data quality</span><div class="dqhero-st" style="color:${ST_COL[GF.epStatus(overall)]}">${ST_TXT[GF.epStatus(overall)]}</div></div>${deltaPts(overall, prevOverall)}</div>
            ${dqBreakdown(rows)}
            <small class="dqhero-note">Average of ${rows.length} endpoint scores. Each parameter counts by its category: critical 60, warning 30, optional 10 points.</small>
          </div>
        ${(() => { // the overall score, day by day over the picked range (7-day average for longer ranges)
          const { R: Rr, O } = periods(c), of = sl => sum(sl.map(x => x.dq)) / sl.length;
          const cur = series(c, of, Rr, O), prev = c.data.n >= O + 2 * Rr ? series(c, of, Rr, O + Rr) : null;
          if (!cur || cur.length < 2) return '';
          const sers = [{ name: `Data quality score${Rr > 7 ? ' (7-day average)' : ''}`, short: 'Score', color: 'var(--ana)', main: true, points: cur }];
          if (prev) sers.push({ name: 'Period before', short: 'Before', color: 'var(--prev)', points: prev });
          return `<div class="dq-trend"><span class="eyebrow">Score over time</span>${lineChart(sers, { axis: v => (Math.round(v * 10) / 10) + '', fmt: v => v.toFixed(1), height: 210, minSpan: 6, width: 520 })}</div>`;
        })()}
        </div>
        <div class="epgrid">${cards}</div>
      </section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Data fixes</span><span>${dataAll.length} open, also in All actions, ${dataSort === 'critical' ? 'critical first, then by the score points each fix wins back' : 'ranked by the score points each fix wins back'}.</span></div><div class="filters"><div class="seg" role="group" aria-label="Sort data fixes"><button data-act="datasort" data-k="points" aria-pressed="${dataSort === 'points'}">Most points</button><button data-act="datasort" data-k="critical" aria-pressed="${dataSort === 'critical'}">Critical first</button></div></div></div>
        ${offTbl}</section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Optional improvements</span><span>Optional parameters below 100%. Nice to have for matching and reporting, so they stay here. Add one to actions if you want to work on it.</span></div></div>${optList}</section>
      ${expList ? `<section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">At expected level</span><span>Parameters that can never reach 100% for good reasons. Their level is the baseline: if one drops below it, it becomes an action again.</span></div></div>${expList}</section>` : ''}
      ${footnote()}</div>`;
  }
  // Setup checks and sources (formerly the Tracking health page). Tag and connection checks belong to the Engineer Fox.
  function dataChecks(c) {
    const groups = {};
    for (const ch of c.cfg.checks.filter(x => x.group !== 'tags')) (groups[ch.group] = groups[ch.group] || []).push(ch);
    const icon = s => `<span class="ico ${s}">${s === 'pass' ? I.check : s === 'warn' ? I.alert : I.x}</span>`;
    const checks = Object.entries(groups).map(([g, list]) => `<div class="check-group"><h4>${esc(GF.CHECK_GROUPS[g])}</h4>${list.map(ch => `<div class="check">${icon(ch.status)}<b style="font-weight:500">${esc(GF.PLATFORMS[ch.platform])}</b><div class="v">${esc(GF.fillDates(ch.value))} <span class="tgt">· target: ${esc(ch.target)}</span>${ch.explain ? `<small>${esc(ch.explain)}</small>` : ''}${ch.fix ? `<small><a href="#recs" data-goto="tr-${ch.group}-${ch.platform}">${esc(ch.fix.title)} →</a></small>` : ''}</div></div>`).join('')}</div>`).join('');
    return `<section class="sec" id="checks"><div class="sec-head"><div class="lead"><span class="eyebrow">Setup checks</span><span>Run daily on every source. Data that fails a check is flagged and explained, never silently dropped; recommendations built on it are held back. Each failing check links to its fix.</span></div></div>${checks}</section>`;
  }
