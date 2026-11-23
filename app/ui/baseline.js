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

  /* Maturity (Paid Media Fox, Google Ads): where the account sits on the three stages, and why. The Stage 1 bar is split into
     the three readiness categories, each filled by its share of passed baseline checks. The checks themselves show up as
     actions in the optimization areas below, so this section only summarizes. */
  const MAT_STAGES = [
    { n: 1, name: 'Establish Baseline', lead: 'First we make sure your tracking, campaign structure and delivery are sound. Growth advice comes after that.' },
    { n: 2, name: 'Experimentation' },
    { n: 3, name: 'Optimization' },
  ];
  const CAT_TONE = { critical: 'bad', attention: 'warn', ready: 'good', not_assessed: 'idle' };
  const CAT_SHORT = { conversion: 'Conversions', structure: 'Structure & relevance', delivery: 'Delivery' };
  // What a failing check means, in a few words (the check names describe the passing state)
  const GATE_ISSUE = { 'DF-1': 'No recent conversions', 'GC-1': 'Bidding on the wrong conversions', 'GC-2': 'Something blocks delivery',
    'GC-3': 'Ads reach areas you don’t serve', 'GC-4': 'Ad group without a usable ad', 'GC-5': 'Bidding works against delivery' };
  const I_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function matCatLine(k) {
    const bad = k.gates.filter(g => g.status === 'critical' || g.status === 'attention');
    const ask = [...new Set(k.gates.flatMap(g => g.missing.profile))], data = k.gates.filter(g => g.status === 'not_assessed' && !g.missing.profile.length);
    const lines = [];
    for (const g of bad) lines.push(`<li class="${g.status === 'critical' ? 'bad' : 'warn'}"><i></i>${esc(GATE_ISSUE[g.id] || g.name)}</li>`);
    if (ask.length) lines.push(`<li class="ask"><i></i><span>Needs your answer: ${esc(ask.map(f => GF.FIELD_LABEL[f]).join(', '))} · <a href="#overview" data-act="bp-jump">Answer</a></span></li>`);
    if (data.length) lines.push(`<li class="idle"><i></i><span title="${esc(data.flatMap(g => g.missing.data).join('; '))}">${data.length === 1 ? '1 check' : `${data.length} checks`} waiting for more Google Ads data</span></li>`);
    if (!lines.length) lines.push(`<li class="good"><i></i>All checks passed</li>`);
    return `<ul class="mat-why">${lines.join('')}</ul>`;
  }
  function readinessSection(c) {
    const rd = c.readiness; if (!rd) return '';
    const s = rd.stage, cats = rd.categories, all = rd.gates, passed = all.filter(g => g.status === 'ok').length;
    const pct = Math.round(100 * passed / Math.max(1, all.length));
    // Stage 1 bar: one segment per category, sized by its number of checks, filled by its passed share
    const segs = cats.map(k => { const n = k.gates.length, p = k.gates.filter(g => g.status === 'ok').length;
      return `<span class="mat-seg t-${CAT_TONE[k.state]}" style="flex:${n}" title="${esc(`${k.name}: ${p} of ${n} checks passed`)}"><span class="mat-fill" style="width:${n ? Math.round(100 * p / n) : 0}%"></span></span>`; }).join('');
    const stages = MAT_STAGES.map(st => {
      const cur = st.n === s.stage, done = st.n < s.stage;
      return `<li class="mat-stage${cur ? ' cur' : done ? ' done' : ' next'}"${cur ? ' aria-current="step"' : ''}>
        <div class="mat-lbl"><span class="mat-num">${done ? I.check : st.n}</span><div><b>${esc(st.name)}</b><small>${cur ? 'You are here' : done ? 'Done' : `${I_LOCK}Opens after Stage ${st.n - 1}`}</small></div></div>
        <div class="mat-bar">${cur ? segs : `<span class="mat-seg t-${done ? 'good' : 'off'}" style="flex:1"><span class="mat-fill" style="width:${done ? 100 : 0}%"></span></span>`}</div></li>`;
    }).join('');
    const tiles = cats.map(k => { const n = k.gates.length, p = k.gates.filter(g => g.status === 'ok').length;
      return `<div class="mat-cat t-${CAT_TONE[k.state]}"><div class="mat-ch"><b>${esc(k.name)}</b><span class="mat-state">${esc(k.label)}</span></div>
        <div class="mat-pips" aria-label="${p} of ${n} checks passed">${k.gates.map(g => `<i class="p-${g.status}" title="${esc(g.name)}"></i>`).join('')}<span>${p} of ${n} passed</span></div>
        ${matCatLine(k)}</div>`; }).join('');
    const cur = MAT_STAGES.find(x => x.n === s.stage);
    return `<section class="sec mat" aria-label="Account maturity">
      <div class="mat-top"><div><span class="eyebrow">Account maturity</span><h2>Stage ${s.stage} of ${MAT_STAGES.length}: ${esc(cur.name)}</h2>
        <p>${esc(cur.lead)} ${passed} of ${all.length} baseline checks passed so far.</p></div>
        <div class="mat-score"><b>${pct}%</b><span>of the baseline</span>${s.provisional ? `<em title="${esc(`${s.notAssessed.length} checks can’t be assessed yet`)}">Provisional</em>` : ''}</div></div>
      <ol class="mat-track">${stages}</ol>
      <div class="mat-cats">${tiles}</div>
      <a class="mat-more" href="#area-setup" data-act="mat-areas">See the actions in the optimization areas ${I.arrow}</a>
    </section>`;
  }
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-act="mat-areas"]'); if (a) { ev.preventDefault(); document.getElementById('area-setup')?.closest('.sec')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  });
  document.addEventListener('click', ev => { if (ev.target.closest('[data-act="bp-jump"]')) setTimeout(() => document.getElementById('profile')?.scrollIntoView({ block: 'start' }), 60); });
