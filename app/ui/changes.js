  function rangeMarks(c) { const R0 = chgRange(c), N = c.hist.n; return changeMarks(c).filter(r => { const i = N - 1 - r.d; return i >= R0.from && i <= R0.to; }); }
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  // Changes you logged that fall in the picked range, oldest first, lettered A, B, C…
  function rangeYours(c) {
    const R0 = chgRange(c), N = c.hist.n;
    return changeRows(c).map(r => Object.assign({}, r, { d: Math.max(0, Math.round((GF.END - dayStart(r.at)) / GF.DAY)) }))
      .filter(r => { const i = N - 1 - r.d; return i >= R0.from && i <= R0.to; })
      .sort((a, b) => a.at - b.at).map((r, k) => Object.assign(r, { letter: String.fromCharCode(65 + (k % 26)) }));
  }
  function changeMarks(c) {
    return ledgerRows(c)
      .filter(r => ['verified', 'not_verified', 'adopted', 'requested'].includes(r.status) && !(r.agent === 'connect' && r.status !== 'verified') && r.agent !== 'volume' && r.agent !== 'gap' && FOX[r.fox])
      .map(r => Object.assign({}, r, { d: Math.max(0, Math.round((GF.END - dayStart(r.at)) / GF.DAY)) })) // calendar days, not hours: an evening change belongs to its own date
      .filter(r => r.d < c.hist.n)
      .sort((a, b) => a.at - b.at);
  }
  function changeVerdict(r) {
    if (r.status === 'adopted' || r.status === 'requested') return { cls: 'info', text: 'Verifying' };
    if (r.status === 'not_verified') return { cls: 'warn', text: 'Not verified' };
    if (r.status === 'closed') return { cls: 'neutral', text: 'Closed as expected' };
    if (r.status === 'expected') return { cls: 'neutral', text: 'Expected level' };
    if (r.bet) return r.successCheck === 'failed' ? { cls: 'warn', text: 'Verified · check not met' } : { cls: 'good', text: 'Verified · check passed' };
    if (r.unit === 'none' || !r.expectedPerDay) return { cls: 'good', text: 'Verified' };
    return r.measuredPerDay >= 0.85 * r.expectedPerDay ? { cls: 'good', text: 'Verified · as expected' } : { cls: 'warn', text: 'Verified · below estimate' };
  }
  function changeChart(c, marks, sel, yours = []) {
    const e = isEcom(c), days = c.hist.days, N = c.hist.n, R0 = chgRange(c), eff = false; // the chart always shows revenue (B2B: leads)
    const fn = eff ? (e ? sl => sum(sl.map(x => x.revenue)) / sum(sl.map(x => x.spend)) : sl => sum(sl.map(x => x.spend)) / sum(sl.map(x => x.conv)))
      : (e ? sl => sum(sl.map(x => x.revenue)) / sl.length : sl => sum(sl.map(x => x.conv)) / sl.length);
    const fmt = eff ? (e ? v => v.toFixed(2) : v => m(v, c, 2)) : (e ? v => m(v, c) : v => v.toFixed(1));
    const axis = eff ? (e ? v => v.toFixed(1) : v => m(v, c)) : (e ? v => Math.round(v / 1000) + 'k' : v => Math.round(v) + '');
    const pts = days.map((d, i) => ({ d: d.date, v: fn(days.slice(Math.max(0, i - 6), i + 1)) })).slice(R0.from, R0.to + 1), n = pts.length;
    const base = sum(pts.slice(0, Math.min(14, n)).map(p => p.v)) / Math.min(14, n);
    const W = 1000, H = 270, L = 60, Rp = 16, T = 22, B = 34;
    const all = pts.map(p => p.v).concat([base]);
    let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.25 || hi * 0.1 || 1; lo -= pad; hi += pad;
    const ticks = niceTicks(lo, hi, 5); lo = ticks[0]; hi = ticks[ticks.length - 1];
    const x = i => L + (n === 1 ? 0 : i / (n - 1)) * (W - L - Rp);
    const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const every = Math.max(1, Math.ceil(n / 8));
    const xl = pts.map((p, i) => (i % every === 0 && n - 1 - i > every * 0.6) || i === n - 1 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="${i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}" font-size="13" fill="var(--faint)">${p.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>` : '').join('');
    const grid = ticks.map(t => `<line x1="${L}" x2="${W - Rp}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)"/><text x="${L - 10}" y="${y(t) + 4}" text-anchor="end" font-size="13" fill="var(--faint)">${esc(axis(t))}</text>`).join('');
    const mk = marks.map(r => { const i = Math.max(0, Math.min(n - 1, N - 1 - r.d - R0.from)); return { r, i, cx: x(i), cy: y(pts[i].v), ly: y(pts[i].v) }; });
    // Several changes on the same day stack vertically (upwards, or downwards near the top) so every dot stays visible.
    // Your changes sit on the baseline (several on one day stack upwards), so they never cover the foxes' dots on the line.
    const yDay = {};
    const yk = yours.map(r => { const i = Math.max(0, Math.min(n - 1, N - 1 - r.d - R0.from)); const k = yDay[i] = (yDay[i] || 0) + 1; const ty = H - B - 16 - (k - 1) * 26; return { r, i, you: true, cx: x(i), ty, cy: ty, ly: y(pts[i].v) }; });
    const byDay = {}; for (const q of mk) (byDay[q.i] = byDay[q.i] || []).push(q);
    for (const g of Object.values(byDay)) if (g.length > 1) { const up = g[0].ly - (g.length - 1) * 26 >= T + 12; g.forEach((q, j) => { q.cy = q.ly + (up ? -1 : 1) * j * 26; }); }
    const stacks = Object.values(byDay).filter(g => g.length > 1).map(g => { const ys = g.map(q => q.cy); return `<line x1="${g[0].cx}" x2="${g[0].cx}" y1="${Math.min(...ys)}" y2="${Math.max(...ys)}" stroke="var(--border-strong)" stroke-width="2"/>`; }).join('');
    const selM = mk.find(q => q.r.id === sel);
    const stem = selM ? `<line x1="${selM.cx}" x2="${selM.cx}" y1="${selM.cy}" y2="${H - B}" stroke="${FOX[selM.r.fox].c}" stroke-dasharray="3 3" stroke-width="1.25"/>` : '';
    const dots = mk.map((q, k) => { // numbered in date order, matching the list below the chart
      const s = q.r.id === sel, col = FOX[q.r.fox].c, hollow = q.r.status !== 'verified', R = s ? 13 : 11;
      return `<g class="mark" data-k="${esc(q.r.id)}" style="cursor:pointer">${s ? `<circle cx="${q.cx}" cy="${q.cy}" r="19" fill="${col}" fill-opacity=".16"/>` : ''}<circle cx="${q.cx}" cy="${q.cy}" r="${R}" fill="${hollow ? '#FFFFFF' : col}" stroke="${hollow ? col : '#FFFFFF'}" stroke-width="2.5"/><text x="${q.cx}" y="${q.cy + 4.5}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${hollow ? col : '#FFFFFF'}" pointer-events="none">${k + 1}</text><circle cx="${q.cx}" cy="${q.cy}" r="18" fill="transparent"/></g>`;
    }).join('') + yk.map(q => { // changes you logged: lettered tags on the baseline, like calendar notes, with a faint guide up to the line
      const ty = q.ty;
      return `<g class="ymark"><line x1="${q.cx}" x2="${q.cx}" y1="${ty - 11}" y2="${q.ly + 4}" stroke="var(--ink-2)" stroke-width="1.25" stroke-dasharray="2 4" opacity=".55"/><rect x="${q.cx - 12}" y="${ty - 11}" width="24" height="22" rx="7" fill="var(--surface)" stroke="var(--ink-2)" stroke-width="1.5"/><text x="${q.cx}" y="${ty + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fg)" pointer-events="none">${esc(q.r.letter)}</text></g>`;
    }).join('');
    const id = 'chg' + (++chartSeq);
    const dl = r => new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    setTimeout(() => {
      const root = document.getElementById(id); if (!root) return;
      const svg = root.querySelector('svg'), tip = root.querySelector('.tip'), cross = root.querySelector('.cross');
      svg.addEventListener('pointermove', ev => {
        const rc = svg.getBoundingClientRect(), sx = (ev.clientX - rc.left) / rc.width * W, sy = (ev.clientY - rc.top) / rc.height * H;
        const near = mk.concat(yk).map(q => ({ q, dd: Math.hypot(q.cx - sx, q.cy - sy) })).sort((a, b) => a.dd - b.dd)[0];
        tip.hidden = false; let px;
        if (near && near.dd < 22 && near.q.you) {
          const r = near.q.r; px = near.q.cx; cross.style.display = 'none';
          tip.innerHTML = `<span class="d">Logged by you · ${dl(r)}</span><b style="font-weight:600;line-height:1.35">${esc(r.title)}</b><span class="d">${esc(CH_CAT[r.cat] || 'Change')}${r.ch ? ' · ' + esc(r.ch) : ''} · context, not a fox action</span>`;
          tip.style.top = (near.q.cy / H * rc.height + 18) + 'px';
        } else if (near && near.dd < 22) {
          const r = near.q.r; px = near.q.cx; cross.style.display = 'none';
          tip.innerHTML = `<span class="d">${esc(FOX[r.fox].name)} · ${dl(r)}</span><b style="font-weight:600;line-height:1.35">${esc(r.title)}</b><span class="d">${esc(changeVerdict(r).text)} · click for details</span>`;
          tip.style.top = (near.q.cy / H * rc.height + 18) + 'px';
        } else {
          const i = Math.max(0, Math.min(n - 1, Math.round((sx - L) / (W - L - Rp) * (n - 1)))); px = x(i);
          cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.display = '';
          tip.innerHTML = `<span class="d">${pts[i].d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span><div class="r"><span>${eff ? (e ? 'Blended ROAS' : 'Blended CPL') : (e ? 'Revenue/day' : 'Leads/day')}</span><b>${esc(fmt(pts[i].v))}</b></div><div class="r sec2"><span>Start of period</span><b>${esc(fmt(base))}</b></div>`;
          tip.style.top = '18px';
        }
        tip.style.left = Math.max(130, Math.min(rc.width - 130, px / W * rc.width)) + 'px';
      });
      svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.style.display = 'none'; });
      svg.querySelectorAll('.mark').forEach(g => g.addEventListener('click', () => { state.resSel = g.dataset.k; state.doneView = 'one'; render(); }));
    });
    const lbl = eff ? (e ? 'Blended ROAS' : 'Blended cost per lead') : (e ? 'Revenue per day' : 'Leads per day');
    return `<div class="chg-title">${e ? 'Revenue' : 'Leads'}</div>
      <div class="chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lbl)} from ${esc(rangeText(c, R0))}, with ${mk.length} actions and ${yk.length} of your own changes marked">
      ${grid}<line x1="${L}" x2="${W - Rp}" y1="${H - B}" y2="${H - B}" stroke="var(--base)"/>${xl}
      <line x1="${L}" x2="${W - Rp}" y1="${y(base)}" y2="${y(base)}" stroke="var(--prev)" stroke-width="2" stroke-dasharray="6 5"/>
      <path d="${path}L${x(n - 1)},${H - B}L${x(0)},${H - B}Z" fill="var(--primary)" fill-opacity="0.06"/>
      <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
      ${stem}<line class="cross" y1="${T}" y2="${H - B}" stroke="#B5B3AC" style="display:none"/>${stacks}${dots}
      </svg><div class="tip" hidden style="width:250px"></div></div>`;
  }
  function changeRange(c, r) {
    if (r.bet) return '';
    if (r.status !== 'verified' || r.unit === 'none' || !r.expectedPerDay || r.measuredPerDay == null) return '';
    const ex = r.expectedPerDay, me = r.measuredPerDay;
    const a = Math.min(0.85 * ex, me) * 0.7, b = Math.max(1.15 * ex, me) * 1.1, pc = v => ((v - a) / (b - a) * 100).toFixed(1) + '%';
    const col = me >= 0.85 * ex ? 'var(--good)' : 'var(--warn)';
    return `<div class="rviz"><div class="rtrack"><span class="rband" style="left:${pc(0.85 * ex)};width:calc(${pc(1.15 * ex)} - ${pc(0.85 * ex)})"></span><span class="rtick" style="left:${pc(ex)}"></span><span class="rdot" style="left:${pc(me)};background:${col}"></span></div>
      <div class="rlabels"><span>Expected: ${esc(impactText(c, r.unit, ex))}</span><span style="color:${col};font-weight:600">Measured: ${esc(impactText(c, r.unit, me))} ${om(r.unit === 'revenue' ? 'modeled' : 'observed')}</span></div></div>`;
  }
  function changedSection(c, opts = {}) {
    const e = isEcom(c), R0 = chgRange(c), N = c.hist.n;
    const marks = rangeMarks(c), yours = rangeYours(c);
    const foxes = ['all', ...['paid', 'analytics', 'engineer', 'commercial'].filter(k => marks.some(r => r.fox === k))];
    if (state.resFox && !foxes.includes(state.resFox)) state.resFox = 'all';
    const rf = 'all'; state.resFox = 'all'; // always all foxes
    const vis = marks.filter(r => rf === 'all' || r.fox === rf);
    if (!vis.some(r => r.id === state.resSel)) state.resSel = (vis.filter(r => r.status === 'verified').slice(-1)[0] || vis.slice(-1)[0] || {}).id || null;
    const sel = vis.find(r => r.id === state.resSel);
    const ver = marks.filter(r => r.status === 'verified');
    const saved = sum(ver.filter(r => r.unit === 'saved').map(r => (r.measuredPerDay || 0) * Math.max(0, R0.to - (N - 1 - r.d))));
    const scored = ver.filter(r => r.unit !== 'none' && r.expectedPerDay);
    const onTarget = scored.filter(r => r.measuredPerDay >= 0.85 * r.expectedPerDay).length;
    const chips = foxes.map(k => `<button class="fbtn" data-act="resfox" data-k="${k}" aria-pressed="${rf === k}">${k === 'all' ? 'All foxes' : esc(FOX[k].name)}<span class="n">${marks.filter(r => k === 'all' || r.fox === k).length}</span></button>`).join('');
    const idx = sel ? vis.indexOf(sel) : -1;
    const v = sel ? changeVerdict(sel) : null;
    const detail = sel ? `<div class="resdetail" style="${foxVars(sel.fox)}">${foxSvg(sel.fox, true)}
        <div style="min-width:0;flex:1">
          <div class="tags"><span class="foxchip">${esc(FOX[sel.fox].name)}</span><span style="font-size:14px;color:var(--muted)">${new Date(sel.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}${GF.PLATFORMS[sel.platform] ? ' · ' + esc(GF.PLATFORMS[sel.platform]) : ''}</span><span class="chip ${v.cls}">${esc(v.text)}</span></div>
          <h3 style="font-size:19px;margin-top:8px">${esc(sel.title)}</h3>
          ${changeRange(c, sel) || `<p style="margin:10px 0 0;color:var(--ink-2)">${sel.bet ? `Estimate: ${esc(betRange(c, sel))}/day. Judged on its success check: ${esc(sel.success || '')} ` : sel.unit !== 'none' && sel.expectedPerDay ? `Expected: ${esc(impactText(c, sel.unit, sel.expectedPerDay))}. ` : ''}${sel.status === 'not_verified' ? '' : sel.status === 'verified' ? '' : 'We’ll find the change in the platform’s change history, then measure it against its success metric.'}</p>`}
          ${sel.note ? `<p class="sub" style="margin-top:8px">${esc(sel.note)}</p>` : ''}
          <a class="done-go" style="margin-top:10px" href="#action/${encodeURIComponent(sel.id)}">See full details ${I.arrow}</a>
        </div>
        <div class="actions" style="align-self:flex-start"><button class="btn icon" data-act="resnav" data-k="-1" aria-label="Previous action" ${idx <= 0 ? 'disabled' : ''}>‹</button><button class="btn icon" data-act="resnav" data-k="1" aria-label="Next action" ${idx >= vis.length - 1 ? 'disabled' : ''}>›</button></div>
      </div>` : '';
    // Two views under the chart: every change in the period (the holistic view), or the one picked on the line.
    const view = state.doneView === 'one' && sel ? 'one' : 'all';
    const youItem = r => `<li><span class="dn you"><span>${esc(r.letter)}</span></span>
        <div style="min-width:0"><b style="font-weight:500">${esc(r.title)}</b><div class="s"><span class="youchip">Logged by you</span><span>${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span>${esc(CH_CAT[r.cat] || 'Change')}${r.ch ? ' · ' + esc(r.ch) : ''}</span></div></div>
        <div class="res"><span style="color:var(--faint)">—</span><small>context</small></div></li>`;
    const merged = vis.map((r, k) => ({ at: r.at, r, num: k + 1 })).concat(yours.map(r => ({ at: r.at, r, you: true }))).sort((a, b) => b.at - a.at);
    const allList = merged.length ? `<ol class="donelist">${merged.map(({ r, num, you }) => {
      if (you) return youItem(r);
      const f = FOX[r.fox], vd = changeVerdict(r);
      const res = r.bet ? (r.status === 'verified' ? `<span class="meas ${r.successCheck === 'failed' ? '' : 'good'}">${checkText(r)}</span><small>success check</small>` : `<span class="meas" style="color:var(--ink-2)">${esc(betRange(c, r))}/day</span><small>estimate</small>`) : r.status === 'verified' && r.unit !== 'none' && r.measuredPerDay != null ? `<span class="meas good">${esc(impactText(c, r.unit, r.measuredPerDay))}</span><small>measured</small>` : r.unit !== 'none' && r.expectedPerDay ? `<span class="meas" style="color:var(--ink-2)">${esc(impactText(c, r.unit, r.expectedPerDay))}</span><small>expected</small>` : '<span style="color:var(--faint)">—</span>';
      const hollow = r.status !== 'verified';
      return `<li style="${foxVars(r.fox)}"><span class="dn" style="${hollow ? `background:#FFFFFF;color:${f.c};box-shadow:inset 0 0 0 2px ${f.c}` : `background:${f.c}`}">${num}</span>
        <div style="min-width:0"><button type="button" class="done-t" data-act="donepick" data-k="${esc(r.id)}">${esc(r.title)}</button><div class="s"><span class="foxchip">${esc(f.name)}</span><span>${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${r.done ? ', ' + new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span><span class="chip ${vd.cls}">${esc(vd.text)}</span>${r.done ? checkChip(r) : ''}</div>${r.done && r.comment ? `<p class="done-cm2">${esc(r.comment)}</p>` : ''}</div>
        <div class="res">${res}<a class="done-go" href="#action/${encodeURIComponent(r.id)}">Details ${I.arrow}</a></div></li>`;
    }).join('')}</ol>` : '<div class="empty">No changes in this period yet.</div>';
    const effOf = sl => sum(sl.map(x => e ? x.revenue : x.conv)) / sl.length;
    const dd = c.hist.days.slice(R0.from, R0.to + 1), startV = effOf(dd.slice(0, Math.min(14, dd.length))), nowV = effOf(dd.slice(-14));
    const worse = nowV < startV * 0.98;
    const downNote = worse && dd.length >= 28 ? `<div class="held" style="margin-top:16px">${I.alert}<div><h4>${e ? 'Revenue' : 'Leads'} per day ${e ? 'is' : 'are'} below the start of the period</h4><p>The last 14 days of the period average ${e ? m(nowV, c) : nowV.toFixed(1)} a day, against ${e ? m(startV, c) : startV.toFixed(1)} at its start. That can come from season, pricing or promotions as much as from ads.${saved ? ` Your verified changes still saved ${m(saved, c)} in wasted spend.` : ''}</p></div></div>` : '';
    return `<section class="sec" aria-label="What you changed, and what happened since">
        <div class="sec-head"><div class="lead"><span class="eyebrow">${opts.title || 'What you changed, and what happened since'}</span>${opts.sub ? `<span>${opts.sub}</span>` : ''}</div></div>
        ${changeChart(c, vis, view === 'one' ? state.resSel : null, yours)}
        <div class="done-tg"><div class="seg" role="group" aria-label="Show"><button data-act="doneview" data-k="all" aria-pressed="${view === 'all'}">All changes (${vis.length + yours.length})</button><button data-act="doneview" data-k="one" aria-pressed="${view === 'one'}" ${sel ? '' : 'disabled'}>Selected change</button></div>${ledgerMode === 'readonly' ? '' : `<button class="btn" data-act="logopen" aria-expanded="${!!state.logOpen}">${state.logOpen ? 'Close' : '+ Log a change of your own'}</button>`}</div>
        ${state.logOpen ? changeForm() : ''}
        ${view === 'one' ? detail : allList}
        <p class="sub" style="margin-top:14px">Numbered circles are your foxes’ actions; lettered tags along the bottom are changes you logged, such as a promotion, a launch or a price change. Together they give the full picture of what changed next to your ${e ? 'revenue' : 'leads'}, so you can judge what moved it. It shows what happened together, not what caused what; each action’s own result is what we verify.</p>
      </section>`;
  }
