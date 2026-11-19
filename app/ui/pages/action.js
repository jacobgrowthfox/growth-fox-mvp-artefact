  /* ---------- Action detail: one change, from recommendation to measured result ---------- */
  function pageAction(c, id) {
    const rec = c.model.recs.find(x => x.id === id);
    const r = ledgerRows(c).find(x => x.id === id || (rec && rec.doneKey && x.id === rec.doneKey));
    const fx = (r || rec || {}).fox, home = { paid: ['#paid', 'Paid Media Fox'], analytics: ['#analytics', 'Data Fox'], engineer: ['#engineer', 'Engineer Fox'] }[fx] || ['#overview', 'Executive'];
    const back = `<a href="${home[0]}" data-act="back" class="ex-more" style="padding:0">← Back</a>`;
    if (!r && !rec) return `<div class="page">${back}<div class="empty">This action isn’t in the ledger.</div></div>`;
    const row = r || rec, f = FOX[row.fox] || FOX.paid, v = r ? changeVerdict(r) : null;
    const dd = t => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const facts = r ? [
      ['Put in place', dd(r.at)],
      ['Owner', r.owner || 'You'],
      ['Platform', GF.PLATFORMS[r.platform] || r.platform || '—'],
      [r.bet ? 'Estimate' : 'Expected', r.bet ? betRange(c, r) + '/day' : r.unit !== 'none' && r.expectedPerDay ? impactText(c, r.unit, r.expectedPerDay) : '—'],
      [r.bet ? 'Success check' : 'Measured', r.bet && r.status === 'verified' ? (r.successCheck === 'failed' ? 'Not met' : 'Passed') : r.status === 'verified' && r.measuredPerDay != null && r.unit !== 'none' ? impactText(c, r.unit, r.measuredPerDay) : r.status === 'verified' ? 'Check passed' : r.status === 'not_verified' ? 'Not verified' : r.status === 'closed' ? `Closed: ${r.reason || ''}` : r.status === 'expected' ? `Baseline ${(r.baseline * 100).toFixed(1)}%` : `Due ${new Date(r.verifyDue || (r.at + (r.verifyDays || 7) * GF.DAY)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`],
    ] : [];
    return `<div class="page" style="${foxVars(row.fox in FOX ? row.fox : 'paid')}">
      ${back}
      <div class="ph"><div class="ph-fox">${foxSvg(row.fox in FOX ? row.fox : 'paid', true)}<div><span class="foxchip">${esc(f.name)}</span><h1 style="font-size:30px;margin-top:8px">${esc(row.title)}</h1></div></div></div>
      ${r ? `<section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Result</span></div><span class="chip ${v.cls}">${esc(v.text)}</span></div>
        ${r.done ? doneState(c, r, r.id) : ''}
        <div class="act-facts">${facts.map(([k, val]) => `<div><span>${k}</span><b>${esc(val)}</b></div>`).join('')}</div>
        ${changeRange(c, r)}
        ${r.success ? `<div class="success" style="margin-top:16px">${I.target}<span><b>How we know it worked.</b> ${esc(r.success)}</span></div>` : ''}
        ${r.note ? `<p class="sub" style="margin-top:10px">${esc(r.note)}</p>` : ''}
      </section>` : ''}
      ${rec && !r ? `<div class="recs detail">${(state.open.add(rec.id), recCard(c, rec, false, { detail: true }))}</div>` : rec ? `<section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">The recommendation</span><span>What the fox saw, and why it suggested this.</span></div></div>
        <div class="why"><p><b>What we saw.</b> ${esc(rec.observe)}</p><p><b>What it means.</b> ${esc(rec.means)}</p>${rec.expect ? `<p><b>What to expect.</b> ${esc(rec.expect)}</p>` : ''}</div>
        <div class="todo" style="margin-top:12px">${I.arrow}<span>${esc(rec.action)}</span></div>
        ${rec.evidence ? evidenceTable(c, rec) : ''}
      </section>` : r && r.sample ? `<p class="sub">This is an earlier action from the sample history; the full recommendation isn’t stored for it.</p>` : ''}
      ${footnote()}</div>`;
  }

  /* ---------- PDF preview: what the downloaded brief looks like ---------- */
  function pageBrief(c) {
    const R0 = chgRange(c);
    return `<div class="page brief-page">
      <div class="ph"><div><a href="#overview" class="ex-more" style="padding:0;margin-bottom:6px">← Back to Executive</a><h1>PDF preview</h1><p>This is what the brief for ${esc(c.cfg.name)}, ${esc(rangeText(c, R0))}, looks like when downloaded. To change the period, pick a different date range on the Executive page.</p></div></div>
      <div class="paper"><iframe title="Brief preview" scrolling="no" srcdoc="${esc(briefHtml(c, true))}"></iframe></div>
    </div>`;
  }
