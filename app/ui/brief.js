  /* ---------- The CMO brief: a one-page, self-contained HTML file ---------- */
  function briefChart(c, x) {
    const e = x.e, days = c.hist.days, R0 = x.R0, n = R0.to - R0.from + 1;
    const avg = (i0) => { const sl = days.slice(Math.max(0, i0 - 6), i0 + 1); return sum(sl.map(d => e ? d.revenue : d.conv)) / sl.length; };
    const cur = []; for (let i = R0.from; i <= R0.to; i++) cur.push(avg(i));
    const prev = x.prevRange ? (() => { const p = []; for (let i = x.prevRange.from; i <= x.prevRange.to; i++) p.push(avg(i)); return p.slice(0, n); })() : null;
    const W = 1000, H = 300, L = 64, Rp = 16, T = 16, B = 32;
    const all = cur.concat(prev || []);
    let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.2 || hi * 0.1 || 1; lo -= pad; hi += pad;
    const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
    const X = i => L + (n === 1 ? 0 : i / (n - 1)) * (W - L - Rp), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const ax = v => e ? (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)) : (Math.round(v * 10) / 10);
    const grid = ticks.map(tk => `<line x1="${L}" x2="${W - Rp}" y1="${Y(tk)}" y2="${Y(tk)}" stroke="#EFEDE7"/><text x="${L - 10}" y="${Y(tk) + 4}" text-anchor="end" font-size="13" fill="#6B706C">${ax(tk)}</text>`).join('');
    const every = Math.max(1, Math.ceil(n / 6));
    const xl = cur.map((_, i) => (i % every === 0 && n - 1 - i > every * 0.6) || i === n - 1 ? `<text x="${X(i)}" y="${H - 8}" font-size="13" fill="#6B706C" text-anchor="${i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}">${days[R0.from + i].date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>` : '').join('');
    const HEX = { paid: '#2F5BBD', analytics: '#6E4FB6', engineer: '#B4551F', commercial: '#B4551F' };
    const dots = x.marks.map((r, k) => { const i = Math.max(0, Math.min(n - 1, c.hist.n - 1 - r.d - R0.from)), col = HEX[r.fox] || '#5E6461', cx = X(i), cy = Y(cur[i]); return `<circle cx="${cx}" cy="${cy}" r="11" fill="${col}" stroke="#FFFFFF" stroke-width="2.5"/><text x="${cx}" y="${cy + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#FFFFFF">${k + 1}</text>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${e ? 'Revenue' : 'Leads'} per day, 7-day average"><g>${grid}<line x1="${L}" x2="${W - Rp}" y1="${H - B}" y2="${H - B}" stroke="#D9D7D0"/>${xl}
      ${prev ? `<path d="${line(prev)}" fill="none" stroke="#B9BCB8" stroke-width="2" stroke-dasharray="6 5"/>` : ''}
      <path d="${line(cur)}L${X(n - 1)},${H - B}L${X(0)},${H - B}Z" fill="#0E5A47" fill-opacity="0.06"/><path d="${line(cur)}" fill="none" stroke="#0E5A47" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}</g></svg>`;
  }
  function briefHtml(c, forPdf) {
    const x = execData(c), t = execText(c, x), e = x.e, today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const period = rangeText(c, x.R0), cmp = x.basis === 'within' ? 'latest 2 weeks vs the first 2 weeks of the period' : x.prevRange ? `compared with ${rangeText(c, x.prevRange)}` : 'no earlier period of the same length yet';
    const ch = x.ch, A = x.A;
    const delta = (k, neutral) => { const v = ch(k); if (v == null) return ''; const cls = neutral || Math.abs(v) < 0.005 ? 'flat' : v > 0 ? 'up' : 'down'; return `<span class="d ${cls}">${v > 0 ? '↑' : v < 0 ? '↓' : '±'} ${pctAbs(v)}</span>`; };
    const rm = REV_MODELS[revModelOf(c)];
    const rows = (e ? rm.parts.map(([k, l]) => [l, revFmt(c, k, A[k]), k]).concat([['Ad spend', m(A.spend, c), 'spend', 1]])
      : [['Leads', n0(A.conv), 'conv'], ['Booked meetings', n0(A.meet), 'meet'], ['Ad spend', m(A.spend, c), 'spend', 1]])
      .map(([l, v, k, neu]) => `<tr><td>${l}</td><td class="r"><b>${v}</b></td><td class="r">${delta(k, neu)}</td></tr>`).join('')
      + (x.dq.now == null ? '' : `<tr><td>Data quality <small>(today, out of 100)</small></td><td class="r"><b>${Math.round(x.dq.now)}</b></td><td class="r">${dqPill(x.dq, 'd')}</td></tr>`);
    const HEX = { paid: '#2F5BBD', analytics: '#6E4FB6', engineer: '#B4551F', commercial: '#B4551F' };
    const changes = x.marks.map((r, k) => { const v = changeVerdict(r); return `<tr><td><span class="n" style="background:${HEX[r.fox] || '#5E6461'}">${k + 1}</span></td><td>${esc(new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}</td><td><b>${esc(r.title)}</b><br><small>${esc(FOX[r.fox].name)}</small></td><td>${esc(v.text)}</td><td class="r">${r.status === 'verified' ? esc(doneValue(c, r)) : r.expectedPerDay && (r.unit === 'saved' || r.unit === 'revenue') ? `<small>expected</small> ${esc(m(r.expectedPerDay * 30, c))}/month` : '—'}</td></tr>`; }).join('');
    const todo = x.todo.map((r, i) => `<li><b>${esc(r.title)}</b><span class="v">${esc(todoValue(c, r))}</span><br><small>${esc(FOX[r.fox].name)} · ${r.owner === 'GrowthFox team' ? 'The GrowthFox team makes this change' : `Owner: your team${r.minutes ? `, about ${r.minutes} minutes` : ''}`}</small><p>${esc(r.action)}</p></li>`).join('');
    const focus = x.mood === 'down' ? 'todo' : x.mood === 'up' ? 'done' : '';
    const doneBlock = `<section class="blk ${focus === 'done' ? 'focus' : ''}"><h2>What we’ve done</h2>
        <p class="kpi"><b>${x.marks.length}</b> change${x.marks.length === 1 ? '' : 's'} put in place · <b>${x.ver.length}</b> verified${x.pending.length ? ` · ${x.pending.length} being verified` : ''}${x.savedMo ? ` · <b>${m(x.savedMo, c)}</b>/month wasted spend removed` : ''}${x.revMo ? ` · an estimated <b>${m(x.revMo, c)}</b>/month in revenue` : ''}</p>
        ${changes ? `<table class="tbl"><thead><tr><th></th><th>Date</th><th>Change</th><th>Status</th><th class="r">Measured result</th></tr></thead><tbody>${changes}</tbody></table>` : '<p class="muted">No changes were put in place in this period.</p>'}
      </section>`;
    const todoBlock = `<section class="blk ${focus === 'todo' ? 'focus' : ''}"><h2>What to do next</h2>
        <p class="kpi">${x.worthMo ? `The top ${x.todo.length} actions are worth about <b>${m(x.worthMo, c)}</b> a month.` : `${x.todo.length} open action${x.todo.length === 1 ? '' : 's'}.`}</p>
        ${todo ? `<ol class="todo">${todo}</ol>` : '<p class="muted">Nothing open right now.</p>'}
      </section>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.cfg.name)}: marketing brief, ${esc(period)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap">
<style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #FAF9F6; color: #1A1D1B; font: 15px/1.5 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { max-width: 880px; margin: 0 auto; padding: 40px 32px 48px; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; border-bottom: 2px solid #0E5A47; padding-bottom: 14px; }
.brand { color: #0E5A47; font-weight: 700; font-size: 20px; letter-spacing: -0.02em; }
header h1 { margin: 4px 0 0; font-size: 28px; letter-spacing: -0.02em; font-weight: 600; }
header .meta { text-align: right; color: #5E6461; font-size: 13px; }
.sample { display: inline-block; margin-top: 4px; background: #FBF0DC; color: #7A4200; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
.headline { margin: 26px 0 6px; font-size: 24px; line-height: 1.3; font-weight: 600; letter-spacing: -0.015em; }
.sub { margin: 0 0 22px; font-size: 16px; color: #4D534F; }
.blk { background: #FFFFFF; border: 1px solid #E5E3DD; border-radius: 16px; padding: 20px 22px; margin-top: 16px; break-inside: avoid; }
.blk.focus { border: 2px solid #0E5A47; }
.blk h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E6461; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.blk h2 i { font-style: normal; display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #0E5A47; color: #FFFFFF; font-size: 12px; letter-spacing: 0; }
.blk.focus h2::after { content: 'Focus'; margin-left: auto; background: #E6F3EC; color: #0E5A47; border-radius: 10px; padding: 2px 10px; font-size: 11px; }
.big { font-size: 34px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }
.cols { display: grid; grid-template-columns: 1fr 1.3fr; gap: 28px; align-items: start; }
.tbl td:nth-child(2) { white-space: nowrap; }
.kpi { margin: 0 0 10px; color: #4D534F; } .kpi b { color: #1A1D1B; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-weight: 500; color: #6B706C; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid #ECEAE4; padding: 0 8px 8px; }
.tbl td { border-bottom: 1px solid #ECEAE4; padding: 8px; vertical-align: top; }
.tbl tr:last-child td { border-bottom: 0; }
.r { text-align: right; white-space: nowrap; }
.d { font-size: 12px; font-weight: 600; border-radius: 10px; padding: 1px 8px; }
.d.up { background: #E6F3EC; color: #1F7A55; } .d.down { background: #FDECEA; color: #B42318; } .d.flat { background: #F0F1ED; color: #4D534F; }
.n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: #FFFFFF; font-size: 11px; font-weight: 700; }
small, .muted { color: #5E6461; font-size: 12.5px; }
svg { display: block; width: 100%; height: auto; margin-top: 8px; }
.legend { display: flex; gap: 18px; font-size: 12.5px; color: #4D534F; margin-top: 6px; flex-wrap: wrap; }
.legend i { display: inline-block; width: 18px; height: 3px; border-radius: 2px; vertical-align: 3px; margin-right: 6px; }
.todo { margin: 0; padding-left: 20px; display: grid; gap: 12px; }
.todo li { padding-left: 4px; }
.todo .v { float: right; font-weight: 600; color: #1F7A55; margin-left: 12px; }
.todo p { margin: 4px 0 0; color: #4D534F; font-size: 14px; }
footer { margin-top: 22px; color: #6B706C; font-size: 12px; line-height: 1.5; }
@media (max-width: 680px) { .cols { grid-template-columns: 1fr; } header .meta { text-align: left; } .page { padding: 24px 16px; } }
@media print { body { background: #FFFFFF; } .page { padding: 0; max-width: none; } }
body.pdf { background: #FFFFFF; } body.pdf .page { padding: 8px 4px; }
</style></head><body${forPdf ? ' class="pdf"' : ''}><div class="page">
<header><div><div class="brand">GrowthFox</div><h1>${esc(c.cfg.name)} · Marketing brief</h1></div>
<div class="meta">${esc(period)}<br>${esc(cmp[0].toUpperCase() + cmp.slice(1))}<br>Prepared ${esc(today)}<br>${c.cfg.real ? '<span class="sample" style="background:#E6F3EC;color:#0E5A47">Google Ads data</span>' : '<span class="sample">Sample data</span>'}</div></header>
<p class="headline">${esc(t.head)}</p>
<p class="sub">${esc(t.sub)}</p>
${x.mood === 'down' ? todoBlock : ''}
<section class="blk"><h2>How it’s going</h2>
  <div class="cols"><div><p class="big">${t.val}${x.chg == null ? '' : ` <span class="d ${x.mood === 'up' ? 'up' : x.mood === 'down' ? 'down' : 'flat'}" style="font-size:15px;vertical-align:6px;letter-spacing:0">${x.chg > 0 ? '↑' : '↓'} ${pctAbs(x.chg)}</span>`}</p><p class="kpi">${x.chg == null ? 'No earlier period to compare with yet' : esc(cmp[0].toUpperCase() + cmp.slice(1))}</p>
  </div><table class="tbl"><tbody>${rows}</tbody></table></div>
  <div style="margin-top:18px"><b style="font-size:14px">${e ? 'Revenue' : 'Leads'} per day</b> <small>(7-day average)</small>${briefChart(c, x)}
  <div class="legend"><span><i style="background:#0E5A47"></i>This period</span>${x.prevRange ? '<span><i style="background:#B9BCB8"></i>Previous period</span>' : ''}<span>Numbered dots: changes listed under “What we’ve done”</span></div></div>
</section>
${x.mood === 'down' ? doneBlock : doneBlock + todoBlock}
<footer>${e ? `Revenue and orders from ${esc(c.cfg.orderSourceName || 'Shopify')}` : c.cfg.leadSource ? `Leads are ${esc(c.cfg.leadSource)}` : 'Leads from forms and Calendly'}; ad spend from platform billing. The line shows correlation, not proof: ${e ? 'revenue' : 'lead volume'} also moves with season, pricing, promotions and the market. Each change’s own result is verified in the ad platform; “saved” is wasted spend removed, measured after the change. Revenue effects are modeled estimates. Only an experiment, such as a holdout, proves an incremental effect on the whole business.<br>${c.cfg.real ? `Generated by GrowthFox from ${esc(c.cfg.name)}’s Google Ads data${c.cfg.dataThrough ? `, through ${esc(new Date(c.cfg.dataThrough + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''}.` : 'Generated by GrowthFox from sample data. Every number in this brief is generated, not a real client’s.'}</footer>
</div></body></html>`;
  }
  /* The PDF is drawn from the same brief: rendered in a hidden frame, captured, then cut into A4 pages
     at block boundaries so no section is split across pages. Libraries load only on the first click. */
  const PDF_LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
  let pdfLibs = null;
  const loadScript = src => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('script')); document.head.appendChild(el); });
  const pdfReady = () => pdfLibs || (pdfLibs = Promise.all([window.html2canvas ? 0 : loadScript(PDF_LIBS[0]), window.jspdf ? 0 : loadScript(PDF_LIBS[1])]).catch(e => { pdfLibs = null; throw e; }));
  async function briefPdf(c) {
    await pdfReady();
    const fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;height:2400px;border:0;visibility:hidden';
    document.body.appendChild(fr);
    try {
      await new Promise(r => { fr.onload = r; fr.srcdoc = briefHtml(c, true); });
      const doc = fr.contentDocument;
      try { await Promise.race([doc.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* system font fallback */ }
      await new Promise(r => setTimeout(r, 120));
      const root = doc.querySelector('.page'), top0 = root.getBoundingClientRect().top;
      const blocks = [...root.children].map(el => { const r = el.getBoundingClientRect(); return { top: r.top - top0, bottom: r.bottom - top0 }; });
      const canvas = await window.html2canvas(root, { scale: 2, backgroundColor: '#FFFFFF', logging: false, useCORS: true });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const M = 12, PW = 210 - 2 * M, PH = 297 - 2 * M, cssW = root.offsetWidth, mm = PW / cssW, px = canvas.width / cssW;
      const total = Math.ceil(root.getBoundingClientRect().height), perPage = PH / mm;
      let start = 0, page = 0;
      while (start < total - 2) {
        let end = Math.min(total, start + perPage);
        if (end < total) { const fit = blocks.filter(b => b.bottom <= end && b.bottom > start + 60).map(b => b.bottom); if (fit.length) end = Math.max(...fit); }
        const sl = document.createElement('canvas'); sl.width = canvas.width; sl.height = Math.max(1, Math.round((end - start) * px));
        const g = sl.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, sl.width, sl.height);
        g.drawImage(canvas, 0, Math.round(start * px), sl.width, sl.height, 0, 0, sl.width, sl.height);
        if (page++) pdf.addPage();
        pdf.addImage(sl.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, PW, (end - start) * mm);
        const next = blocks.filter(b => b.top >= end - 1).map(b => b.top);
        start = end < total && next.length ? Math.min(...next) : end;
      }
      pdf.setProperties({ title: `${c.cfg.name}: marketing brief`, creator: 'GrowthFox' });
      return pdf.output('arraybuffer');
    } finally { fr.remove(); }
  }
  async function downloadBrief(c) {
    if (!downloads || state.pdfBusy) return;
    const R0 = chgRange(c), d = i => { const t = c.hist.days[i].date; return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
    const filename = `GrowthFox brief - ${c.cfg.name} - ${d(R0.from)} to ${d(R0.to)}.pdf`;
    state.pdfBusy = true; render();
    let data;
    try { data = await briefPdf(c); }
    catch (e) { state.pdfBusy = false; render(); toast('Couldn’t build the PDF. Check your connection and try again.'); return; }
    state.pdfBusy = false; render();
    try {
      await downloads.save({ filename, data });
      toast('PDF saved.');
    } catch (err) {
      const code = err && err.code;
      if (code === 'declined') return;
      if (code === 'rate_limited') toast('A download is already waiting for your answer.');
      else if (code === 'extension_not_enabled') toast('PDF downloads aren’t available in this view.');
      else if (['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) { downloads = null; render(); toast('Downloads aren’t available in this view.'); }
      else toast('Couldn’t create the download. Please try again.');
    }
  }
