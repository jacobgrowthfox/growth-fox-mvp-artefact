  /* ---------- Events ---------- */
  document.addEventListener('click', ev => {
    const rb = ev.target.closest('[data-range]');
    if (rb) { state.range = +rb.dataset.range; store.set('range', state.range); render(); return; }
    const hrefNode = ev.target.closest('[data-href]');
    if (hrefNode) { const h = hrefNode.dataset.href; if (h === '#addsrc') { document.getElementById('addsrc')?.scrollIntoView({ behavior: 'smooth' }); } else location.hash = h; return; }
    // Overview: clicking the background of "Your foxes" clears the fox filter
    if (state.nextFox && ev.target.closest('section[data-sec="foxes"]') && !ev.target.closest('a, button, .bubble, select')) { state.nextFox = null; render(); return; }
    const go = ev.target.closest('[data-goto]');
    if (go) {
      const id = go.dataset.goto; state.recFilter = 'all'; state.showDone = false; state.open.add(id); pendingGoto = id;
      if (location.hash === '#recs') { ev.preventDefault(); route(); }
      else if (!go.closest('a')) location.hash = '#recs'; // e.g. a box in the connection map
      return;
    }
    const prow = ev.target.closest('tr[data-row]');
    if (prow && !ev.target.closest('button, a, select, input, label')) { location.hash = prow.dataset.row; return; }
    const row = ev.target.closest('.actlist li');
    const rowLink = row && row.querySelector('a.t[href^="#action/"]');
    const selecting = () => { const sl = window.getSelection && window.getSelection(); return !!(sl && !sl.isCollapsed && String(sl).trim()); };
    if (rowLink && !ev.target.closest('button, a, select, input, label')) { if (!selecting()) location.hash = rowLink.getAttribute('href'); return; }
    // Paid Media 2×2 area cards: the whole card opens that area on the channel page (inner chip links keep their own target)
    const agCard = ev.target.closest('.areagrid li'), agLink = agCard && agCard.querySelector('a.ag-link');
    if (agLink && (ev.target.closest('a.ag-link') || (!ev.target.closest('a, button, select, input, label, .area-checked') && !selecting()))) {
      ev.preventDefault(); state.scrollArea = agLink.dataset.area; const h = agLink.getAttribute('href');
      if (location.hash === h) route(); else location.hash = h; return;
    }
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'back') { if (history.length > 1) { ev.preventDefault(); history.back(); } return; }
    const c = ctx(); const id = b.dataset.id; const act = b.dataset.act; const now = Date.now();
    if (act === 'brief') { downloadBrief(c); return; }
    if (act === 'doneview') { state.doneView = b.dataset.k; render(); return; }
    if (act === 'donepick') { state.resSel = b.dataset.k; state.doneView = 'one'; render(); return; }
    if (act === 'revedit') { state.revEdit = !state.revEdit; render(); return; }
    if (act === 'revmodel') { setRevModel(c, b.dataset.k); state.revEdit = false; render(); return; }
    if (act === 'evsel') {
      const ev = b.dataset.k, on = !!ev && !(state.evSel && state.evSel.ep === state.ep && state.evSel.ev === ev);
      state.evSel = on ? { ep: state.ep, ev } : null; render();
      if (on && b.closest('.evgrid')) document.getElementById('ep-params')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (act === 'doneopen-go') { state.doneOpen = true; render(); document.querySelector('section[aria-label="What your foxes have done"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (act === 'why') { // accordion: keep focus on the header button across the re-render
      state.whyOpen.has(id) ? state.whyOpen.delete(id) : state.whyOpen.add(id); render();
      [...document.querySelectorAll('[data-act="why"]')].find(x => x.dataset.id === id)?.focus({ preventScroll: true }); return;
    }
    if (act === 'done-open' || act === 'done-undo') {
      if (ledgerMode === 'readonly') { toast('You can view this ledger, but not change it.'); return; }
      const key = b.dataset.key;
      if (act === 'done-open') { openDone(c, key, b.dataset.rec); return; }
      const prev = c.status[key];
      saveLedger(c, key, null).then(ok => { render(); if (!ok) toast('Couldn’t undo. Please try again.'); else toast('Undone.', () => saveLedger(c, key, prev).then(() => render())); });
      return;
    }
    const rec = c.model.recs.find(x => x.id === id);
    const undoTo = () => { setStatus(c, id, null); render(); };
    if (['adopt', 'request', 'request-src', 'snooze', 'explevel', 'promote', 'unpromote', 'ctxopen', 'closeopen', 'dismiss', 'verify', 'undo'].includes(act) && ledgerMode === 'readonly') { toast('You can view this ledger, but not change it.'); return; }
    if (act === 'toggle') { state.open.has(id) ? state.open.delete(id) : state.open.add(id); }
    else if (act === 'ovfox') { state.ovFox = b.dataset.k; }
    else if (act === 'bubfox') { state.bubFox = b.dataset.k; }
    else if (act === 'resfox') { state.resFox = b.dataset.k; state.resSel = null; }
    else if (act === 'resmetric') { state.resMetric = b.dataset.k; }
    else if (act === 'resnav') { const rf = state.resFox || 'all'; const vis = rangeMarks(c).filter(r => rf === 'all' || r.fox === rf); const i = vis.findIndex(r => r.id === state.resSel) + +b.dataset.k; if (vis[i]) state.resSel = vis[i].id; }
    else if (act === 'adopt' && rec) { setStatus(c, id, ledgerEntry(c, rec, 'adopted')); toast('Added to the ledger. We’ll verify the change.', undoTo); }
    else if (act === 'request' && rec) { setStatus(c, id, ledgerEntry(c, rec, 'requested')); toast('Sent to the GrowthFox team and added to the ledger.', undoTo); }
    else if (act === 'promote' && rec) { setStatus(c, id, { status: 'promoted', at: now, by: uid }); toast('Added to All actions.', undoTo); }
    else if (act === 'unpromote') { setStatus(c, id, null); toast('Back in Optional improvements.'); }
    else if (act === 'datamore') { state.dataMore = !state.dataMore; }
    else if (act === 'ctxopen') { state.ctxOpen = id; state.closing = null; }
    else if (act === 'ctxcancel') { state.ctxOpen = null; }
    else if (act === 'closeopen') { state.closing = id; state.ctxOpen = null; }
    else if (act === 'closecancel') { state.closing = null; }
    else if (act === 'datasort') { state.dataSort = b.dataset.k; store.set('dataSort', state.dataSort); }
    else if (act === 'optmore') { state.optMore = !state.optMore; }
    else if (act === 'explevel' && rec) { const base = Math.floor(rec.compNow * 1000) / 1000; setStatus(c, id, ledgerEntry(c, rec, 'expected', { baseline: base, verifyDays: 0 })); toast(`Marked as expected at ${(base * 100).toFixed(1)}%. We’ll only flag it if it drops below.`, undoTo); }
    else if (act === 'snooze' && rec) { setStatus(c, id, ledgerEntry(c, rec, 'snoozed', { until: now + 7 * GF.DAY })); toast('Snoozed for 7 days.', undoTo); }
    else if (act === 'ask-dismiss') { state.dismissing = id; }
    else if (act === 'cancel-dismiss') { state.dismissing = null; }
    else if (act === 'dismiss' && rec) { setStatus(c, id, ledgerEntry(c, rec, 'dismissed', { reason: b.dataset.reason })); state.dismissing = null; toast('Dismissed. Your reason is logged in the ledger.', undoTo); }
    else if (act === 'nextfox') { state.nextFox = state.nextFox === b.dataset.k ? null : b.dataset.k; state.bouncePick = !!state.nextFox; }
    else if (act === 'bizm') { state.bizMetric = b.dataset.k; }
    else if (act === 'doneopen') { ev.preventDefault(); state.doneOpen = !state.doneOpen; }
    else if (act === 'logopen') { state.logOpen = !state.logOpen; }
    else if (act === 'ch-remove') {
      if (ledgerMode === 'readonly') { toast('You can view these changes, but not change them.'); return; }
      const cid = c.cfg.id, prevVal = chg(cid)[id];
      if (prevVal) { delete chg(cid)[id]; writeDoc(cid, 'changes', id, null); toast('Change removed.', () => { chg(cid)[id] = prevVal; writeDoc(cid, 'changes', id, prevVal); render(); }); }
    }
    else if (act === 'request-src') {
      const x = GF.ENGINEER[c.cfg.id].catalog.find(k => k.id === id);
      if (x) { const now2 = Date.now(); setStatus(c, 'src-' + id, { status: 'requested', at: now2, by: uid, title: `Connect ${x.name}`, fox: 'engineer', agent: 'connect', kind: 'connect', platform: x.name, owner: 'GrowthFox team', confidence: 'certain', unit: 'none', expectedPerDay: 0, spendChangedPerDay: 0, success: `${x.name} connected and syncing daily.`, verifyDays: 7, verifyDue: now2 + 7 * GF.DAY }); toast(`Sent to the GrowthFox team. ${x.name} is in the ledger.`); }
    }
    else if (act === 'verify') { if (c.cfg.real) return; simulateVerify(c, id); toast('Verification run (sample data).'); }
    else if (act === 'undo') { setStatus(c, id, null); }
    else if (act === 'filter') { state.recFilter = b.dataset.f; }
    else if (act === 'q-include' || act === 'q-exclude') { setDecision(c, id, act === 'q-include' ? 'include' : 'exclude'); toast(act === 'q-include' ? 'Included. The data is back in the dashboard.' : 'Kept out of the dashboard.'); }
    else if (act === 'q-undo') { setDecision(c, id, null); }
    render();
  });
  // Log a change: keep the draft while typing (a shared-store update re-renders the page), save on submit
  document.addEventListener('input', ev => {
    const f = ev.target.form; if (!f || f.dataset.form !== 'change') return;
    state.chDraft = Object.fromEntries(new FormData(f));
  });
  document.addEventListener('submit', ev => {
    const tf = ev.target;
    if (tf.dataset && (tf.dataset.form === 'ctxnote' || tf.dataset.form === 'closeticket')) {
      ev.preventDefault();
      if (ledgerMode === 'readonly') { toast('You can view this ledger, but not change it.'); return; }
      const c = ctx(), id = tf.dataset.id, rec = c.model.recs.find(x => x.id === id), v = Object.fromEntries(new FormData(tf));
      if (!rec) return;
      if (tf.dataset.form === 'ctxnote') {
        const text = (v.text || '').trim(); if (!text) return;
        const prev = c.status['note-' + id], notes = ((prev && prev.notes) || []).concat([{ text: text.slice(0, 200), at: Date.now(), by: uid }]);
        setStatus(c, 'note-' + id, { notes }); state.ctxOpen = null; toast('Context added to the ticket.'); render(); return;
      }
      const reason = (v.reason || '').trim(); if (!reason) { toast('Add a reason.'); return; }
      const cid = c.cfg.id, chId = v.log ? 'ch' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null;
      if (chId) { const val = { at: dayStart(rec.startAt) + 12 * 3600e3, title: reason.slice(0, 90), cat: CH_CAT[v.cat] ? v.cat : 'other', ch: '', by: uid, loggedAt: Date.now(), fromTicket: id }; chg(cid)[chId] = val; writeDoc(cid, 'changes', chId, val); }
      setStatus(c, id, ledgerEntry(c, rec, 'closed', { reason: reason.slice(0, 120), logged: !!chId, verifyDays: 0 }));
      state.closing = null;
      toast(chId ? 'Ticket closed. The change is on the Executive chart.' : 'Ticket closed.', () => { setStatus(c, id, null); if (chId) { delete chg(cid)[chId]; writeDoc(cid, 'changes', chId, null); } render(); });
      render(); return;
    }
    const f = ev.target; if (!f.dataset || f.dataset.form !== 'change') return;
    ev.preventDefault();
    if (ledgerMode === 'readonly') { toast('You can view these changes, but not add to them.'); return; }
    const v = Object.fromEntries(new FormData(f));
    const title = (v.title || '').trim();
    if (!title || !v.date) { toast('Add a date and what changed.'); return; }
    const at = new Date(v.date + 'T12:00:00').getTime();
    if (!isFinite(at)) { toast('That date doesn’t look right.'); return; }
    const c = ctx(), cid = c.cfg.id, id = 'ch' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const val = { at, title: title.slice(0, 90), cat: CH_CAT[v.cat] ? v.cat : 'other', ch: CH_AFFECTS.includes(v.ch) ? v.ch : '', by: uid, loggedAt: Date.now() };
    chg(cid)[id] = val; writeDoc(cid, 'changes', id, val);
    state.chDraft = null;
    const R0 = chgRange(c), i = dayIdx(c, dayStart(at)), inRange = i >= R0.from && i <= R0.to;
    toast(inRange ? 'Logged. It’s on the Executive chart.' : 'Logged. Widen the date range to see it on the chart.', () => { delete chg(cid)[id]; writeDoc(cid, 'changes', id, null); render(); });
    render();
  });
  document.addEventListener('change', ev => {
    if (ev.target.id === 'client') { state.clientId = ev.target.value; store.set('client', state.clientId); state.open.clear(); state.dismissing = null; state.dataMore = state.optMore = false; render(); }
    if (ev.target.id === 'rule') { state.rule = ev.target.value; render(); }
    if (ev.target.dataset && ev.target.dataset.thr) {
      if (ledgerMode === 'readonly') { toast('You can view these settings, but not change them.'); render(); return; }
      const c = ctx(); setStatus(c, 'thr-' + ev.target.dataset.thr, { value: +ev.target.value, at: Date.now(), by: uid }); render();
      toast('Threshold saved. Tickets now follow it.');
    }
    if (ev.target.id === 'sort') { state.recSort = ev.target.value; render(); }
  });
  function route() {
    let [h, sub, sub2] = location.hash.replace('#', '').split('/');
    if (h === 'tracking') { h = 'analytics'; sub = null; history.replaceState(null, '', '#analytics'); } // Tracking health now lives on the Data Fox page
    state.page = PAGES.includes(h) ? h : 'overview';
    state.ep = state.page === 'analytics' && sub ? sub : null;
    state.ch = state.page === 'paid' && sub ? sub : null;
    state.actId = state.page === 'action' && sub ? decodeURIComponent(sub) : null;
    state.param = state.page === 'param' && sub && sub2 ? { ep: sub, key: decodeURIComponent(sub2) } : null;
    render();
    const el = pendingGoto && document.getElementById('rec-' + pendingGoto);
    pendingGoto = null;
    const areaEl = state.scrollArea && document.getElementById('area-' + state.scrollArea); state.scrollArea = null;
    if (el) el.scrollIntoView({ block: 'start' }); else if (areaEl) areaEl.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
  }
