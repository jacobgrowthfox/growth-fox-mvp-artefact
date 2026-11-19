
  /* ---------- The Paid Media Fox rubric: check id → check name ---------- */
  const PM_CHECKS = {
    'pm.2.spend.spend_no_conversions': 'Spend with no conversions', 'pm.2.spend.cpa_rising': 'Rising CPA', 'pm.2.spend.roas_falling': 'Falling ROAS (e-com)',
    'pm.2.spend.conversions_falling': 'Falling conversions', 'pm.2.spend.budget_shift': 'Budget shifts', 'pm.2.spend.invalid_clicks_spike': 'Invalid-click spike',
    'pm.2.spend.recent_major_edit': 'Large edit before a KPI moved',
    'pm.2.audiences.prospecting_hits_existing': 'Prospecting hits existing customers', 'pm.2.audiences.frequency_high': 'Frequency too high',
    'pm.2.audiences.segment_cpa_outlier': 'Segment CPA outlier', 'pm.2.audiences.placement_waste': 'Placement with spend and no conversions',
    'pm.2.creative_lp.landing_page_cvr_low': 'Landing page converting below the paid average', 'pm.2.creative_lp.creative_fatigue': 'Creative fatigue',
    'pm.2.creative_lp.ad_strength_poor': '“Poor” ad strength', 'pm.2.creative_lp.mobile_lcp_slow': 'Slow mobile pages',
    'pm.1.setup.bidding_conversion': 'Bidding on the wrong or a secondary conversion', 'pm.1.setup.search_budget_limited': 'Search campaign limited by budget',
    'pm.1.setup.location_presence_interest': 'Location set to “presence or interest”', 'pm.1.setup.no_shared_negative_list': 'No shared negative keyword list',
    'pm.1.setup.broad_without_smart_bidding': 'Broad match without smart bidding', 'pm.1.setup.keyword_conflicts': 'Keyword blocked by a negative',
    'pm.1.setup.not_serving': 'Enabled but not serving', 'pm.2.creative_lp.creative_disapproved': 'Disapproved ad',
    'pm.1.setup.brand_absolute_top_low': 'Brand campaign low on absolute top', 'pm.1.setup.target_far_from_actual': 'Target or cap tighter than actual results',
  };
  // The app's Paid Media rules mapped to rubric checks (by rule id pattern). Unmatched rules: { check: null, checkNote }.
  const RUBRIC_MAP = [
    [/^sw-/, 'pm.2.spend.spend_no_conversions'],
    [/^sp-cpa-/, 'pm.2.spend.cpa_rising'],
    [/^au-freq-/, 'pm.2.audiences.frequency_high'],
    [/^au-seg-/, 'pm.2.audiences.segment_cpa_outlier'],
    [/^cr-lp-meta/, 'pm.2.creative_lp.mobile_lcp_slow'],
    [/^cr-lp-/, 'pm.2.creative_lp.landing_page_cvr_low'],
    [/^cr-rsa-/, 'pm.2.creative_lp.ad_strength_poor'],
    [/^cr-fatigue-/, 'pm.2.creative_lp.creative_fatigue'],
    [/^st-conv-/, 'pm.1.setup.bidding_conversion'],
    [/^st-geo-gads$/, 'pm.1.setup.location_presence_interest'],
  ];
  const NOT_IN_RUBRIC = [
    [/^ps-(realloc|inv|cut)-/, 'expensive search campaign'],
    [/^ps-neg$/, 'search-term negative keywords'],
    [/^ps-brand$/, 'brand CPC rising'],
    [/^st-geo-/, 'targeting outside the delivery areas'],
  ];
  function rubricCheck(rc) {
    const hit = RUBRIC_MAP.find(([re]) => re.test(rc.id));
    if (hit) return { check: hit[1] };
    const no = NOT_IN_RUBRIC.find(([re]) => re.test(rc.id));
    return { check: null, checkNote: no ? no[1] : (rc.rule || rc.title || 'app rule').slice(0, 80) };
  }
