  /* ---------- All actions ---------- */
  function pageRecs(c) {
    const recs = c.model.recs.filter(r => !r.held && (!r.optional || promoted(c, r)));
    const heldRecs = c.model.recs.filter(r => r.held);
    const done = recs.filter(r => recState(c, r));
    const active = recs.filter(r => !recState(c, r));
    const counts = { all: active.length }; for (const r of active) counts[r.fox] = (counts[r.fox] || 0) + 1;
    let list = active.filter(r => state.recFilter === 'all' || r.fox === state.recFilter);
    if (state.recSort === 'effort') list = [...list].sort((a, b) => (a.minutes || 999) - (b.minutes || 999));
    const filters = [['all', 'All'], ['paid', 'Paid Media'], ['analytics', 'Data'], ['engineer', 'Engineer']]
      .map(([k, l]) => `<button class="fbtn" data-act="filter" data-f="${k}" aria-pressed="${state.recFilter === k}">${l}<span class="n">${counts[k] || 0}</span></button>`).join('');
    const held = c.model.held.map(h => heldCard(c, h)).join('') + heldRecs.map(r => `<div class="held">${I.clock}<div><h4>On hold: ${esc(r.title)}</h4><p>${esc(r.held.text)}</p></div></div>`).join('');
    return `<div class="page">
      <div class="ph"><div><h1>All actions</h1><p>Every open action from your three foxes: ${active.length} open. Data fixes come first, because every other number depends on them; the rest are ranked by expected impact × confidence ÷ effort. You make every change; we verify it afterwards.</p></div>
        <a class="btn" href="#ledger">${I.history}Recommendation ledger (${ledgerRows(c).length})</a></div>
      ${held ? `<div style="display:grid;gap:10px">${held}</div>` : ''}
      <div class="filters" role="group" aria-label="Filter by fox">${filters}<span style="flex:1"></span><label for="sort" style="color:var(--muted);font-size:14px">Sort</label><select id="sort" class="select"><option value="value" ${state.recSort === 'value' ? 'selected' : ''}>Ranked (data fixes first)</option><option value="effort" ${state.recSort === 'effort' ? 'selected' : ''}>Quickest first</option></select></div>
      <div class="recs">${list.map((r, i) => recCard(c, r, i === 0 && state.recFilter === 'all')).join('') || `<div class="empty">No open actions from this fox.</div>`}</div>
      ${footnote()}</div>`;
  }
