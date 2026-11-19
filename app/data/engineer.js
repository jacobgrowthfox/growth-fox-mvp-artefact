  /* ---------- Engineer Fox: coverage ----------
     Coverage = share of ad spend tracked end to end. Each ad platform needs three links: the platform
     connected, its browser tag firing every key event, and server-side events arriving. A platform's
     coverage is its weakest link; overall coverage weights platforms by spend. Sample values. */
  const ENGINEER = {
    nordlys: {
      links: {
        gads: [
          { key: 'api', name: 'Platform connected', detail: 'Google Ads API · spend and campaigns', cov: 1, source: 'Google Ads' },
          { key: 'tag', name: 'Tag firing key events', detail: 'Google tag · purchase', cov: 1, source: 'Google Ads' },
          { key: 'server', name: 'Server-side events arriving', detail: 'Enhanced conversions', cov: 1, source: 'Google Enhanced Conversions' },
        ],
        meta: [
          { key: 'api', name: 'Platform connected', detail: 'Meta Marketing API · spend and campaigns', cov: 1, source: 'Meta Ads' },
          { key: 'tag', name: 'Pixel firing key events', detail: '4 of 5 key events: begin_checkout stopped', cov: 0.8, since: 5, source: 'Meta pixel', check: 'tags-meta' },
          { key: 'server', name: 'Server-side events arriving', detail: 'Conversions API · purchases', cov: 1, source: 'Meta Conversions API' },
        ],
      },
      catalog: [
        { id: 'klaviyo', name: 'Klaviyo', kind: 'Email', fox: 'crm', unlocks: 'Separates email-driven orders from paid, so paid media isn’t credited for email sales.', provide: 'A read-only API key' },
        { id: 'tiktok', name: 'TikTok Ads', kind: 'Ad platform', fox: 'paid', unlocks: 'Adds TikTok as a Paid Media channel, with its own coverage and opportunities.', provide: 'Access to your TikTok Business Center' },
        { id: 'gsc', name: 'Google Search Console', kind: 'Organic search', fox: 'seo', unlocks: 'Organic queries next to paid search terms, to spot where you pay for clicks you’d get anyway.', provide: 'Access to your Search Console property' },
        { id: 'cogs', name: 'Product costs', kind: 'Costs (CSV or ERP)', unlocks: 'Profit and margin per order. Needed for the Commercial Fox in V2.', provide: 'Cost per product, as a file or ERP access', fox: 'commercial' },
      ],
      // Volume per source (key event streams). Sample anomalies: a promotion spike, the quarantined GA4 day, begin_checkout gone.
      streams: [
        { id: 'shop', source: 'Shopify orders', label: 'Shopify orders', unit: 'orders', fromConv: 1, anomalies: [{ from: 9, to: 7, factor: 1.8 }] },
        { id: 'ga4', source: 'GA4', label: 'GA4 sessions', unit: 'sessions', perDay: 4600, anomalies: [{ from: 1, to: 1, factor: 4.4 }], note: 'The Data Fox has quarantined this day’s GA4 data until you decide whether it was real.' },
        { id: 'gads', source: 'Google Ads', label: 'Google Ads clicks', unit: 'clicks', perDay: 1900 },
        { id: 'meta', source: 'Meta Ads', label: 'Meta Ads clicks', unit: 'clicks', perDay: 1450 },
        { id: 'pixel-bc', source: 'Meta pixel', label: 'Meta pixel · begin_checkout', unit: 'events', perDay: 330, anomalies: [{ from: 4, to: 0, factor: 0 }], check: 'tags-meta' },
        { id: 'pixel-pv', source: 'Meta pixel', label: 'Meta pixel · page views', unit: 'events', perDay: 3900 },
        { id: 'capi', source: 'Meta Conversions API', label: 'Meta Conversions API · purchases', unit: 'purchases', fromConv: 0.97 },
        { id: 'ec', source: 'Google Enhanced Conversions', label: 'Google enhanced conversions', unit: 'conversions', perDay: 150 },
        { id: 'consent', source: 'Consent platform (Cookiebot)', label: 'Consent choices', unit: 'choices', perDay: 4100 },
        { id: 'wholesale', source: 'Shopify orders', label: 'Shopify · wholesale orders', unit: 'orders', perDay: 6 },
      ],
      // Browser (client) against server counts of the same events. gap = share the browser misses, normally.
      pairs: [
        { id: 'ga4-purchase', event: 'purchases', client: 'GA4 web tag', server: 'Server-side GA4', sources: ['GA4'], fromConv: 0.98, gap: 0.22, change: { since: 8, gap: 0.35 } },
        { id: 'meta-purchase', event: 'purchases', client: 'Meta pixel', server: 'Meta Conversions API', sources: ['Meta pixel', 'Meta Conversions API'], fromConv: 0.97, gap: 0.2 },
        { id: 'gads-conv', event: 'conversions', client: 'Google tag', server: 'Enhanced conversions', sources: ['Google Ads', 'Google Enhanced Conversions'], perDay: 150, gap: 0.08 },
      ],
    },
    flamehouse: {
      links: {
        gads: [
          { key: 'api', name: 'Platform connected', detail: 'Google Ads API · spend and campaigns', cov: 1, source: 'Google Ads' },
          { key: 'tag', name: 'Tag firing key events', detail: 'Google tag · purchase', cov: 1, source: 'Google Ads' },
          { key: 'server', name: 'Server-side events arriving', detail: 'Enhanced conversions', cov: 1, source: 'Google Enhanced Conversions' },
        ],
        meta: [
          { key: 'api', name: 'Platform connected', detail: 'Meta Marketing API · spend and campaigns', cov: 1, source: 'Meta Ads' },
          { key: 'tag', name: 'Pixel firing key events', detail: '6 of 6 key events', cov: 1, source: 'Meta pixel' },
          { key: 'server', name: 'Server-side events arriving', detail: 'Conversions API: app purchases stopped', cov: 0.7, since: 6, source: 'Meta Conversions API', check: 'tags-meta' },
        ],
      },
      catalog: [
        { id: 'delivery', name: 'Delivery partners', kind: 'Marketplace orders', fox: 'commercial', unlocks: 'Orders placed through delivery marketplaces, so paid media isn’t judged on app orders alone.', provide: 'Partner API access or a daily order export' },
        { id: 'loyalty', name: 'Loyalty platform', kind: 'CRM', fox: 'crm', unlocks: 'Repeat-order rate per campaign, and loyalty IDs as a matching key for Meta and Google.', provide: 'A read-only API key' },
        { id: 'tiktok', name: 'TikTok Ads', kind: 'Ad platform', fox: 'paid', unlocks: 'Adds TikTok as a Paid Media channel, with its own coverage and opportunities.', provide: 'Access to your TikTok Business Center' },
        { id: 'pos', name: 'In-store POS', kind: 'Store sales', unlocks: 'Walk-in and drive-through sales per restaurant, for local campaigns. Needed for the Commercial Fox in V2.', provide: 'A daily sales export per store', fox: 'commercial' },
      ],
      streams: [
        { id: 'orders', source: 'Ordering app & web orders', label: 'App & web orders', unit: 'orders', fromConv: 1 },
        { id: 'ga4', source: 'GA4', label: 'GA4 sessions', unit: 'sessions', perDay: 11500, anomalies: [{ from: 4, to: 3, factor: 1.7 }] },
        { id: 'gads', source: 'Google Ads', label: 'Google Ads clicks', unit: 'clicks', perDay: 7400 },
        { id: 'meta', source: 'Meta Ads', label: 'Meta Ads clicks', unit: 'clicks', perDay: 8900 },
        { id: 'pixel', source: 'Meta pixel', label: 'Meta pixel · purchases', unit: 'events', fromConv: 0.62 },
        { id: 'capi', source: 'Meta Conversions API', label: 'Meta Conversions API · purchases', unit: 'purchases', fromConv: 0.96, anomalies: [{ from: 5, to: 0, factor: 0.4 }], check: 'tags-meta' },
        { id: 'ec', source: 'Google Enhanced Conversions', label: 'Google enhanced conversions', unit: 'conversions', perDay: 640 },
        { id: 'consent', source: 'Consent platform', label: 'Consent choices', unit: 'choices', perDay: 9800 },
        { id: 'catering', source: 'Ordering app & web orders', label: 'Catering orders', unit: 'orders', perDay: 9 },
      ],
      pairs: [
        { id: 'ga4-purchase', event: 'purchases', client: 'GA4 web tag', server: 'Server-side GA4', sources: ['GA4'], fromConv: 0.7, gap: 0.17 },
        { id: 'meta-purchase', event: 'purchases', client: 'Meta pixel', server: 'Meta Conversions API', sources: ['Meta pixel', 'Meta Conversions API'], fromConv: 0.62, gap: 0.18, change: { since: 6, gap: -0.42 } },
        { id: 'gads-conv', event: 'conversions', client: 'Google tag', server: 'Enhanced conversions', sources: ['Google Ads', 'Google Enhanced Conversions'], perDay: 640, gap: 0.1 },
      ],
    },
  };
