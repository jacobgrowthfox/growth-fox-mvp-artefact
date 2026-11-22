// Local test fixture shaped like Hue Therapy's shared-store export (clients/hue-therapy/gads/*).
// INVENTED TEST DATA: the shapes follow engine/real-data.js; the numbers are made up and are not Hue Therapy's.
// The real data only loads inside claude.ai. Used by tools/smoke.js and tools/readiness-test.js; never published.
//
// makeDocs({ endT, variant, tweak }) returns { meta, terms, 'daily-YYYY', 'segments-YYYY', 'ads-YYYY', 'settings-now' }.
//   variant 'current': only the fields the BigQuery export carries today.
//   variant 'full':    adds the optional fields the Stage 1 gates can use (conversion actions, locations, ...).
//   tweak(docs, helpers): mutate the docs for a scenario.
const DAY = 864e5;
const iso = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function makeDocs({ endT, variant = 'current', days = 120, lastConvDaysAgo = 20, outsideShare = 0.05, tweak } = {}) {
  const end = new Date(endT); end.setHours(12, 0, 0, 0);
  const dates = []; for (let k = days - 1; k >= 0; k--) dates.push(iso(new Date(end.getFullYear(), end.getMonth(), end.getDate() - k).getTime()));
  const camps = [
    { id: '111', name: 'Hue Leads Search', type: 'search', status: 'ENABLED', perDay: 300 },
    { id: '222', name: 'Hue Brand', type: 'search', status: 'PAUSED', perDay: 40, pausedDaysAgo: 12 },
  ];
  const daily = {}, seg = {}, ads = {};
  let r = 7; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  dates.forEach((d, i) => {
    const ago = days - 1 - i, y = d.slice(0, 4);
    for (const c of camps) {
      const live = !(c.pausedDaysAgo != null && ago < c.pausedDaysAgo);
      const cost = live ? Math.round(c.perDay * (0.8 + 0.4 * rnd())) : 0, clicks = live ? Math.round(cost / 70) : 0;
      // Conversions every few days until lastConvDaysAgo, none after (mirrors the "no conversion since" note on the real page)
      const conv = live && c.id === '111' && ago >= lastConvDaysAgo && i % 4 === 0 ? 1 : 0;
      const D = (daily[`daily-${y}`] = daily[`daily-${y}`] || { camps: {} }).camps;
      const s = D[c.id] = D[c.id] || { d: [], cost: [], clicks: [], conv: [], imp: [], inv: [], elig: [], lost: [] };
      s.d.push(d); s.cost.push(cost); s.clicks.push(clicks); s.conv.push(conv); s.imp.push(clicks * 12); s.inv.push(0); s.elig.push(clicks * 14); s.lost.push(clicks);
      if (cost) {
        const S = (seg[`segments-${y}`] = seg[`segments-${y}`] || { cols: ['date', 'campaign', 'type', 'value', 'label', 'detail', 'cost', 'clicks', 'conv'], rows: [] }).rows;
        const out = Math.round(cost * outsideShare);
        S.push([d, c.id, 'country', '2208', 'Denmark', null, cost - out, clicks, conv]);
        if (out) S.push([d, c.id, 'country', '2752', 'Sweden', null, out, 0, 0]);
        S.push([d, c.id, 'device', 'MOBILE', null, null, cost, clicks, conv]);
        if (c.id === '111') {
          const A = (ads[`ads-${y}`] = ads[`ads-${y}`] || { cols: ['date', 'campaign', 'adGroup', 'ad', 'imp', 'clicks', 'cost', 'conv'], rows: [] }).rows;
          A.push([d, '111', '9001', '7001', clicks * 8, Math.round(clicks * 0.6), Math.round(cost * 0.6), conv]);
          A.push([d, '111', '9002', '7002', clicks * 4, Math.round(clicks * 0.4), Math.round(cost * 0.4), 0]);
        }
      }
    }
  });
  const lastConv = dates[days - 1 - lastConvDaysAgo - ((days - 1 - lastConvDaysAgo) % 4)];
  const docs = Object.assign({
    meta: { campaigns: camps.map(c => ({ id: c.id, name: c.name, type: c.type, status: c.status, lostIs28: 0.12, cpc28: 70 })), dataThrough: dates[days - 1], firstSpend: dates[0], lastConversion: lastConv },
    terms: { rows: [['therapist copenhagen', '111', 142, 3, 0], ['couples therapy copenhagen', '111', 96, 2, 0], ['free therapy online', '111', 88, 2, 0]] },
    'settings-now': {
      snapshotDate: dates[days - 1],
      campaigns: [
        { id: '111', name: 'Hue Leads Search', status: 'ENABLED', servingStatus: 'SERVING', channel: 'SEARCH', bidding: 'MAXIMIZE_CONVERSIONS', budget: 320 },
        { id: '222', name: 'Hue Brand', status: 'PAUSED', servingStatus: 'SERVING', channel: 'SEARCH', bidding: 'MANUAL_CPC', budget: 50 },
      ],
      adGroups: [
        { campaign: '111', id: '9001', name: 'Therapy Copenhagen', status: 'ENABLED', type: 'SEARCH_STANDARD', bidding: '' },
        { campaign: '111', id: '9002', name: 'Couples therapy', status: 'ENABLED', type: 'SEARCH_STANDARD', bidding: '' },
        { campaign: '222', id: '9003', name: 'Brand', status: 'ENABLED', type: 'SEARCH_STANDARD', bidding: '' },
      ],
      keywords: [
        { campaign: '111', adGroup: '9001', id: 'k1', text: 'therapist copenhagen', match: 'PHRASE', negative: false, status: 'ENABLED', approval: 'APPROVED', serving: 'ELIGIBLE', qs: 6 },
        { campaign: '111', adGroup: '9001', id: 'k2', text: 'psychotherapy', match: 'BROAD', negative: false, status: 'ENABLED', approval: 'APPROVED', serving: 'ELIGIBLE', qs: 5 },
        { campaign: '111', adGroup: '9002', id: 'k3', text: 'couples therapy', match: 'PHRASE', negative: false, status: 'ENABLED', approval: 'APPROVED', serving: 'ELIGIBLE', qs: 7 },
        { campaign: '111', adGroup: '9001', id: 'n1', text: 'free', match: 'BROAD', negative: true, status: 'ENABLED', approval: '', serving: '', qs: 0 },
      ],
      campaignNegatives: [{ campaign: '111', text: 'jobs', status: 'ENABLED' }],
      ads: [
        { campaign: '111', adGroup: '9001', id: '7001', type: 'RESPONSIVE_SEARCH_AD', strength: 'AVERAGE', approval: 'APPROVED', status: 'ENABLED' },
        { campaign: '111', adGroup: '9002', id: '7002', type: 'EXPANDED_TEXT_AD', strength: '', approval: 'APPROVED', status: 'ENABLED' },
        { campaign: '222', adGroup: '9003', id: '7003', type: 'RESPONSIVE_SEARCH_AD', strength: 'GOOD', approval: 'APPROVED', status: 'ENABLED' },
      ],
    },
  }, daily, seg, ads);
  if (variant === 'full') {
    const S = docs['settings-now'];
    S.conversionActions = [
      { id: 'c1', name: 'Contact form submitted', category: 'SUBMIT_LEAD_FORM', primary: true, status: 'ENABLED' },
      { id: 'c2', name: 'Booking page viewed', category: 'PAGE_VIEW', primary: true, status: 'ENABLED' },
      { id: 'c3', name: 'Phone number clicked', category: 'PHONE_CALL_LEAD', primary: false, status: 'ENABLED' },
    ];
    S.campaigns[0].geoTargetType = 'PRESENCE_OR_INTEREST'; S.campaigns[1].geoTargetType = 'PRESENCE';
    S.campaigns[0].locations = [{ name: 'Denmark', country: 'Denmark', negative: false }, { name: 'Malmö', country: 'Sweden', negative: false }];
    S.campaigns[1].locations = [{ name: 'Denmark', country: 'Denmark', negative: false }];
    S.campaigns[0].euPolitical = 'DOES_NOT_CONTAIN'; S.campaigns[1].euPolitical = 'DOES_NOT_CONTAIN';
    S.campaigns[0].bidCeiling = 0; S.campaigns[1].bidCeiling = 0;
    for (const a of S.ads) a.finalUrlError = '';
    S.account = { status: 'ENABLED', billingOk: true, policyHold: false };
  }
  if (tweak) tweak(docs, { dates, iso });
  return docs;
}
// A profile with every question answered (invented answers for tests).
const PROFILE_FULL = {
  services: { state: 'answered', value: [{ name: 'Individual therapy', priority: true }, { name: 'Couples therapy', priority: true }, { name: 'Family therapy', priority: false }] },
  priorities: { state: 'answered' },
  objectives: { state: 'answered', value: ['enquiries', 'bookings'] },
  customers: { state: 'answered', value: 'Adults in Copenhagen looking for therapy in English or Danish' },
  markets: { state: 'answered', value: [{ name: 'Denmark', country: 'Denmark' }] },
  customerValue: { state: 'unsure' },
};
module.exports = { makeDocs, PROFILE_FULL, iso, DAY };
