  /* ---------- Real clients ---------- */
  const dLong = s => new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  // What the numbers are, and the one thing worth knowing about them (from the data, not assumed).
  function realNote(c) {
    if (!c.cfg.real) return '';
    const cfg = c.cfg, D = c.hist.days, lc = cfg.lastConversion;
    const since = lc ? D.filter(d => d.date > new Date(lc + 'T23:59:59')) : D;
    const spentSince = sum(since.map(d => d.spend)), lastSpend = D.slice().reverse().find(d => d.spend > 0);
    const silent = spentSince > 0 && (!lc || (GF.END - new Date(lc + 'T12:00:00').getTime()) / GF.DAY > 14);
    const note = `<p><b style="font-weight:600">Real data from Google Ads${cfg.dataThrough ? `, through ${esc(dLong(cfg.dataThrough))}` : ''}.</b> Leads here are ${esc(cfg.leadSource)}: the only lead source connected so far, so there’s no first-party count to check them against yet.</p>`;
    const warn = silent ? `<p style="margin-top:8px"><b style="font-weight:600">Google Ads hasn’t recorded a conversion ${lc ? `since ${esc(dLong(lc))}` : 'at all'}</b>, while the account has spent ${m(spentSince, c)} since${lastSpend ? ` (most recently on ${esc(lastSpend.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))})` : ''}. Check that conversion tracking still works before trusting cost per lead.</p>` : '';
    return `<div class="held" style="background:${silent ? 'var(--warn-soft)' : 'var(--primary-soft)'}">${silent ? I.alert : I.check}<div>${note}${warn}</div></div>`;
  }
  function pageNotConnected(c, kind) {
    const f = FOX[kind];
    const what = kind === 'analytics'
      ? { does: 'checks every endpoint your numbers depend on, parameter by parameter: the Google tag, GA4 and your booking or contact forms.', needs: ['Access to your Google Tag Manager container', 'Access to your GA4 property', 'Where your bookings and enquiries land (booking system, CRM or inbox)'] }
      : { does: 'makes sure every source is connected and data keeps arriving, and flags dips, spikes and gaps between browser and server counts.', needs: ['Access to your GA4 property', 'Your booking system or CRM', 'Any other ad platform you use, such as Meta'] };
    return `<div class="page" style="${foxVars(kind)}">
      <section class="fox-hero" aria-label="${esc(f.name)}"><div class="id">${foxSvg(kind, true)}<div><h1>${esc(f.name)}</h1><div class="role">${esc(f.role)}</div></div></div>
        <div><span class="eyebrow">Not connected yet</span><p class="sum">The ${esc(f.name)} ${esc(what.does)} For ${esc(c.cfg.name)}, only Google Ads is connected so far, so there’s nothing here to check yet.</p></div></section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Connected</span></div></div>
        <div class="sources">${c.cfg.sources.map(s => `<div class="src"><div><b style="font-weight:500">${esc(s.name)}</b><small>${esc(s.kind)} · ${esc(s.sync)}</small></div><span class="chip good">${I.check}Connected</span></div>`).join('')}</div></section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">To switch it on</span><span>Setup is an expert service: tell us to go ahead and we connect these.</span></div></div>
        <ul style="margin:0;padding-left:20px;display:grid;gap:6px">${what.needs.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>
    </div>`;
  }
  function pageWaiting(cfg) {
    const st = realStatus[cfg.id];
    const msg = st === 'nodb' ? `${cfg.name}’s numbers are real client data, kept in this page’s shared store. They load when the page is opened in claude.ai.`
      : st === 'empty' ? `No data has been exported for ${cfg.name} yet.`
      : st === 'error' ? `${cfg.name}’s data couldn’t be read. You may not have access to it.`
      : `Loading ${cfg.name}’s Google Ads data…`;
    return `<div class="page"><div class="ph"><div><h1>${esc(cfg.name)}</h1><p>${esc(msg)}</p></div></div></div>`;
  }
