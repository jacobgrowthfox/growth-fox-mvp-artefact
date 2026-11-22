  /* ---------- Shared pieces ---------- */
  function statusStrip(c) {
    const src = c.cfg.sources;
    const qNames = new Set(c.cfg.quarantine.filter(q => !c.qdec[q.id]).map(q => q.source));
    const status = s => s.status === 'quarantined' && !qNames.has(s.name) ? 'healthy' : s.status;
    const healthy = src.filter(s => status(s) === 'healthy').length;
    const degraded = src.filter(s => status(s) === 'degraded').length;
    const quarantined = src.filter(s => status(s) === 'quarantined').length;
    return `<div class="strip">
      <span class="chip good">${I.check}${healthy} of ${src.length} sources healthy</span>
      ${degraded ? `<a class="chip warn" href="#analytics">${I.alert}${degraded} degraded</a>` : ''}
      ${quarantined ? `<a class="chip bad" href="#analytics">${I.shield}${quarantined} quarantined</a>` : ''}
      ${c.model.warm ? '' : `<span class="chip info">${I.clock}Warmup: ${c.model.warmLeft} days left</span>`}
    </div>`;
  }
  const asOf = () => 'Data through ' + new Date(GF.END).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  function confBadge(r) {
    const lv = { certain: 3, strong: 3, moderate: 2, investigate: 1 }[r.confidence];
    const label = CONF_LABEL[r.confidence];
    return `<span class="conf ${r.confidence}" title="${esc(CONF_WHY[r.confidence])}"><span class="dots">${[1, 2, 3].map(k => `<i class="${k <= lv ? 'on' : ''}"></i>`).join('')}</span>${label}</span>`;
  }
  // The Paid Media rubric check an opportunity comes from: its name, with the check id on hover. Muted when the app's rule has no rubric equivalent.
  // One hue per rubric check, distinct within each optimization area (colours repeat across areas).
  const CHECK_HUE = {
    'pm.2.spend.spend_no_conversions': 'rose', 'pm.2.spend.cpa_rising': 'orange', 'pm.2.spend.roas_falling': 'amber', 'pm.2.spend.conversions_falling': 'violet',
    'pm.2.spend.budget_shift': 'blue', 'pm.2.spend.invalid_clicks_spike': 'teal', 'pm.2.spend.recent_major_edit': 'slate',
    'pm.2.audiences.prospecting_hits_existing': 'blue', 'pm.2.audiences.frequency_high': 'amber', 'pm.2.audiences.segment_cpa_outlier': 'violet', 'pm.2.audiences.placement_waste': 'rose',
    'pm.2.creative_lp.landing_page_cvr_low': 'teal', 'pm.2.creative_lp.creative_fatigue': 'rose', 'pm.2.creative_lp.ad_strength_poor': 'amber', 'pm.2.creative_lp.mobile_lcp_slow': 'blue',
    'pm.1.setup.bidding_conversion': 'violet', 'pm.1.setup.search_budget_limited': 'orange', 'pm.1.setup.location_presence_interest': 'teal', 'pm.1.setup.no_shared_negative_list': 'green',
    'pm.1.setup.brand_absolute_top_low': 'blue', 'pm.1.setup.target_far_from_actual': 'slate',
    'pm.1.setup.broad_without_smart_bidding': 'amber', 'pm.1.setup.keyword_conflicts': 'rose', 'pm.1.setup.not_serving': 'brown', 'pm.2.creative_lp.creative_disapproved': 'violet',
  };
  const checkChip = r => {
    if (r.fox !== 'paid') return '';
    const name = r.check && GF.PM_CHECKS[r.check];
    return name ? `<span class="chip checkchip ck-${CHECK_HUE[r.check] || 'slate'}" title="${esc(r.check)}">${esc(name)}</span>`
      : `<span class="chip checkchip off" title="${esc('Not in rubric: ' + (r.checkNote || 'app rule'))}">Not in rubric</span>`;
  };
  // Confidence levels from the Analytical Framework
  const CONF_LABEL = { certain: 'High', strong: 'High', moderate: 'Medium', investigate: 'Low · investigate' };
  const CONF_WHY = {
    certain: 'High: observed data, and the same conclusion under every attribution rule.',
    strong: 'High: the conclusion holds under every attribution rule.',
    moderate: 'Medium: relies on modeled numbers or limited data, but the conclusion is stable.',
    investigate: 'Low: the conclusion changes with the rule, or the data is too thin. Our team investigates instead.',
  };
  function unitLabel(unit) { return unit === 'revenue' ? 'revenue per day' : unit === 'dq' ? 'data quality points' : unit === 'cov' ? 'coverage points' : 'saved per day'; }
  function impactText(c, unit, v) { return unit === 'cov' ? `+${v} pts coverage` : unit === 'dq' ? `+${ptsTxt(v)} data quality` : unit === 'none' ? '—' : `+${m(v, c)} ${unit === 'revenue' ? 'revenue' : 'saved'}/day`; }
  const AGENT = { 'setup-scan': 'Period check', settings: 'Settings check', 'spend-scan': 'Spend & optimization check', 'segment-scan': 'Segment check', 'spend-watch': 'Spend-Watch', 'paid-search': 'Paid-Search', creative: 'Creative & LP', setup: 'Setup check', audience: 'Audiences', trend: 'Spend trend', engineer: 'Arrival check', volume: 'Volume check', gap: 'Client vs server', connect: 'New source', tracking: 'Tracking', investigate: 'Investigate' };
  // Growth bets show a range, labelled as an estimate; cuts and fixes show one observed figure.
  const nice = v => { const a = Math.abs(v), st = a >= 1000 ? 100 : a >= 200 ? 10 : a >= 50 ? 5 : 1; return Math.round(v / st) * st; };
  function betRange(c, r, per) { const k = per === 'month' ? 30 : 1, a = m(nice(r.lo * k), c), b = m(nice(r.hi * k), c); return `≈ +${c.cfg.currency === 'DKK' ? a.replace(' kr', '') : a}–${c.cfg.currency === 'DKK' ? b : b.replace('€', '')}`; }
  const checkText = r => r.successCheck === 'failed' ? 'Check not met' : 'Check passed';
  function shortImpact(c, r) {
    if (r.impactTxt) return r.impactTxt.imp;
    if (r.ticket) return `${r.devTxt} ${r.ticket === 'gap' ? (r.tkind === 'browser' ? 'more in the browser' : 'missed by the browser') : r.tkind === 'zero' ? 'arriving' : 'vs normal'}`;
    if (r.confidence === 'investigate') return r.finding ? 'To look into' : 'To investigate';
    if (r.bet) return `${betRange(c, r)} ${r.unit === 'revenue' ? 'revenue' : 'saved'} / day`;
    if (r.unit === 'cov') return `+${r.cov} pts coverage`;
    if (r.agent === 'tracking') return `+${ptsTxt(r.dq)} ${GF.PLATFORMS[r.platform]} data quality`;
    return `${r.estimate ? '≈ ' : ''}+${m(r.valuePerDay, c)} ${r.kind === 'reallocate' ? 'revenue' : 'saved'} / day`;
  }
  function outcome(c, r) {
    if (r.impactTxt) return `<div class="outcome"><div class="k">${esc(r.impactTxt.k)}</div><div class="v inv">${esc(r.impactTxt.imp)}<span class="u">${esc(r.impactTxt.sub)}</span></div></div>`;
    if (r.ticket) return `<div class="outcome"><div class="k">${r.ticket === 'gap' ? 'Browser vs server' : 'Volume'}</div><div class="v tk ${r.tkind === 'spike' || r.tkind === 'shift' ? 'warn' : 'bad'}">${esc(r.devTxt)}<span class="u">${r.ticket === 'gap' ? (r.tkind === 'browser' ? 'more in the browser' : `missed · normally ${Math.round(r.gapNormal * 100)}%`) : r.tkind === 'zero' ? 'arriving' : 'vs normal level'}</span></div></div>`;
    if (r.finding && r.confidence === 'investigate') return `<div class="outcome"><div class="k">Found in period</div><div class="v inv">To look into</div></div>`;
    if (r.confidence === 'investigate') return `<div class="outcome"><div class="k">Status</div><div class="v inv">Investigating</div></div>`;
    if (r.bet) return `<div class="outcome"><div class="k">Size of the prize</div><div class="v">${betRange(c, r)}<span class="u">${r.unit === 'revenue' ? 'revenue' : 'saved'} per day · estimate</span></div></div>`;
    if (r.fox === 'paid') return `<div class="outcome"><div class="k">${r.estimate ? 'Estimated saving' : 'Expected saving'}</div><div class="v">↗ ${r.estimate ? 'about ' : '+'}${m(r.valuePerDay, c)}<span class="u">per day · ${r.estimate ? 'estimate' : 'observed'}</span></div></div>`;
    if (r.unit === 'cov') return `<div class="outcome"><div class="k">Expected outcome</div><div class="v">↗ +${r.cov}<span class="u">pts coverage</span></div></div>`;
    if (r.agent === 'tracking') return `<div class="outcome"><div class="k">Expected outcome</div><div class="v">↗ +${ptsTxt(r.dq)}<span class="u">${esc(GF.PLATFORMS[r.platform])} data quality</span></div></div>`;
    return `<div class="outcome"><div class="k">Expected outcome</div><div class="v">↗ +${m(r.valuePerDay, c)}<span class="u">${r.kind === 'reallocate' ? 'revenue per day' : 'saved per day'}</span></div></div>`;
  }
  /* Period finding chart: what the check measures, day by day over the picked range. Shaded days = the check fired.
     Same look as the page's other charts (hairline grid, 2px lines, crosshair + tooltip); sized to the viewport so text stays legible on phones. */
  function findingChart(c, ch) {
    const n = ch.dates.length, all = ch.series.flatMap(s => s.vals).filter(v => v != null && isFinite(v));
    if (n < 2 || !all.length) return '';
    const id = 'fc' + (++chartSeq), vw = window.innerWidth || 1024;
    const W = Math.round(Math.max(320, Math.min(760, vw - (vw < 900 ? 64 : 380)))), H = vw < 600 ? 220 : 250, L = 50, Rp = 10, T = 10, B = 26;
    const val = ch.fmt === 'money' ? (v => m(v, c)) : ch.fmt === 'pct' ? (v => (Math.round(v * 10) / 10).toLocaleString('en') + '%') : (v => v.toFixed(2));
    const ax = ch.fmt === 'money' ? (v => v >= 1000 ? (v / 1000).toLocaleString('en', { maximumFractionDigits: 1 }) + 'k' : Math.round(v).toLocaleString('en')) : ch.fmt === 'pct' ? (v => (Math.round(v * 10) / 10) + '%') : (v => (Math.round(v * 100) / 100) + '');
    const ticks = niceTicks(0, Math.max(...all) * 1.06 || 1, 4), hi = ticks[ticks.length - 1];
    const x = i => L + i / (n - 1) * (W - L - Rp), y = v => T + (1 - v / hi) * (H - T - B), step = (W - L - Rp) / (n - 1);
    let bands = '';
    for (let i = 0; i < n; i++) if (ch.fired[i]) { let j = i; while (j + 1 < n && ch.fired[j + 1]) j++; bands += `<rect x="${Math.max(L, x(i) - step / 2).toFixed(1)}" y="${T}" width="${(Math.min(W - Rp, x(j) + step / 2) - Math.max(L, x(i) - step / 2)).toFixed(1)}" height="${H - T - B}" fill="var(--warn-soft)"/>`; i = j; }
    const grid = ticks.map(t => `<line x1="${L}" x2="${W - Rp}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--faint)">${esc(ax(t))}</text>`).join('');
    // Month ticks: the first of each month (thinned on narrow screens)
    const months = []; ch.dates.forEach((t, i) => { const d = new Date(t); if (d.getDate() === 1 || (i === 0 && d.getDate() <= 7)) months.push({ i, d }); });
    let lastR = -Infinity, first = true; // keep a tick only where its label fits after the previous one (~6.5px per character)
    const mt = months.map(o => { const lbl = o.d.toLocaleDateString('en-GB', first || o.d.getMonth() === 0 ? { month: 'short', year: 'numeric' } : { month: 'short' });
      const w = lbl.length * 6.5, left = o.i === 0 ? x(o.i) : x(o.i) - w / 2; if (left < lastR + 10) return ''; lastR = left + w; first = false;
      return `<line x1="${x(o.i)}" x2="${x(o.i)}" y1="${H - B}" y2="${H - B + 4}" stroke="var(--base)"/><text x="${x(o.i)}" y="${H - 8}" text-anchor="${o.i === 0 ? 'start' : 'middle'}" font-size="12" fill="var(--faint)">${esc(lbl)}</text>`; }).join('');
    const COL = { main: 'var(--med)', base: '#8A8F8B', ref: 'var(--ink-2)' };
    const path = vals => { let pen = false; return vals.map((v, i) => { if (v == null || !isFinite(v)) { pen = false; return ''; } const s = `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(Math.min(v, hi)).toFixed(1)}`; pen = true; return s; }).join(''); };
    const lines = ch.series.slice().reverse().map(s => { const d = path(s.vals); if (!d) return '';
      return s.role === 'ref' ? `<path d="${d}" fill="none" stroke="${COL.ref}" stroke-width="1.25" stroke-dasharray="5 4"/>` : `<path d="${d}" fill="none" stroke="${COL[s.role] || COL.main}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`; }).join('');
    const mainS = ch.series.find(s => s.role === 'main');
    const dots = (ch.markers || []).map(i => `<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${H - B - 7}" y2="${H - B - 1}" stroke="var(--good)" stroke-width="2"/>`).join(''); // a rug along the baseline
    const key = s => s.role === 'ref' ? `repeating-linear-gradient(90deg,${COL.ref} 0 5px,transparent 5px 9px)` : COL[s.role] || COL.main;
    const legend = `<div class="legend fc-legend">${ch.series.map(s => `<span><i style="background:${key(s)}${s.role === 'ref' ? ';height:2px' : ''}"></i>${esc(s.name)}</span>`).join('')}<span><i style="background:var(--warn-soft);height:12px;width:14px;border-radius:3px"></i>${esc(ch.firedLabel)}</span>${(ch.markers || []).length ? `<span><i style="background:var(--good);width:2px;height:10px;border-radius:1px"></i>${esc(ch.markerLabel || '')} (ticks on the baseline)</span>` : ''}</div>`;
    setTimeout(() => {
      const root = document.getElementById(id); if (!root) return;
      const svg = root.querySelector('svg'), tip = root.querySelector('.tip'), cross = root.querySelector('.cross');
      const move = ev => {
        const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.round((px - L) / step)));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = ''; tip.hidden = false;
        tip.innerHTML = `<span class="d">${new Date(ch.dates[i]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>`
          + ch.series.map((s, k) => `<div class="r ${k ? 'sec2' : ''}"><span>${esc(s.name)}</span><b>${s.vals[i] == null || !isFinite(s.vals[i]) ? '—' : esc(val(s.vals[i]))}</b></div>`).join('')
          + (ch.fired[i] ? `<div class="r"><span>${esc(ch.firedLabel)}</span><b>Yes</b></div>` : '') + ((ch.markers || []).includes(i) ? `<div class="r sec2"><span>${esc(ch.markerLabel || '')}</span><b>✓</b></div>` : '');
        tip.style.left = Math.max(130, Math.min(r.width - 130, x(i) / W * r.width)) + 'px';
      };
      svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
      svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.style.display = 'none'; });
    });
    return `<div class="fc">${legend}<div class="fc-y">${esc(ch.yLabel || '')}</div><div class="chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${ch.yLabel}, day by day; ${ch.fired.filter(Boolean).length} days where the check fired are shaded`)}">
      ${bands}${grid}<line x1="${L}" x2="${W - Rp}" y1="${H - B}" y2="${H - B}" stroke="var(--base)"/>${mt}${lines}${dots}
      <line class="cross" y1="${T}" y2="${H - B}" stroke="#B5B3AC" style="display:none"/><rect x="${L}" y="${T}" width="${W - L - Rp}" height="${H - T - B}" fill="transparent"/>
    </svg><div class="tip" hidden style="width:260px"></div></div>${ch.note ? `<p class="fc-note">${esc(ch.note)}</p>` : ''}</div>`;
  }
  function evidenceTable(c, r) {
    const ev = r.evidence;
    const rules = ev.rules.length ? `<div><div class="eyebrow" style="margin-bottom:8px">Checked under each attribution rule</div><div class="rules">${ev.rules.map(([k, v]) => `<span class="chip neutral">${om('modeled')}${esc(k)}: <b style="color:var(--fg)">${typeof v === 'number' ? v : esc(v)}</b></span>`).join('')}</div></div>` : '';
    const tableOf = (t, dateOpts) => t && t.rows.length ? `<div class="tbl-wrap" style="margin-top:0"><table><thead><tr>${t.cols.map((h, i) => `<th class="${i ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row => `<tr>${row.map((v, i) => {
      const s = v instanceof Date ? v.toLocaleDateString('en-GB', dateOpts) : typeof v === 'number' ? ((t.money || []).includes(i) ? m(v, c, t.moneyDecimals || 0) : n0(v)) : esc(v);
      return `<td class="${i ? 'r' : ''}">${s}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    const chart = ev.chart ? findingChart(c, ev.chart) : '';
    const weekly = ev.weekly && ev.weekly.rows.length ? `<details class="wk"><summary>Show weekly numbers</summary>${tableOf(ev.weekly, { day: 'numeric', month: 'short', year: 'numeric' })}</details>` : '';
    return `<div class="evidence">${rules}${chart}${weekly}${tableOf(ev, { weekday: 'short', day: 'numeric', month: 'short' })}<div class="verdict">${I.bulb.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px;margin-right:6px"')}${esc(ev.verdict)}</div></div>`;
  }
  /* ---------- "Done": the user records when they made a change (date, time, comment) ----------
     Stored in the same shared ledger as adopted actions (clients/<client>/ledger/<key>, status 'adopted'), so it counts as a change
     put in place and goes through the usual verification. Period findings are keyed by check + target without the range
     (rec.doneKey), and every entry keeps a full snapshot (title, check, fox, platform, campaign…) so it still renders when the
     finding is no longer in the picked range. */
  const doneKeyOf = r => r.doneKey || r.id;
  async function saveLedger(c, key, val) {
    const prev = c.status[key];
    if (val) c.status[key] = val; else delete c.status[key];
    if (ledgerMode === 'local') { store.set('status.' + c.cfg.id, c.status); return true; }
    const undo = () => { if (prev) c.status[key] = prev; else delete c.status[key]; };
    if (ledgerMode === 'readonly' || !db) { undo(); return false; }
    try { const ref = db.doc(`clients/${c.cfg.id}/ledger/${key}`); if (val == null) await ref.delete(); else await ref.set(val); return true; }
    catch (e) { undo(); if (e && e.code === 'invalid_argument') ledgerMode = 'readonly'; return false; }
  }
  const pad2 = n => String(n).padStart(2, '0');
  const isoDay2 = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const doneWhen = st => { const t = st.at; return `${new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };
  function doneDialog() {
    let dlg = document.getElementById('done-dlg'); if (dlg) return dlg;
    dlg = document.createElement('dialog'); dlg.id = 'done-dlg'; dlg.setAttribute('aria-labelledby', 'done-h'); dlg.setAttribute('aria-modal', 'true');
    dlg.innerHTML = `<form class="dlg-form" method="dialog" novalidate>
      <h2 id="done-h">Mark as done</h2>
      <p class="dlg-sub" id="done-what"></p>
      <div class="dlg-row"><label>Date<input type="date" name="date" required></label><label>Time<input type="time" name="time" required></label></div>
      <label>Comment <span class="dlg-opt">(optional)</span><textarea name="comment" rows="3" maxlength="300" placeholder="e.g. Raised budget to 400 kr/day"></textarea></label>
      <p class="dlg-err" role="alert" hidden></p>
      <div class="dlg-actions"><button type="button" class="btn ghost" data-dlg="cancel">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.querySelector('[data-dlg="cancel"]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { const k = dlg.dataset.focus; dlg.dataset.focus = ''; const b = k && [...document.querySelectorAll('[data-act^="done-"]')].find(x => x.dataset.key === k && !x.disabled); (b || document.querySelector('#app h1'))?.focus?.({ preventScroll: true }); });
    dlg.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, err = f.querySelector('.dlg-err'), save = f.querySelector('[type="submit"]'), c = ctx(), key = dlg.dataset.key;
      const date = f.date.value, time = f.time.value || '00:00', comment = f.comment.value.trim().slice(0, 300);
      const showErr = t => { err.textContent = t; err.hidden = false; };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return showErr('Pick the date you made the change.');
      const at = new Date(`${date}T${time}:00`).getTime();
      if (!isFinite(at)) return showErr('That date or time doesn’t look right.');
      if (at > Date.now() + 60e3) return showErr('The date and time can’t be in the future.');
      const rec = c.model.recs.find(x => x.id === dlg.dataset.rec), base = c.status[key] || (rec ? ledgerEntry(c, rec, 'adopted') : null);
      if (!base) return showErr('This action can’t be found any more.');
      const val = Object.assign({}, base, {
        status: base.status === 'verified' || base.status === 'not_verified' ? base.status : 'adopted', at, verifyDue: at + (base.verifyDays || 7) * GF.DAY,
        done: true, doneAt: `${date}T${time}`, comment, recId: rec ? rec.id : (base.recId || null), check: rec ? (rec.check || null) : (base.check || null),
        checkNote: rec ? (rec.checkNote || null) : (base.checkNote || null), campaign: rec ? (rec.campaign || null) : (base.campaign || null), by: uid || null, editedAt: Date.now(),
      });
      save.disabled = true; err.hidden = true;
      const ok = await saveLedger(c, key, val); save.disabled = false;
      if (!ok) { showErr(ledgerMode === 'readonly' ? 'You can view this ledger, but not change it.' : 'Couldn’t save to the shared ledger. Please try again.'); toast('Couldn’t save. Please try again.'); return; }
      dlg.close(); render(); toast('Logged as done. It’s on the Executive page under What we’ve done.');
      const b = [...document.querySelectorAll('[data-act="done-open"]')].find(x => x.dataset.key === key); b?.focus({ preventScroll: true });
    });
    return dlg;
  }
  function openDone(c, key, recId) {
    const dlg = doneDialog(), f = dlg.querySelector('form'), st = c.status[key], rec = c.model.recs.find(x => x.id === recId);
    const now = new Date(), at = st && st.done ? new Date(st.at) : now;
    dlg.dataset.key = key; dlg.dataset.rec = recId || (st && st.recId) || ''; dlg.dataset.focus = key;
    f.date.value = isoDay2(at); f.date.max = isoDay2(now); f.time.value = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
    f.comment.value = st && st.done ? st.comment || '' : ''; f.querySelector('.dlg-err').hidden = true;
    dlg.querySelector('#done-what').textContent = (rec || st || {}).title || '';
    dlg.showModal(); f.date.focus();
  }
  const doneBtn = (c, r) => ledgerMode === 'readonly'
    ? `<span title="You can view this ledger, but not change it."><button type="button" class="btn primary" disabled>Done ${I.check}</button></span>`
    : `<button type="button" class="btn primary" data-act="done-open" data-key="${esc(doneKeyOf(r))}" data-rec="${esc(r.id)}">Done ${I.check}</button>`;
  // The done state on the detail page: "Done · 12 Apr 2025, 14:30 — comment", with Edit and Undo
  const doneState = (c, st, key) => `<div class="done-state"><span class="chip good">${I.check}Done · ${esc(doneWhen(st))}</span>${st.comment ? `<span class="done-cm">— ${esc(st.comment)}</span>` : ''}
    ${ledgerMode === 'readonly' ? '' : `<span class="actions"><button type="button" class="btn" data-act="done-open" data-key="${esc(key)}" data-rec="${esc(st.recId || '')}">Edit</button><button type="button" class="btn ghost" data-act="done-undo" data-key="${esc(key)}">Undo</button></span>`}</div>`;
  function recCard(c, r, top, opts = {}) {
    const whyOpen = state.whyOpen.has(r.id), whyId = 'why-' + r.id.replace(/[^\w-]/g, '_'); // the "Why this came up" accordion, open/closed per rec in memory
    const st = recState(c, r);
    const inv = r.confidence === 'investigate';
    const open = state.open.has(r.id);
    const owner = r.owner || 'You';
    const plat = GF.PLATFORMS[r.platform] || r.platform;
    let foot;
    if (st) {
      const when = new Date(st.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const msg = st.status === 'verified' ? `<span class="chip good">${I.check}Verified</span><span style="color:var(--muted)">${st.bet ? `Success check ${st.successCheck === 'failed' ? 'not met' : 'passed'}.` : `Measured ${esc(impactText(c, st.unit, st.measuredPerDay))}.`}</span>`
        : st.status === 'not_verified' ? `<span class="chip warn">${I.alert}Not verified</span><span style="color:var(--muted)">${esc(st.note || '')}</span>`
        : st.status === 'adopted' ? `<span class="chip good">${I.check}Adopted ${when}</span><span style="color:var(--muted)">${r.agent === 'tracking' ? 'We’ll confirm the check passes.' : `We’ll verify it against the ${esc(plat)} change history.`}</span>`
        : st.status === 'requested' ? `<span class="chip info">${I.team}Requested ${when}</span><span style="color:var(--muted)">${r.ticket ? 'Our team is looking into it and will report back.' : 'Our team will make the change and confirm the check passes.'}</span>`
        : st.status === 'closed' ? `<span class="chip neutral">${I.check}Closed as expected ${when}</span><span style="color:var(--muted)">Reason: ${esc(st.reason || '')}${st.logged ? ' · logged as your change, so it shows on the Executive chart' : ''}</span>`
        : st.status === 'expected' ? `<span class="chip neutral">${I.target}Expected level</span><span style="color:var(--muted)">Baseline ${(st.baseline * 100).toFixed(1)}%. We’ll only raise it again if it drops below.</span>`
        : st.status === 'snoozed' ? `<span class="chip neutral">${I.clock}Snoozed until ${new Date(st.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>`
        : `<span class="chip neutral">${I.x}Dismissed ${when}</span><span style="color:var(--muted)">Reason: ${esc(st.reason)}</span>`;
      foot = `<div class="rec-foot"><div class="statusline">${msg}</div><div class="actions"><button class="btn ghost" data-act="undo" data-id="${r.id}">Undo</button></div></div>`;
    } else if (r.finding) { // found by the period scan: shown as what the app would have spotted, nothing to mark as done
      foot = `<div class="rec-foot">
        <div class="meta"><span>Platform: <b style="color:var(--fg);font-weight:500">${esc(plat)}</b></span><span>${esc(AGENT[r.agent])}</span><span>A finding from the picked period, not a live recommendation</span></div>
        <div class="actions"><button class="btn ghost" data-act="toggle" data-id="${r.id}" aria-expanded="${open}">${open ? 'Hide' : 'Show'} evidence</button></div></div>`;
    } else if (r.ticket && state.closing === r.id) {
      foot = `<form class="rec-foot tkform" data-form="closeticket" data-id="${esc(r.id)}" aria-label="Close the ticket as expected">
        <label class="grow">Why is this expected?<input name="reason" required maxlength="120" placeholder="e.g. 20% off sitewide for the long weekend"></label>
        <label class="chk"><input type="checkbox" name="log" ${r.tkind === 'spike' ? 'checked' : ''}> Also log it as one of my changes, so it shows on the Executive chart</label>
        <label>Kind<select name="cat" class="select">${Object.entries(CH_CAT).map(([k, l]) => `<option value="${k}" ${k === (r.tkind === 'spike' ? 'promo' : 'site') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="actions"><button type="button" class="btn ghost" data-act="closecancel">Cancel</button><button class="btn primary" type="submit">Close ticket</button></div></form>`;
    } else if (r.ticket && state.ctxOpen === r.id) {
      foot = `<form class="rec-foot tkform" data-form="ctxnote" data-id="${esc(r.id)}" aria-label="Add context">
        <label class="grow">Context<input name="text" required maxlength="200" placeholder="e.g. Site migration on Monday"></label>
        <div class="actions"><button type="button" class="btn ghost" data-act="ctxcancel">Cancel</button><button class="btn primary" type="submit">Add context</button></div></form>`;
    } else if (r.ticket) {
      foot = `<div class="rec-foot">
        <div class="meta"><span>Source: <b style="color:var(--fg);font-weight:500">${esc((r.sources || [r.platform]).join(' · '))}</b></span><span>${esc(AGENT[r.agent])}</span></div>
        <div class="actions">
          <button class="btn ghost" data-act="toggle" data-id="${r.id}" aria-expanded="${open}">${open ? 'Hide' : 'Show'} evidence</button>
          <button class="btn" data-act="ctxopen" data-id="${r.id}">Add context</button>
          <button class="btn" data-act="closeopen" data-id="${r.id}">Expected, close it</button>
          <button class="btn primary" data-act="request" data-id="${r.id}">Ask our team ${I.arrow}</button>
        </div></div>`;
    } else if (r.optional && !promoted(c, r)) {
      foot = `<div class="rec-foot"><div class="statusline"><span class="catchip optional">Optional</span><span style="color:var(--muted)">Not in All actions. Add it if you want to work on it.</span></div><div class="actions"><button class="btn primary" data-act="promote" data-id="${r.id}">Add to actions ${I.arrow}</button></div></div>`;
    } else if (state.dismissing === r.id) {
      foot = `<div class="rec-foot"><div class="dismiss-box"><span>Why are you dismissing this?</span>${['Already done', 'I disagree with the data', 'Not a priority now', 'Other reason'].map(x => `<button class="fbtn" data-act="dismiss" data-id="${r.id}" data-reason="${x}">${x}</button>`).join('')}</div><button class="btn ghost" data-act="cancel-dismiss">Cancel</button></div>`;
    } else {
      const primary = inv ? '' : owner === 'GrowthFox team' ? `<button class="btn primary" data-act="request" data-id="${r.id}">Ask our team to fix ${I.arrow}</button>` : `<button class="btn primary" data-act="adopt" data-id="${r.id}">I made this change ${I.check}</button>`;
      foot = `<div class="rec-foot">
        <div class="meta"><span>Platform: <b style="color:var(--fg);font-weight:500">${esc(plat)}</b></span>${r.minutes ? `<span>${I.clock}~${r.minutes} min</span>` : ''}<span>${esc(AGENT[r.agent])}</span></div>
        <div class="actions">
          <button class="btn ghost" data-act="toggle" data-id="${r.id}" aria-expanded="${open}">${open ? 'Hide' : 'Show'} evidence</button>
          ${r.param ? `<button class="btn" data-act="explevel" data-id="${r.id}" title="Some ${esc(r.param)} values can never be sent. Sets today’s level as the baseline.">Expected level</button>` : ''}
          <button class="btn icon" data-act="snooze" data-id="${r.id}" title="Snooze for 7 days" aria-label="Snooze for 7 days">${I.clock}</button>
          <button class="btn icon" data-act="ask-dismiss" data-id="${r.id}" title="Dismiss" aria-label="Dismiss">${I.x}</button>
          ${primary}
        </div></div>`;
    }
    return `<article class="rec ${top && !st ? 'top' : ''} ${inv ? 'inv' : ''} ${st ? 'done' : ''}" id="rec-${r.id}" style="${foxVars(r.fox)}">
      <div class="rec-head"><div>${foxSvg(r.fox)}<div style="min-width:0"><div class="tags"><span class="foxchip">${FOX[r.fox].name}</span>${confBadge(r)}${checkChip(r)}${r.asOf ? `<span class="asof">${esc(r.asOf)}</span>` : ''}</div><h3><a class="rec-t" href="#action/${encodeURIComponent(r.id)}">${esc(r.title)}</a></h3>${r.eligibility && r.eligibility.state === 'qualified' ? `<p class="qual-note">${esc(r.eligibility.text)}</p>` : ''}</div></div>${outcome(c, r)}</div>
      <div class="why${whyOpen ? ' open' : ''}"><button type="button" class="why-h" data-act="why" data-id="${esc(r.id)}" aria-expanded="${whyOpen}" aria-controls="${whyId}"><svg class="why-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 13.5V9.5M5.5 13.5V7M8.5 13.5V10.5"/><circle cx="11" cy="5.25" r="2.75"/><path d="M13 7.25 14.75 9"/></svg><span class="why-t"><b>Analysis</b>${whyOpen ? '' : `<span class="why-pv">${esc(String(r.observe || '').split(/(?<=[.!?])\s/)[0])}</span>`}</span><svg class="why-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>
        <div class="why-b" id="${whyId}"${whyOpen ? '' : ' hidden'}><p><b>What we see.</b> ${esc(r.observe)} ${r.labels.spend ? om(r.labels.spend) : ''} ${r.labels.conv ? om(r.labels.conv) : ''}</p><p><b>What it means.</b> ${esc(r.means)}</p>${r.hypothesis && r.hypothesis !== r.means && !r.observe.includes(r.hypothesis) ? `<p><b>Our hypothesis.</b> ${esc(r.hypothesis)}</p>` : ''}<p><b>What to expect.</b> ${esc(r.expect)}</p></div></div>
      <div class="todo"><svg class="todo-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M5.25 8h5.25M8.25 5.75 10.5 8l-2.25 2.25"/></svg><span><span class="todo-k">${inv ? 'Next step' : 'Recommended action'}</span>${esc(r.action)}</span></div>
      ${opts.detail && !st ? `<div class="done-row">${doneBtn(c, r)}</div>` : ''}
      ${r.success ? `<div class="success">${I.target}<span><b>How we’ll know it worked.</b> ${esc(r.success)}</span></div>` : ''}
      ${r.ticket && c.status['note-' + r.id] && c.status['note-' + r.id].notes ? `<div class="notes"><b>Context</b>${c.status['note-' + r.id].notes.map(nt => `<p>${esc(nt.text)} <small>${new Date(nt.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></p>`).join('')}</div>` : ''}
      ${r.rule ? `<div class="ruleline">${I.pulse}<span><b>Rule${r.draft ? ' · draft, to validate with our media lead' : ''}.</b> ${esc(r.rule)}</span></div>` : ''}
      ${r.caveat ? `<div class="caveat">${I.alert.replace('<svg', '<svg width="14" height="14"')}${esc(r.caveat)}</div>` : ''}
      ${open && !st ? evidenceTable(c, r) : ''}
      ${foot}
    </article>`;
  }
  function heldCard(c, h) {
    const q = h.quarantine && c.cfg.quarantine.find(x => x.id === h.quarantine);
    if (q && c.qdec[q.id] === 'include') return '';
    if (q && c.qdec[q.id] === 'exclude') return ''; // decided: nothing left to ask
    return `<div class="held">${q ? I.shield : I.alert}<div><h4>${esc(h.title)}</h4><p>${q ? esc(q.what) + ' ' : ''}${esc(h.text)}</p>
      ${q ? `<p style="color:var(--fg);margin-top:8px;font-weight:500">${esc(q.ask)}</p><div class="actions"><button class="btn" data-act="q-include" data-id="${q.id}">It’s real, include it</button><button class="btn" data-act="q-exclude" data-id="${q.id}">Not real, keep it out</button></div>` : ''}</div></div>`;
  }
  function footnote() {
    return `<div class="footnote"><span>${om('observed')} Observed: recorded directly, matched by ID</span><span>${om('modeled')} Modeled: depends on a rule or inference</span><span>Correlational, never causal. Only an experiment proves an incremental effect.</span></div>`;
  }
