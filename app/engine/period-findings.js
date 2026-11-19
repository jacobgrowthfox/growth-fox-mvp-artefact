  /* ---------- Period findings: one finding per check × target for the whole picked range ----------
     The daily evaluation is unchanged (same thresholds, same firing days). Episodes ("stretches") of the same check and target
     are summed up in one finding, measured over the whole range, with a daily chart and a weekly table as evidence. */
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
  // Weekly rows (weeks start on Monday): [week start, ...row(sums), days fired]
  function weekRows(days, sumF, row) {
    const W = []; let cur = null;
    for (const d of days) {
      const dt = new Date(d.t), mon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - ((dt.getDay() + 6) % 7)).getTime();
      if (!cur || cur.mon !== mon) { cur = { mon, s: {}, fired: 0 }; W.push(cur); }
      for (const f of sumF) cur.s[f] = (cur.s[f] || 0) + (d.raw[f] || 0);
      if (d.on) cur.fired++;
    }
    return W.map(w => [new Date(w.mon)].concat(row(w.s), [w.fired]));
  }
  function periodRecs(cfg, fromT, toT) {
    const R = REAL[cfg.id];
    if (!cfg.real || !R || !isFinite(fromT) || !isFinite(toT) || toT < fromT) return [];
    const sp = scanSpend(cfg, fromT, toT), sg = scanSegments(cfg, fromT, toT), st = scanSetup(cfg, fromT, toT);
    const M = Math.round((toT - fromT) / DAY) + 1, range = spanTxt(fromT, toT), rid = `${isoD(fromT)}_${isoD(toT)}`;
    const recs = [], plat = PLATFORMS.gads, N = cfg.convNoun, N1 = cfg.convNounOne, Ncap = N[0].toUpperCase() + N.slice(1);
    const n1 = v => (Math.round(v * 10) / 10).toLocaleString('en'), pc0 = v => Math.round(v * 100) + '%', pc1 = v => (v * 100).toFixed(1) + '%';
    const multi = new Set(sp.concat(sg, st).map(e => e.cid)).size > 1;
    const inCampOf = name => multi ? ` in ${short(name)}` : '';
    const group = (eps, key) => { const g = new Map(); for (const e of eps) { const k = key(e); if (!g.has(k)) g.set(k, []); g.get(k).push(e); } return g; };
    const sumRaw = (days, f) => days.reduce((a, d) => a + (d.raw[f] || 0), 0);
    // The most extreme firing day across the stretches: {ep, d, v}
    const worstOf = (eps, days, val, isBetter) => { let w = null; for (const ep of eps) for (let k = ep.firstK; k <= ep.lastK; k++) { const d = days[k]; if (!d || !d.on) continue; const v = val(d); if (v == null || Number.isNaN(v)) continue; if (!w || isBetter(v, w.v)) w = { ep, d, v }; } return w; };
    const firedLine = (n, w, txt) => `The check fired on ${n} of ${M} days${w ? `; the worst stretch was ${spanTxt(w.ep.startT, w.ep.lastT)} (${txt})` : ''}.`;
    const mk = (check, checkId, target, o) => recs.push(Object.assign({
      id: `scan-${check}-${target}-${rid}`, doneKey: `scan-${check}-${target}`, fox: 'paid', platform: 'gads', spendChangedPerDay: 0, valuePerDay: 0, effort: 'low', minutes: 0, owner: 'You', verifyDays: 7,
      labels: { spend: 'observed', conv: 'observed' }, focus: 0, draft: true, bet: false, check: checkId, kind: 'investigate', unit: 'none', confidence: 'investigate', score: -1,
      expect: 'A clear explanation of what happened and, if it could happen again, what to change.',
    }, o));
    const chartOf = (days, series, extra) => Object.assign({ dates: days.map(d => d.t), fired: days.map(d => !!d.on), series, firedLabel: 'Check fired' }, extra);
    const spendWeeks = days => ({ cols: ['Week of', 'Spend', 'Clicks', Ncap, `Cost per ${N1}`, 'Days fired'], money: [1, 4],
      rows: weekRows(days, ['cost', 'clicks', 'conv'], s => [s.cost, s.clicks, n1(s.conv), s.conv > 0 ? s.cost / s.conv : Infinity]) });
    const evid = (chart, weekly, verdict) => ({ cols: [], rows: [], money: [], rules: [], chart, weekly, verdict });

    /* Spend & optimization: one finding per check × campaign */
    const T = SPEND_SCAN;
    for (const [key, eps] of group(sp, e => `${e.check}|${e.cid}`)) {
      const { check, checkId, cid, camp } = eps[0], tr = (sp.tracks || []).find(t => t.cid === cid); if (!tr) continue;
      const days = tr.days.map(d => Object.assign({}, d, { on: !!d.fired[check] })), nF = days.filter(d => d.on).length;
      const tot = { cost: sumRaw(days, 'cost'), clicks: sumRaw(days, 'clicks'), conv: sumRaw(days, 'conv'), inv: sumRaw(days, 'inv') };
      const inCamp = inCampOf(camp), nS = eps.length, stretches = plural(nS, 'stretch', 'stretches');
      const rangeCpa = tot.conv > 0 ? `${money(tot.cost / tot.conv, cfg)} per ${N1} (${n1(tot.conv)} ${N} from ${money(tot.cost, cfg)})` : `${money(tot.cost, cfg)} spent and no ${N} recorded`;
      const ruleEnd = `. Checked on every day of the picked period; firing days ${T.mergeGap} or fewer apart count as one stretch. Check ${checkId}.`;
      const verdict = `Shaded days are the days the check fired. Spend, clicks and conversions as ${plat} reports them, the only source connected.`;
      if (check === 'noConv') {
        const covered = new Set(); for (const ep of eps) for (let k = Math.max(0, ep.firstK - (T.w7 - 1)); k <= ep.lastK; k++) covered.add(k);
        const cSpend = [...covered].reduce((a, k) => a + days[k].raw.cost, 0), saving = cSpend / M;
        const w = eps.map(ep => ({ ep, v: ep.rows.reduce((a, r) => a + r[1], 0) })).sort((a, b) => b.v - a.v)[0];
        const conDays = days.map((d, i) => d.raw.conv > 0 ? i : -1).filter(i => i >= 0);
        mk('noConv', checkId, cid, { area: 'spend', agent: 'spend-scan', campaign: camp, kind: 'cut', unit: 'saved', valuePerDay: saving, spendChangedPerDay: saving, minutes: 2, confidence: 'moderate', score: saving * CONF_W.moderate,
          title: `${camp} had 7-day stretches with spend and zero ${N} (${range})`,
          observe: `${firedLine(nF, w, `${money(w.v, cfg)} with zero ${N} over ${w.ep.rows.length} days`)} Across ${stretches}, ${money(cSpend, cfg)} was spent on ${covered.size} days of the period with no ${N} recorded by ${plat}. Over the whole period: ${rangeCpa}. No lead source of your own is connected yet to cross-check.`,
          means: `Either the campaign wasn’t producing ${N} in those stretches, or conversion tracking had stopped recording them. Both are worth sorting out before more budget goes in.`,
          hypothesis: `Conversion tracking stopped recording (often after a website change), or the ads reached people who don’t get in touch.`,
          action: `Check that conversion tracking still records ${N} (Google Ads → Goals → Conversions). If it does, pause the campaign or cut its budget when a stretch like this starts.`,
          expect: `Save about ${money(saving, cfg)} a day: the spend in zero-${N1} stretches, spread over the ${M} days of the period.`,
          success: `No 7-day stretch with ${money(cfg.spendWatchMin, cfg)}+ spend and zero ${N}.`,
          rule: `Spends ${money(cfg.spendWatchMin, cfg)}+ in 7 days with zero conversions recorded by ${plat} (the only conversion source connected)` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: 'Spend, last 7 days', vals: days.map(d => d.x.spend7), role: 'main' }, { name: `${money(cfg.spendWatchMin, cfg)} threshold`, vals: days.map(() => cfg.spendWatchMin), role: 'ref' }],
            { fmt: 'money', yLabel: 'Spend over the last 7 days', markers: conDays, markerLabel: `Day with a ${N1}` }), spendWeeks(days), verdict) });
      } else if (check === 'cpaRising') {
        const ratio = d => d.x.conv7 > 0 && d.x.convB > 0 ? (d.x.spend7 / d.x.conv7) / (d.x.spendB / d.x.convB) : null;
        const w = worstOf(eps, days, ratio, (a, b) => a > b);
        mk('cpaRising', checkId, cid, { area: 'spend', agent: 'spend-scan', campaign: camp,
          title: `Cost per ${N1}${inCamp} rose ${Math.round((T.cpaRising.factor - 1) * 100)}%+ in ${stretches} (${range})`,
          observe: `${firedLine(nF, w, w ? `${money(w.d.x.spend7 / w.d.x.conv7, cfg)} per ${N1}, ${pc0(w.v - 1)} above the 28 days before` : '')} Over the whole period: ${rangeCpa}.`,
          means: `${Ncap} got more expensive in those stretches. Something changed: the auction, the ads, the landing page, or how conversions are counted.`,
          action: `Look at what changed at the start of each stretch: the ${plat} change history, search terms, auction insights and the landing page.`,
          success: `Cost per ${N1} stays within ${Math.round((T.cpaRising.factor - 1) * 100)}% of the 28 days before.`,
          rule: `Cost per conversion in the last 7 days at least ${Math.round((T.cpaRising.factor - 1) * 100)}% above the 28 days before, with ${T.cpaRising.minBaseConv}+ conversions in those 28 days` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: `Cost per ${N1}, last 7 days`, vals: days.map(d => d.x.conv7 > 0 ? d.x.spend7 / d.x.conv7 : null), role: 'main' }, { name: `Cost per ${N1}, the 28 days before`, vals: days.map(d => d.x.convB > 0 ? d.x.spendB / d.x.convB : null), role: 'base' }],
            { fmt: 'money', yLabel: `Cost per ${N1}`, note: `Gaps are 7-day windows with no ${N}.` }), spendWeeks(days), verdict) });
      } else if (check === 'convFalling') {
        const ratio = d => d.x.convB > 0 ? (d.x.conv7 / T.w7) / (d.x.convB / T.base) : null;
        const w = worstOf(eps, days, ratio, (a, b) => a < b);
        mk('convFalling', checkId, cid, { area: 'spend', agent: 'spend-scan', campaign: camp,
          title: `${Ncap}${inCamp} fell by ${Math.round((1 - T.convFalling.ratio) * 100)}% or more in ${stretches} (${range})`,
          observe: `${firedLine(nF, w, w ? `${n1(w.d.x.conv7 / T.w7)} ${N} a day, ${pc0(1 - w.v)} below the 28 days before` : '')} Over the whole period: ${n1(tot.conv / M)} ${N} a day (${n1(tot.conv)} in all).`,
          means: `Fewer ${N} came in than usual in those stretches. It can be real demand (season, holidays) or tracking that stopped recording some conversions.`,
          action: `Compare spend, clicks and conversion rate at the start of each stretch, and check that conversion tracking still records ${N}.`,
          success: `${Ncap} per day stay above ${Math.round(T.convFalling.ratio * 100)}% of the 28 days before.`,
          rule: `Conversions per day in the last 7 days at most ${Math.round(T.convFalling.ratio * 100)}% of the 28 days before, with ${T.convFalling.minBaseConv}+ conversions in those 28 days` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: `${Ncap} per day, last 7 days`, vals: days.map(d => d.x.conv7 / T.w7), role: 'main' }, { name: `${Ncap} per day, the 28 days before`, vals: days.map(d => d.x.convB / T.base), role: 'base' }],
            { fmt: 'num2', yLabel: `${Ncap} per day` }), spendWeeks(days), verdict) });
      } else if (check === 'budgetShift') {
        const up = eps.filter(e => e.dir === 'up').length, down = nS - up;
        const ratio = d => d.x.spendB > 0 ? (d.x.spend7 / T.w7) / (d.x.spendB / T.base) : null;
        const w = worstOf(eps, days, ratio, (a, b) => Math.abs(Math.log(a)) > Math.abs(Math.log(b)));
        const what = !down ? `jumped ${T.budgetShift.up}× or more` : !up ? `dropped by ${Math.round((1 - T.budgetShift.down) * 100)}% or more` : 'jumped or dropped sharply';
        mk('budgetShift', checkId, cid, { area: 'spend', agent: 'spend-scan', campaign: camp,
          title: `Daily spend${inCamp} ${what} in ${stretches} (${range})`,
          observe: `${firedLine(nF, w, w ? `${money(w.d.x.spend7 / T.w7, cfg)} a day, ${w.v.toFixed(1)}× the 28 days before` : '')} ${up && down ? `${plural(up, 'stretch', 'stretches')} up, ${down} down. ` : ''}Over the whole period the campaign spent ${money(tot.cost / M, cfg)} a day on average.`,
          means: up && !down ? 'The campaign spent much more per day than before. If nobody raised the budget on purpose, a bid strategy or budget change may have run away.' : !up ? 'The campaign spent much less per day than before: a lower budget, paused ads or ad groups, disapprovals or lost auctions.' : 'Daily spend swung well above and below its usual level. Budget or bid changes, paused ads, disapprovals or auction changes are the usual causes.',
          action: `Check the ${plat} change history at the start of each stretch for budget or bid changes, and whether they were intended.`,
          success: 'Spend per day stays in line with the budget you intend.',
          rule: `Spend per day in the last 7 days at least ${T.budgetShift.up}× or at most ${T.budgetShift.down}× the 28 days before, when those 28 days averaged ${money(T.budgetShift.minBaseSpendPerDay, cfg)}+ a day` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: 'Spend per day, last 7 days', vals: days.map(d => d.x.spend7 / T.w7), role: 'main' }, { name: 'Spend per day, the 28 days before', vals: days.map(d => d.x.spendB / T.base), role: 'base' }],
            { fmt: 'money', yLabel: 'Spend per day' }), spendWeeks(days), verdict) });
      } else if (check === 'invalidSpike') {
        const share7 = d => d.x.clicks7 + d.x.inv7 > 0 ? d.x.inv7 / (d.x.clicks7 + d.x.inv7) : null;
        const shareB = d => d.x.clicksB + d.x.invB > 0 ? d.x.invB / (d.x.clicksB + d.x.invB) : null;
        const w = worstOf(eps, days, share7, (a, b) => a > b), rShare = tot.clicks + tot.inv > 0 ? tot.inv / (tot.clicks + tot.inv) : 0;
        mk('invalidSpike', checkId, cid, { area: 'spend', agent: 'spend-scan', campaign: camp,
          title: `Invalid clicks${inCamp} spiked in ${stretches} (${range})`,
          observe: `${firedLine(nF, w, w ? `${pc1(w.v)} of clicks invalid` : '')} Over the whole period ${pc1(rShare)} of clicks were invalid (${Math.round(tot.inv).toLocaleString('en')} of ${Math.round(tot.clicks + tot.inv).toLocaleString('en')}).`,
          means: `${plat} filtered more clicks as invalid than usual. You aren’t charged for those, but a spike can mean bot traffic or click fraud, and some of it may slip through.`,
          action: 'Look at placements, locations and search terms at the start of each stretch, and consider IP exclusions if it keeps happening.',
          success: 'Invalid-click share stays near its usual level.',
          rule: `${T.invalidSpike.minInv}+ invalid clicks in the last 7 days, and an invalid-click share at least ${T.invalidSpike.factor}× the 28 days before` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: 'Invalid share, last 7 days', vals: days.map(d => { const v = share7(d); return v == null ? null : v * 100; }), role: 'main' }, { name: 'Invalid share, the 28 days before', vals: days.map(d => { const v = shareB(d); return v == null ? null : v * 100; }), role: 'base' }],
            { fmt: 'pct', yLabel: 'Share of clicks that were invalid' }),
            { cols: ['Week of', 'Clicks', 'Invalid clicks', 'Invalid share', 'Days fired'], money: [], rows: weekRows(days, ['clicks', 'inv'], s => [s.clicks, s.inv, s.clicks + s.inv > 0 ? pc1(s.inv / (s.clicks + s.inv)) : '—']) }, verdict) });
      }
    }

    /* Audiences: one finding per segment */
    const G = SEGMENT_SCAN;
    for (const [key, eps] of group(sg, e => `${e.cid}|${e.type}|${e.value}`)) {
      const e0 = eps[0], tr = (sg.tracks || []).find(t => t.key === key); if (!tr) continue;
      const days = tr.days.map(d => Object.assign({}, d, { on: d.fired })), nF = days.filter(d => d.on).length;
      const seg = { spend: sumRaw(days, 'segSpend'), conv: sumRaw(days, 'segConv') }, cmp = { spend: sumRaw(days, 'campSpend'), conv: sumRaw(days, 'campConv') };
      const campCpa = cmp.conv > 0 ? cmp.spend / cmp.conv : Infinity, segCpa = seg.conv > 0 ? seg.spend / seg.conv : Infinity, rR = segCpa / campCpa;
      const saving = cmp.conv > 0 ? Math.max(0, (seg.spend - seg.conv * campCpa) / M) : 0;
      const dRatio = d => d.x.campConv > 0 ? (d.x.conv > 0 ? (d.x.spend / d.x.conv) / (d.x.campSpend / d.x.campConv) : Infinity) : null;
      const wF = worstOf(eps, days, d => { const v = dRatio(d); return v != null && isFinite(v) ? v : null; }, (a, b) => a > b);
      const wZ = worstOf(eps, days, d => dRatio(d) === Infinity ? d.x.spend : null, (a, b) => a > b);
      const w = wF || wZ, aud = e0.type === 'audience', dev = e0.type === 'device', nm = e0.name, inCamp = inCampOf(e0.camp);
      const who = aud ? `${nm} (Google Ads audience ID ${e0.value}${e0.label ? `, ${e0.label}` : ''})` : nm;
      const title = seg.conv === 0 ? `${nm}${inCamp} spent ${money(seg.spend, cfg)} with no ${N} (${range})`
        : rR >= G.factor ? `${nm}${inCamp} costs ${rR.toFixed(1)}× the campaign’s cost per ${N1} (${range})`
        : wF ? `${nm}${inCamp} cost up to ${wF.v.toFixed(1)}× the campaign’s cost per ${N1} in parts of the period (${range})`
        : `${nm}${inCamp} had 28-day stretches with spend and no ${N} (${range})`;
      mk('segment', SEGMENT_ID, `${e0.cid}-${e0.type}-${e0.value}`, { area: 'audiences', agent: 'segment-scan', campaign: e0.camp,
        kind: 'audience', unit: 'saved', valuePerDay: saving, spendChangedPerDay: saving, estimate: true, minutes: 5, confidence: 'moderate', verifyDays: 14, score: saving * CONF_W.moderate / EFFORT_W.low,
        impactTxt: saving < 0.5 ? { k: 'Over the period', imp: 'No saving overall', sub: isFinite(rR) ? `${rR.toFixed(1)}× the campaign’s cost per ${N1}` : `no ${N} at all` } : undefined,
        title,
        observe: `${firedLine(nF, w, w === wF && wF ? `${wF.v.toFixed(1)}× the campaign’s cost per ${N1} over 28 days` : w ? `${money(w.d.x.spend, cfg)} with no ${N} over 28 days` : '')} Over the whole period ${who} took ${money(seg.spend, cfg)} of ${e0.camp}’s ${money(cmp.spend, cfg)} and brought ${n1(seg.conv)} ${N}${seg.conv > 0 ? `: ${money(segCpa, cfg)} per ${N1}` : ''}; the campaign paid ${money(campCpa, cfg)} per ${N1}.${aud ? ' Audience rows cover only the part of the traffic that matches an audience, so they don’t add up to the campaign.' : ''}`,
        means: `The same budget bought far fewer ${N} from ${dev ? `people on ${nm.toLowerCase()}` : aud ? 'this audience' : nm} than from the campaign as a whole.${aud ? ' Interest names aren’t translated yet: look the ID up in Google Ads (Audiences) to see which interest it is.' : ''}`,
        hypothesis: dev ? `People on ${nm.toLowerCase()} click but rarely get in touch, perhaps because the landing page or the contact step works less well there.` : 'This audience reaches people who are interested in the topic but not looking for help right now.',
        action: dev ? `Lower the bid adjustment for ${nm.toLowerCase()} in this campaign, then re-check its cost per ${N1} after 14 days.` : 'Lower this audience’s bid adjustment or exclude it from the campaign, then re-check after 14 days.',
        expect: `Save about ${money(saving, cfg)} a day (estimate: the segment’s spend above what the campaign’s own cost per ${N1} would buy, over the ${M} days of the period).`,
        success: `${nm}’s cost per ${N1} within 1.5× the campaign’s within 14 days, and ${N} not down by more than its share.`,
        caveat: aud ? `Interest names aren’t translated yet. Based on ${plat} conversions only, and it optimizes lead volume, not lead quality.` : `Based on ${plat} conversions only, and it optimizes lead volume, not lead quality.`,
        rule: `A segment (device, country or audience) costs at least ${G.factor}× the campaign’s cost per ${N1} over 28 days (or, with no ${N}, spends at least ${G.factor}× it), spends at least ${money(G.minSpend, cfg)} and ${Math.round(G.minSpendShare * 100)}% of the campaign, and the campaign has ${G.minCampConv}+ ${N} in those 28 days. Checked on every day of the picked period; firing days ${G.mergeGap} or fewer apart count as one stretch. Check ${SEGMENT_ID}.`,
        evidence: evid(chartOf(days, [
            { name: `${nm}, cost per ${N1} (28 days)`, vals: days.map(d => d.x.conv > 0 ? d.x.spend / d.x.conv : null), role: 'main' },
            { name: `Campaign, cost per ${N1} (28 days)`, vals: days.map(d => d.x.campConv > 0 ? d.x.campSpend / d.x.campConv : null), role: 'base' },
            { name: `${G.factor}× the campaign`, vals: days.map(d => d.x.campConv > 0 ? G.factor * d.x.campSpend / d.x.campConv : null), role: 'ref' }],
            { fmt: 'money', yLabel: `Cost per ${N1}, last 28 days`, note: `Gaps in the ${nm.toLowerCase()} line are 28-day windows where it brought no ${N}.` }),
          { cols: ['Week of', 'Segment spend', `Segment ${N}`, 'Campaign spend', `Campaign ${N}`, 'Days fired'], money: [1, 3],
            rows: weekRows(days, ['segSpend', 'segConv', 'campSpend', 'campConv'], s => [s.segSpend, n1(s.segConv), s.campSpend, n1(s.campConv)]) },
          `Shaded days are the days the check fired. Saving estimate: (${money(seg.spend, cfg)} − ${n1(seg.conv)} × ${money(campCpa, cfg)}) ÷ ${M} days = ${money(saving, cfg)} a day.`) });
    }

    /* Campaign setup and creative: budget-limited search campaigns, ad fatigue */
    const S2 = SETUP_SCAN, snap = R.settings && R.settings.snapshotDate ? dFmt(new Date(R.settings.snapshotDate + 'T12:00:00').getTime(), true) : null;
    for (const [key, eps] of group(st, e => `${e.check}|${e.check === 'fatigue' ? e.adId : e.cid}`)) {
      const e0 = eps[0], tr = (st.tracks || []).find(t => t.key === key); if (!tr) continue;
      const days = tr.days.map(d => Object.assign({}, d, { on: d.fired })), nF = days.filter(d => d.on).length, stretches = plural(eps.length, 'stretch', 'stretches');
      const ruleEnd = `. Checked on every day of the picked period; firing days ${S2.mergeGap} or fewer apart count as one stretch. Check ${e0.checkId}.`;
      if (e0.check === 'budgetLimited') {
        const tot = { cost: sumRaw(days, 'cost'), elig: sumRaw(days, 'elig'), lost: sumRaw(days, 'lost') }, share = tot.elig > 0 ? tot.lost / tot.elig : 0;
        const w = worstOf(eps, days, d => d.x.elig > 0 ? d.x.lost / d.x.elig : null, (a, b) => a > b);
        const sc = R.settings && R.settings.campaigns.find(c => c.id === e0.cid), budget = sc && sc.budget ? `${money(sc.budget, cfg)} a day${snap ? `, as of ${snap}` : ''}` : null;
        mk('budgetLimited', e0.checkId, e0.cid, { area: 'setup', agent: 'setup-scan', campaign: e0.camp, kind: 'budget', confidence: 'moderate', minutes: 5, score: 0,
          impactTxt: { k: 'Room to grow', imp: 'Room to grow', sub: `${pc0(share)} lost to budget` },
          title: `${e0.camp} lost ${pc0(share)} of its search impressions to budget (${range})`,
          observe: `${firedLine(nF, w, w ? `${pc0(w.v)} of search impressions lost to budget over 7 days` : '')} Over the whole period it was eligible for ${Math.round(tot.elig).toLocaleString('en')} search impressions and lost ${Math.round(tot.lost).toLocaleString('en')} (${pc0(share)}) because the daily budget ran out, while spending ${money(tot.cost, cfg)}.`,
          means: 'The campaign could have shown more often for searches it already targets, if the budget had allowed it.',
          hypothesis: 'The daily budget runs out before the end of the day, so the ads stop showing for the rest of it.',
          action: `Raise the daily budget${budget ? ` (today’s budget: ${budget})` : ''} or lower bids, so the budget lasts the whole day.`,
          expect: 'More impressions and clicks from searches the campaign already targets, at a similar cost per click.',
          success: `Impressions lost to budget under ${Math.round(S2.budgetLimited.minLostShare * 100)}% of eligible within 14 days.`,
          caveat: 'Adds spend for lead volume; lead quality unknown until CRM data arrives.',
          rule: `A search campaign spends ${money(S2.budgetLimited.minSpend, cfg)}+ in 7 days and loses ${Math.round(S2.budgetLimited.minLostShare * 100)}%+ of its eligible search impressions to budget` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: 'Lost to budget, last 7 days', vals: days.map(d => d.x.elig > 0 ? 100 * d.x.lost / d.x.elig : null), role: 'main' }, { name: `${Math.round(S2.budgetLimited.minLostShare * 100)}% threshold`, vals: days.map(() => 100 * S2.budgetLimited.minLostShare), role: 'ref' }],
              { fmt: 'pct', yLabel: 'Share of eligible search impressions lost to budget' }),
            { cols: ['Week of', 'Spend', 'Eligible impressions', 'Lost to budget', 'Share lost', 'Days fired'], money: [1],
              rows: weekRows(days, ['cost', 'elig', 'lost'], s => [s.cost, s.elig, s.lost, s.elig > 0 ? pc1(s.lost / s.elig) : '—']) },
            `Shaded days are the days the check fired. Impression counts as ${plat} reports them.`) });
      } else {
        const tot = { imp: sumRaw(days, 'imp'), clicks: sumRaw(days, 'clicks') }, nm = adName(R, e0.adId);
        const w = worstOf(eps, days, d => d.x.imp7 > 0 && d.x.impB > 0 && d.x.clkB > 0 ? (d.x.clk7 / d.x.imp7) / (d.x.clkB / d.x.impB) : null, (a, b) => a < b);
        mk('fatigue', e0.checkId, e0.adId, { area: 'creative', agent: 'setup-scan', campaign: e0.camp,
          title: `Click-through rate on ${nm} dropped ${Math.round((1 - S2.fatigue.ratio) * 100)}%+ in ${stretches} (${range})`,
          observe: `${firedLine(nF, w, w ? `${(100 * w.d.x.clk7 / w.d.x.imp7).toFixed(1)}% CTR over 7 days, ${pc0(1 - w.v)} below the 21 days before` : '')} Over the whole period the ad got ${Math.round(tot.clicks).toLocaleString('en')} clicks from ${Math.round(tot.imp).toLocaleString('en')} impressions (${tot.imp > 0 ? (100 * tot.clicks / tot.imp).toFixed(1) : '0'}% CTR).`,
          means: 'The ad earned fewer clicks per impression than it did before. People may have seen it too often, competitors may have fresher ads, or the searches it shows for changed.',
          hypothesis: 'The headlines and descriptions have gone stale for the people seeing them.',
          action: 'Refresh the headlines and descriptions, and check that the ad still matches the searches it shows for.',
          success: 'Click-through rate stays within 30% of its level in the 21 days before.',
          rule: `An ad’s click-through rate in the last 7 days is at most ${Math.round(S2.fatigue.ratio * 100)}% of its rate in the 21 days before, with ${S2.fatigue.minImp}+ impressions in the 7 days and ${S2.fatigue.minImpBase}+ in the 21` + ruleEnd,
          evidence: evid(chartOf(days, [{ name: 'CTR, last 7 days', vals: days.map(d => d.x.imp7 > 0 ? 100 * d.x.clk7 / d.x.imp7 : null), role: 'main' }, { name: 'CTR, the 21 days before', vals: days.map(d => d.x.impB > 0 ? 100 * d.x.clkB / d.x.impB : null), role: 'base' }],
              { fmt: 'pct', yLabel: 'Click-through rate' }),
            { cols: ['Week of', 'Impressions', 'Clicks', 'CTR', 'Days fired'], money: [], rows: weekRows(days, ['imp', 'clicks'], s => [s.imp, s.clicks, s.imp > 0 ? pc1(s.clicks / s.imp) : '—']) },
            `Shaded days are the days the check fired. Impressions and clicks as ${plat} reports them.`) });
      }
    }
    // Shared finding details: the picked range is the period the finding covers
    for (const r of recs) r.finding = { from: fromT, to: toT, label: range };
    return recs;
  }
