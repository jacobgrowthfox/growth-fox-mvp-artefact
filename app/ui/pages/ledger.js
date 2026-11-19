  /* ---------- Recommendation ledger ---------- */
  // Every action someone acted on (shared store) plus the sample client's earlier history.
  function ledgerRows(c) {
    const now = Date.now();
    const hist = (c.cfg.history || []).map(h => Object.assign({}, h, {
      id: 'hist-' + h.id, sample: true, at: now - h.daysAgo * GF.DAY,
      verifiedAt: h.verifiedDaysAgo != null ? now - h.verifiedDaysAgo * GF.DAY : null,
    }));
    const live = Object.entries(c.status).filter(([, s]) => s && s.title && s.status !== 'promoted').map(([id, s]) => Object.assign({ id }, s));
    return live.concat(hist).sort((a, b) => b.at - a.at);
  }
  /* ---------- Changes you logged ----------
     Things that move results that the foxes can't see (a promotion, a launch, a price change). They sit on the
     same timeline as the foxes' actions, as context: shown next to the results, never credited with them. */
  const CH_CAT = { promo: 'Promotion or discount', price: 'Price change', launch: 'Launch', site: 'Website or app change', stock: 'Stock-out', pr: 'PR or press', offline: 'Offline campaign', other: 'Other' };
  const CH_AFFECTS = ['Google Ads', 'Meta', 'Email', 'Website', 'App', 'Offline'];
  const SAMPLE_CHANGES = {
    nordlys: [{ daysAgo: 19, cat: 'launch', title: 'New winter blend launched', ch: '' }, { daysAgo: 9, cat: 'promo', title: '20% off all beans for a long weekend', ch: '' }, { daysAgo: 3, cat: 'stock', title: 'Best-selling espresso blend sold out', ch: 'Website' }],
    flamehouse: [{ daysAgo: 20, cat: 'launch', title: 'Plant-based burger added to the menu', ch: '' }, { daysAgo: 11, cat: 'promo', title: '2-for-1 burgers on Tuesdays in the app', ch: 'App' }, { daysAgo: 4, cat: 'offline', title: 'Local radio campaign in three cities', ch: 'Offline' }],
  };
  function changeRows(c) {
    const samples = (SAMPLE_CHANGES[c.cfg.id] || []).map((s, i) => Object.assign({ id: 'sample-ch-' + i, sample: true, at: GF.END - s.daysAgo * GF.DAY + 12 * 3600e3 }, s));
    const mine = Object.entries(chg(c.cfg.id)).filter(([, v]) => v && v.title).map(([id, v]) => Object.assign({ id }, v));
    return mine.concat(samples).sort((a, b) => b.at - a.at);
  }
  const isoDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function changeForm() {
    if (ledgerMode === 'readonly') return '<p class="sub">You can view these changes, but not add to them.</p>';
    const dr = state.chDraft || {};
    return `<form class="chform" data-form="change" aria-label="Log a change">
      <label>Date<input type="date" name="date" required max="${isoDay(GF.END + GF.DAY)}" value="${esc(dr.date || isoDay(GF.END))}"></label>
      <label>Kind<select name="cat" class="select">${Object.entries(CH_CAT).map(([k, l]) => `<option value="${k}" ${dr.cat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="grow">What changed<input name="title" required maxlength="90" placeholder="e.g. 20% off sitewide for Black Friday" value="${esc(dr.title || '')}"></label>
      <label>Affects<select name="ch" class="select"><option value="">The whole business</option>${CH_AFFECTS.map(a => `<option ${dr.ch === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <button class="btn primary" type="submit">Log change</button></form>`;
  }
  function ledgerStats(c, rows) {
    const verified = rows.filter(r => r.status === 'verified');
    const adoptedAll = rows.filter(r => ['adopted', 'requested', 'verified', 'not_verified'].includes(r.status));
    const decided = rows.filter(r => !['snoozed', 'expected', 'closed'].includes(r.status));
    const checked = rows.filter(r => r.status === 'verified' || r.status === 'not_verified');
    const money = verified.filter(r => (r.unit === 'saved' || r.unit === 'revenue') && !r.bet);
    const judged = verified.filter(r => r.unit !== 'none' && r.expectedPerDay), passed = judged.filter(r => r.bet ? r.successCheck !== 'failed' : r.measuredPerDay >= 0.85 * r.expectedPerDay).length;
    const exp = money.reduce((s, r) => s + (r.expectedPerDay || 0), 0), meas = money.reduce((s, r) => s + (r.measuredPerDay || 0), 0);
    return {
      decisioned: verified.reduce((s, r) => s + (r.spendChangedPerDay || 0), 0) * 30,
      adoption: decided.length ? adoptedAll.length / decided.length : null,
      verifiedShare: checked.length ? verified.length / checked.length : null,
      hitRate: exp ? meas / exp : null, passed, judgedN: judged.length,
      verified: verified.length, adopted: adoptedAll.length, decidedN: decided.length, checkedN: checked.length,
      pending: rows.filter(r => r.status === 'adopted' || r.status === 'requested').length,
    };
  }
  const STATUS_CHIP = {
    verified: s => `<span class="chip good">${I.check}Verified</span>`,
    not_verified: s => `<span class="chip warn">${I.alert}Not verified</span>`,
    adopted: s => `<span class="chip info">${I.clock}Adopted · verifying</span>`,
    requested: s => `<span class="chip info">${I.team}With our team</span>`,
    snoozed: s => `<span class="chip neutral">${I.clock}Snoozed</span>`,
    expected: s => `<span class="chip neutral">${I.target}Expected level</span>`,
    closed: s => `<span class="chip neutral">${I.check}Closed as expected</span>`,
    dismissed: s => `<span class="chip neutral">${I.x}Dismissed</span>`,
  };
  function pageLedger(c) {
    const rows = ledgerRows(c), st = ledgerStats(c, rows);
    const d = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
    const readonly = ledgerMode === 'readonly';
    const body = rows.map(r => {
      const live = !r.sample;
      const due = r.verifyDue;
      let verif = '';
      if (r.status === 'verified') verif = `Verified ${d(r.verifiedAt)}${r.note ? `<small>${esc(r.note)}</small>` : ''}`;
      else if (r.status === 'not_verified') verif = `Checked ${d(r.verifiedAt || r.at)}${r.note ? `<small>${esc(r.note)}</small>` : ''}`;
      else if (r.status === 'adopted' || r.status === 'requested') verif = `Due ${d(due)}<small>${r.agent === 'volume' || r.agent === 'gap' ? 'Our team reports back' : r.agent === 'connect' ? 'When the source starts syncing' : (r.agent === 'tracking' || r.agent === 'engineer') ? 'When the check passes on the daily run' : `Against the ${esc(GF.PLATFORMS[r.platform] || r.platform)} change history`}</small>`;
      else if (r.status === 'dismissed') verif = `<small style="margin:0">Reason: ${esc(r.reason || '—')}</small>`;
      else if (r.status === 'snoozed') verif = `<small style="margin:0">Back ${d(r.until)}</small>`;
      else if (r.status === 'closed') verif = `Closed ${d(r.at)}<small>${esc(r.reason || '')}${r.logged ? ' · logged as your change' : ''}</small>`;
      else if (r.status === 'expected') verif = `<small style="margin:0">Baseline ${(r.baseline * 100).toFixed(1)}% · flagged again only below it</small>`;
      const measured = r.bet && r.status === 'verified' ? `<span class="meas ${r.successCheck === 'failed' ? 'low' : 'good'}">${checkText(r)}</span><small>success check</small>` : r.status === 'verified' && r.unit !== 'none'
        ? `<span class="meas ${r.measuredPerDay >= 0.85 * r.expectedPerDay ? 'good' : 'low'}">${esc(impactText(c, r.unit, r.measuredPerDay))}</span> ${om(r.unit === 'revenue' ? 'modeled' : 'observed')}`
        : '<span style="color:var(--faint)">—</span>';
      const acts = !live || readonly ? '' : (r.status === 'adopted' || r.status === 'requested')
        ? `${c.cfg.real ? '' : `<button class="btn" data-act="verify" data-id="${esc(r.id)}" title="Sample data: runs the verification check now instead of waiting ${r.verifyDays || 7} days">Run verification (demo)</button>`}<button class="btn ghost" data-act="undo" data-id="${esc(r.id)}">Undo</button>`
        : r.status === 'verified' || r.status === 'not_verified' ? '' : `<button class="btn ghost" data-act="undo" data-id="${esc(r.id)}">Reopen</button>`;
      return `<tr style="${foxVars(r.fox)}">
        <td style="white-space:nowrap">${d(r.at)}</td>
        <td class="act"><b><span class="foxdot"></span>${esc(r.title)}</b><small>${esc(FOX[r.fox].name)} · ${esc(AGENT[r.agent] || '')} · ${esc(r.owner || 'You')}${r.sample ? ' · earlier history' : ''}</small>${r.success ? `<small>${I.target.replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px;margin-right:4px"')}${esc(r.success)}</small>` : ''}</td>
        <td class="act ver">${STATUS_CHIP[r.status] ? STATUS_CHIP[r.status](r) : esc(r.status)}<small style="margin-top:6px">${verif}</small>${acts ? `<div class="row-actions" style="justify-content:flex-start;margin-top:8px">${acts}</div>` : ''}</td>
        <td class="r" style="white-space:nowrap">${r.unit === 'none' ? '—' : r.bet ? `${esc(betRange(c, r))}/day<small>estimate</small>` : esc(impactText(c, r.unit, r.expectedPerDay))}</td>
        <td class="r" style="white-space:nowrap">${measured}</td></tr>`;
    }).join('');
    const mode = ledgerMode === 'shared' ? 'Shared with everyone who can open this page.' : ledgerMode === 'readonly' ? 'Shared. You can view it, but not change it.' : 'Saved in this browser only, because the shared store isn’t available here.';
    return `<div class="page">
      <div class="ph"><div><h1>Recommendation ledger</h1><p>The record of every action: what we recommended, what you did, and what it actually achieved. An action counts only once we’ve verified the change in the platform and measured the result.</p></div><span class="aside">${esc(mode)}</span></div>
      ${statusStrip(c)}
      <div class="kpis">
        <div class="kpi hero"><div class="label">Decisioned spend</div><div class="value">${m(st.decisioned, c)}<span style="font-size:15px;font-weight:500"> / month</span></div><small>Ad spend changed by ${st.verified} adopted and verified actions. Our north-star.</small></div>
        <div class="kpi"><div class="label">Adoption rate</div><div class="value">${pct(st.adoption)}</div><small>${st.adopted} of ${st.decidedN} actions acted on were adopted</small></div>
        <div class="kpi"><div class="label">Verified</div><div class="value">${pct(st.verifiedShare)}</div><small>${st.verified} of ${st.checkedN} checked · ${st.pending} still verifying</small></div>
        <div class="kpi"><div class="label">Success checks passed</div><div class="value">${st.judgedN ? `${st.passed} of ${st.judgedN}` : '—'}</div><small>Verified actions that met their success check. Feeds back into our rules.</small></div>
      </div>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">How an action moves through the ledger</span><span>Observe → Diagnose → Prioritize → Act → Measure → Learn</span></div></div>
        <div class="loop"><span><b>1</b>Recommended</span><span><b>2</b>You adopt, or ask our team</span><span><b>3</b>We find the change in the platform</span><span><b>4</b>We measure against the success metric</span><span><b>5</b>Verified outcome tunes the rules</span></div></section>
      <section class="sec" id="yourchanges"><div class="sec-head"><div class="lead"><span class="eyebrow">Changes you made</span><span>Things that move your results that the foxes can’t see, such as a promotion, a launch or a price change. They show as lettered tags along the bottom of the Executive chart, next to the foxes’ actions.</span></div></div>
        ${changeForm()}
        <div class="tbl-wrap" style="margin-top:14px"><table class="ltbl"><thead><tr><th>Date</th><th>Change</th><th>Kind</th><th>Affects</th><th class="r"></th></tr></thead><tbody>${changeRows(c).map(r => `<tr>
          <td style="white-space:nowrap">${d(r.at)}</td>
          <td class="act"><b>${esc(r.title)}</b><small>${r.sample ? 'Sample entry' : 'Logged by you'}</small></td>
          <td style="white-space:nowrap">${esc(CH_CAT[r.cat] || 'Other')}</td>
          <td style="white-space:nowrap">${esc(r.ch || 'The whole business')}</td>
          <td class="r">${r.sample || readonly ? '' : `<button class="btn ghost" data-act="ch-remove" data-id="${esc(r.id)}">Remove</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No changes logged yet.</td></tr>'}</tbody></table></div></section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">All entries</span><span>Newest first. ${c.cfg.real ? 'Real client: checking adopted actions against the Google Ads change history isn’t automated yet, so they stay “verifying” until our team checks them.' : 'Sample data: “Run verification” does now what our nightly check does after the waiting period.'}</span></div></div>
        <div class="tbl-wrap"><table class="ltbl"><thead><tr><th>Date</th><th>Action</th><th>Status and verification</th><th class="r">Expected</th><th class="r">Result</th></tr></thead><tbody>${body || '<tr><td colspan="5" class="empty">Nothing in the ledger yet.</td></tr>'}</tbody></table></div></section>
      ${footnote()}</div>`;
  }
  // Sample-data stand-in for the nightly verification job: finds the change and measures the outcome.
  function simulateVerify(c, id) {
    const s = c.status[id]; if (!s) return;
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const now = Date.now(), plat = GF.PLATFORMS[s.platform] || s.platform;
    if (s.agent === 'investigate' || s.unit === 'none') {
      setStatus(c, id, Object.assign({}, s, { status: 'verified', verifiedAt: now, measuredPerDay: 0, note: s.agent === 'connect' ? 'Connected and syncing daily.' : 'Our team reported back with the explanation.' }));
      return;
    }
    if (s.unit === 'dq' || s.unit === 'cov') {
      setStatus(c, id, Object.assign({}, s, { status: 'verified', verifiedAt: now, measuredPerDay: s.expectedPerDay, note: 'Check passed on the next daily run.' }));
      return;
    }
    if (h % 7 === 0) {
      setStatus(c, id, Object.assign({}, s, { status: 'not_verified', verifiedAt: now, measuredPerDay: null, note: `No matching change found in the ${plat} change history.` }));
      return;
    }
    if (s.bet) { const ok = h % 4 !== 0; setStatus(c, id, Object.assign({}, s, { status: 'verified', verifiedAt: now, measuredPerDay: null, successCheck: ok ? 'passed' : 'failed', note: `Change found in the ${plat} change history. Success check ${ok ? 'passed' : 'not met'}: ${s.success}` })); return; }
    const factor = s.unit === 'revenue' ? 0.65 + (h % 30) / 100 : 0.86 + (h % 14) / 100;
    setStatus(c, id, Object.assign({}, s, { status: 'verified', verifiedAt: now, measuredPerDay: s.expectedPerDay * factor, note: `Change found in the ${plat} change history.` }));
  }
