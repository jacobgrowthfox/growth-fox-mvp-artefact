  /* ---------- Engineer Fox: is every source connected, and is data arriving? ---------- */
  const covCol = v => v >= 95 ? 'var(--good)' : v >= 85 ? 'var(--dot)' : 'var(--bad)';
  /* Connection map: GrowthFox in the middle, every system around it. The line and the box say whether the
     connection is stable, needs fixing, or is available to add. Click a box to jump to its fix or its setup. */
  function connMap(c, open) {
    const E = GF.ENGINEER[c.cfg.id], q = c.cfg.quarantine.filter(x => !c.qdec[x.id]);
    const node = s => {
      const tk = open.find(r => (r.sources || [r.platform]).includes(s.name));
      const st = tk ? 'fix' : 'ok';
      const quar = q.find(x => x.source === s.name);
      return { name: s.name, kind: s.kind, st, sub: tk ? (tk.ticket === 'gap' ? 'Browser and server disagree' : tk.tkind === 'zero' ? 'Nothing arriving' : tk.tkind === 'dip' ? `Volume ${tk.devTxt} vs normal` : `Volume ${tk.devTxt} vs normal`) : quar ? 'Data quarantined by the Data Fox' : `Synced ${s.sync}`, href: tk ? '#action/' + encodeURIComponent(tk.id) : null };
    };
    const leftKinds = ['Ad platform', 'Browser tracking', 'Server-side', 'Consent'];
    const left = c.cfg.sources.filter(s => leftKinds.includes(s.kind)).map(node);
    const right = c.cfg.sources.filter(s => !leftKinds.includes(s.kind)).map(node)
      .concat(E.catalog.map(x => ({ name: x.name, kind: x.kind, st: c.status['src-' + x.id] ? 'req' : 'add', sub: c.status['src-' + x.id] ? 'Our team is on it' : `Not connected · ${x.kind}`, href: '#addsrc' })));
    const W = 1000, NW = 292, NH = 58, GAP = 14, HW = 184, HH = 128, X1 = 16, X2 = W - 16 - NW, HX = (W - HW) / 2;
    const colH = n => n * NH + (n - 1) * GAP;
    const H = Math.max(colH(left.length), colH(right.length), HH) + 56;
    const top0 = n => 28 + (H - 56 - colH(n)) / 2;
    const HY = (H - HH) / 2;
    const cut = (t, k) => t.length > k ? t.slice(0, k - 1) + '…' : t;
    const COL = { ok: 'var(--good)', fix: 'var(--warn)', add: 'var(--base)', req: 'var(--info)' };
    const LABEL = { ok: 'Stable', fix: 'Needs attention', add: 'Available', req: 'Requested' };
    const box = (n, x, y, side) => {
      const lx = side === 'L' ? x + NW : x, hx = side === 'L' ? HX : HX + HW, my = y + NH / 2, hy = HY + HH / 2 + (my - (H / 2)) * 0.35;
      const dash = n.st === 'fix' ? '6 5' : n.st === 'add' ? '2 5' : n.st === 'req' ? '6 5' : '';
      const line = `<path d="M${lx} ${my} C ${(lx + hx) / 2} ${my}, ${(lx + hx) / 2} ${hy}, ${hx} ${hy}" fill="none" stroke="${COL[n.st]}" stroke-width="${n.st === 'ok' ? 2 : 2.2}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
      const fill = n.st === 'fix' ? 'var(--warn-soft)' : n.st === 'add' ? 'var(--bg)' : 'var(--surface)';
      const stroke = n.st === 'fix' ? 'var(--warn)' : n.st === 'add' ? 'var(--border-strong)' : 'var(--border)';
      const g = `<g class="cnode ${n.st}"${n.goto ? ` data-goto="${n.goto}" role="link" tabindex="0"` : n.href ? ` data-href="${n.href}" role="link" tabindex="0"` : ''}>
        <rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="10" fill="${fill}" stroke="${stroke}" ${n.st === 'add' ? 'stroke-dasharray="4 4"' : ''}/>
        <circle cx="${x + 18}" cy="${y + 20}" r="5" fill="${COL[n.st]}"/>
        <text x="${x + 30}" y="${y + 24}" font-size="14" font-weight="600" fill="${n.st === 'add' ? 'var(--ink-2)' : 'var(--fg)'}">${esc(cut(n.name, 30))}</text>
        <text x="${x + 30}" y="${y + 44}" font-size="12"><tspan font-weight="600" fill="${n.st === 'fix' ? 'var(--warn-ink)' : n.st === 'ok' ? 'var(--good)' : n.st === 'req' ? 'var(--info)' : 'var(--muted)'}">${LABEL[n.st]}</tspan><tspan fill="var(--muted)"> · ${esc(cut(n.sub, 37 - LABEL[n.st].length))}</tspan></text>
        <title>${esc(n.name)} — ${esc(n.kind)}: ${esc(n.sub)}</title></g>`;
      return { line, g };
    };
    const L = left.map((n, i) => box(n, X1, top0(left.length) + i * (NH + GAP), 'L'));
    const R = right.map((n, i) => box(n, X2, top0(right.length) + i * (NH + GAP), 'R'));
    const conn = c.cfg.sources.length, stable = left.concat(right).filter(n => n.st === 'ok').length, fix = conn - stable;
    const avail = E.catalog.filter(x => !c.status['src-' + x.id]).length;
    const hub = `<g><rect x="${HX}" y="${HY}" width="${HW}" height="${HH}" rx="18" fill="var(--primary)"/>
      <text x="${W / 2}" y="${HY + 40}" text-anchor="middle" font-size="18" font-weight="700" fill="#FFFFFF">GrowthFox</text>
      <text x="${W / 2}" y="${HY + 66}" text-anchor="middle" font-size="13" fill="#D7EEE3">${stable} of ${conn} connections stable</text>
      <text x="${W / 2}" y="${HY + 88}" text-anchor="middle" font-size="13" fill="${fix ? '#FFD58A' : '#D7EEE3'}">${fix ? `${fix} need${fix === 1 ? 's' : ''} attention` : 'Nothing to look into'}</text>
      <text x="${W / 2}" y="${HY + 110}" text-anchor="middle" font-size="12" fill="#A9D6C3">${avail} available to add</text></g>`;
    const heads = `<text x="${X1}" y="16" font-size="11.5" letter-spacing="0.06em" fill="var(--faint)">AD PLATFORMS AND TRACKING</text><text x="${X2}" y="16" font-size="11.5" letter-spacing="0.06em" fill="var(--faint)">ANALYTICS, STORE AND MORE</text>`;
    const legend = `<div class="legend" style="margin:12px 0 0"><span><i style="background:var(--good)"></i>Stable</span><span><i style="background:repeating-linear-gradient(90deg,var(--warn) 0 6px,transparent 6px 10px)"></i>Needs attention</span><span><i style="background:repeating-linear-gradient(90deg,var(--info) 0 6px,transparent 6px 10px)"></i>Requested</span><span><i style="background:repeating-linear-gradient(90deg,var(--base) 0 2px,transparent 2px 6px)"></i>Available to add</span></div>`;
    // Phones: the same information as a list
    const list = `<div class="connlist">${left.concat(right).map(n => `<div class="cl ${n.st}"><i style="background:${COL[n.st]}"></i><div><b>${esc(n.name)}</b><small>${esc(n.kind)} · ${esc(n.sub)}</small></div><span>${LABEL[n.st]}</span></div>`).join('')}</div>`;
    return `<div class="connmap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${stable} of ${conn} connections to GrowthFox are stable; ${fix} need attention; ${avail} sources available to add">${heads}${L.map(x => x.line).join('')}${R.map(x => x.line).join('')}${hub}${L.map(x => x.g).join('')}${R.map(x => x.g).join('')}</svg></div>${list}${legend}`;
  }
  /* Small charts for the Engineer Fox: a source's daily volume against its normal band, and a pair's daily gap. */
  function volChart(c, x) {
    const N = c.data.n, from = N - 28, W = 520, H = 150, L = 46, R = 12, T = 10, B = 24;
    const v = x.vals.slice(from), nm = x.normals.slice(from), t = x.t;
    const hi0 = Math.max(...v, ...nm.map(k => (k || 0) * (1 + t))) * 1.08 || 1, ticks = niceTicks(0, hi0, 3), hi = ticks.at(-1);
    const X = i => L + i / 27 * (W - L - R), Y = val => T + (1 - val / hi) * (H - T - B);
    const band = nm.map((k, i) => `${X(i).toFixed(1)},${Y(k * (1 + t)).toFixed(1)}`).join(' ') + ' ' + nm.map((k, i) => `${X(i).toFixed(1)},${Y(Math.max(0, k * (1 - t))).toFixed(1)}`).reverse().join(' ');
    const line = arr => arr.map((k, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(k).toFixed(1)}`).join('');
    const day = i => c.data.days[from + i].date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const flags = x.flags.slice(from);
    const dots = flags.map((f, i) => f ? `<circle cx="${X(i)}" cy="${Y(v[i])}" r="4.5" fill="${f === 'spike' ? 'var(--dot)' : 'var(--bad)'}" stroke="var(--surface)" stroke-width="1.5"><title>${day(i)}: ${n0(v[i])} against a normal ${n0(nm[i])}</title></circle>` : '').join('');
    return `<svg class="minichart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(x.s.label)}, daily, last 28 days, against its normal level">
      ${ticks.map(k => `<line x1="${L}" x2="${W - R}" y1="${Y(k)}" y2="${Y(k)}" stroke="var(--grid)"/><text x="${L - 8}" y="${Y(k) + 4}" text-anchor="end" font-size="11.5" fill="var(--faint)">${k >= 1000 ? (k / 1000) + 'k' : k}</text>`).join('')}
      ${x.checked ? `<polygon points="${band}" fill="var(--c)" fill-opacity="0.09"/>` : ''}
      <path d="${line(nm)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 4"/>
      <path d="${line(v)}" fill="none" stroke="var(--c)" stroke-width="2.2" stroke-linejoin="round"/>${dots}
      <text x="${L}" y="${H - 6}" font-size="11.5" fill="var(--faint)">${day(0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="11.5" fill="var(--faint)">${day(27)}</text></svg>`;
  }
  function gapChart(c, x) {
    const N = c.data.n, from = N - 28, W = 520, H = 150, L = 46, R = 12, T = 10, B = 24;
    const g = x.daily.slice(from).map(k => k * 100), nm = x.normal * 100, t = x.t * 100;
    const lo0 = Math.min(0, ...g, nm - t) - 4, hi0 = Math.max(...g, nm + t) + 4, ticks = niceTicks(lo0, hi0, 3), lo = ticks[0], hi = ticks.at(-1);
    const X = i => L + i / 27 * (W - L - R), Y = val => T + (1 - (val - lo) / (hi - lo)) * (H - T - B);
    const day = i => c.data.days[from + i].date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const off = k => k < 0 || Math.abs(k - nm) > t;
    const dots = g.map((k, i) => off(k) ? `<circle cx="${X(i)}" cy="${Y(k)}" r="4.5" fill="${k < 0 ? 'var(--bad)' : 'var(--dot)'}" stroke="var(--surface)" stroke-width="1.5"><title>${day(i)}: the browser ${k < 0 ? `counted ${Math.abs(k).toFixed(0)}% more` : `missed ${k.toFixed(0)}%`}</title></circle>` : '').join('');
    return `<svg class="minichart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of ${esc(x.p.event)} the browser misses, daily, last 28 days, against its normal gap">
      ${ticks.map(k => `<line x1="${L}" x2="${W - R}" y1="${Y(k)}" y2="${Y(k)}" stroke="${k === 0 ? 'var(--border-strong)' : 'var(--grid)'}"/><text x="${L - 8}" y="${Y(k) + 4}" text-anchor="end" font-size="11.5" fill="var(--faint)">${k}%</text>`).join('')}
      <rect x="${L}" y="${Y(nm + t)}" width="${W - L - R}" height="${Y(nm - t) - Y(nm + t)}" fill="var(--c)" fill-opacity="0.09"/>
      <line x1="${L}" x2="${W - R}" y1="${Y(nm)}" y2="${Y(nm)}" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 4"/>
      <path d="${g.map((k, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(k).toFixed(1)}`).join('')}" fill="none" stroke="var(--c)" stroke-width="2.2" stroke-linejoin="round"/>${dots}
      <text x="${L}" y="${H - 6}" font-size="11.5" fill="var(--faint)">${day(0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="11.5" fill="var(--faint)">${day(27)}</text></svg>`;
  }
  function pageEngineer(c) {
    const f = FOX.engineer, E = GF.ENGINEER[c.cfg.id], eng = c.model.eng, N = c.data.n;
    const open = activeRecs(c).filter(r => r.ticket).sort((a, b) => b.score - a.score);
    const bad = new Set(open.flatMap(r => r.sources || [r.platform]));
    const total = c.cfg.sources.length, stable = c.cfg.sources.filter(s => !bad.has(s.name)).length;
    const avail = E.catalog.filter(x => !c.status['src-' + x.id]).length;
    const summary = `${stable} of ${total} connections are stable. ${open.length ? `${open.length} open ticket${open.length === 1 ? '' : 's'}, starting with “${open[0].title}”.` : 'No open tickets: every source is arriving at its normal level, and browser and server counts agree as usual.'}${avail ? ` ${avail} more source${avail === 1 ? '' : 's'} you could connect.` : ''}`;
    const tkRow = (r, i) => `<li><span class="rank">${i + 1}</span><div style="min-width:0"><a class="t" href="#action/${encodeURIComponent(r.id)}">${esc(r.title)}</a><div class="s"><span class="catchip ${r.tkind === 'spike' || r.tkind === 'shift' ? 'warning' : 'critical'}">${r.ticket === 'gap' ? 'Client vs server' : r.tkind === 'zero' ? 'Nothing arriving' : r.tkind === 'dip' ? 'Dip' : 'Spike'}</span><span>${esc((r.sources || [r.platform]).join(' · '))}</span>${c.status['note-' + r.id] ? `<span>${c.status['note-' + r.id].notes.length} note${c.status['note-' + r.id].notes.length === 1 ? '' : 's'}</span>` : ''}</div></div><div class="imp ${r.tkind === 'spike' || r.tkind === 'shift' ? 'warn' : 'bad'}">${esc(r.devTxt)}<small>${esc(shortImpact(c, r).replace(r.devTxt + ' ', ''))}</small></div></li>`;
    const tickets = open.length ? `<ol class="actlist">${open.map(tkRow).join('')}</ol>` : '<div class="empty">No open tickets. Every connection is stable.</div>';
    const recOf = id => c.model.recs.find(r => r.id === id);
    const chipFor = (rec, kind, txtBad) => { if (!rec) return '<span class="chip good">Normal</span>'; const st = recState(c, rec); if (st) return `<span class="chip neutral">${st.status === 'closed' ? 'Closed as expected' : st.status === 'requested' ? 'With our team' : 'Handled'}</span>`; return `<span class="chip ${kind === 'spike' || kind === 'shift' ? 'warn' : 'bad'}">${txtBad}</span>`; };
    const VOPTS = [0.25, 0.5, 0.75, 1], GOPTS = [0.05, 0.1, 0.15, 0.2];
    const sel = (id, opts, cur, fmt) => ledgerMode === 'readonly' ? `<b>${fmt(cur)}</b>` : `<select class="select" data-thr="${esc(id)}" aria-label="Threshold">${opts.map(o => `<option value="${o}" ${Math.abs(o - cur) < 1e-9 ? 'selected' : ''}>${fmt(o)}</option>`).join('')}</select>`;
    const streams = eng.streams.slice().sort((a, b) => (b.ep ? 1 : 0) - (a.ep ? 1 : 0));
    const volCards = streams.map(x => {
      const rec = recOf('vol-' + x.s.id), last = x.vals[N - 1], nm = x.normals[N - 1], dev = nm ? last / nm - 1 : 0;
      const src = c.cfg.sources.find(s => s.name === x.s.source);
      const chip = !x.checked ? '<span class="chip neutral">Below minimum · not checked</span>' : chipFor(rec, x.ep && x.ep.kind, x.ep ? (x.ep.kind === 'zero' ? 'Nothing arriving' : x.ep.kind === 'dip' ? 'Dip' : 'Spike') : '');
      return `<div class="volcard">
        <div class="vh"><div><b>${esc(x.s.label)}</b><small>${esc(x.s.source)}${src ? ' · ' + esc(src.kind) : ''}</small></div>${chip}</div>
        <div class="vn"><b>${n0(last)}</b><span>${esc(x.s.unit)} on the last day · normal ${n0(nm || 0)}</span>${x.checked && nm ? `<span class="dpill ${Math.abs(dev) <= x.t ? 'flat' : dev > 0 ? 'up' : 'down'}">${dev >= 0 ? '+' : '−'}${Math.abs(Math.round(dev * 100))}%</span>` : ''}</div>
        ${volChart(c, x)}
        <div class="vf">${x.checked ? `<label class="thr">Flag at ±${sel(x.s.id, VOPTS, x.t, o => Math.round(o * 100) + '%')}</label>` : `<span class="thr">Under ${GF.VOL_MIN} a day, so it isn’t checked</span>`}${rec && !recState(c, rec) ? `<a class="done-go" href="#action/${encodeURIComponent(rec.id)}">Open ticket ${I.arrow}</a>` : ''}</div></div>`;
    }).join('');
    const pairCards = eng.pairs.map(x => {
      const rec = recOf('gap-' + x.p.id), pc = v => Math.abs(Math.round(v * 100)) + '%';
      return `<div class="volcard">
        <div class="vh"><div><b>${esc(x.p.client)} vs ${esc(x.p.server)}</b><small>${esc(x.p.event[0].toUpperCase() + x.p.event.slice(1))}</small></div>${chipFor(rec, x.flag, x.flag === 'browser' ? 'Browser above server' : 'Gap moved')}</div>
        <div class="vn"><b>${x.cur < 0 ? '+' + pc(x.cur) : pc(x.cur)}</b><span>${x.cur < 0 ? 'more in the browser' : 'missed by the browser'}, last 7 days · normal ${pc(x.normal)}</span></div>
        ${gapChart(c, x)}
        <div class="vf"><label class="thr">Flag at ±${sel(x.p.id, GOPTS, x.t, o => Math.round(o * 100) + ' pts')} from normal</label>${rec && !recState(c, rec) ? `<a class="done-go" href="#action/${encodeURIComponent(rec.id)}">Open ticket ${I.arrow}</a>` : ''}</div></div>`;
    }).join('');
    const catalog = E.catalog.map(x => {
      const st = c.status['src-' + x.id], fx = FOX[x.fox];
      return `<div class="kpi catcard"><div class="catfox">${fx ? foxSvg(x.fox, true) : ''}<div><b>${esc(x.name)}</b><span>${esc(x.kind)}</span></div></div>
        ${fx ? `<span class="foxtag" style="--c:${fx.c};--t:${fx.t}">For the ${esc(fx.name)}${x.fox === 'paid' ? '' : ' (V2)'}</span>` : ''}
        <p>${esc(x.unlocks)}</p><small><b>You provide:</b> ${esc(x.provide)}</small>
        ${st ? `<span class="chip info" style="justify-self:start">${I.team}Requested ${new Date(st.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>` : `<button class="btn" style="justify-self:start" data-act="request-src" data-id="${esc(x.id)}">Ask our team to set it up ${I.arrow}</button>`}</div>`;
    }).join('');
    return `<div class="page" style="${foxVars('engineer')}">
      <section class="fox-hero" aria-label="Executive summary"><div class="id">${foxSvg('engineer', true)}<div><h1>${f.name}</h1><div class="role">${esc(f.role)}</div></div></div>
        <div><span class="eyebrow">Executive summary · today</span><p class="sum">${esc(summary)}</p></div></section>
      ${statusStrip(c)}
      <section class="sec" aria-label="Connections">
        <div class="sec-head"><div class="lead"><span class="eyebrow">Connections</span><span>Every system connected to GrowthFox, and whether it’s stable or needs attention. Click one that needs attention to open its ticket.</span></div></div>
        ${connMap(c, open)}
      </section>
      <section class="sec" aria-label="Open tickets"><div class="sec-head"><div class="lead"><span class="eyebrow">Open tickets</span><span>${open.length ? `${open.length} open, also in All actions, where they come first: every other number depends on them.` : 'Nothing open.'} Each ticket can take context, be closed as expected, or go to our team.</span></div></div>${tickets}</section>
      <section class="sec" aria-label="Daily volume"><div class="sec-head"><div class="lead"><span class="eyebrow">Daily volume</span><span>Each source against its normal level: the same weekday over the last 4 weeks. The shaded band is the threshold; a day outside it opens a ticket, and so does a day with nothing at all. Change the threshold per source to match its sensitivity.</span></div></div>
        <div class="legend" style="margin:0 0 12px"><span><i style="background:var(--c)"></i>Daily volume</span><span><i style="background:repeating-linear-gradient(90deg,var(--faint) 0 4px,transparent 4px 8px)"></i>Normal level</span><span><i style="background:var(--c);opacity:.25;height:10px"></i>Threshold band</span><span><i style="background:var(--bad);width:10px;height:10px;border-radius:50%"></i>Outside the band</span></div>
        <div class="volgrid">${volCards}</div></section>
      <section class="sec" aria-label="Client vs server"><div class="sec-head"><div class="lead"><span class="eyebrow">Client vs server</span><span>The same events counted in the browser and on the server. Some gap is normal, because ad blockers and declined consent hide browser events, so each pair is judged against its own normal gap (days 8 to 35 ago). A ticket opens when the last 7 days move outside the band, or when the browser counts more than the server.</span></div></div>
        <div class="volgrid">${pairCards}</div></section>
      <section class="sec" id="addsrc"><div class="sec-head"><div class="lead"><span class="eyebrow">Add a source</span><span>Setup is an expert service in v1: tell us what to connect and we do it. Each source says which fox it feeds, what it unlocks and what we need from you.</span></div></div><div class="catgrid">${catalog}</div></section>
      ${footnote()}</div>`;
  }
