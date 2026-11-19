  /* ---------- Parameter detail: one parameter on one endpoint ----------
     1) Its row from the endpoint table, column by column. 2) A preview of the 20 most recent events in the
     picked date range that are missing it or carry an invalid value. Sample events, generated, not a real client's. */
  function pageParam(c, prm) {
    const { R } = periods(c), O = periods(c).O, rows = epRows(c, R);
    const row = prm && rows.find(r => r.ep.id === prm.ep), p = row && row.ep.params.find(x => x.key === prm.key);
    if (!row || !p) return `<div class="page"><a href="#analytics">← Data Fox</a><div class="empty">Parameter not found.</div></div>`;
    const { ep, w } = row;
    const v = w.comp[p.key], inv = p.inv || 0, pres = Math.min(1, v / (1 - inv)), vr = GF.validRule(p.key);
    const baseN = ep.evShare ? w.events * (ep.evShare[p.ev] || 0) : w.events, failN = Math.round(baseN * (1 - v));
    const missN = Math.round(baseN * (1 - pres)), invN = Math.max(0, failN - missN);
    const rid = `dq-${ep.id}-${p.key}`, rec = c.model.recs.find(r => r.id === rid), st = c.status[rid];
    const status = p.exp && v >= p.exp - 0.005 ? `<span class="chip neutral">${I.target}At expected level · ${pct1(p.exp)}</span><small>${esc(p.expWhy || '')}</small>`
      : st && st.status === 'expected' && rec && recState(c, rec) ? `<span class="chip neutral">${I.target}Expected level · ${pct1(st.baseline)}</span><small>Set by you</small>`
      : rec && !recState(c, rec) ? `<a class="chip ${p.cat === 'critical' ? 'bad' : p.cat === 'warning' ? 'warn' : 'neutral'}" href="#action/${encodeURIComponent(rid)}">${rec.optional && !promoted(c, rec) ? 'Optional improvement' : 'Open action'} →</a><small>${esc(rec.title)}</small>`
      : v >= 0.9995 ? `<span class="chip good">${I.check}Complete</span><small>Nothing to fix</small>` : '<span class="chip neutral">No action</span>';
    const kpis = `<div class="kpis pkpis">
      <div class="kpi"><div class="label">Present</div><div class="value">${pct1(pres)}</div><small>${n0(baseN * pres)} of ${n0(baseN)} ${esc(p.ev ? p.ev + ' events' : ep.unit)} carry it · ${n0(missN)} without it</small></div>
      <div class="kpi"><div class="label">Valid</div><div class="value" style="color:${vr ? (inv ? 'var(--bad)' : 'var(--good)') : 'var(--faint)'}">${vr ? pct1(1 - inv) : '—'}</div><small>${vr ? `Value check: ${esc(vr)}${p.bad ? ` · e.g. ${p.bad.map(b => '“' + esc(b) + '”').join(', ')}` : ''}${inv ? ` · ${n0(invN)} invalid` : ''}` : 'No value check: presence only'}</small></div>
      <div class="kpi"><div class="label">Complete and valid</div><div class="value" style="color:${compCol(v)}">${pct1(v)}</div><span class="meter"><i style="width:${(v * 100).toFixed(1)}%;background:${compCol(v)}"></i></span><small>${n0(failN)} failing events ${esc(perTxt(c))}</small></div>
      <div class="kpi"><div class="label">What it’s for</div><div style="font-size:15px;color:var(--fg)">${esc(p.desc)}</div><small>${CAT[p.cat].name}: ${esc(CAT[p.cat].why)}</small></div>
      <div class="kpi"><div class="label">Status</div><div style="display:grid;gap:6px;justify-items:start">${status}</div></div>
    </div>`;
    // Daily share complete and valid, over the picked range
    const e = c.data.eps.find(x => x.ep.id === ep.id), n = c.data.n, Rn = Math.min(R, n), from = n - O - Rn;
    const pts = e.days.slice(from, n - O).map((x, i) => ({ d: c.data.days[from + i].date, v: x.comp[p.key] * 100 }));
    const chart = pts.length > 1 ? lineChart([{ name: 'Complete and valid, per day', short: 'Complete and valid', color: 'var(--ana)', main: true, points: pts }], { axis: k => (Number.isInteger(k) ? k : k.toFixed(1)) + '%', fmt: k => k.toFixed(1) + '%', height: 220, minSpan: 2 }) : '';
    // Preview: the 20 most recent failing events in the range (deterministic sample)
    let seed = [...(c.cfg.id + ep.id + p.key)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const hex = k => Array.from({ length: k }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
    const PATHS = c.cfg.id === 'flamehouse' ? ['/order', '/menu/burgers', '/menu/sides', '/checkout', '/app/order'] : ['/espresso-machines', '/coffee-beans/winter-blend', '/coffee-beans', '/cart', '/checkout'];
    const invShare = failN ? invN / failN : 0, out = [];
    for (let i = n - O - 1; i >= from && out.length < 20; i--) {
      const x = e.days[i], perDay = (ep.evShare ? x.events * (ep.evShare[p.ev] || 0) : x.events) * (1 - x.comp[p.key]);
      const k = Math.min(20 - out.length, Math.max(perDay > 0.3 ? 1 : 0, Math.round(perDay)));
      const times = Array.from({ length: k }, () => Math.floor(rnd() * 86400)).sort((a, b) => b - a);
      for (const t of times) {
        const invalid = p.bad && rnd() < invShare;
        const evName = ep.id === 'meta' ? pick(['Purchase', 'Purchase', 'InitiateCheckout', 'AddToCart', 'ViewContent']) : ep.id === 'gads' ? 'Purchase (website)' : ep.evShare ? p.ev : 'order';
        const id = ep.id === 'meta' ? `evt_${hex(10)}` : ep.id === 'ga4' ? (p.ev === 'purchase' ? `T-${100000 + Math.floor(rnd() * 90000)}` : `GA1.1.${Math.floor(rnd() * 1e9)}`) : `#${10000 + Math.floor(rnd() * 90000)}`;
        const src = ep.id === 'meta' ? pick(['Conversions API', 'Conversions API', 'Browser pixel']) : ep.id === 'gads' ? 'Enhanced conversions' : ep.id === 'ga4' ? pick(PATHS) : pick(c.cfg.id === 'flamehouse' ? ['App', 'App', 'Web'] : ['Online store']);
        out.push({ at: c.data.days[i].t + t * 1000, evName, id, src, invalid, val: invalid ? pick(p.bad) : null });
      }
    }
    const fmtAt = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const srcLabel = ep.id === 'ga4' ? 'Page' : ep.id === 'meta' ? 'Sent by' : ep.id === 'gads' ? 'Sent by' : 'Channel';
    const preview = out.length ? `<div class="tbl-wrap"><table class="ltbl"><thead><tr><th>Time</th><th>Event</th><th>ID</th><th>${srcLabel}</th><th>${esc(p.key)}</th><th>Issue</th></tr></thead><tbody>${out.map(r => `<tr>
        <td style="white-space:nowrap">${fmtAt(r.at)}</td><td><code>${esc(r.evName)}</code></td><td><code>${esc(r.id)}</code></td><td style="color:var(--ink-2)">${esc(r.src)}</td>
        <td>${r.invalid ? `<code style="color:var(--bad)">${esc(r.val)}</code>` : '<span style="color:var(--faint)">not sent</span>'}</td>
        <td>${r.invalid ? `<span class="catchip critical">Invalid</span><small>Fails: ${esc(vr)}</small>` : '<span class="catchip warning">Missing</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No failing events in this period.</div>';
    return `<div class="page" style="${foxVars('analytics')}">
      <a href="#analytics/${ep.id}" data-act="back" style="font-size:15px;font-weight:500;text-decoration:none">← ${esc(ep.name)}</a>
      <div class="ph"><div><h1 style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;letter-spacing:-0.01em">${esc(p.key)}</h1><p>${esc(ep.name)} · ${esc(ep.kind)}${p.ev ? ` · on <code>${esc(p.ev)}</code> events` : ''} · <span class="catchip ${p.cat}">${CAT[p.cat].name}</span></p></div><span class="aside">${asOf()}</span></div>
      <div class="filters" style="justify-content:flex-end">${rangeSeg()}</div>
      ${kpis}
      ${chart ? `<section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Complete and valid over time</span><span>Share of ${esc(p.ev ? p.ev + ' events' : ep.unit)} carrying a valid ${esc(p.key)}, per day.</span></div></div>${chart}</section>` : ''}
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Failing events</span><span>The ${Math.min(20, out.length)} most recent of ${n0(failN)} ${esc(p.ev ? p.ev + ' events' : ep.unit)} in ${esc(perTxt(c))} that are missing ${esc(p.key)}${vr && inv ? ' or carry an invalid value' : ''}. Sample data.</span></div></div>${preview}</section>
      ${footnote()}</div>`;
  }

  function pageEndpoint(c, id) {
    const { R } = periods(c);
    const rows = epRows(c, R);
    const row = rows.find(r => r.ep.id === id);
    if (!row) return `<div class="page"><a href="#analytics">← Data Fox</a><div class="empty">Endpoint not found.</div></div>`;
    const { ep, w, p } = row, st = GF.epStatus(w.score);
    const Rn = Math.min(R, c.data.n);
    const tabs = rows.map(r => `<a class="fbtn" href="#analytics/${r.ep.id}" aria-pressed="${r.ep.id === id}">${esc(r.ep.name)}<span class="n" style="color:${r.ep.id === id ? '' : ST_COL[GF.epStatus(r.w.score)]}">${Math.round(r.w.score)}</span></a>`).join('');
    const trend = GF.epTrend(c.data, id, Rn, periods(c).O);
    const chart = lineChart(GF.CATS.map((k, i) => ({ name: `${CAT[k].name} values missing`, short: CAT[k].name, color: CAT[k].col, main: i === 0, solid: i > 0, points: trend.map(x => ({ d: x.d, v: x[k] })) })), { axis: v => (Number.isInteger(v) ? v : v.toFixed(1)) + '%', fmt: v => v.toFixed(1) + '%', height: 260 });
    const kpis = `<div class="kpis">
      <div class="kpi"><div class="label">Data quality score</div><div class="value" style="color:${ST_COL[st]}">${Math.round(w.score)}<span style="font-size:15px;color:var(--muted);font-weight:500">/100</span></div>${deltaPts(w.score, p && p.score)}</div>
      <div class="kpi"><div class="label">${esc(ep.unit[0].toUpperCase() + ep.unit.slice(1))} ${om('observed')}</div><div class="value">${n0(w.events)}</div><small>${perCap(c)}</small></div>
      <div class="kpi"><div class="label">Failed ${esc(ep.unit)}</div><div class="value" style="color:${w.failed / w.events > 0.05 ? 'var(--bad)' : 'var(--fg)'}">${n0(w.failed)}</div><small>${(w.failed / w.events * 100).toFixed(1)}% missing a critical parameter</small></div>
      <div class="kpi"><div class="label">Completeness by category</div>${GF.CATS.map(k => `<div class="catrow"><span><i style="background:${CAT[k].col}"></i>${CAT[k].name}</span><b style="color:${compCol(w.cats[k])}">${pct1(w.cats[k])}</b></div>`).join('')}</div>
    </div>`;
    const day = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    // Clicking an event scorecard filters "Parameters by category" to that event's parameters.
    const evSel = ep.events && state.evSel && state.evSel.ep === id && ep.params.some(x => x.ev === state.evSel.ev) ? state.evSel.ev : null;
    const tables = GF.CATS.map(k => {
      const ps = ep.params.filter(x => x.cat === k && (!evSel || x.ev === evSel)).sort((a, b) => w.comp[a.key] - w.comp[b.key]);
      if (!ps.length) return '';
      return `<div class="cattbl"><div class="cathead ${k}"><b>${CAT[k].name}</b><span>${ps.length} parameter${ps.length > 1 ? 's' : ''} · weight ${GF.CAT_W[k] * 100}% · ${esc(CAT[k].why)}</span></div>
        <div class="tbl-wrap" style="margin-top:0"><table><thead><tr><th>Parameter</th><th class="r">Present</th><th class="r">Valid</th><th style="min-width:160px">Complete and valid</th><th>What it’s for</th></tr></thead><tbody>${ps.map(x => {
          const v = w.comp[x.key], baseN = ep.evShare ? w.events * (ep.evShare[x.ev] || 0) : w.events, vr = GF.validRule(x.key), pres = Math.min(1, v / (1 - (x.inv || 0)));
          const rid = `dq-${ep.id}-${x.key}`, st = c.status[rid], rec = c.model.recs.find(r => r.id === rid);
          const tag = x.exp && v >= x.exp - 0.005 ? `<small class="pdesc">Expected level ${pct1(x.exp)}</small>` : st && st.status === 'expected' && rec && recState(c, rec) ? `<small class="pdesc">Expected level ${pct1(st.baseline)} (set by you)</small>` : rec && !recState(c, rec) ? `<small class="pdesc"><a href="#action/${encodeURIComponent(rid)}">${rec.optional && !promoted(c, rec) ? 'Optional · details' : 'Open action'} →</a></small>` : '';
          const note = x.issue ? `<small class="pdesc" style="color:var(--bad)">Dropped from ${pct1(x.base)} to ${pct1(x.issue.to)} on ${day(GF.END - (x.issue.since - 1) * GF.DAY)}</small>` : '';
          const valid = vr ? `<span style="color:${x.inv ? 'var(--bad)' : 'var(--good)'};font-weight:600">${pct1(1 - (x.inv || 0))}</span><small class="pdesc" title="Value check">${esc(vr)}${x.bad ? ` · e.g. ${x.bad.map(b => '“' + b + '”').join(', ')}` : ''}</small>` : '<span style="color:var(--faint)">—</span><small class="pdesc">presence only</small>';
          return `<tr class="prow" data-row="#param/${ep.id}/${encodeURIComponent(x.key)}"><td><a class="pkey" href="#param/${ep.id}/${encodeURIComponent(x.key)}"><code>${esc(x.key)}</code></a>${note}${tag}</td><td class="r">${pct1(pres)}<small class="pdesc">${n0(baseN * pres)}</small></td><td class="r">${valid}</td><td><div class="cbar"><span class="meter"><i style="width:${v * 100}%;background:${compCol(v)}"></i></span><b style="color:${compCol(v)}">${pct1(v)}</b></div></td><td style="color:var(--ink-2)">${esc(x.desc)}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
    }).join('');
    // GA4: event quality, like PULSE's event scorecards
    let events = '';
    if (ep.events) {
      const evs = [...new Set(ep.params.map(x => x.ev))];
      events = `<section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Event quality</span><span>Each event and the parameters it must carry. Click an event to see its parameters below.</span></div></div><div class="evgrid">${(() => {
        const sc = ep.params.reduce((s, x) => s + w.comp[x.key], 0) / ep.params.length * 100;
        return `<button type="button" class="kpi kpibtn" data-act="evsel" data-k="" aria-pressed="${!evSel}"><div class="label">All events</div><div class="value" style="color:${ST_COL[GF.epStatus(sc)]}">${sc.toFixed(1)}%</div><span class="meter"><i style="width:${sc}%;background:${ST_COL[GF.epStatus(sc)]}"></i></span><small>${ep.params.length} parameters</small></button>`;
      })()}${evs.map(ev => {
        const ps = ep.params.filter(x => x.ev === ev), sc = ps.reduce((s, x) => s + w.comp[x.key], 0) / ps.length * 100;
        const weak = ps.slice().sort((a, b) => w.comp[a.key] - w.comp[b.key])[0];
        return `<button type="button" class="kpi kpibtn" data-act="evsel" data-k="${esc(ev)}" aria-pressed="${evSel === ev}"><div class="label">${esc(ev.replace(/_/g, ' '))}</div><div class="value" style="color:${ST_COL[GF.epStatus(sc)]}">${sc.toFixed(1)}%</div><span class="meter"><i style="width:${sc}%;background:${ST_COL[GF.epStatus(sc)]}"></i></span><small title="${ps.length} parameters">Weakest <code>${esc(weak.key.split('.')[1])}</code> ${pct1(w.comp[weak.key])}</small></button>`;
      }).join('')}</div></section>`;
    }
    let disc = '';
    if (ep.discrepancy) {
      // Volume discrepancy: what the browser (client) recorded against the server, per day.
      // Alignment = 100 minus 2.5 points per % apart (4% apart = 90, 20% apart = 50).
      const O = periods(c).O, days = c.data.days.slice(c.data.n - O - Rn, c.data.n - O), WD = [0.86, 1.05, 1.06, 1.02, 1.0, 0.96, 0.88];
      const jit = (k, i) => { const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      const rows = ep.discrepancy.map((dc, k) => {
        const pts = days.map((d, i) => { const sv = dc.fromConv ? d.conv : dc.perDay * WD[d.date.getDay()] * (0.92 + 0.16 * jit(k, i)); return { d: d.date, server: sv, client: sv * dc.ratio * (0.97 + 0.06 * jit(k + 5, i)) }; });
        const server = sum(pts.map(x => x.server)), client = sum(pts.map(x => x.client)), gap = Math.abs(client / server - 1) * 100;
        return { dc, pts, server, client, gap, score: Math.max(0, Math.round(100 - 2.5 * gap)) };
      });
      const scol = v => v >= 90 ? 'var(--good)' : v >= 70 ? 'var(--warn-ink)' : 'var(--bad)';
      const overall = Math.round(sum(rows.map(r => r.score)) / rows.length);
      const cards = rows.map(r => {
        const mx = Math.max(r.client, r.server);
        const bar = (lbl, v, col) => `<div class="vd-bar"><span>${lbl}</span><span class="vd-track"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${col}"></i></span><b>${n0(v)}</b></div>`;
        return `<div class="vd-card"><span class="eyebrow">${esc(r.dc.label)}</span><span class="vd-sub">Alignment</span><div class="vd-score" style="color:${scol(r.score)}">${r.score}<span>/100</span></div>
          ${bar('Client', r.client, 'var(--primary)')}${bar('Server', r.server, 'var(--med)')}<small>${r.gap.toFixed(1)}% apart · ${r.client < r.server ? 'the browser misses' : 'the browser over-counts'} ${n0(Math.abs(r.server - r.client))} ${esc(r.dc.label.toLowerCase())}</small>
          <div class="vd-chart"><span class="vd-sub">Per day, client against server</span>${lineChart([{ name: 'Client (browser)', short: 'Client', color: 'var(--primary)', main: true, points: r.pts.map(x => ({ d: x.d, v: x.client })) }, { name: 'Server', short: 'Server', color: 'var(--med)', solid: true, points: r.pts.map(x => ({ d: x.d, v: x.server })) }], { axis: v => v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : Math.round(v) + '', fmt: v => n0(v), height: 230, width: 520 })}</div></div>`;
      }).join('');
      disc = `<section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Volume discrepancy</span><span>What the browser recorded against what the server recorded, ${perTxt(c)}. Under 4% apart scores 90+; 20% apart scores 50.</span></div><div class="vd-overall" style="color:${scol(overall)}">${overall}<span>/100</span></div></div>
        <div class="vd-grid">${cards}</div></section>`;
    }
    const checks = c.cfg.checks.filter(ch => ch.platform === id && ch.group !== 'tags');
    const icon = s => `<span class="ico ${s}">${s === 'pass' ? I.check : s === 'warn' ? I.alert : I.x}</span>`;
    const checkList = checks.length ? checks.map(ch => `<div class="check">${icon(ch.status)}<b style="font-weight:500">${esc(GF.CHECK_GROUPS[ch.group])}</b><div class="v">${esc(GF.fillDates(ch.value))} <span class="tgt">· target: ${esc(ch.target)}</span>${ch.explain ? `<small>${esc(ch.explain)}</small>` : ''}${ch.fix ? `<small><a href="#recs" data-goto="tr-${ch.group}-${ch.platform}">${esc(ch.fix.title)} →</a></small>` : ''}</div></div>`).join('') : '<div class="empty">No setup checks for this endpoint.</div>';
    return `<div class="page" style="${foxVars('analytics')}">
      <a href="#analytics" style="font-size:15px;font-weight:500;text-decoration:none">← Data Fox</a>
      <div class="ph"><div><h1>${esc(ep.name)} <span style="color:var(--muted);font-weight:500">· ${esc(ep.kind)}</span></h1><p>${esc(ep.about)} Every parameter is critical, warning or optional, and checked for presence and, where it has a value check, validity.</p></div><span class="aside">${asOf()}</span></div>
      <div class="filters" role="group" aria-label="Endpoint">${tabs}<span style="flex:1"></span>${rangeSeg()}</div>
      ${kpis}
      <section class="sec"><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px"><span class="eyebrow">Missing parameters over time</span><span style="font-size:15px;color:var(--ink-2)">Average share of parameter values missing, by category, per day.</span></div>${chart}</section>
      ${events}
      <section class="sec" id="ep-params" style="scroll-margin-top:90px"><div class="sec-head"><div class="lead"><span class="eyebrow">Parameters by category${evSel ? ` · ${esc(evSel)}` : ''}</span><span>${evSel ? `The parameters the <code>${esc(evSel)}</code> event must carry, ${perTxt(c)}, weakest first.` : `${perCap(c)}, weakest first in each category.`}</span></div>${evSel ? `<button class="btn ghost" data-act="evsel" data-k="${esc(evSel)}">Show all events</button>` : ''}</div><div style="display:grid;gap:20px">${tables}</div></section>
      <section class="sec"><div class="sec-head"><div class="lead"><span class="eyebrow">Setup checks for ${esc(ep.name)}</span><span>Run daily. Each failing check links to its fix.</span></div><a href="#analytics" style="font-size:15px;font-weight:500">All checks</a></div><div class="check-group" style="border:0;padding-top:0">${checkList}</div></section>
      ${footnote()}</div>`;
  }
