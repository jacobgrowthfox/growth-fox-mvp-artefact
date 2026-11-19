  /* ---------- Render ---------- */
  function render() {
    const cfg0 = GF.CLIENTS.find(x => x.id === state.clientId) || GF.CLIENTS[0];
    if (cfg0.real && !GF.REAL[cfg0.id]) { // a real client whose data hasn't arrived (or can't, outside claude.ai)
      const sel = $('#client');
      if (!sel.options.length) sel.innerHTML = GF.CLIENTS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
      sel.value = cfg0.id;
      $('#client-name').textContent = cfg0.name;
      $('#client-badge').textContent = cfg0.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      $('#client-sub').textContent = cfg0.segment + ' · real data';
      const note = $('#sample-note'); note.className = 'sample real'; note.textContent = 'Real client data from Google Ads.';
      $('#nav').innerHTML = '';
      $('#app').innerHTML = pageWaiting(cfg0);
      return;
    }
    const c = ctx();
    const sel = $('#client');
    if (!sel.options.length) sel.innerHTML = GF.CLIENTS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    sel.value = c.cfg.id;
    $('#client-name').textContent = c.cfg.name;
    $('#client-badge').textContent = c.cfg.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    $('#client-sub').textContent = (c.cfg.segment || (isEcom(c) ? 'E-commerce' : 'B2B lead-gen')) + (c.cfg.real ? ' · real data' : ' · sample data');
    const note = $('#sample-note');
    note.className = c.cfg.real ? 'sample real' : 'sample';
    note.textContent = c.cfg.real ? `Real data: Google Ads only${c.cfg.dataThrough ? `, through ${dLong(c.cfg.dataThrough)}` : ''}. The other foxes connect later.` : 'Sample data. Every number here is generated, not a real client’s.';
    const pg = state.page;
    const actFox = pg === 'action' ? (((c.model.recs.find(x => x.id === state.actId) || ledgerRows(c).find(x => x.id === state.actId) || {}).fox) || 'overview') : null;
    const cur = p => pg === p || (p === 'overview' && pg === 'brief') || (p === 'analytics' && pg === 'param') || (pg === 'action' && (actFox === p || (p === 'overview' && !['paid', 'analytics', 'engineer'].includes(actFox)))) ? 'aria-current="page"' : '';
    const anaAlert = c.cfg.checks.some(x => x.status === 'fail' && x.group !== 'tags');
    const engAlert = activeRecs(c).some(r => r.ticket);
    $('#nav').innerHTML = `<span class="grp">Your foxes</span>
      <a href="#overview" ${cur('overview')}>${foxSvg('executive')}Executive</a>
      <a href="#paid" ${cur('paid')}>${foxSvg('paid')}Paid Media</a>
      <a href="#analytics" ${cur('analytics')}>${foxSvg('analytics')}Data${anaAlert ? '<span class="alert-dot" title="A data check is failing"></span>' : ''}</a>
      <a href="#engineer" ${cur('engineer')}>${foxSvg('engineer')}Engineer${engAlert ? '<span class="alert-dot" title="A connection needs attention"></span>' : ''}</a>
      <span class="grp">Work</span>
      <a href="#recs" ${cur('recs')}>${I.list}All actions<span class="count">${activeRecs(c).length}</span></a>
      <a href="#ledger" ${cur('ledger')}>${I.book}Ledger</a>
`;
    const off = k => c.cfg.foxes && !c.cfg.foxes.includes(k);
    $('#app').innerHTML = (pg === 'analytics' || pg === 'param') && off('analytics') ? pageNotConnected(c, 'analytics') : pg === 'engineer' && off('engineer') ? pageNotConnected(c, 'engineer') : pg === 'param' ? pageParam(c, state.param) : pg === 'recs' ? pageRecs(c) : pg === 'ledger' ? pageLedger(c) : pg === 'analytics' ? (state.ep ? pageEndpoint(c, state.ep) : pageData(c)) : pg === 'paid' ? (state.ch ? pageChannel(c, state.ch) : pageMedia(c)) : pg === 'engineer' ? pageEngineer(c) : pg === 'brief' ? pageBrief(c) : pg === 'action' ? pageAction(c, state.actId) : FOX[pg] ? pageFox(c, pg) : pageOverview(c);
    const paper = document.querySelector('.paper iframe');
    if (paper) { const fit = () => { try { const pg = paper.contentDocument.querySelector('.page'); if (pg) paper.style.height = Math.ceil(pg.getBoundingClientRect().bottom + 8) + 'px'; } catch (e) { /* keep default */ } }; paper.onload = () => { fit(); setTimeout(fit, 800); }; window.addEventListener('resize', fit, { passive: true }); }
    glanceLoop(document.querySelector('.fox-hero svg.fox, .ph-fox svg.fox'), { first: 1500, rest: [1500, 3200] }); // the big fox looks around on its own
    const picked = document.querySelector('.foxcard[aria-pressed="true"] svg.fox'); // Overview: the selected fox comes alive
    if (picked) { if (state.bouncePick) bounce(picked); glanceLoop(picked, { first: state.bouncePick ? 260 : 600 }); }
    state.bouncePick = false;
  }

  /* ---------- Fox motion: random idle glances, and a bounce on hover ----------
     Parallax sells the turn: eyes travel furthest, nose and muzzle less, the head turns a few degrees.
     Each cycle picks fresh random directions (never the same twice in a row), with random holds. */
  const DIRS = [[-2.6, 0.2], [2.6, 0.3], [0.3, -2.1], [0, 1.9], [-1.9, -1.8], [1.9, -1.8], [-1.4, 1.7], [1.5, 1.7]];
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rnd = (a, b) => a + Math.random() * (b - a);
  function glanceLoop(svg, { first = 150, rest = [700, 1500] } = {}) {
    if (reduceMotion() || !svg || !svg.animate) return;
    const parts = { eyes: svg.querySelector('.eyes'), nose: svg.querySelector('.nose'), muz: svg.querySelector('.muz'), head: svg.querySelector('.head') };
    if (!parts.eyes || !parts.head) return;
    const token = {}; svg._glance = token;
    let last = -1;
    const pick = () => { let i; do { i = Math.floor(Math.random() * DIRS.length); } while (i === last); last = i; return DIRS[i]; };
    const cycle = delay => {
      if (svg._glance !== token || !svg.isConnected) return;
      const steps = [{ t: 0, d: [0, 0] }]; let t = delay;
      if (delay) steps.push({ t, d: [0, 0] });
      const n = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) {
        const d = pick();
        t += rnd(320, 480); steps.push({ t, d });
        t += rnd(700, 1600); steps.push({ t, d });
        if (k === n - 1 || Math.random() < 0.5) { t += rnd(320, 450); steps.push({ t, d: [0, 0] }); t += rnd(rest[0], rest[1]); steps.push({ t, d: [0, 0] }); }
      }
      const kf = f => steps.map(s => ({ offset: s.t / t, transform: f(s.d), easing: 'ease-in-out' }));
      const anims = [
        parts.eyes.animate(kf(([x, y]) => `translate(${x}px, ${y}px)`), t),
        parts.nose && parts.nose.animate(kf(([x, y]) => `translate(${x * 0.62}px, ${y * 0.55}px)`), t),
        parts.muz && parts.muz.animate(kf(([x, y]) => `translate(${x * 0.3}px, ${y * 0.27}px)`), t),
        parts.head.animate(kf(([x, y]) => `rotate(${x * 1.5}deg) translate(${x * 0.2}px, ${y * 0.2}px)`), t),
      ].filter(Boolean);
      svg._anims = anims;
      anims[0].onfinish = () => cycle(0);
    };
    cycle(first);
  }
  function stopGlances(svg) {
    if (!svg) return; svg._glance = null;
    for (const an of svg._anims || []) { // ease back to centre from wherever it was looking
      const el = an.effect && an.effect.target, cur = el ? getComputedStyle(el).transform : 'none';
      an.cancel();
      if (el && cur && cur !== 'none') el.animate([{ transform: cur }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }
    svg._anims = [];
  }
  function bounce(svg) {
    if (reduceMotion() || !svg || !svg.animate) return;
    svg.animate([
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(-2px) scale(0.98, 1.03)', offset: 0.35 },
      { transform: 'translateY(0) scale(1.03, 0.97)', offset: 0.65 },
      { transform: 'translateY(0) scale(1, 1)' },
    ], { duration: 420, easing: 'ease-out' });
  }
  document.addEventListener('mouseover', ev => {
    const a = ev.target.closest && ev.target.closest('.nav a, .how-foxes .foxcard, .fox-hero'); if (!a || (ev.relatedTarget && a.contains(ev.relatedTarget))) return;
    const svg = a.querySelector('svg.fox'); if (!svg) return;
    bounce(svg); glanceLoop(svg, { first: 260 });
  });
  document.addEventListener('mouseout', ev => {
    const a = ev.target.closest && ev.target.closest('.nav a, .how-foxes .foxcard'); if (!a || (ev.relatedTarget && a.contains(ev.relatedTarget))) return;
    stopGlances(a.querySelector('svg.fox'));
  });
  let toastTimer, pendingGoto = null;
  function toast(msg, undo) {
    const t = $('#toast'); t.hidden = false;
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="toast-undo">Undo</button>' : ''}`;
    if (undo) $('#toast-undo').onclick = () => { undo(); t.hidden = true; };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }
