  /* ---------- Stage 1 baseline UI: the business profile (Executive Fox) and the readiness panel (Paid Media Fox) ---------- */

  /* Business profile: five questions, each can be answered, skipped or "I'm not sure". Edited one question at a time;
     state.bpQ = the open question (1-5) or null; state.bpDraft holds unsaved list entries while it is open. */
  const BP_STATE = { answered: ['good', 'Answered'], partial: ['info', 'Partly answered'], skipped: ['neutral', 'Skipped'], unsure: ['neutral', 'Not sure'], empty: ['warn', 'Not answered'] };
  const bpRaw = c => { const p = GF.profileOf(c.cfg.id), o = {}; for (const f of GF.PROFILE_FIELDS) o[f] = { state: p.fields[f].state, value: p.fields[f].value }; return o; };
  function bpAnswer(c, p, f) {
    const x = p.fields[f], v = x.value;
    if (x.state !== 'answered') return '';
    if (f === 'services') return v.map(s => s.name).join(', ');
    if (f === 'priorities') { const pr = p.fields.services.value.filter(s => s.priority).map(s => s.name); return pr.length ? pr.join(', ') : 'No priorities'; }
    if (f === 'objectives') return v.map(k => GF.OBJECTIVES[k].label).join(', ');
    if (f === 'customers') return v;
    if (f === 'markets') return v.map(m => m.name === m.country ? m.name : `${m.name} (${m.country})`).join(', ');
    if (f === 'customerValue') return `about ${m(v.amount, c)}`;
    return '';
  }
  // A question's state: the worst of its fields (question 4 asks two)
  const qState = (p, q) => { const st = q.fields.map(f => p.fields[f].state); return st.every(s => s === 'answered') ? 'answered' : st.includes('answered') ? 'partial' : st.includes('empty') ? 'empty' : st[0]; };
  function bpEditor(c, q, p) {
    const D = state.bpDraft || {}, ro = ledgerMode === 'readonly';
    let body = '';
    if (q.n === 1) {
      const list = D.services || [];
      body = `<ul class="bp-list">${list.map((s, i) => `<li><span>${esc(s.name)}</span><button type="button" class="btn icon" data-act="bp-del" data-k="services" data-i="${i}" aria-label="Remove ${esc(s.name)}">${I.x}</button></li>`).join('') || '<li class="bp-none">No services yet.</li>'}</ul>
        <div class="bp-add"><label class="grow">Add a product or service<input name="newsvc" maxlength="80" placeholder="e.g. Couples therapy"></label><button type="button" class="btn" data-act="bp-add-svc">Add</button></div>`;
    } else if (q.n === 2) {
      const list = D.services || [];
      body = list.length ? `<fieldset class="bp-checks"><legend class="sr">Priority services</legend>${list.map((s, i) => `<label class="chk"><input type="checkbox" name="prio" value="${i}" ${s.priority ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}</fieldset><small class="bp-hint">Tick the ones you want more customers for. Leave the rest unticked.</small>`
        : `<p class="bp-hint">Add your products or services first (question 1), then pick the ones to prioritize.</p>`;
    } else if (q.n === 3) {
      const on = new Set(p.fields.objectives.value);
      body = `<fieldset class="bp-checks"><legend class="sr">Business goals</legend>${Object.entries(GF.OBJECTIVES).map(([k, o]) => `<label class="chk"><input type="checkbox" name="obj" value="${k}" ${on.has(k) ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}</fieldset>`;
    } else if (q.n === 4) {
      const list = D.markets || [];
      body = `<label>Who are your customers?<textarea name="customers" rows="2" maxlength="300" placeholder="e.g. Adults in Copenhagen looking for therapy in English">${esc(D.customers != null ? D.customers : p.fields.customers.value || '')}</textarea></label>
        <div class="bp-sub">Where can you serve them?</div>
        <ul class="bp-list">${list.map((x, i) => `<li><span>${esc(x.name === x.country ? x.name + ' (the whole country)' : `${x.name}, ${x.country}`)}</span><button type="button" class="btn icon" data-act="bp-del" data-k="markets" data-i="${i}" aria-label="Remove ${esc(x.name)}">${I.x}</button></li>`).join('') || '<li class="bp-none">No places yet.</li>'}</ul>
        <div class="bp-add"><label class="grow">Town, region or country<input name="newplace" maxlength="80" placeholder="e.g. Copenhagen, or leave empty for the whole country"></label>
          <label>Country<select name="newcountry" class="select">${GF.COUNTRY_NAMES.map(n => `<option ${n === 'Denmark' ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><button type="button" class="btn" data-act="bp-add-mkt">Add</button></div>`;
    } else if (q.n === 5) {
      const v = p.fields.customerValue.value;
      body = `<label>Roughly what one new customer is worth to you, in ${c.cfg.currency === 'DKK' ? 'kroner' : 'euros'}<input name="value" type="number" min="1" step="1" inputmode="numeric" value="${v ? v.amount : ''}" placeholder="e.g. 4000"></label><small class="bp-hint">Optional. A rough figure is fine; we only use it for advice that spends more.</small>`;
    }
    return `<form class="bp-form" data-form="bp" data-q="${q.n}" aria-label="${esc(q.q)}">${body}<p class="dlg-err" role="alert" hidden></p>
      <div class="actions">${ro ? '' : `<button type="button" class="btn ghost" data-act="bp-cancel">Cancel</button><button type="button" class="btn" data-act="bp-mark" data-st="skipped">Skip</button><button type="button" class="btn" data-act="bp-mark" data-st="unsure">I’m not sure</button><button type="submit" class="btn primary">Save${q.n < 5 ? ' and next' : ''}</button>`}</div></form>`;
  }
  function profileSection(c) {
    const p = GF.profileOf(c.cfg.id), ro = ledgerMode === 'readonly';
    const rows = GF.PROFILE_QUESTIONS.map(q => {
      const st = qState(p, q), [cls, lbl] = BP_STATE[st], open = state.bpQ === q.n;
      const ans = q.fields.map(f => bpAnswer(c, p, f)).filter(Boolean).join(' · ');
      return `<li class="bp-q${open ? ' open' : ''}"><div class="bp-row"><span class="bp-n">${q.n}</span><div class="bp-txt"><b>${esc(q.q)}</b>${ans ? `<span class="bp-ans">${esc(ans)}</span>` : ''}</div>
        <span class="chip ${cls}">${lbl}</span>${ro || open ? '' : `<button type="button" class="btn" data-act="bp-open" data-q="${q.n}">${st === 'answered' ? 'Edit' : 'Answer'}</button>`}</div>${open ? bpEditor(c, q, p) : ''}</li>`;
    }).join('');
    return `<section class="sec bp" id="profile" aria-label="Business profile">
      <div class="sec-head"><div class="lead"><span class="eyebrow">Business profile</span><span>Five questions about your business. Skip any of them, or say you’re not sure. The foxes use your answers only for the checks that need them.</span></div></div>
      <ol class="bp-qs">${rows}</ol></section>`;
  }
  async function bpSave(c, patch) {
    const doc = Object.assign(bpRaw(c), patch, { updatedAt: Date.now(), by: uid || null });
    const ok = await saveProfile(c.cfg.id, doc);
    if (!ok) { toast(ledgerMode === 'readonly' ? 'You can view the profile, but not change it.' : 'Couldn’t save your answer. Please try again.'); return false; }
    return true;
  }
  function bpOpen(c, n) {
    const p = GF.profileOf(c.cfg.id);
    state.bpQ = n; state.bpDraft = { services: p.fields.services.value.map(s => Object.assign({}, s)), markets: p.fields.markets.value.map(x => Object.assign({}, x)), customers: null };
  }
  const bpNext = (c, n) => { if (n < 5) bpOpen(c, n + 1); else { state.bpQ = null; state.bpDraft = null; } };
  const bpFocus = () => { const f = document.querySelector('.bp-form'); (f && f.querySelector('input, textarea, button'))?.focus({ preventScroll: false }); };
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-act^="bp-"]'); if (!b) return;
    const c = ctx(), act = b.dataset.act, f = b.closest('form'), D = state.bpDraft || (state.bpDraft = {});
    if (act === 'bp-open') { bpOpen(c, +b.dataset.q); render(); bpFocus(); return; }
    if (act === 'bp-cancel') { const n = state.bpQ; state.bpQ = null; state.bpDraft = null; render(); document.querySelector(`[data-act="bp-open"][data-q="${n}"]`)?.focus(); return; }
    if (act === 'bp-add-svc') { const v = (f.newsvc.value || '').trim().slice(0, 80); if (!v) return; if (!(D.services || []).some(s => s.name.toLowerCase() === v.toLowerCase())) (D.services = D.services || []).push({ name: v, priority: false }); render(); document.querySelector('.bp-form [name="newsvc"]')?.focus(); return; }
    if (act === 'bp-add-mkt') { if (f.customers) D.customers = f.customers.value; const country = f.newcountry.value, name = (f.newplace.value || '').trim().slice(0, 80) || country; (D.markets = D.markets || []).push({ name, country }); render(); document.querySelector('.bp-form [name="newplace"]')?.focus(); return; }
    if (act === 'bp-del') { if (f && f.customers) D.customers = f.customers.value; (D[b.dataset.k] || []).splice(+b.dataset.i, 1); render(); bpFocus(); return; }
    if (act === 'bp-mark') {
      const q = GF.PROFILE_QUESTIONS.find(x => x.n === state.bpQ); if (!q) return;
      const patch = {}; for (const fl of q.fields) patch[fl] = { state: b.dataset.st, value: null };
      if (await bpSave(c, patch)) { toast(b.dataset.st === 'skipped' ? 'Skipped. You can answer it any time.' : 'Saved as “not sure”.'); bpNext(c, q.n); render(); bpFocus(); }
    }
  });
  document.addEventListener('submit', async ev => {
    const f = ev.target; if (!f.dataset || f.dataset.form !== 'bp') return;
    ev.preventDefault();
    const c = ctx(), n = +f.dataset.q, D = state.bpDraft || {}, p = GF.profileOf(c.cfg.id), err = f.querySelector('.dlg-err');
    const fail = t => { err.textContent = t; err.hidden = false; };
    let patch = {};
    if (n === 1) {
      const extra = (f.newsvc.value || '').trim(); const list = (D.services || []).slice(); if (extra && !list.some(s => s.name.toLowerCase() === extra.toLowerCase())) list.push({ name: extra.slice(0, 80), priority: false });
      if (!list.length) return fail('Add at least one product or service, or choose Skip.');
      patch = { services: { state: 'answered', value: list } };
    } else if (n === 2) {
      const list = (D.services || []); if (!list.length) return fail('Add your products or services first (question 1), or choose Skip.');
      const on = new Set([...f.querySelectorAll('[name="prio"]:checked')].map(x => +x.value));
      patch = { services: { state: p.fields.services.state, value: list.map((s, i) => ({ name: s.name, priority: on.has(i) })) }, priorities: { state: 'answered', value: null } };
    } else if (n === 3) {
      const v = [...f.querySelectorAll('[name="obj"]:checked')].map(x => x.value); if (!v.length) return fail('Pick at least one goal, or choose Skip.');
      patch = { objectives: { state: 'answered', value: v } };
    } else if (n === 4) {
      const cust = (f.customers.value || '').trim(), list = (D.markets || []).slice(), place = (f.newplace.value || '').trim();
      if (place) list.push({ name: place.slice(0, 80), country: f.newcountry.value });
      if (!cust && !list.length) return fail('Describe your customers or add a place you serve, or choose Skip.');
      // Each part is its own field: an empty part stays unanswered, so only the checks that need it wait.
      patch = { customers: cust ? { state: 'answered', value: cust } : { state: p.fields.customers.state, value: p.fields.customers.value }, markets: list.length ? { state: 'answered', value: list } : { state: p.fields.markets.state, value: p.fields.markets.value } };
    } else if (n === 5) {
      const v = +f.value.value; if (!(v > 0)) return fail('Enter a number above 0, or choose “I’m not sure”.');
      patch = { customerValue: { state: 'answered', value: { amount: Math.round(v) } } };
    }
    if (await bpSave(c, patch)) { toast('Saved.'); bpNext(c, n); render(); bpFocus(); }
  });

  /* Readiness (Paid Media Fox, Google Ads): Stage 1, the three categories, their gates and the advisory checks. */
  const RD_ST = { critical: ['bad', 'Critical'], attention: ['warn', 'Needs attention'], ok: ['good', 'Passed'], not_assessed: ['neutral', 'Not assessed'] };
  const CAT_CHIP = { critical: 'bad', attention: 'warn', ready: 'good', not_assessed: 'neutral' };
  function gateRow(c, g) {
    const [cls, lbl] = RD_ST[g.status], ev = g.evidence, id = 'rd-' + g.id;
    const need = g.missing.profile.length ? `<p class="rd-need">${I.alert}<span>Needs your answer to ${g.missing.profile.map(f => `“${esc((GF.PROFILE_QUESTIONS.find(q => q.fields.includes(f)) || {}).q || f)}”`).join(' and ')} in the <a href="#overview" data-act="bp-jump">business profile</a>.</span></p>` : '';
    const parts = (g.parts || []).length ? `<ul class="rd-parts">${g.parts.map(p => `<li><i class="rd-dot ${RD_ST[p.status][0]}"></i>${esc(p.label)}<span>${esc(RD_ST[p.status][1])}</span></li>`).join('')}</ul>` : '';
    const dataNote = !g.missing.profile.length && g.missing.data.length ? `<p class="rd-data">Not in the Google Ads export yet: ${esc(g.missing.data.join('; '))}.</p>` : '';
    const camps = ev.campaigns.length ? `<p class="rd-camps">Campaigns: ${esc(ev.campaigns.join(', '))}</p>` : '';
    const table = ev.rows.length ? `<details class="rd-ev"><summary>Show evidence (${ev.rows.length} row${ev.rows.length === 1 ? '' : 's'})</summary><div class="tbl-wrap"><table><thead><tr>${ev.cols.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${ev.rows.map(r => `<tr>${r.map((v, i) => `<td>${typeof v === 'number' ? ((ev.money || []).includes(i) ? m(v, c) : n0(v)) : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : '';
    return `<li class="rd-gate" id="${id}"><div class="rd-gh"><b>${esc(g.name)}</b><small>${esc(g.id)}${g.interim ? ' · interim check' : ''}</small><span class="chip ${cls}">${lbl}</span></div>
      ${g.summary ? `<p class="rd-sum">${esc(g.summary)}</p>` : ''}${camps}${need}${parts}${dataNote}${table}</li>`;
  }
  function readinessSection(c) {
    const rd = c.readiness; if (!rd) return '';
    const s = rd.stage, nameOf = id => (rd.gates.find(g => g.id === id) || {}).name || id;
    const cats = rd.categories.map(k => {
      const why = k.state === 'not_assessed' ? (k.passed.length ? `Passed: ${k.passed.map(nameOf).join(', ')}. Not assessed yet: ${k.notAssessed.map(nameOf).join(', ')}.` : `Not assessed yet: ${k.notAssessed.map(nameOf).join(', ')}.`)
        : `${k.state === 'ready' ? 'Passed' : 'Failing'}: ${k.contributing.map(nameOf).join(', ')}.${k.notAssessed.length ? ` Not assessed yet: ${k.notAssessed.map(nameOf).join(', ')}.` : ''}`;
      const adv = k.advisory.length ? `<p class="rd-adv"><b>Advisory</b> (doesn’t change the state): ${k.advisory.map(a => `${esc(a.name)}${a.status === 'attention' ? ` <span class="rd-n">${esc(a.summary.replace(/\.$/, ''))}</span>` : ''}`).join(' · ')}</p>` : '';
      return `<div class="rd-cat st-${k.state}"><div class="rd-h"><div><b>${esc(k.name)}</b><span>${esc(k.q)}</span></div><span class="chip ${CAT_CHIP[k.state]}">${esc(k.label)}</span></div>
        <p class="rd-why">${esc(why)}</p><ul class="rd-gates">${k.gates.map(g => gateRow(c, g)).join('')}</ul>${adv}</div>`;
    }).join('');
    return `<section class="sec rd" aria-label="Stage 1 readiness">
      <div class="sec-head"><div class="lead"><span class="eyebrow">Stage ${s.stage} · ${esc(s.name)}${s.provisional ? ' · provisional' : ''}</span><span>${esc(s.reason)}${s.provisional ? ` Provisional while ${s.notAssessed.length} gate${s.notAssessed.length === 1 ? ' is' : 's are'} not assessed.` : ''} Only the gates below set a category’s state.</span></div></div>
      <div class="rd-grid">${cats}</div></section>`;
  }
  document.addEventListener('click', ev => { if (ev.target.closest('[data-act="bp-jump"]')) setTimeout(() => document.getElementById('profile')?.scrollIntoView({ block: 'start' }), 60); });
