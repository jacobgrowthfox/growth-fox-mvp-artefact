  /* ---------- Rule engine ---------- */
  const EFFORT_W = { low: 1, med: 1.6, high: 2.5 };
  // Confidence weights from the Analytical Framework: High 1.0, Medium 0.6, Low 0.3
  const CONF_W = { certain: 1, strong: 1, moderate: 0.6, investigate: 0.3 };
  // Value checks per parameter type (PRD). Parameters without one are checked for presence only.
  function validRule(key) {
    const k = key.toLowerCase().replace(/^\w+\./, '');
    if (/currency/.test(k)) return 'an ISO 4217 code such as DKK or EUR';
    if (/(^|_)(value|total|total_price|conversion_value)$/.test(k)) return 'a positive number';
    if (/(transaction_id|order_id|event_id)$/.test(k)) return 'present and unique';
    if (/(event_time|date_time|created_at)$/.test(k)) return 'within the last few days';
    if (/^(em|ph|fn|ln|ct|zp|external_id)$|hashed_/.test(k)) return 'a valid SHA-256 hash';
    if (k === 'event_name') return 'on the platform’s standard event list';
    return '';
  }
  function build(cfg, data, opts = {}) {
    const recs = [];
    const isEcom = cfg.route === 'ecom';
    const warm = data.n >= 28;
    const warmLeft = Math.max(0, 28 - data.n);
    const w28 = win(data, Math.min(28, data.n));
    const blended = isEcom ? w28.revenue / w28.spend : w28.spend / w28.conv;
    const perDay = x => x / w28.len;

    // Impact on the Paid Media fox's focus metric
    function focusDelta(dSpendPerDay, dConvPerDay, dRevPerDay) {
      const S = perDay(w28.spend), C = perDay(w28.conv), R = perDay(w28.revenue);
      const v = isEcom ? (R + dRevPerDay) / (S + dSpendPerDay) - R / S : (S + dSpendPerDay) / (C + dConvPerDay) - S / C;
      return isFinite(v) ? v : 0; // no conversions in the window: the cost-per-lead effect can't be computed
    }

    /* Spend-Watch: spend with no conversions under any reasonable rule.
       Real clients get it from the period scan instead (scanSpend → pm.2.spend.spend_no_conversions). */
    for (const c of cfg.real ? [] : cfg.campaigns) {
      const w7 = campWindow(data, c.id, 7);
      if (w7.spend < cfg.spendWatchMin) continue;
      if (w7.lc > 0.5 || w7.lin > 0.5 || w7.plat > 0.5) continue;
      const daily = [];
      for (let i = data.n - 7; i < data.n; i++) { const x = data.days[i].camps[c.id]; daily.push([data.days[i].date, x.spend, x.clicks, 0, 0, 0]); }
      const sPerDay = w7.spend / 7;
      const po = cfg.platformOnly, lastConv = po && cfg.lastConversion ? new Date(cfg.lastConversion + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
      recs.push({
        id: 'sw-' + c.id, area: 'spend', rule: po ? `Spends ${money(cfg.spendWatchMin, cfg)}+ in 7 days with zero conversions recorded by ${PLATFORMS[c.platform]} (the only conversion source connected)` : `Spends ${money(cfg.spendWatchMin, cfg)}+ in 7 days with zero ${cfg.convNoun} under every attribution rule`, agent: 'spend-watch', fox: 'paid', kind: 'cut', platform: c.platform, campaign: c.name,
        title: `${c.name} spent ${money(w7.spend, cfg)} in 7 days with zero ${cfg.convNoun}`,
        observe: po ? `${money(w7.spend, cfg)} spent and ${Math.round(w7.clicks).toLocaleString('en')} clicks in the last 7 days, and ${PLATFORMS[c.platform]} recorded zero conversions.${lastConv ? ` Its last recorded conversion was on ${lastConv}.` : ''} No lead source of your own is connected yet to cross-check.`
          : `${money(w7.spend, cfg)} spent and ${Math.round(w7.clicks).toLocaleString('en')} clicks in the last 7 days. Zero ${cfg.convNoun} matched by ${isEcom ? 'order' : 'lead'} ID, and zero claimed by ${PLATFORMS[c.platform]} itself.`,
        means: po ? `Either the campaign isn’t producing ${cfg.convNoun}, or conversion tracking has stopped recording them. Both are worth sorting out before more budget goes in.` : `No attribution rule credits this campaign with a single ${cfg.convNounOne}. ${c.note || ''}`.trim(),
        action: po ? `Check that conversion tracking still records ${cfg.convNoun} (Google Ads → Goals → Conversions). If it does, pause the campaign or cut its budget.` : 'Pause the campaign, or check which conversion event it optimizes for.',
        expect: `Save about ${money(sPerDay, cfg)} a day.`,
        hypothesis: po ? `Conversion tracking stopped recording (often after a website change), or the ads reach people who don’t get in touch.` : `The campaign optimizes for an event that doesn’t lead to ${cfg.convNoun}, or reaches people who don’t buy.`,
        success: `Campaign spend is 0 within 24 hours of pausing; total ${cfg.convNoun} unchanged over 7 days.`,
        verifyDays: 7, unit: 'saved', spendChangedPerDay: sPerDay,
        valuePerDay: sPerDay, effort: 'low', minutes: 2,
        confidence: po ? 'moderate' : c.note ? 'strong' : 'certain',
        labels: { spend: 'observed', conv: 'observed' },
        focus: focusDelta(-sPerDay, 0, 0),
        evidence: po ? {
          cols: ['Day', 'Spend', 'Clicks', `${PLATFORMS[c.platform]} conversions`],
          rows: daily.map(d => d.slice(0, 4)), money: [1],
          rules: [[`${PLATFORMS[c.platform]}-claimed`, 0]],
          verdict: `Only ${PLATFORMS[c.platform]}’s own conversion count is connected, so confidence is capped at medium.`,
        } : {
          cols: ['Day', 'Spend', 'Clicks', 'Last click 7d', 'Linear 28d', 'Platform-claimed'],
          rows: daily, money: [1],
          rules: [['Last click, 7-day', 0], ['Linear, 28-day', 0], [`${PLATFORMS[c.platform]}-claimed`, 0]],
          verdict: 'Holds under every rule.',
        },
      });
    }

    /* Paid-Search: weekly review of search campaigns */
    const search = cfg.campaigns.filter(c => c.platform === 'gads' && c.type === 'search');
    const cw = {}; for (const c of cfg.campaigns) cw[c.id] = campWindow(data, c.id, Math.min(28, data.n));
    const cpa = (c, rule) => cw[c.id].spend / Math.max(0.01, cw[c.id][rule]);
    const searchSpend = search.reduce((s, c) => s + cw[c.id].spend, 0);
    const searchConv = search.reduce((s, c) => s + cw[c.id].lc, 0);
    const avgCpa = searchSpend / searchConv;
    const RULES = cfg.platformOnly ? [['plat', 'Google Ads-claimed']] : [['lc', 'Last click, 7-day'], ['lin', 'Linear, 28-day'], ['plat', 'Google Ads-claimed']];
    const noun1 = isEcom ? 'order' : 'lead';

    if (isEcom) {
      // Reallocation needs 28 days of data (trend-based) → warmup gate
      const good = search.filter(c => c.isLost >= 0.1).sort((a, b) => cpa(a, 'lc') - cpa(b, 'lc'))[0];
      const bad = search.filter(c => cpa(c, 'lc') > 1.5 * avgCpa && c !== good);
      for (const b of bad) {
        const shift = Math.round(Math.min(0.3 * cw[b.id].spend / w28.len, good.isLost * cw[good.id].spend / w28.len) / 50) * 50;
        const flips = RULES.filter(([k]) => !(cpa(b, k) > 1.2 * cpa(good, k)));
        const dConv = shift / cpa(good, 'lc') * 0.8 - shift / cpa(b, 'lc');
        const dRev = dConv * cfg.aov;
        const base = {
          agent: 'paid-search', fox: 'paid', platform: 'gads', campaign: b.name,
          labels: { spend: 'observed', conv: 'modeled' },
          evidence: {
            cols: ['Campaign', 'Spend 28d', 'Last click CPA', 'Linear CPA', 'Claimed CPA', 'Lost IS (budget)'],
            rows: [b, good].map(c => [c.name, cw[c.id].spend, cpa(c, 'lc'), cpa(c, 'lin'), cpa(c, 'plat'), Math.round(c.isLost * 100) + '%']),
            money: [1, 2, 3, 4],
            rules: RULES.map(([k, label]) => [label, `${money(cpa(b, k), cfg)} vs ${money(cpa(good, k), cfg)}`]),
          },
        };
        if (flips.length === 0) {
          recs.push(Object.assign(base, {
            id: 'ps-realloc-' + b.id, area: 'spend', rule: 'One search campaign loses 10%+ impression share to budget and is cheaper per order under every rule; another costs 1.5× the search average', kind: 'reallocate', fox: 'paid', alsoFox: 'commercial',
            title: `Move ${money(shift, cfg)}/day from ${short(b.name)} to ${short(good.name)}`,
            observe: `${short(b.name)} costs ${money(cpa(b, 'lc'), cfg)} per ${noun1}. ${short(good.name)} costs ${money(cpa(good, 'lc'), cfg)} and loses ${Math.round(good.isLost * 100)}% of its impression share to budget.`,
            means: `The cheaper campaign could take more budget. The gap holds under all three attribution rules.`,
            action: `Lower the ${short(b.name)} daily budget by ${money(shift, cfg)} and raise ${short(good.name)} by the same amount.`,
            expect: `About ${fmt1(dConv * 7)} more ${cfg.convNoun} a week (+${money(dRev, cfg)}/day revenue), assuming 20% diminishing returns.`,
            hypothesis: `${short(good.name)} is held back by its budget, so extra budget buys more ${cfg.convNoun} at a similar cost.`,
            success: `${short(good.name)} loses under 10% impression share to budget, and blended ROAS is up, within 14 days.`,
            verifyDays: 14, unit: 'revenue', spendChangedPerDay: shift,
            valuePerDay: dRev, revPerDay: dRev, effort: 'low', minutes: 5, confidence: 'strong',
            focus: focusDelta(0, dConv, dRev),
            warmupGate: true,
          }));
          base.evidence.verdict = 'Holds under every rule.';
        } else {
          recs.push(Object.assign(base, {
            id: 'ps-inv-' + b.id, area: 'spend', rule: 'A search campaign costs 1.5× the search average under last click, but not under every rule', kind: 'investigate',
            title: `Check whether ${short(b.name)} is worth its budget`,
            observe: `Under last click it costs ${money(cpa(b, 'lc'), cfg)} per ${noun1}, well above the ${money(avgCpa, cfg)} search average. Under ${flips.map(f => f[1].toLowerCase()).join(' and ')} it looks fine (${money(cpa(b, flips[0][0]), cfg)}).`,
            means: 'The verdict depends on the attribution rule, so we don’t recommend a cut. The campaign may start journeys that other campaigns finish.',
            action: 'Our team will look at assisted conversions and path data, and come back with a recommendation.',
            expect: 'A clear keep or cut decision within a week.',
            hypothesis: 'The campaign may start journeys that other campaigns finish, so last click undervalues it.',
            success: 'A keep or cut decision, with the path data behind it, within 7 days.',
            verifyDays: 7, unit: 'none', spendChangedPerDay: 0,
            valuePerDay: 0, effort: 'low', minutes: 0, confidence: 'investigate', owner: 'GrowthFox team',
            focus: 0, warmupGate: true,
          }));
          base.evidence.verdict = `Flips under ${flips.map(f => f[1]).join(', ')}. Downgraded to investigate.`;
        }
      }
    } else {
      // B2B: cuts only
      for (const b of search.filter(c => cpa(c, 'lc') > 1.5 * avgCpa)) {
        const flips = RULES.filter(([k]) => !(cpa(b, k) > 1.2 * (searchSpend / search.reduce((s, c) => s + cw[c.id][k], 0))));
        const cut = Math.round(0.5 * cw[b.id].spend / w28.len / 10) * 10;
        const lostLeads = cut / cpa(b, 'lc');
        recs.push({
          id: 'ps-cut-' + b.id, area: 'spend', rule: 'A search campaign costs 1.5× the search average per lead under every rule', agent: 'paid-search', fox: 'paid', kind: flips.length ? 'investigate' : 'cut', platform: 'gads', campaign: b.name,
          title: flips.length ? `Check whether ${short(b.name)} is worth its budget` : `Cut ${short(b.name)} budget by half (${money(cut, cfg)}/day)`,
          observe: `${short(b.name)} costs ${money(cpa(b, 'lc'), cfg)} per lead over the last ${w28.len} days. The search average is ${money(avgCpa, cfg)}.`,
          means: `You pay ${(cpa(b, 'lc') / avgCpa).toFixed(1)}× the search average per lead. ` + (flips.length ? 'But the verdict flips under another rule.' : cfg.platformOnly ? 'Based on Google Ads’ own conversion count, the only one connected.' : 'The gap holds under all three attribution rules.'),
          action: `Lower the daily budget from ${money(cw[b.id].spend / w28.len, cfg)} to ${money(cw[b.id].spend / w28.len - cut, cfg)}.`,
          expect: `Save ${money(cut, cfg)}/day for about ${fmt1(lostLeads * 7)} fewer leads a week.`,
          hypothesis: `${short(b.name)} buys expensive clicks that rarely turn into leads.`,
          success: `Daily spend on ${short(b.name)} is down ${money(cut, cfg)} within 2 days; total leads drop by no more than ${fmt1(lostLeads * 7 * 1.5)} a week over 14 days.`,
          verifyDays: 14, unit: 'saved', spendChangedPerDay: cut,
          caveat: 'Optimizes lead volume, not lead quality.',
          valuePerDay: cut - lostLeads * avgCpa, effort: 'low', minutes: 3, confidence: flips.length ? 'investigate' : 'moderate',
          labels: { spend: 'observed', conv: 'modeled' },
          focus: focusDelta(-cut, -lostLeads, 0),
          evidence: {
            cols: ['Campaign', 'Spend', 'Last click CPL', 'Linear CPL', 'Claimed CPL'],
            rows: search.map(c => [c.name, cw[c.id].spend, cpa(c, 'lc'), cpa(c, 'lin'), cpa(c, 'plat')]),
            money: [1, 2, 3, 4],
            rules: RULES.map(([k, label]) => [label, money(cpa(b, k), cfg)]),
            verdict: (data.n < 28 ? `Based on ${data.n} days of data, so confidence is capped at moderate. ` : '') + (cfg.platformOnly ? 'Google Ads-claimed only.' : 'Holds under every rule.'),
          },
        });
      }
    }

    // Negative keywords (a cut, allowed in both routes)
    const target = isEcom ? avgCpa : avgCpa;
    const negs = cfg.searchTerms.filter(s => s.spend28 >= 0.8 * target);
    if (negs.length) {
      const save = negs.reduce((s, x) => s + x.spend28, 0) / 28;
      const camps = [...new Set(negs.map(s => short(cfg.campaigns.find(c => c.id === s.campaign).name)))];
      recs.push({
        id: 'ps-neg', area: 'setup', rule: 'Search terms spend at least 80% of the average cost per conversion, with zero conversions under every rule', agent: 'paid-search', fox: 'paid', kind: 'negative', platform: 'gads', campaign: camps.join(', '),
        title: `Add ${negs.length} negative keywords to stop ${money(save * 7, cfg)}/week of wasted search spend`,
        observe: `${negs.length} search terms spent ${money(save * 28, cfg)} over 28 days with zero ${cfg.convNoun} under any rule.`,
        means: 'These searches show no buying intent (repairs, manuals, freebies, jobs, logins).',
        action: `Add them as exact-match negatives in ${camps.join(' and ')}.`,
        expect: `Save about ${money(save, cfg)} a day with no expected loss of ${cfg.convNoun}.`,
        hypothesis: 'Broad and phrase match let these campaigns show for searches with no buying intent.',
        success: `Spend on these terms is 0 within 7 days; ${cfg.convNoun} unchanged.`,
        verifyDays: 7, unit: 'saved', spendChangedPerDay: save,
        caveat: isEcom ? null : 'Optimizes lead volume, not lead quality.',
        valuePerDay: save, effort: 'low', minutes: 5, confidence: 'strong',
        labels: { spend: 'observed', conv: 'observed' },
        focus: focusDelta(-save, 0, 0),
        evidence: {
          cols: ['Search term', 'Campaign', 'Spend 28d', 'Clicks', cfg.convNoun[0].toUpperCase() + cfg.convNoun.slice(1)],
          rows: negs.map(s => [s.term, short(cfg.campaigns.find(c => c.id === s.campaign).name), s.spend28, s.clicks, 0]),
          money: [2],
          rules: cfg.platformOnly ? [['Google Ads-claimed', 0]] : [['Last click, 7-day', 0], ['Linear, 28-day', 0], ['Google Ads-claimed', 0]],
          verdict: cfg.platformOnly ? 'Google Ads-claimed only.' : 'Holds under every rule.',
        },
      });
    }

    // Brand CPC trend (a trend recommendation → needs warmup)
    const brand = cfg.campaigns.find(c => c.type === 'brand');
    if (brand && brand.cpcRise) {
      const bw = cw[brand.id];
      const save = 0.18 * bw.spend / w28.len;
      recs.push({
        id: 'ps-brand', area: 'spend', rule: 'Brand CPC up 20%+ over 4 weeks while impression share stays at 95%+', agent: 'paid-search', fox: 'paid', kind: 'bid', platform: 'gads', campaign: brand.name,
        title: `Brand CPCs rose ${Math.round(brand.cpcRise * 100)}% in 4 weeks while impression share sits at 98%`,
        observe: `Average brand CPC went from ${money(brand.cpc, cfg, 2)} to ${money(brand.cpc * (1 + brand.cpcRise), cfg, 2)}. You already show for almost every brand search.`,
        means: 'You’re paying more for clicks you were already getting. A competitor may have started bidding on your name.',
        action: 'Lower the target impression share from 98% to 90%, or set a max CPC cap.',
        expect: `Save about ${money(save, cfg)} a day for a small drop in brand clicks.`,
        hypothesis: 'A competitor started bidding on your brand name, pushing up the price of clicks you’d get anyway.',
        success: 'Brand CPC down at least 10%, with brand clicks down under 5%, within 14 days.',
        verifyDays: 14, unit: 'saved', spendChangedPerDay: save,
        valuePerDay: save * 0.85, effort: 'low', minutes: 5, confidence: 'moderate',
        labels: { spend: 'observed', conv: 'observed' },
        focus: focusDelta(-save, -save / cpa(brand, 'lc') * 0.15, -save / cpa(brand, 'lc') * 0.15 * (cfg.aov || 0)),
        warmupGate: true,
        evidence: {
          cols: ['Week', 'Avg CPC', 'Impression share'],
          rows: [3, 2, 1, 0].map(k => [`${k === 0 ? 'This week' : k + ' weeks ago'}`, brand.cpc * (1 + brand.cpcRise * (3 - k) / 3), (97 + (3 - k) * 0.3).toFixed(0) + '%']),
          money: [1], moneyDecimals: 2,
          rules: [], verdict: 'Trend-based. Uses observed CPC and impression share only.',
        },
      });
    }

    /* Creative & landing pages (Google Ads and Meta). Sample signals: CTR and ad strength per ad,
       creative fatigue (CTR trend × frequency), and conversion rate per landing page from GA4 + store. */
    const perDayC = id => cw[id] ? cw[id].spend / w28.len : 0;
    /* Landing pages (PRD estimation method): benchmark = volume-weighted paid conversion rate (total orders ÷ total sessions).
       Target = the lower of halfway to the benchmark, or today's rate × 1.5. Extra revenue/day = sessions/day × (target − today) × AOV. */
    const LP_HALF = 0.5, LP_CAP = 1.5;
    const lpCalc = lp => { const cur = lp.orders / lp.sessions, bench = lp.benchOrders / lp.benchSessions, half = cur + LP_HALF * (bench - cur), cap = cur * LP_CAP, target = Math.min(half, cap), perDay = lp.sessions / 28; return { cur, bench, half, cap, target, perDay, lift: perDay * Math.max(0, target - cur) * cfg.aov }; };
    const pc1 = v => (v * 100).toFixed(1) + '%';
    const lpNote = lp => { const k = lpCalc(lp); return ` Target ${pc1(k.target)}: the lower of halfway to the paid average (${pc1(k.half)}) and today’s rate × ${LP_CAP} (${pc1(k.cap)}). Extra revenue = ${Math.round(k.perDay)} sessions a day × ${(100 * (k.target - k.cur)).toFixed(2)} pts × average order value.`; };
    const CREATIVE = {
      nordlys: [
        { id: 'cr-lp-c3', platform: 'gads', kind: 'landing', camp: 'c3', effort: 'med', minutes: 60, confidence: 'moderate', unit: 'revenue',
          title: 'Espresso machines ads land on a page that converts at 0.6%',
          observe: '8,140 sessions from these ads in 28 days, 49 orders: a 0.6% conversion rate. The site average for paid search is 1.9%. 71% of the sessions are on mobile.',
          means: 'The ads bring the right searches, but the landing page loses them. The page leads with a long brand story and puts prices below the fold on mobile.',
          hypothesis: 'Visitors searching for a machine want to compare models and prices straight away.',
          action: 'Test the Espresso machines category page (prices, filters) as the landing page for half the traffic, using a Google Ads experiment.',
          success: `Landing-page conversion rate on the test half reaches at least ${pc1(lpCalc({ sessions: 8140, orders: 49, benchSessions: 31600, benchOrders: 600 }).target)} within 14 days, at the same CPC.`,
          lp: { sessions: 8140, orders: 49, benchSessions: 31600, benchOrders: 600 },
          verifyDays: 14, lift: () => lpCalc({ sessions: 8140, orders: 49, benchSessions: 31600, benchOrders: 600 }).lift, labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Landing page', 'Sessions 28d', 'Orders', 'Conversion rate', 'Mobile share'], rows: [['/espresso-machines/story', 8140, 49, '0.6%', '71%'], ['/espresso-machines (category)', 2210, 41, '1.9%', '64%'], ['Paid search average', 31600, 600, '1.9%', '66%']], money: [], rules: [], verdict: 'Observed sessions (GA4) and orders (Shopify, matched by order ID). The lift is an estimate; the experiment proves it.' } },
        { id: 'cr-rsa-c2', platform: 'gads', kind: 'creative', camp: 'c2', effort: 'med', minutes: 45, confidence: 'moderate', unit: 'saved',
          title: '4 ads in Coffee beans have “Poor” ad strength and half the account’s CTR',
          observe: 'These 4 responsive search ads take 38% of the campaign’s impressions at a 2.3% CTR. The account’s other search ads average 4.9%.',
          means: 'Low CTR lowers Quality Score, so you pay more per click and lose auctions on budget-limited terms.',
          hypothesis: 'The headlines are generic (“Quality coffee beans”) and leave out price, origin and free delivery.',
          action: 'Add 5 headlines with price, origin and “free delivery over 399 kr” to each ad, then pause the 2 weakest ads after 14 days.',
          success: 'CTR on these ad groups above 3.5% and average CPC down at least 5% within 14 days.',
          verifyDays: 14, lift: () => 0.08 * perDayC('c2'), labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Ad', 'Ad strength', 'Impressions 28d', 'CTR'], rows: [['RSA · Quality coffee beans', 'Poor', 41200, '2.1%'], ['RSA · Fresh roasted beans', 'Poor', 33800, '2.4%'], ['RSA · Coffee beans online', 'Poor', 29100, '2.2%'], ['RSA · Buy beans', 'Poor', 18400, '2.6%'], ['Other search ads (average)', 'Good', 198000, '4.9%']], money: [], rules: [], verdict: 'Observed in Google Ads. The CPC saving is an estimate from Quality Score effects.' } },
        { id: 'cr-fatigue-c6', platform: 'meta', kind: 'creative', camp: 'c6', effort: 'med', minutes: 60, confidence: 'moderate', unit: 'saved', warmupGate: true,
          title: 'Your top prospecting creative is wearing out: CTR down 38% in 3 weeks',
          observe: 'The “Morning ritual” video takes 64% of Prospecting broad’s spend. Its CTR fell from 1.6% to 1.0% over 3 weeks while frequency rose from 1.9 to 3.4.',
          means: 'The same people keep seeing the same ad, so each impression does less and cost per order climbs.',
          hypothesis: 'The audience has seen this video too often; fresh creative will win back attention.',
          action: 'Add 3 new creatives to the ad set (one new hook, one product demo, one customer review) and let delivery shift away from the old video.',
          success: 'Ad set CTR back above 1.4% and frequency below 2.5 within 14 days; cost per order (last click) down at least 8%.',
          verifyDays: 14, lift: () => 0.1 * perDayC('c6'), labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Week', 'CTR', 'Frequency', 'Share of spend'], rows: [['3 weeks ago', '1.6%', '1.9', '58%'], ['2 weeks ago', '1.4%', '2.5', '61%'], ['Last week', '1.2%', '3.0', '63%'], ['This week', '1.0%', '3.4', '64%']], money: [], rules: [], verdict: 'Trend-based, from Meta’s delivery data. Needs the 4-week warmup.' } },
        { id: 'cr-lp-meta', platform: 'meta', kind: 'landing', camp: 'c7', effort: 'high', minutes: 240, confidence: 'moderate', unit: 'revenue',
          title: 'Meta visitors leave mobile product pages before they load (4.6 s)',
          observe: '82% of Meta clicks land on mobile. Product pages take 4.6 s to show the main image (LCP) and 41% of these visits end before the page loads.',
          means: 'You pay for the click, and many people never see the page.',
          hypothesis: 'Uncompressed hero images and an app embed slow the first paint on mobile.',
          action: 'Compress product hero images and defer the review widget, aiming for LCP under 2.5 s on mobile.',
          success: 'Mobile LCP under 2.5 s and the early-exit share under 25% within 7 days of the change.',
          verifyDays: 7, lift: () => 0.06 * perDayC('c7') * 2.4, labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Page type', 'Meta clicks 28d', 'Mobile LCP', 'Exit before load'], rows: [['Product pages', 15800, '4.6 s', '41%'], ['Collection pages', 4100, '2.8 s', '22%'], ['Home page', 1900, '2.1 s', '14%']], money: [], rules: [], verdict: 'Observed: page speed from Chrome user data, exits from GA4. The revenue lift is an estimate.' } },
      ],
      flamehouse: [
        { id: 'cr-lp-f2', platform: 'gads', kind: 'landing', camp: 'f2', effort: 'med', minutes: 60, confidence: 'moderate', unit: 'revenue',
          title: 'Delivery ads land on the home page, two taps away from ordering',
          observe: '10,640 sessions from these ads in 28 days, 640 orders: a 6.0% conversion rate. Visitors who land straight on the order page convert at 9.1%. 88% of the sessions are on mobile.',
          means: 'People searching for delivery want to order now. The home page shows campaigns and the brand story first, and asks for an address only on the next screen.',
          hypothesis: 'Landing on the order page with the nearest restaurant pre-selected removes two steps.',
          action: 'Test the order page (location pre-filled) as the landing page for half the traffic, using a Google Ads experiment.',
          success: `Conversion rate on the test half reaches at least ${pc1(lpCalc({ sessions: 10640, orders: 640, benchSessions: 58200, benchOrders: 4250 }).target)} within 14 days, at the same CPC.`,
          lp: { sessions: 10640, orders: 640, benchSessions: 58200, benchOrders: 4250 },
          verifyDays: 14, lift: () => lpCalc({ sessions: 10640, orders: 640, benchSessions: 58200, benchOrders: 4250 }).lift, labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Landing page', 'Sessions 28d', 'Orders', 'Conversion rate', 'Mobile share'], rows: [['/ (home)', 10640, 640, '6.0%', '88%'], ['/order (same ads, direct)', 2310, 210, '9.1%', '90%'], ['Paid search average', 58200, 4250, '7.3%', '86%']], money: [], rules: [], verdict: 'Observed sessions (GA4) and orders (ordering app, matched by order ID). The lift is an estimate; the experiment proves it.' } },
        { id: 'cr-fatigue-f6', platform: 'meta', kind: 'creative', camp: 'f6', effort: 'med', minutes: 60, confidence: 'moderate', unit: 'saved', warmupGate: true,
          title: 'The “Double Flame” video is wearing out: CTR down 35% in 3 weeks',
          observe: 'The video takes 58% of Local stores prospecting’s spend. Its CTR fell from 1.7% to 1.1% over 3 weeks while frequency rose from 2.1 to 3.6.',
          means: 'The same people keep seeing the same ad, so each impression does less and cost per order climbs.',
          hypothesis: 'The audience has seen this video too often; fresh creative will win back attention.',
          action: 'Add 3 new creatives to the ad set (a limited-time offer, a menu close-up, a local-store angle) and let delivery shift away from the old video.',
          success: 'Ad set CTR back above 1.5% and frequency below 2.5 within 14 days; cost per order (last click) down at least 8%.',
          verifyDays: 14, lift: () => 0.1 * perDayC('f6'), labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Week', 'CTR', 'Frequency', 'Share of spend'], rows: [['3 weeks ago', '1.7%', '2.1', '51%'], ['2 weeks ago', '1.5%', '2.7', '54%'], ['Last week', '1.3%', '3.2', '56%'], ['This week', '1.1%', '3.6', '58%']], money: [], rules: [], verdict: 'Trend-based, from Meta’s delivery data. Needs the 4-week warmup.' } },
      ],
    };
    for (const x of (CREATIVE[cfg.id] || [])) {
      const camp = cfg.campaigns.find(k => k.id === x.camp);
      const v = x.lift();
      recs.push({
        id: x.id, area: 'creative', rule: x.id.includes('lp-meta') ? 'Mobile pages that take paid clicks load the main image (LCP) in over 2.5 s' : x.kind === 'landing' ? 'Ad traffic to a page converts at under half the paid average, with 1,000+ sessions in 28 days' : x.id.includes('rsa') ? '“Poor” ad strength and a CTR under half the account average' : 'CTR down 30%+ over 3 weeks while frequency rises', agent: 'creative', fox: 'paid', kind: x.kind, platform: x.platform, campaign: camp ? camp.name : null,
        title: x.title, observe: x.observe, means: x.means, hypothesis: x.hypothesis, action: x.action, success: x.success,
        expect: x.unit === 'revenue' ? `About +${money(v, cfg)}/day revenue if the test wins (estimate).` : `Save about ${money(v, cfg)} a day if the test wins (estimate).`,
        verifyDays: x.verifyDays, unit: x.unit, spendChangedPerDay: x.unit === 'saved' ? v : 0, caveat: x.caveat || null,
        valuePerDay: v, revPerDay: x.unit === 'revenue' ? v : 0, effort: x.effort, minutes: x.minutes, confidence: x.confidence,
        labels: x.labels, warmupGate: x.warmupGate || false,
        focus: x.unit === 'revenue' ? focusDelta(0, v / (cfg.aov || 1), v) : focusDelta(-v, 0, 0),
        evidence: x.lp ? Object.assign({}, x.evidence, { verdict: x.evidence.verdict + lpNote(x.lp) }) : x.evidence,
      });
    }

    /* More candidate rules (drafts, to validate with the media lead): account setup, audiences and spend trends.
       Sample signals, generated, not a real client's. */
    const PAIDX = {
      nordlys: [
        { id: 'st-conv-c5', area: 'setup', agent: 'setup', platform: 'gads', kind: 'setup', camp: 'c5', unit: 'revenue', confidence: 'moderate', effort: 'low', minutes: 5, verifyDays: 21,
          rule: 'A secondary event (add-to-cart, page view) is set as a primary conversion for bidding',
          title: 'PMax bids on add-to-carts as well as purchases',
          observe: 'add_to_cart is a primary conversion goal for PMax · Shopping. It fires 9× as often as purchase, and makes up 31% of the conversions the campaign optimizes for.',
          means: 'Smart bidding chases cheap add-to-carts instead of orders, so budget drifts to shoppers who don’t buy.',
          action: 'Set add_to_cart to a secondary conversion, so PMax bids on purchases only.',
          success: 'Purchase is the only primary conversion within 1 day; PMax cost per order down within 21 days.',
          lift: () => 0.08 * perDayC('c5') * (cfg.aov / 190), labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Conversion action', 'Goal', 'Conversions 28d', 'Share'], rows: [['purchase', 'Primary', 1310, '69%'], ['add_to_cart', 'Primary', 590, '31%']], money: [], rules: [], verdict: 'Read from the Google Ads conversion settings.' } },
        { id: 'st-geo-gads', area: 'setup', agent: 'setup', platform: 'gads', kind: 'setup', camp: 'c2', unit: 'saved', bet: false, confidence: 'strong', effort: 'low', minutes: 3, verifyDays: 7,
          rule: 'Location targeting set to “presence or interest”, with 5%+ of clicks from outside the shipping countries',
          title: 'Search ads reach people interested in Denmark, not in it',
          observe: 'Search campaigns target “presence or interest”. 12% of search clicks in the last 28 days came from outside Denmark, where you don’t ship.',
          means: 'Those clicks can’t turn into orders.',
          action: 'Switch location targeting to “Presence: people in or regularly in your targeted locations”.',
          success: 'Clicks from outside Denmark under 1% within 7 days; orders unchanged.',
          lift: () => 0.12 * (perDayC('c2') + perDayC('c3') + perDayC('c4')), labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Country', 'Clicks 28d', 'Orders'], rows: [['Denmark', 15400, 412], ['Sweden', 1120, 0], ['Norway', 640, 0], ['Other', 340, 0]], money: [], rules: [], verdict: 'Observed clicks by location; orders from Shopify.' } },
        { id: 'au-freq-c7', area: 'audiences', agent: 'audience', platform: 'meta', kind: 'audience', camp: 'c7', unit: 'saved', confidence: 'moderate', effort: 'low', minutes: 10, verifyDays: 14,
          rule: 'Weekly frequency above 6 in a retargeting ad set',
          title: 'Retargeting shows the same people 9 ads a week',
          observe: 'Meta · Retargeting 30d reaches 4,100 people a week at a frequency of 9.4. Orders per 1,000 impressions have fallen 28% since frequency passed 6.',
          means: 'Past a point, extra impressions on the same people mostly cost money.',
          action: 'Shorten the retargeting window from 30 to 14 days, or cap frequency at 5 a week.',
          success: 'Weekly frequency under 6 within 14 days; retargeting orders down under 10%.',
          lift: () => 0.2 * perDayC('c7'), labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Week', 'Frequency', 'Orders per 1,000 impressions'], rows: [['4 weeks ago', '5.1', '3.9'], ['3 weeks ago', '6.4', '3.5'], ['2 weeks ago', '8.0', '3.1'], ['This week', '9.4', '2.8']], money: [], rules: [], verdict: 'Frequency observed in Meta; orders matched by order ID.' } },
        { id: 'au-seg-c2', area: 'audiences', agent: 'audience', platform: 'gads', kind: 'audience', camp: 'c2', unit: 'saved', confidence: 'moderate', effort: 'low', minutes: 5, verifyDays: 14,
          rule: 'A device, location or audience segment costs over 2× the campaign average per conversion, with a minimum spend',
          title: 'Tablets cost 2.6× more per order in Coffee beans',
          observe: 'Tablets took 11% of Coffee beans’ spend over 28 days at 420 kr per order. The campaign average is 160 kr.',
          means: 'The same budget buys far fewer orders on tablets.',
          action: 'Set a −40% bid adjustment on tablets for this campaign.',
          success: 'Tablet cost per order within 1.5× the campaign average within 14 days.',
          lift: () => 0.06 * perDayC('c2'), labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Device', 'Share of spend', 'Cost per order'], rows: [['Mobile', '61%', '150 kr'], ['Desktop', '28%', '140 kr'], ['Tablet', '11%', '420 kr']], money: [], rules: [], verdict: 'Last-click orders by device. Holds under linear too.' } },
        { id: 'sp-cpa-c6', area: 'spend', agent: 'trend', platform: 'meta', kind: 'investigate', camp: 'c6', unit: 'none', confidence: 'investigate', effort: 'low', minutes: 0, verifyDays: 7, owner: 'GrowthFox team', warmupGate: true,
          rule: 'Cost per conversion up 25%+ in the last 7 days against the previous 28, with 30+ conversions in the base period',
          title: 'Cost per order in Prospecting broad is up 31% this week',
          observe: 'Last 7 days: 395 kr per order. Previous 28 days: 300 kr, from 290 orders. Spend was flat.',
          means: 'Something changed in the last week: the audience, the creative, the auction or the landing page.',
          action: 'Our team will check the change history, creative fatigue and auction insights, and come back with a recommendation.',
          success: 'A cause and a recommendation within 7 days.',
          lift: () => 0, labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Period', 'Spend per day', 'Cost per order (last click)'], rows: [['Previous 28 days', '3,200 kr', '300 kr'], ['Last 7 days', '3,210 kr', '395 kr']], money: [], rules: [], verdict: 'Trend rule. Needs 30+ conversions in the base period.' } },
      ],
      flamehouse: [
        { id: 'st-geo-f2', area: 'setup', agent: 'setup', platform: 'gads', kind: 'setup', camp: 'f2', unit: 'saved', bet: false, confidence: 'strong', effort: 'low', minutes: 5, verifyDays: 7,
          rule: 'Location targeting reaches areas with no restaurant or delivery, with 5%+ of clicks from there',
          title: 'Delivery ads show in towns with no restaurant',
          observe: '9% of Burger delivery near me clicks come from postcodes outside all 64 delivery areas.',
          means: 'Those people can’t order delivery from you.',
          action: 'Target a radius around each restaurant instead of whole regions.',
          success: 'Clicks from outside delivery areas under 1% within 7 days; orders unchanged.',
          lift: () => 0.09 * perDayC('f2'), labels: { spend: 'observed', conv: 'observed' },
          evidence: { cols: ['Area', 'Clicks 28d', 'Orders'], rows: [['Inside delivery areas', 41200, 3940], ['Outside', 4080, 0]], money: [], rules: [], verdict: 'Observed clicks by postcode; orders from the ordering app.' } },
        { id: 'au-seg-f2', area: 'audiences', agent: 'audience', platform: 'gads', kind: 'audience', camp: 'f2', unit: 'saved', confidence: 'moderate', effort: 'low', minutes: 5, verifyDays: 14,
          rule: 'A device, location or audience segment costs over 2× the campaign average per conversion, with a minimum spend',
          title: 'Desktop costs 2.4× more per order on Burger delivery',
          observe: 'Desktop took 14% of the campaign’s spend at €21 per order. The campaign average is €9.',
          means: 'People order food on their phones; desktop clicks rarely turn into orders.',
          action: 'Set a −50% bid adjustment on desktop for this campaign.',
          success: 'Desktop cost per order within 1.5× the campaign average within 14 days.',
          lift: () => 0.07 * perDayC('f2'), labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Device', 'Share of spend', 'Cost per order'], rows: [['Mobile', '82%', '€8'], ['Desktop', '14%', '€21'], ['Tablet', '4%', '€11']], money: [], rules: [], verdict: 'Last-click orders by device.' } },
        { id: 'sp-cpa-f6', area: 'spend', agent: 'trend', platform: 'meta', kind: 'investigate', camp: 'f6', unit: 'none', confidence: 'investigate', effort: 'low', minutes: 0, verifyDays: 7, owner: 'GrowthFox team', warmupGate: true,
          rule: 'Cost per conversion up 25%+ in the last 7 days against the previous 28, with 30+ conversions in the base period',
          title: 'Cost per order in Local stores prospecting is up 27% this week',
          observe: 'Last 7 days: €17.80 per order. Previous 28 days: €14.00, from 6,000 orders. Spend was flat.',
          means: 'Something changed in the last week: the audience, the creative, the auction or the landing page.',
          action: 'Our team will check the change history, creative fatigue and auction insights, and come back with a recommendation.',
          success: 'A cause and a recommendation within 7 days.',
          lift: () => 0, labels: { spend: 'observed', conv: 'modeled' },
          evidence: { cols: ['Period', 'Spend per day', 'Cost per order (last click)'], rows: [['Previous 28 days', '€3,000', '€14.00'], ['Last 7 days', '€3,020', '€17.80']], money: [], rules: [], verdict: 'Trend rule. Needs 30+ conversions in the base period.' } },
      ],
    };
    for (const x of (PAIDX[cfg.id] || [])) {
      const camp = cfg.campaigns.find(k => k.id === x.camp);
      const v = x.lift(), inv = x.confidence === 'investigate';
      recs.push({
        id: x.id, area: x.area, rule: x.rule, agent: x.agent, fox: 'paid', kind: x.kind, platform: x.platform, campaign: camp ? camp.name : null,
        title: x.title, observe: x.observe, means: x.means, hypothesis: x.means, action: x.action, success: x.success,
        expect: inv ? 'A clear explanation and, if needed, a recommendation.' : x.unit === 'revenue' ? `About +${money(v, cfg)}/day revenue (estimate).` : `Save about ${money(v, cfg)} a day.`,
        verifyDays: x.verifyDays, unit: x.unit, spendChangedPerDay: x.unit === 'saved' ? v : 0, bet: x.bet,
        valuePerDay: v, revPerDay: x.unit === 'revenue' ? v : 0, effort: x.effort, minutes: x.minutes, confidence: x.confidence, owner: x.owner,
        labels: x.labels, warmupGate: x.warmupGate || false,
        focus: inv ? 0 : x.unit === 'revenue' ? focusDelta(0, v / (cfg.aov || 1), v) : focusDelta(-v, 0, 0),
        evidence: x.evidence,
      });
    }

    /* Data Fox parameter rules (PRD): one action per parameter per source, never per event.
       Completeness: present on less than 100% of the events that should carry it.
       Validity: the value fails its check; an invalid value counts as missing.
       Critical and warning parameters become actions; optional ones are listed on the Data Fox page only.
       An "Expected level" (set by the user, or known in advance like the Meta click ID) is the baseline:
       below it, the action comes back. */
    const merged = new Set();
    for (const e of data.eps) {
      const ep = e.ep, w = epWindow(data, ep.id, 7);
      for (const p of ep.params) {
        const comp = w.comp[p.key];
        if (comp >= 0.9995) continue;
        if (p.exp && comp >= p.exp - 0.005) continue; // at its expected level: not an action
        const vr = validRule(p.key), inv = p.inv || 0, present = Math.min(1, comp / (1 - inv));
        const nCat = ep.params.filter(x => x.cat === p.cat).length;
        const pts = Math.round(100 * CAT_W[p.cat] * (1 - comp) / nCat * 100) / 100, ptsT = pts < 0.1 ? 'less than 0.1' : pts.toFixed(1);
        const ch = cfg.checks.find(x => x.param === p.key && x.platform === ep.id && x.fix);
        if (ch) merged.add(ch);
        const unit1 = p.ev ? `${p.ev} events` : ep.unit, pc = v => (v * 100 >= 99.95 ? '100' : (v * 100).toFixed(1)) + '%';
        const mostlyInvalid = inv && (1 - present) < inv * present;
        const drop = p.issue ? ` It dropped from ${pc(p.base)} to ${pc(p.issue.to)} on ${dayLabel(p.issue.since)}.` : '';
        const badTxt = inv ? ` ${pc(inv)} of the values sent fail the value check (${vr}), e.g. ${p.bad.map(b => `“${b}”`).join(', ')}. Invalid values count as missing.` : '';
        const label = p.key.replace(/^\w+\./, k => p.ev ? '' : k);
        recs.push({
          id: `dq-${ep.id}-${p.key}`, agent: 'tracking', fox: 'analytics', kind: 'fix', platform: ep.id, campaign: null,
          param: p.key, cat: p.cat, ep: ep.id, optional: p.cat === 'optional', compNow: comp, present, invalid: inv, valid: vr,
          title: ch ? ch.fix.title : mostlyInvalid ? `Fix ${p.key} on ${ep.name}: ${pc(inv)} of values are invalid` : `Send ${label} with every ${ep.name} ${p.ev ? p.ev + ' event' : ep.unit.replace(/s$/, '')}`,
          observe: `${pc(present)} of ${ep.name} ${unit1} carry ${p.key} (last 7 days).${badTxt}${drop}${ch && ch.explain ? ' ' + ch.explain : ''}${p.exp ? ` It’s below its expected level of ${pc(p.exp)}.` : ''}`,
          means: p.cat === 'critical' ? `${p.key} is critical: without it the ${unit1} can’t be attributed, deduplicated or counted correctly.` : p.cat === 'warning' ? `${p.key} is a warning parameter: the ${unit1} still count, but matching, value or attribution suffers.` : `${p.key} is optional: nice to have, as an extra matching key or for reporting detail.`,
          hypothesis: '',
          action: ch ? ch.fix.action : mostlyInvalid ? `Find where ${p.key} is set and make every value pass the check (${vr}). The examples above show what is being sent today.` : `Find where ${ep.name} ${unit1} are sent without ${p.key} and add it. If some can never carry it, mark the level as expected instead.`,
          expect: `Raises the ${ep.name} data quality score by about ${ptsT} points.`,
          success: `${p.key} is present${vr ? ' and valid' : ''} on ${p.exp ? 'at least ' + pc(p.exp) : 'every one'} of the ${unit1} on the next daily run.`,
          rule: inv ? `Validity: the value must pass its check (${vr}); invalid values count as missing. Completeness: present on less than 100% of the ${unit1} that should carry it.` : `Completeness: a ${p.cat} parameter present on less than 100% of the ${unit1} that should carry it.`,
          verifyDays: 1, unit: 'dq', spendChangedPerDay: 0, owner: ch ? ch.fix.owner : (ep.id === 'meta' || ep.id === 'gads') ? 'GrowthFox team' : 'You',
          valuePerDay: 0, dq: pts, effort: ch ? ch.fix.effort : 'low', minutes: ch ? ch.fix.minutes : 30,
          confidence: 'certain', labels: { spend: null, conv: 'observed' },
          evidence: { cols: ['Check', 'Last 7 days', 'Target'], rows: [['Present', pc(present), p.exp ? pc(p.exp) + ' (expected level)' : '100%']].concat(vr ? [['Valid (' + vr + ')', pc(1 - inv), '100%']] : []).concat([['Counted as complete', pc(comp), p.exp ? pc(p.exp) : '100%']]), money: [], rules: [], verdict: 'Rule-based parameter check, run daily on every event.' },
        });
      }
    }

    /* Setup checks (Data Fox) and tag checks (Engineer Fox). A field check that a parameter rule already covers isn't repeated. */
    for (const ch of cfg.checks) {
      if (!ch.fix || merged.has(ch) || ch.group === 'tags') continue; // tag checks: the Engineer Fox's volume tickets cover them
      recs.push({
        id: 'tr-' + ch.group + '-' + ch.platform, agent: ch.group === 'tags' ? 'engineer' : 'tracking', fox: ch.group === 'tags' ? 'engineer' : 'analytics', kind: 'fix', platform: ch.platform, campaign: null,
        title: ch.fix.title,
        observe: fillDates(ch.value) + '. ' + (ch.explain || ''),
        means: ch.status === 'fail' ? 'Data built on this is unreliable until fixed.' : 'Your data is usable but weaker than it should be.',
        action: ch.fix.action,
        expect: `Raises the ${PLATFORMS[ch.platform]} data quality score by ${ch.penalty} points.`,
        hypothesis: ch.explain || 'The setup behind this check changed.',
        success: `The “${CHECK_GROUPS[ch.group]}” check passes on the next daily run; ${PLATFORMS[ch.platform]} score +${ch.penalty}.`,
        verifyDays: 1, unit: 'dq', spendChangedPerDay: 0, failing: ch.status === 'fail',
        owner: ch.fix.owner, valuePerDay: 0, dq: ch.penalty, effort: ch.fix.effort, minutes: ch.fix.minutes,
        confidence: ch.status === 'fail' ? 'certain' : 'strong', labels: { spend: null, conv: 'observed' },
        evidence: { cols: ['Check', 'Result', 'Target'], rows: [[CHECK_GROUPS[ch.group], fillDates(ch.value), ch.target]], money: [], rules: [], verdict: 'Rule-based data check, run daily.' },
      });
    }

    // Real clients: campaign setup and creative checks on the latest settings snapshot (live recommendations).
    if (cfg.real) for (const rc of settingsRecs(cfg, data)) recs.push(rc);

    // Engineer Fox fixes: a key event stopped arriving. Impact = coverage points regained.
    for (const rc of recs) if (rc.fox === 'engineer') {
      const key = rc.id.replace('tr-', '');
      const now = coverage(cfg, data, 7).cov, fx = coverage(cfg, data, 7, 0, (pid, l) => l.check === key).cov;
      rc.cov = Math.max(0, Math.round((fx - now) * 10) / 10); rc.unit = 'cov'; rc.dq = 0;
      rc.means = 'Spend on the affected platform is no longer tracked end to end, so its results and recommendations are incomplete.';
      rc.expect = `Raises coverage by about ${rc.cov} points: that share of ad spend is tracked end to end again.`;
      rc.success = `The event arrives again on the next daily run, and coverage is back to ${Math.round(fx)}%.`;
      rc.evidence.verdict = 'Arrival check, run daily.';
    }

    /* Engineer Fox tickets: volume dips, spikes and zero arrivals; client vs server gaps. Ranked above every other fix. */
    const eng = engHealth(cfg, data, opts.thr || {});
    const dl = i => data.days[i].date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const wdName = i => data.days[i].date.toLocaleDateString('en-GB', { weekday: 'long' });
    const pcS = v => (v > 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
    for (const x of eng.streams) {
      const ep = x.ep; if (!ep) continue;
      const st = x.s, ch = st.check && cfg.checks.find(k => `${k.group}-${k.platform}` === st.check);
      const when = ep.days === 1 ? `on ${dl(ep.start)}` : ep.ongoing ? `since ${dl(ep.start)}` : `from ${dl(ep.start)} to ${dl(ep.end)}`;
      const title = ep.kind === 'zero' ? `${st.label}: nothing arriving ${ep.ongoing ? 'since ' + dl(ep.start) : when}` : `${st.label} ${ep.kind === 'dip' ? 'down' : 'up'} ${Math.abs(Math.round(ep.dev * 100))}% ${when}`;
      const lastI = ep.end;
      recs.push({
        id: `vol-${st.id}`, ticket: 'volume', stream: st.id, sources: [st.source], startAt: data.days[ep.start].t, agent: 'volume', fox: 'engineer', kind: 'ticket', platform: st.source, campaign: null,
        title, dev: ep.dev, tkind: ep.kind, devTxt: ep.kind === 'zero' ? 'Nothing' : pcS(ep.dev),
        observe: (ep.days === 1 ? `${n0r(ep.v)} ${st.unit} arrived on ${dl(ep.start)}, against a normal level of ${n0r(ep.nm)} for a ${wdName(ep.start)} (the same weekday over the last 4 weeks).` : `${n0r(ep.v / ep.days)} ${st.unit} a day arrived ${when}, against a normal level of ${n0r(ep.nm / ep.days)} a day (the same weekdays over the last 4 weeks).`) + (ch && ch.explain ? ' ' + ch.explain : '') + (st.note ? ' ' + st.note : ''),
        means: ep.kind === 'zero' ? 'Nothing is arriving from this source, so every number built on it is incomplete.' : ep.kind === 'dip' ? 'Fewer events are arriving than normal. A broken tag, an expired connection or a site or app release is the usual cause; sometimes it is a real drop in the business.' : 'More events are arriving than normal. A promotion, a launch or press coverage can explain it; so can bot traffic or an event firing twice.',
        hypothesis: '',
        action: (ch && ch.fix ? ch.fix.action + ' ' : '') + `Check what changed around ${dl(ep.start)}. If you know the cause, add it as context or close the ticket as expected; if not, ask our team to look into it.`,
        expect: 'A known cause: fixed, or closed as expected with a reason.',
        success: `${st.label} back within ±${Math.round(x.t * 100)}% of its normal level on the next daily run.`,
        rule: `Volume: a day more than ±${Math.round(x.t * 100)}% from the normal level (the same weekday over the last 4 weeks), or nothing at all. Sources under ${VOL_MIN} a day aren't checked.`,
        verifyDays: 1, unit: 'none', spendChangedPerDay: 0, owner: 'You', valuePerDay: 0, effort: 'low', minutes: 0, confidence: 'certain', labels: { conv: 'observed' },
        evidence: { cols: ['Day', st.unit[0].toUpperCase() + st.unit.slice(1), 'Normal level', 'Against normal'], rows: Array.from({ length: 7 }, (_, k) => data.n - 7 + k).map(i => [data.days[i].date, Math.round(x.vals[i]), Math.round(x.normals[i]), x.normals[i] ? pcS(x.vals[i] / x.normals[i] - 1) : '—']), money: [], rules: [], verdict: 'Volume check, run daily on every source.' },
        score: 1e9 + (ep.kind === 'zero' ? 3e6 : ep.kind === 'dip' ? 2e6 : 1.5e6) + Math.abs(ep.dev) * 1000 + (ep.ongoing ? 5e5 : 0),
      });
    }
    for (const x of eng.pairs) {
      if (!x.flag) continue;
      const pr = x.p, pc = v => Math.abs(Math.round(v * 100)) + '%';
      const since = x.since != null ? ` since ${dl(x.since)}` : '';
      recs.push({
        id: `gap-${pr.id}`, ticket: 'gap', pair: pr.id, sources: pr.sources, startAt: data.days[x.since != null ? x.since : data.n - 7].t, agent: 'gap', fox: 'engineer', kind: 'ticket', platform: pr.sources[0], campaign: null,
        title: x.flag === 'browser' ? `${pr.client} counts more ${pr.event} than the ${pr.server}${since}` : `${pr.client} now misses ${pc(x.cur)} of ${pr.event} (normally ${pc(x.normal)})`,
        gapCur: x.cur, gapNormal: x.normal, tkind: x.flag, devTxt: x.flag === 'browser' ? `+${pc(-x.cur)}` : `${pc(x.cur)}`,
        observe: x.flag === 'browser' ? `Over the last 7 days the ${pr.client} counted ${pc(-x.cur)} more ${pr.event} than the ${pr.server}. Normally the browser counts ${pc(x.normal)} fewer, because ad blockers and declined consent hide browser events.` : `Over the last 7 days the ${pr.client} counted ${pc(x.cur)} fewer ${pr.event} than the ${pr.server}. Its normal gap is ${pc(x.normal)} (days 8 to 35 ago), so it has moved ${Math.round(Math.abs(x.cur - x.normal) * 100)} points.`,
        means: x.flag === 'browser' ? 'A server count below the browser usually means server-side events have stopped arriving or are being dropped.' : x.cur > x.normal ? 'The browser is losing more events than it used to: a consent banner change, a removed tag or a new ad-blocker rule are the usual causes.' : 'The gap has narrowed: the server may be dropping events, or the browser counting some twice.',
        hypothesis: '',
        action: `Compare the two counts by day around ${x.since != null ? dl(x.since) : 'the start of the change'} and check what changed on the site, the tags or the server-side setup. Add context or close it as expected if you know why; otherwise ask our team.`,
        expect: 'A known cause: fixed, or closed as expected with a reason.',
        success: `The gap is back within ${Math.round(x.t * 100)} points of its normal level, and the server counts at least as many as the browser.`,
        rule: `Client vs server: the gap moves more than ${Math.round(x.t * 100)} points from its 4-week normal, or the browser counts more than the server.`,
        verifyDays: 1, unit: 'none', spendChangedPerDay: 0, owner: 'You', valuePerDay: 0, effort: 'low', minutes: 0, confidence: 'certain', labels: { conv: 'observed' },
        evidence: { cols: ['Day', pr.client, pr.server, 'Browser misses'], rows: Array.from({ length: 7 }, (_, k) => data.n - 7 + k).map(i => [data.days[i].date, Math.round(x.client[i]), Math.round(x.server[i]), (x.daily[i] < 0 ? '−' : '') + pc(x.daily[i])]), money: [], rules: [], verdict: `Normal gap ${pc(x.normal)}, last 7 days ${x.cur < 0 ? '−' : ''}${pc(x.cur)}.` },
        score: 1e9 + (x.flag === 'browser' ? 2.5e6 : 1.2e6) + Math.abs(x.cur - x.normal) * 1000,
      });
    }

    /* Anomalies → investigate items */
    for (const a of cfg.anomalies) {
      recs.push({
        id: 'an-' + a.id, agent: 'investigate', fox: a.fox, kind: 'investigate', platform: cfg.route === 'ecom' ? (cfg.orderSource || 'shop') : 'crm', campaign: null,
        title: a.title, observe: a.observe, means: a.means,
        action: 'Our team will look into it as part of the service and report back.',
        expect: 'An explanation and, if needed, a recommendation.',
        hypothesis: a.means,
        success: 'A written explanation of the cause, and a recommendation if one is needed, within 7 days.',
        verifyDays: 7, unit: 'none', spendChangedPerDay: 0,
        owner: 'GrowthFox team', valuePerDay: a.valuePerDay, effort: 'low', minutes: 0, confidence: 'investigate', labels: { conv: 'observed' },
        evidence: { cols: [], rows: [], money: [], rules: [], verdict: 'Observed change, cause unknown.' },
      });
    }

    /* Paid Media: every rule is a draft until the media lead signs off. Cuts with an observed saving show one figure;
       growth bets show a range (the estimate × 0.6 to × 1.25) and are judged on their success check, not on revenue. */
    for (const rc of recs) if (rc.fox === 'paid') {
      rc.draft = true;
      rc.bet = rc.bet !== false && rc.agent !== 'spend-watch' && rc.kind !== 'negative' && rc.confidence !== 'investigate' && rc.unit !== 'none';
      if (rc.bet) { rc.lo = rc.valuePerDay * 0.6; rc.hi = rc.valuePerDay * 1.25; }
    }

    // Which Paid Media rubric check each rule belongs to (PM_CHECKS); rules with no rubric equivalent get checkNote instead.
    for (const rc of recs) if (rc.fox === 'paid' && rc.check === undefined) Object.assign(rc, rubricCheck(rc));

    /* Gates: warmup, held-back data */
    for (const rc of recs) {
      if (rc.warmupGate && !warm) rc.held = { reason: 'warmup', text: `Trend recommendations start after a 4-week warmup. ${warmLeft} days to go.` };
    }
    const held = [];
    for (const c of cfg.campaigns) {
      if (c.heldBy === 'dedup') held.push({ id: 'held-' + c.id, title: `Recommendations for ${c.name} are on hold`, text: 'Meta counts some of these leads twice (61% deduplicated). We’ll review this campaign once deduplication passes.', platform: 'meta' });
    }
    for (const q of cfg.quarantine) held.push({ id: 'held-' + q.id, title: `${q.source} data from ${dayLabel(q.daysAgo)} is quarantined`, text: q.held, platform: 'ga4', quarantine: q.id });

    // Rank (Analytical Framework): expected impact × confidence ÷ effort.
    // Tracking fixes always come first (failing checks before warnings), since every other number depends on that data.
    // Investigate items (low confidence) sink below actions.
    for (const rc of recs) {
      if (rc.ticket) continue; // scored where it was made
      if (rc.agent === 'tracking' || rc.agent === 'engineer') rc.score = 1e9 + (rc.failing ? 1e6 : 0) + (rc.dq || rc.cov || 0); // data fixes: by the score points they win back
      else if (rc.confidence === 'investigate') rc.score = -1 / (rc.valuePerDay + 1);
      else rc.score = rc.valuePerDay * CONF_W[rc.confidence] / EFFORT_W[rc.effort];
    }
    recs.sort((a, b) => b.score - a.score);

    return { recs, held, warm, warmLeft, w28, blended, eng };
  }
