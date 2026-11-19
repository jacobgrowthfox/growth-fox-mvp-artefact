  /* ---------- Overview: executive summary (how it's going, what we've done, what to do) ----------
     Everything is tied to the date range in the page header. The headline adapts: when the business
     metric is down, it leads with what to do; when it's up, with what the foxes have done. Wording
     stays correlational ("while"), never causal ("because"). */
  let downloads = null; // the brief is previewed on #brief rather than downloaded
  const pctAbs = v => Math.abs(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0) + '%';
  const rose = (v, up = 'rose', down = 'fell') => Math.abs(v) < 0.005 ? 'held level' : `${v > 0 ? up : down} ${pctAbs(v)}`;
  function execData(c) {
    const e = isEcom(c), R0 = chgRange(c), days = c.hist.days, L = R0.to - R0.from + 1;
    let pf = R0.from - L, pt = R0.from - 1;
    const cm = cmpOf(R0);
    if (cm === 'yoy') { const ly = d => { const x = days[d].date; return dayIdx(c, new Date(x.getFullYear() - 1, x.getMonth(), x.getDate()).getTime()); }; pf = ly(R0.from); pt = ly(R0.to); }
    const cur = days.slice(R0.from, R0.to + 1), prevD = cm !== 'none' && pf >= 0 ? days.slice(pf, pt + 1) : null;
    const tot = sl => { const t = { rev: sum(sl.map(x => x.revenue || 0)), conv: sum(sl.map(x => x.conv)), paid: sum(sl.map(x => x.lc)), spend: sum(sl.map(x => x.spend)), meet: sum(sl.map(x => x.meetings || 0)), n: sl.length }; t.other = t.conv - t.paid; t.aov = t.conv ? t.rev / t.conv : 0;
      for (const k of ['sessions', 'newRev', 'retRev', 'appRev', 'webRev']) t[k] = sum(sl.map(x => x[k] || 0));
      t.cr = t.sessions ? t.conv / t.sessions : 0; t.stores = c.cfg.stores || 1; t.opr = t.conv / t.stores;
      t.clicks = sum(sl.map(x => x.clicks || 0)); t.ccr = t.clicks ? t.conv / t.clicks : NaN; return t; };
    const main = t => e ? t.rev : t.conv;
    let a = tot(cur), b = prevD ? tot(prevD) : null, basis = 'prev';
    if (!b && cm !== 'none' && cur.length >= 28) { b = tot(cur.slice(0, 14)); a = Object.assign(tot(cur.slice(-14)), {}); basis = 'within'; }
    const A = tot(cur); // the whole period, for the headline number
    const chg = b && main(b) > 0 ? main(a) / main(b) - 1 : null;
    const mood = chg == null ? 'none' : chg >= 0 ? 'up' : 'down';
    const ch = k => b && b[k] ? a[k] / b[k] - 1 : null;
    // What we've done in the period
    const marks = rangeMarks(c), ver = marks.filter(r => r.status === 'verified'), pending = marks.filter(r => r.status === 'adopted' || r.status === 'requested');
    const savedMo = sum(ver.filter(r => r.unit === 'saved').map(r => r.measuredPerDay || 0)) * 30;
    const revMo = sum(ver.filter(r => r.unit === 'revenue').map(r => r.measuredPerDay || 0)) * 30;
    const fixes = ver.filter(r => r.unit === 'dq' || r.unit === 'cov').length;
    const money = r => (r.unit === 'saved' || r.unit === 'revenue') ? (r.measuredPerDay || 0) : -1;
    const topDone = ver.slice().sort((x, y) => money(y) - money(x)).slice(0, 3);
    // What to do now
    const todo = activeRecs(c).slice(0, 3); // ranked like All actions, period findings included
    const worthMo = sum(todo.filter(r => r.confidence !== 'investigate' && r.unit !== 'cov' && r.agent !== 'tracking').map(r => r.valuePerDay || 0)) * 30;
    return { e, R0, L, A, a, b, basis, chg, mood, ch, marks, ver, pending, savedMo, revMo, fixes, topDone, todo, worthMo, prevRange: prevD ? { from: pf, to: pt } : null, ytd: cm === 'yoy', dq: execDq(c, R0) };
  }
  // Data quality: today's score (as on the Data Fox page), and its move since the start of the period
  // (points, from the first week of the period that has scored data).
  function execDq(c, R0) {
    if (!c.data.eps.length) return { now: null, chg: null }; // no endpoints connected for this client
    const now = GF.dqOverall(c.cfg, c.data), D = c.hist.days;
    const st = D.slice(R0.from, R0.to + 1).filter(d => d.dq != null).slice(0, 7);
    const chg = st.length && R0.to - R0.from >= 6 ? now - sum(st.map(d => d.dq)) / st.length : null;
    return { now, chg: chg == null || Math.abs(chg) < 0.5 ? (chg == null ? null : 0) : chg };
  }
  const dqPill = (q, cls = 'dpill') => q.chg == null ? '' : `<span class="${cls} ${q.chg === 0 ? 'flat' : q.chg > 0 ? 'up' : 'down'}">${q.chg === 0 ? '± 0 pts' : `${q.chg > 0 ? '↑' : '↓'} ${Math.round(Math.abs(q.chg))} pt${Math.round(Math.abs(q.chg)) === 1 ? '' : 's'}`}</span>`;
  function execText(c, x) {
    // One headline and one line. Up: what went well. Down: how to improve.
    const { e, L, A, chg, mood, ver, marks, todo, topDone, basis } = x;
    const metric = e ? 'Revenue' : 'Leads', val = e ? m(A.rev, c) : n0(A.conv) + ' leads';
    const span = { '90': '3 months', '180': '6 months', '365': '12 months' }[x.R0.preset];
    const cmp = basis === 'within' ? 'in the latest two weeks, compared with the first two' : x.ytd ? 'on the same period last year' : `on the previous ${span || L + ' days'}`;
    const lc = t => lcTitle(c, t);
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    let head, sub;
    if (mood === 'none') {
      head = e ? `Revenue was ${val} in this period.` : `You had ${val} in this period.`;
      sub = todo[0] ? `Next: ${lc(todo[0].title)}.` : '';
    } else if (mood === 'up') {
      head = `${metric} ${e ? 'is' : 'are'} up ${pctAbs(chg)} ${cmp}.`;
      const t = topDone[0];
      sub = t ? `What went well: ${lc(t.title)} (${doneValue(c, t)})${ver.length > 1 ? `, plus ${pl(ver.length - 1, 'more verified change')}` : ''}.`
        : marks.length ? `What went well: ${pl(marks.length, 'change')} put in place, now being verified.` : (() => {
          const ds = (e ? [['orders', x.ch('conv')], ['the average order value', x.ch('aov')]] : [['leads', x.ch('conv')], ['booked meetings', x.ch('meet')]]).filter(d => d[1] > 0.005).sort((p, q) => q[1] - p[1]);
          return ds.length ? `What went well: ${ds[0][0]} rose ${pctAbs(ds[0][1])}${ds[1] ? ` and ${ds[1][0]} ${pctAbs(ds[1][1])}` : ''}.` : '';
        })();
    } else {
      head = `${metric} ${e ? 'is' : 'are'} down ${pctAbs(chg)} ${cmp}.`;
      const t = todo[0];
      sub = t ? `To improve: ${lc(t.title)} (${todoValue(c, t)})${todo.length > 1 ? `, then ${pl(todo.length - 1, 'more action')} below` : ''}.` : 'Nothing open from your foxes right now.';
    }
    return { head, sub, metric, val };
  }
  // Lower-case a title's first letter to use it mid-sentence, unless it starts with a campaign name.
  const lcTitle = (c, t) => { t = t.replace(/\.$/, ''); return c.cfg.campaigns.some(k => t.startsWith(k.name)) ? t : t.replace(/^./, ch => ch.toLowerCase()); };
  function doneValue(c, r) {
    if (r.bet) return r.successCheck === 'failed' ? 'Check not met' : 'Success check passed';
    if (r.unit === 'saved' || r.unit === 'revenue') return `${m((r.measuredPerDay || 0) * 30, c)}/month ${r.unit === 'saved' ? 'saved' : 'revenue'}`;
    if (r.unit === 'dq') return `+${ptsTxt(r.measuredPerDay ?? r.expectedPerDay)} data quality`;
    if (r.unit === 'cov') return `+${r.measuredPerDay ?? r.expectedPerDay} pts coverage`;
    return 'Verified';
  }
  function todoValue(c, r) {
    if (r.impactTxt) return r.impactTxt.imp;
    if (r.ticket) return 'Ticket · ' + shortImpact(c, r);
    if (r.confidence === 'investigate') return 'To investigate';
    if (r.bet) return `${betRange(c, r, 'month')}/month`;
    if (r.unit === 'cov') return `+${r.cov} pts coverage`;
    if (r.agent === 'tracking') return `+${ptsTxt(r.dq)} data quality`;
    return `≈ ${m((r.valuePerDay || 0) * 30, c)}/month`;
  }
  /* How revenue breaks down for this business. Each model's parts multiply (×) or add (+) up to revenue exactly;
     the client picks the one that matches how they run the business. */
  const REV_MODELS = {
    oa: { short: 'Orders and order value', why: 'The simplest view, and a good default for most shops: are you selling more often, or selling bigger baskets?', name: 'Orders × average order value', parts: [['conv', 'Orders', '×'], ['aov', 'Average order value']] },
    scv: { short: 'Traffic, conversion and order value', why: 'For when you invest in both traffic and the site: separates “more visitors” from “better at turning them into buyers”.', name: 'Sessions × conversion rate × average order value', parts: [['sessions', 'Sessions', '×'], ['cr', 'Conversion rate', '×'], ['aov', 'Average order value']] },
    nr: { short: 'New and returning customers', why: 'Shows whether growth comes from winning new customers or from bringing existing ones back.', name: 'New customers + returning customers', parts: [['newRev', 'New-customer revenue', '+'], ['retRev', 'Returning-customer revenue']] },
    sto: { short: 'Restaurants and orders per restaurant', why: 'For chains: separates growth from opening restaurants from growth in each existing restaurant.', name: 'Restaurants × orders per restaurant × average order value', parts: [['stores', 'Restaurants', '×'], ['opr', 'Orders per restaurant', '×'], ['aov', 'Average order value']] },
    ch: { short: 'App and web', why: 'Shows which ordering channel your revenue comes through.', name: 'App revenue + web revenue', parts: [['appRev', 'App revenue', '+'], ['webRev', 'Web revenue']] },
    lead: { short: 'Clicks and click-to-lead rate', why: 'Shows whether leads moved because you bought more clicks, or because more clicks turned into leads.', name: 'Ad clicks × click-to-lead rate', parts: [['clicks', 'Ad clicks', '×'], ['ccr', 'Click-to-lead rate']] },
  };
  const revFmt = (c, k, v) => ['aov', 'newRev', 'retRev', 'appRev', 'webRev'].includes(k) ? m(v, c) : k === 'cr' || k === 'ccr' ? (isFinite(v) ? (v * 100).toFixed(2) + '%' : '—') : n0(v);
  function revModelOf(c) {
    const list = c.cfg.revModels || ['oa'];
    state.revModel = state.revModel || {};
    const id = state.revModel[c.cfg.id] || store.get('revmodel.' + c.cfg.id, null);
    return list.includes(id) ? id : list[0];
  }
  function setRevModel(c, id) {
    state.revModel = state.revModel || {}; state.revModel[c.cfg.id] = id; store.set('revmodel.' + c.cfg.id, id);
    if (db && ledgerMode === 'shared') { try { db.doc(`clients/${c.cfg.id}/settings/revenue`).set({ model: id, at: Date.now(), by: uid }).catch(() => {}); } catch (e) { /* kept locally */ } }
  }
  /* Executive page as three sections that tell one story: how it's going (revenue as the business model's
     equation), what we've done (changes on the revenue line), what to do (the next actions). When revenue is
     down, "what to do" comes second; when it's up, "what we've done" does. */
  function execSummary(c) {
    const x = execData(c), { e, A, ch } = x, rm = REV_MODELS[revModelOf(c)];
    const what = e ? 'Revenue' : 'Leads', val = e ? m(A.rev, c) : n0(A.conv) + ' leads';
    const vs = x.basis === 'within' ? 'the first two weeks of the period' : x.ytd ? 'the same period last year' : 'the period before';
    const out = [e ? (x.chg == null ? `${what} was ${val} in this period.` : `${what} was ${val}, ${Math.abs(x.chg) < 0.005 ? 'level with' : `${x.chg > 0 ? 'up' : 'down'} ${pctAbs(x.chg)} on`} ${vs}.`)
      : (x.chg == null ? `There were ${val} in this period.` : `There were ${val}, ${Math.abs(x.chg) < 0.005 ? 'level with' : `${x.chg > 0 ? 'up' : 'down'} ${pctAbs(x.chg)} on`} ${vs}.`)];
    if (e && x.chg != null) {
      const parts = rm.parts.filter(([k]) => k !== 'stores').map(([k, l]) => { const v = ch(k); return v == null ? null : `${l.toLowerCase().replace(/^./, s => s.toUpperCase())} ${rose(v)}`; }).filter(Boolean);
      const signs = rm.parts.filter(([k]) => k !== 'stores').map(([k]) => Math.sign(ch(k) || 0));
      if (parts.length) out.push(parts.length === 2 ? `${parts[0]} ${signs[0] === signs[1] ? 'and' : 'while'} ${parts[1].replace(/^./, s => s.toLowerCase())}.` : parts.slice(0, -1).join(', ').replace(/, ([A-Z])/g, (_, s) => ', ' + s.toLowerCase()) + ` and ${parts[parts.length - 1].replace(/^./, s => s.toLowerCase())}.`);
    }
    if (x.marks.length) out.push(`${x.marks.length} change${x.marks.length === 1 ? ' was' : 's were'} put in place${x.ver.length ? `, ${x.ver.length} verified so far` : ''}${x.savedMo ? `, saving about ${m(x.savedMo, c)} a month` : ''}${x.revMo ? `${x.savedMo ? ' and' : ','} adding an estimated ${m(x.revMo, c)} a month` : ''}.`);
    else out.push('No changes were put in place in this period.');
    if (x.todo[0]) out.push(`${x.todo.length} action${x.todo.length === 1 ? ' is' : 's are'} waiting, starting with: ${lcTitle(c, x.todo[0].title)}.`);
    return out.join(' ');
  }
  function execSections(c) {
    const x = execData(c), { e, A, ch, mood } = x;
    const pill = (k, inv) => { const v = ch(k); if (v == null) return ''; const good = inv ? v < 0 : v > 0; return `<span class="dpill ${Math.abs(v) < 0.005 ? 'flat' : good ? 'up' : 'down'}">${v > 0 ? '↑' : v < 0 ? '↓' : '±'} ${pctAbs(v)}</span>`; };
    const cmpLbl = x.basis === 'within' ? 'Latest 2 weeks vs first 2 weeks' : x.prevRange ? `vs ${rangeText(c, x.prevRange)}` : cmpOf(x.R0) === 'none' ? 'No comparison' : 'No earlier period yet';
    const rm = REV_MODELS[revModelOf(c)];
    const focus = on => on ? '<em class="sec-focus">Focus</em>' : '';
    // 1. How it's going
    // Each part of the formula as a small scorecard, like the fox cards: value, change and its own trend line.
    const partDay = { clicks: d => [d.clicks || 0, 1], ccr: d => [d.conv, d.clicks || 0], conv: d => [d.conv, 1], aov: d => [d.revenue, d.conv], sessions: d => [d.sessions, 1], cr: d => [d.conv, d.sessions], newRev: d => [d.newRev, 1], retRev: d => [d.retRev, 1], appRev: d => [d.appRev, 1], webRev: d => [d.webRev, 1], stores: () => [c.cfg.stores || 1, 1], opr: d => [d.conv / (c.cfg.stores || 1), 1] };
    const partSeries = (k, from, to) => { const D = c.hist.days, out = [], f = partDay[k], win = to - from + 1 > 14 ? 7 : 1; for (let i = from; i <= to; i++) { let a = 0, b = 0; for (let j = Math.max(0, i - win + 1); j <= i; j++) { const [p, q] = f(D[j]); a += p; b += q; } out.push({ v: a / b }); } return out; };
    const tiles = rm.parts.map(([k, l, op]) => `<div class="eq-tile"><span class="eq-l">${esc(l)}</span><span class="eq-v"><b>${revFmt(c, k, A[k])}</b>${pill(k)}</span>${spark(partSeries(k, x.R0.from, x.R0.to), x.prevRange ? partSeries(k, x.prevRange.from, x.prevRange.from + (x.R0.to - x.R0.from)) : null, 'var(--primary)')}</div>${op ? `<i class="eq-op">${op}</i>` : ''}`).join('');
    const editor = state.revEdit ? `<div class="rev-pick" role="radiogroup" aria-label="Choose your growth formula">
        <div class="rp-h"><b>Choose your growth formula</b><span>Pick the one that matches how you run the business. Every option adds or multiplies up to revenue exactly, and it’s saved for everyone on this account.</span></div>
        <div class="rp-grid">${(c.cfg.revModels || ['oa']).map(id => { const md = REV_MODELS[id], on = id === revModelOf(c); return `<button type="button" role="radio" aria-checked="${on}" class="rp-opt" data-act="revmodel" data-k="${id}">
          <span class="rp-top"><i class="rp-radio"></i><span class="rp-name">${esc(md.short || md.name)}</span>${on ? '<em>Current</em>' : ''}</span>
          <span class="rp-eq"><b>Revenue</b> = ${md.parts.map(([, l, op]) => `<span class="rp-chip">${esc(l)}</span>${op ? `<i>${op}</i>` : ''}`).join('')}</span>
          <span class="rp-why">${esc(md.why || '')}</span></button>`; }).join('')}</div>
      </div>` : '';
    const P = periods(c);
    const foxCards = ['paid', 'analytics', 'engineer'].filter(k => !c.cfg.foxes || c.cfg.foxes.includes(k)).map(key => {
      const fm = metricFor(c, key);
      const sv = series(c, fm.of, P.R, P.O), spv = P.prev ? series(c, fm.of, P.R, P.O + P.R) : null;
      const v = fm.now ? fm.now() : fm.total(P.cur), pv = P.prev ? fm.total(P.prev) : null;
      return `<a class="foxcard" href="#${key}" style="${foxVars(key)}"><span class="who">${foxSvg(key)}<span><b>${FOX[key].name}</b><span>${esc(fm.label)}</span></span></span>
        <span class="v"><strong>${fm.fmt(v)}</strong>${dpill(fm.total(P.cur), pv, fm.invert)}</span>${spark(sv, spv, FOX[key].c)}</a>`;
    }).join('');
    const how = `<section class="sec ex-sec" aria-label="How it's going">
        <div class="sec-head"><div class="lead"><span class="eyebrow">How it’s going</span></div></div>
        <div class="how-top">
          <div class="how-main">
            <div class="ex-big ex-val">${e ? m(A.rev, c) : n0(A.conv)}${x.chg == null ? '' : `<span class="dpill ${mood === 'up' ? 'up' : mood === 'down' ? 'down' : 'flat'}">${x.chg > 0 ? '↑' : '↓'} ${pctAbs(x.chg)}</span>`}</div>
            <div class="ex-cmp"><span>${e ? 'Revenue' : 'Leads'} · ${esc(cmpLbl)}</span></div>
          </div>
          <div class="how-foxes">${foxCards}</div>
        </div>
        <div class="how-model">
          <div class="rev-h"><div><span>Growth formula</span><small class="how-note">${e ? 'Revenue' : 'Leads'} = ${rm.parts.map(([, l, op]) => esc(l) + (op ? ` ${op} ` : '')).join('')}. Which part moved?</small></div><button type="button" class="rev-edit" data-act="revedit" aria-expanded="${!!state.revEdit}">${state.revEdit ? 'Close' : 'Change formula'}</button></div>
          <div class="eq">${tiles}</div>
          ${editor}
        </div>
      </section>`;
    // 2. What we've done: the changes on the revenue line
    const doneSec = changedSection(c, {
      title: `What we’ve done${focus(mood === 'up')}`,
      sub: `<b>${x.marks.length}</b> change${x.marks.length === 1 ? '' : 's'} put in place · <b>${x.ver.length}</b> verified${x.pending.length ? ` · ${x.pending.length} being verified` : ''}${x.savedMo ? ` · <b>${m(x.savedMo, c)}</b>/month saved` : ''}${x.revMo ? ` · <b>${m(x.revMo, c)}</b>/month revenue (est.)` : ''}${(n => n ? ` · <b>${n}</b> change${n === 1 ? '' : 's'} logged by you` : '')(rangeYours(c).length)}`,
    });
    // 3. What to do
    const cards = x.todo.map((r, i) => `<a class="todo-card" href="#action/${encodeURIComponent(r.id)}" style="${foxVars(r.fox)}">
        <div class="tc-h">${foxSvg(r.fox)}<span class="foxchip">${esc(FOX[r.fox].name)}</span><span class="tc-n">${i + 1}</span></div>
        <b class="tc-t">${esc(r.title)}</b>${r.fox === 'paid' ? `<span>${checkChip(r)}</span>` : ''}
        <span class="tc-v">${esc(todoValue(c, r))}</span>
        <span class="tc-m">${r.minutes ? `About ${r.minutes} min · ` : ''}Review ${I.arrow}</span></a>`).join('');
    const todo = `<section class="sec ex-sec" aria-label="What to do">
        <div class="sec-head"><div class="lead"><span class="eyebrow">What to do${focus(mood === 'down')}</span><span>${x.worthMo ? `The top ${x.todo.length} actions are worth about <b>${m(x.worthMo, c)}</b> a month.` : `The top ${x.todo.length} actions right now, ranked by impact, confidence and effort.`}</span></div><a href="#recs" style="font-size:15px;font-weight:500">All actions</a></div>
        ${cards ? `<div class="todo-grid">${cards}</div>` : '<div class="empty">Nothing open right now.</div>'}
      </section>`;
    return how + (mood === 'down' ? todo + doneSec : doneSec + todo);
  }
  function execSection(c) {
    const x = execData(c), t = execText(c, x), { e, A, a, b, ch, mood } = x;
    const pill = (k, inv) => { const v = ch(k); if (v == null) return ''; const good = inv ? v < 0 : v > 0; return `<span class="dpill ${Math.abs(v) < 0.005 ? 'flat' : good ? 'up' : 'down'}">${v > 0 ? '↑' : v < 0 ? '↓' : '±'} ${pctAbs(v)}</span>`; };
    const rm = REV_MODELS[revModelOf(c)];
    const formula = `<div class="rev-f"><div class="rev-h"><span>Business model</span><button type="button" class="rev-edit" data-act="revedit" aria-expanded="${!!state.revEdit}">${state.revEdit ? 'Done' : 'Edit'}</button></div>
        <div class="rev-eq"><span class="rev-tot">${e ? 'Revenue' : 'Leads'}</span><i>=</i>${rm.parts.map(([, l, op]) => `<span class="rev-part">${esc(l)}</span>${op ? `<i>${op}</i>` : ''}`).join('')}</div>
        <small>Your growth formula: the parts your revenue is made of. Each one is tracked below, so you can see which part moved.</small></div>`;
    const editor = state.revEdit ? `<div class="rev-pick" role="group" aria-label="How your revenue breaks down"><span>How does your revenue break down?</span>${(c.cfg.revModels || ['oa']).map(id => `<button type="button" data-act="revmodel" data-k="${id}" aria-pressed="${id === revModelOf(c)}">${esc(REV_MODELS[id].name)}</button>`).join('')}<small>Every option adds or multiplies up to revenue exactly. Saved for everyone on this account.</small></div>` : '';
    const rows = (e ? rm.parts.map(([k, l]) => [l, revFmt(c, k, A[k]), k]) : [['Leads', n0(A.conv), 'conv'], ['Booked meetings', n0(A.meet), 'meet']])
      .map(([l, v, k, inv]) => `<div class="ex-row"><span>${l}</span><b>${v}</b>${pill(k, inv)}</div>`).join('')
      + `<div class="ex-row ctx"><span>Ad spend</span><b>${m(A.spend, c)}</b>${ch('spend') == null ? '' : `<span class="dpill flat">${ch('spend') > 0 ? '↑' : '↓'} ${pctAbs(ch('spend'))}</span>`}</div>`
      + `<div class="ex-row"><span>Data quality</span><b>${Math.round(x.dq.now)}/100</b>${dqPill(x.dq)}</div>`;
    const cmpLbl = x.basis === 'within' ? 'Latest 2 weeks vs first 2 weeks' : x.prevRange ? `vs ${rangeText(c, x.prevRange)}` : cmpOf(x.R0) === 'none' ? 'No comparison' : 'No earlier period yet';
    const how = `<div class="ex-card">
        <span class="ex-k">How it’s going</span>
        <div class="ex-big ex-val">${t.val}${x.chg == null ? '' : `<span class="dpill ${mood === 'up' ? 'up' : mood === 'down' ? 'down' : 'flat'}">${x.chg > 0 ? '↑' : '↓'} ${pctAbs(x.chg)}</span>`}</div>
        <div class="ex-cmp"><span>${esc(cmpLbl)}</span></div>
        ${e ? formula + editor : ''}
        <div class="ex-rows">${rows}</div>
      </div>`;
    const doneList = x.topDone.map(r => `<li style="${foxVars(r.fox)}"><i class="fdot"></i><span>${esc(r.title)}<small>${esc(FOX[r.fox].name)} · ${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></span><b>${esc(doneValue(c, r))}</b></li>`).join('');
    const done = `<div class="ex-card ${mood === 'up' ? 'focus' : ''}">
        <span class="ex-k">What we’ve done${mood === 'up' ? '<em>Focus</em>' : ''}</span>
        <div class="ex-big">${x.marks.length} <span>change${x.marks.length === 1 ? '' : 's'} put in place</span></div>
        <div class="ex-cmp"><span>${x.ver.length} verified${x.pending.length ? ` · ${x.pending.length} being verified` : ''}${x.savedMo ? ` · ${m(x.savedMo, c)}/month saved` : ''}</span></div>
        ${doneList ? `<ol class="ex-list">${doneList}</ol>` : '<p class="ex-empty">No changes put in place in this period.</p>'}
        <button class="ex-more" data-act="doneopen-go">See all changes ${I.arrow}</button>
      </div>`;
    const todoList = x.todo.map((r, i) => `<li style="${foxVars(r.fox)}"><i class="fnum">${i + 1}</i><span><a href="#action/${encodeURIComponent(r.id)}">${esc(r.title)}</a><small>${esc(FOX[r.fox].name)}${r.minutes ? ` · ~${r.minutes} min` : ''}</small></span><b>${esc(todoValue(c, r))}</b></li>`).join('');
    const todo = `<div class="ex-card ${mood === 'down' ? 'focus' : ''}">
        <span class="ex-k">What to do${mood === 'down' ? '<em>Focus</em>' : ''}</span>
        <div class="ex-big">${x.worthMo ? `≈ ${m(x.worthMo, c)} <span>a month on the table</span>` : `${x.todo.length} <span>open action${x.todo.length === 1 ? '' : 's'}</span>`}</div>
        <div class="ex-cmp"><span>The top ${x.todo.length || ''} actions right now, ranked by impact, confidence and effort</span></div>
        ${todoList ? `<ol class="ex-list">${todoList}</ol>` : '<p class="ex-empty">Nothing open right now.</p>'}
        <a class="ex-more" href="#recs">All actions ${I.arrow}</a>
      </div>`;
    return `<section class="sec exec mood-${mood}" aria-label="Executive summary">
        <div class="ex-grid">${how}${done}${todo}</div>
      </section>`;
  }
