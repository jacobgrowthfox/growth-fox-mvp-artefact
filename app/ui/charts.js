  /* ---------- Fox metrics ---------- */
  const sum = arr => arr.reduce((s, x) => s + x, 0);
  function metricFor(c, kind) {
    const e = isEcom(c);
    if (kind === 'engineer') return {
      label: 'Connection health', of: sl => sum(sl.map(x => x.health == null ? 100 : x.health)) / sl.length, total: w => w.health, fmt: v => Math.round(v) + '%', axis: v => Math.round(v) + '%',
      perDay: 'Checks within their normal range', dayFmt: v => v.toFixed(0) + '%', invert: false,
    };
    if (kind === 'commercial') return {
      label: e ? 'Revenue' : 'Leads', of: sl => e ? sum(sl.map(x => x.revenue)) / sl.length : sum(sl.map(x => x.conv)) / sl.length,
      total: w => e ? w.revenue : w.conv, fmt: v => e ? m(v, c) : n0(v), axis: v => e ? (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v) + '') : (Math.round(v * 10) / 10) + '',
      perDay: e ? 'Revenue per day' : 'Leads per day', dayFmt: v => e ? m(v, c) : v.toFixed(1), invert: false,
    };
    if (kind === 'analytics') return {
      label: 'Data quality score', of: sl => sum(sl.map(x => x.dq)) / sl.length, total: w => w.dq, fmt: v => Math.round(v) + '', axis: v => Math.round(v) + '',
      perDay: 'Data quality score', dayFmt: v => v.toFixed(0), invert: false, now: () => GF.dqOverall(c.cfg, c.data),
    };
    return {
      label: e ? 'Blended ROAS' : 'Blended cost per lead',
      of: sl => e ? sum(sl.map(x => x.revenue)) / sum(sl.map(x => x.spend)) : sum(sl.map(x => x.spend)) / sum(sl.map(x => x.conv)),
      total: w => e ? w.revenue / w.spend : w.spend / w.conv, fmt: v => e ? v.toFixed(2) : m(v, c, 2), axis: v => e ? v.toFixed(1) : m(v, c, 0),
      perDay: e ? 'Blended ROAS' : 'Blended CPL', dayFmt: v => e ? v.toFixed(2) : m(v, c, 2), invert: !e,
    };
  }
  function series(c, fn, R, offset = 0) {
    const d = c.data.days, n = c.data.n, out = [], roll = R > 7 ? 7 : 1;
    for (let i = n - R; i < n; i++) {
      const j = i - offset; if (j < 0) return null;
      out.push({ d: d[i].date, v: fn(d.slice(Math.max(0, j - roll + 1), j + 1)) });
    }
    return out;
  }

  /* ---------- Chart ---------- */
  function niceTicks(lo, hi, count = 4) {
    const span = hi - lo || 1, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= step0);
    const start = Math.floor(lo / step) * step, ticks = [];
    for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(+v.toFixed(6));
    if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }
  let chartSeq = 0;
  function lineChart(sers, { axis, fmt, height = 300, marks = [], minSpan = 0, width = 760 }) {
    const id = 'ch' + (++chartSeq);
    const W = width, H = height, L = 52, Rp = 12, T = 14, B = 30;
    const pts = sers[0].points, nP = pts.length;
    const all = sers.flatMap(s => s.points.map(p => p.v)).filter(v => isFinite(v));
    if (!all.length) return `<div class="empty">Nothing to chart for ${esc(sers[0].name.toLowerCase())} in this period.</div>`;
    let lo = Math.min(...all), hi = Math.max(...all); if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; } const nonNeg = lo >= 0; const pad = (hi - lo) * 0.18 || hi * 0.1 || 1; lo -= pad; hi += pad; if (nonNeg) lo = Math.max(0, lo);
    const ticks = niceTicks(lo, hi); lo = ticks[0]; hi = ticks[ticks.length - 1];
    const x = i => L + (nP === 1 ? 0 : (i / (nP - 1)) * (W - L - Rp));
    const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const grid = ticks.map(t => `<line x1="${L}" x2="${W - Rp}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)"/><text x="${L - 10}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--faint)">${esc(axis(t))}</text>`).join('');
    const every = Math.max(1, Math.ceil(nP / 6));
    const xl = pts.map((p, i) => (i % every === 0 || i === nP - 1) && !(i !== nP - 1 && nP - 1 - i < every * 0.6) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === nP - 1 ? 'end' : 'middle'}" font-size="12" fill="var(--faint)">${p.d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</text>` : '').join('');
    const lines = sers.slice().reverse().map(s => {
      let pen = false; // a value that isn't finite (e.g. cost per lead with no leads) leaves a gap
      const path = s.points.map((p, i) => { if (!isFinite(p.v)) { pen = false; return ''; } const seg = `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`; pen = true; return seg; }).join('');
      if (!path) return '';
      if (s.solid) return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (!s.main) return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"/>`;
      const last = s.points[nP - 1];
      if (!isFinite(last.v) || s.points.some(p => !isFinite(p.v))) return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`;
      return `<path d="${path}L${x(nP - 1)},${H - B}L${x(0)},${H - B}Z" fill="${s.color}" fill-opacity="0.08"/><path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(nP - 1)}" cy="${y(last.v)}" r="5" fill="${s.color}" stroke="#FFFFFF" stroke-width="2"/>`;
    }).join('');
    const legend = `<div class="legend">${sers.map(s => `<span><i style="background:${s.main || s.solid ? s.color : `repeating-linear-gradient(90deg,${s.color} 0 6px,transparent 6px 10px)`}"></i>${esc(s.name)}</span>`).join('')}</div>`;
    setTimeout(() => {
      const root = document.getElementById(id); if (!root) return;
      const svg = root.querySelector('svg'), tip = root.querySelector('.tip'), cross = root.querySelector('.cross'), dot = root.querySelector('.hdot');
      svg.addEventListener('pointermove', ev => {
        const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) / r.width * W;
        const i = Math.max(0, Math.min(nP - 1, Math.round((px - L) / (W - L - Rp) * (nP - 1))));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
        dot.setAttribute('cx', x(i)); if (isFinite(sers[0].points[i].v)) { dot.setAttribute('cy', y(sers[0].points[i].v)); dot.style.display = ''; } else dot.style.display = 'none';
        tip.hidden = false;
        tip.innerHTML = `<span class="d">${pts[i].d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>` + sers.map((s, si) => `<div class="r ${si ? 'sec2' : ''}"><span>${esc(s.short || s.name)}</span><b>${esc(fmt(s.points[i].v))}</b></div>`).join('');
        tip.style.left = Math.max(110, Math.min(r.width - 110, x(i) / W * r.width)) + 'px';
      });
      svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.style.display = 'none'; dot.style.display = 'none'; });
    });
    return `${legend}<div class="chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(sers[0].name)} over time">
      ${grid}<line x1="${L}" x2="${W - Rp}" y1="${H - B}" y2="${H - B}" stroke="var(--base)"/>${xl}${lines}
      <line class="cross" y1="${T}" y2="${H - B}" stroke="#B5B3AC" style="display:none"/>
      <circle class="hdot" r="5" fill="${sers[0].color}" stroke="#FFFFFF" stroke-width="2" style="display:none"/>
      <rect x="${L}" y="${T}" width="${W - L - Rp}" height="${H - T - B}" fill="transparent"/>
      ${(() => { const used = {}; return marks.map(mk => { const k = mk.i; used[k] = (used[k] || 0) + 1; const cy = T + 12 + (used[k] - 1) * 22; return `<g class="mark"><line x1="${x(mk.i)}" x2="${x(mk.i)}" y1="${cy + 9}" y2="${H - B}" stroke="${mk.color}" stroke-width="1.2" stroke-dasharray="3 4" opacity=".7"/><circle cx="${x(mk.i)}" cy="${cy}" r="9.5" fill="${mk.color}" stroke="#FFFFFF" stroke-width="2"/><text x="${x(mk.i)}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">${mk.n}</text><title>${esc(mk.title)}</title></g>`; }).join(''); })()}
    </svg><div class="tip" hidden></div></div>`;
  }
  function spark(cur, prev, color) {
    const W = 220, H = 44, all = (cur || []).concat(prev || []).map(p => p.v).filter(v => isFinite(v));
    if (!cur || !all.length) return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>`;
    const lo = Math.min(...all), hi = Math.max(...all), sp = hi - lo || 1;
    const path = s => { let pen = false; return s.map((p, i) => { if (!isFinite(p.v)) { pen = false; return ''; } const seg = `${pen ? 'L' : 'M'}${(i / Math.max(1, s.length - 1) * (W - 4) + 2).toFixed(1)},${(H - 4 - (p.v - lo) / sp * (H - 8)).toFixed(1)}`; pen = true; return seg; }).join(''); };
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${prev ? `<path d="${path(prev)}" fill="none" stroke="var(--prev)" stroke-width="1.4" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>` : ''}<path d="${path(cur)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
