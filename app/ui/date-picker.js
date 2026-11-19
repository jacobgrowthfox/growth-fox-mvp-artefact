  /* ---------- Overview: what you changed, and what happened since (actions pinned to the line) ---------- */
  /* ---------- Date range picker for "What you changed" ----------
     Presets or two clicks on the calendar: the first click is the start date, the second the end date,
     unless the second is earlier, which then becomes the start. Nothing changes until Update. */
  const DP_PRESETS = [['7', 'Last 7 days', 7], ['14', 'Last 14 days', 14], ['30', 'Last 30 days', 30], ['90', 'Last 3 months', 90], ['180', 'Last 6 months', 182], ['365', 'Last 12 months', 365], ['ytd', 'Year to date', 0]];
  const dayIdx = (c, t) => Math.round((t - c.hist.days[0].t) / GF.DAY);
  function presetRange(c, key) {
    const n = c.hist.n, p = DP_PRESETS.find(x => x[0] === key) || DP_PRESETS[2];
    if (p[0] === 'ytd') { const end = c.hist.days[n - 1].date; return { preset: 'ytd', from: Math.max(0, dayIdx(c, new Date(end.getFullYear(), 0, 1).getTime())), to: n - 1 }; }
    return { preset: p[0], from: Math.max(0, n - Math.min(n, p[2])), to: n - 1 };
  }
  function chgRange(c) {
    state.chgRange = state.chgRange || {};
    let r = state.chgRange[c.cfg.id];
    if (!r || r.to > c.hist.n - 1) r = state.chgRange[c.cfg.id] = defaultRange(c) || presetRange(c, '30');
    return r;
  }
  // A client's own starting period (cfg.defaultRange, ISO dates), used when it lies inside the history.
  function defaultRange(c) {
    const dr = c.cfg.defaultRange; if (!dr || !c.hist.n) return null;
    const ix = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? dayIdx(c, new Date(s + 'T00:00:00').getTime()) : NaN;
    const from = ix(dr.from), to = ix(dr.to);
    if (!(from >= 0 && to >= from && to <= c.hist.n - 1)) return null;
    return { preset: 'custom', from, to, cmp: 'prev' };
  }
  const fmtD = (c, i, y) => c.hist.days[i].date.toLocaleDateString('en-GB', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  function rangeText(c, r) { const D = c.hist.days, y = D[r.from].date.getFullYear() !== D[r.to].date.getFullYear(); return r.from === r.to ? fmtD(c, r.from, true) : `${fmtD(c, r.from, y)} – ${fmtD(c, r.to, true)}`; }
  function dpLabel(c, r) { const p = DP_PRESETS.find(x => x[0] === r.preset); return p ? p[1] : 'Custom'; }
  function dpMonth(c, y, mo, dr) {
    const first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, len = new Date(y, mo + 1, 0).getDate();
    const cells = [];
    for (let k = 0; k < lead; k++) cells.push('<span></span>');
    for (let d = 1; d <= len; d++) {
      const t = new Date(y, mo, d).getTime(), i = dayIdx(c, t), ok = i >= 0 && i < c.hist.n;
      const a = dr.a, b = dr.b == null ? dr.a : dr.b;
      const cls = [ok ? '' : 'off', a != null && i === a ? 'sa' : '', a != null && i === b ? 'sb' : '', a != null && i > a && i < b ? 'in' : ''].join(' ').trim();
      cells.push(ok ? `<button type="button" class="${cls}" data-dp="day" data-i="${i}" aria-pressed="${a != null && i >= a && i <= b}" aria-label="${new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}">${d}</button>` : `<span class="off">${d}</span>`);
    }
    return `<div class="dp-m"><div class="dp-mh">${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div><div class="dp-g">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => `<i>${w}</i>`).join('')}${cells.join('')}</div></div>`;
  }
  function datePicker(c) {
    const r = chgRange(c), dp = state.dp || {};
    const btn = `<button type="button" class="dp-btn" data-dp="toggle" aria-expanded="${!!dp.open}" aria-haspopup="dialog"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg><span><b>${esc(dpLabel(c, r))}</b> · ${esc(rangeText(c, r))}${cmpOf(r) === 'prev' ? '' : `<small class="dp-vs"> · ${cmpOf(r) === 'yoy' ? 'vs last year' : 'no comparison'}</small>`}</span><svg class="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4.5l3 3 3-3"/></svg></button>`;
    if (!dp.open) return `<div class="dp">${btn}</div>`;
    const days = c.hist.days, last = days[c.hist.n - 1].date, firstD = days[0].date;
    const vm = dp.month || { y: last.getFullYear(), m: last.getMonth() };
    const prev = new Date(vm.y, vm.m - 1, 1);
    const canPrev = prev > new Date(firstD.getFullYear(), firstD.getMonth(), 1), canNext = new Date(vm.y, vm.m + 1, 1) <= last;
    const sel = dp.a == null ? 'Click a start date' : dp.b == null ? `${fmtD(c, dp.a, true)} – pick an end date` : (dp.a === dp.b ? fmtD(c, dp.a, true) : `${fmtD(c, dp.a)} – ${fmtD(c, dp.b, true)}`);
    const ready = dp.a != null && dp.b != null;
    return `<div class="dp">${btn}
      <div class="dp-pop" role="dialog" aria-label="Choose a date range">
        <div class="dp-pre">${DP_PRESETS.map(([k, l]) => `<button type="button" data-dp="preset" data-k="${k}" aria-pressed="${dp.preset === k}">${l}</button>`).join('')}<span class="dp-note">Data from ${fmtD(c, 0, true)}</span></div>
        <div class="dp-cal">
          <div class="dp-nav"><button type="button" class="btn icon" data-dp="prev" aria-label="Previous month" ${canPrev ? '' : 'disabled'}>‹</button><button type="button" class="btn icon" data-dp="next" aria-label="Next month" ${canNext ? '' : 'disabled'}>›</button></div>
          <div class="dp-ms">${dpMonth(c, prev.getFullYear(), prev.getMonth(), dp)}${dpMonth(c, vm.y, vm.m, dp)}</div>
          <div class="dp-cmp"><span>Compare to</span><div class="seg" role="group" aria-label="Compare to">${['prev', 'yoy', 'none'].map(k => `<button type="button" data-dp="cmp" data-k="${k}" aria-pressed="${(dp.cmp || 'prev') === k}">${CMP_TXT[k]}</button>`).join('')}</div></div>
          <div class="dp-foot"><span class="dp-sel">${esc(sel)}</span><button type="button" class="btn ghost" data-dp="cancel">Cancel</button><button type="button" class="btn primary" data-dp="apply" ${ready ? '' : 'disabled'}>Update</button></div>
        </div>
      </div></div>`;
  }
  document.addEventListener('click', ev => {
    const t = ev.target.closest && ev.target.closest('[data-dp]');
    const dp = state.dp || (state.dp = { open: false });
    if (!t) { if (dp.open && !ev.target.closest('.dp-pop')) { dp.open = false; render(); } return; }
    ev.preventDefault();
    const c = ctx(), act = t.dataset.dp;
    if (act === 'toggle') {
      if (dp.open) dp.open = false;
      else { const r = chgRange(c), end = c.hist.days[r.to].date; state.dp = { open: true, a: r.from, b: r.to, preset: r.preset, cmp: cmpOf(r), month: { y: end.getFullYear(), m: end.getMonth() } }; }
    } else if (act === 'preset') { const r = presetRange(c, t.dataset.k); Object.assign(dp, { a: r.from, b: r.to, preset: r.preset }); if (r.preset === 'ytd' && !dp.cmpSet) dp.cmp = 'yoy'; const end = c.hist.days[r.to].date; dp.month = { y: end.getFullYear(), m: end.getMonth() }; }
    else if (act === 'day') {
      const i = +t.dataset.i; dp.preset = null;
      if (dp.a == null || dp.b != null) { dp.a = i; dp.b = null; }   // first click: the start date
      else if (i >= dp.a) dp.b = i;                                    // second click: the end date
      else { dp.b = dp.a; dp.a = i; }                                  // earlier than the start: it becomes the start
    }
    else if (act === 'prev' || act === 'next') { const v = dp.month, d = new Date(v.y, v.m + (act === 'next' ? 1 : -1), 1); dp.month = { y: d.getFullYear(), m: d.getMonth() }; }
    else if (act === 'cancel') dp.open = false;
    else if (act === 'cmp') { dp.cmp = t.dataset.k; dp.cmpSet = true; }
    else if (act === 'apply' && dp.a != null && dp.b != null) { state.chgRange[c.cfg.id] = { preset: dp.preset || 'custom', from: dp.a, to: dp.b, cmp: dp.cmp || 'prev' }; dp.open = false; state.resSel = null; }
    render();
    if (state.dp.open) document.querySelector('.dp-pop button[data-dp="apply"]')?.closest('.dp-pop')?.querySelector(act === 'day' ? `button[data-i="${t.dataset.i}"]` : '[data-dp="apply"]')?.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && state.dp && state.dp.open) { state.dp.open = false; render(); } });
