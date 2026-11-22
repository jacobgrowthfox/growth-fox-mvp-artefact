// Smoke test: serves app/ locally, opens every page for each client in headless Chromium,
// and fails if any page throws or logs an error. Run from the repo root:  node tools/smoke.js
// Uses the Playwright that is pre-installed in Claude Code cloud sessions (require('playwright')).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { makeDocs } = require('./fixtures/hue-therapy');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
// claude.ai wraps index.html in a document skeleton (doctype, utf-8 charset, viewport); mimic it here.
const wrap = body => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`;

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const ext = path.extname(file);
  let body = fs.readFileSync(file, 'utf8');
  if (rel === 'index.html') body = wrap(body);
  res.writeHead(200, { 'Content-Type': `${TYPES[ext] || 'text/plain'}; charset=utf-8` });
  res.end(body);
});

const ROUTES = ['overview', 'paid', 'paid/gads', 'paid/meta', 'analytics', 'analytics/meta', 'analytics/ga4', 'analytics/shop', 'analytics/app',
  'param/ga4/purchase.currency', 'engineer', 'recs', 'ledger', 'brief', 'action/ps-neg', 'action/hist-h1'];
// hue-therapy is a real client: outside claude.ai it shows its waiting page, so it runs twice: once as is, and once with the
// local fixture shaped like its export (invented numbers, tools/fixtures/hue-therapy.js) so its Stage 1 pages render.
const CLIENTS = ['nordlys', 'flamehouse', 'hue-therapy', 'hue-therapy+fixture'];
const END = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - 864e5; })();

server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];
  let pages = 0;
  for (const run of CLIENTS) {
    const [client, fx] = run.split('+');
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    if (fx) await page.addInitScript(d => { window.__gfFixture = { 'hue-therapy': d }; }, makeDocs({ endT: END }));
    page.on('pageerror', e => errors.push(`${run} #${page.url().split('#')[1]}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${run} console: ${m.text()}`); });
    await page.addInitScript(c => { try { localStorage.setItem('gf.client', JSON.stringify(c)); } catch (e) {} }, client);
    await page.goto(url + '#overview', { waitUntil: 'load' });
    for (const r of ROUTES) {
      await page.evaluate(h => { location.hash = h; }, r);
      await page.waitForTimeout(50);
      const len = await page.evaluate(() => document.querySelector('#app').innerHTML.length);
      if (len < 100) errors.push(`${run} #${r}: page rendered almost nothing (${len} characters)`);
      pages++;
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(`${pages} pages checked, ${errors.length} error${errors.length === 1 ? '' : 's'}`);
  for (const e of errors) console.log('  ' + e);
  process.exit(errors.length ? 1 : 0);
});
