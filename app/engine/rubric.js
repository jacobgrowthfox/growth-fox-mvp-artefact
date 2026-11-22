
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
    'pm.2.creative_lp.no_rsa_in_ad_group': 'Search ad group without a usable responsive search ad', 'pm.1.setup.eu_declaration_missing': 'EU political advertising declaration missing',
    'pm.1.setup.bid_cap_on_smart_bidding': 'Bid cap or floor on smart bidding', 'pm.2.creative_lp.landing_page_error': 'Landing page broken',
    'gf.conversion_sanity': 'Conversion recorded in 7 days (interim)',
  };
  /* Stage 1 categories for every Paid Media check (GC-6, RE-2). kind 'gate' = one of the deterministic gates that set a category's
     state (the gate id says which); every other check is 'advisory': tagged with a category, never changes a state.
     Categories: conversion = Conversion Readiness, structure = Campaign Structure & Relevance, delivery = Delivery Readiness. */
  const PM_TAGS = {
    'gf.conversion_sanity': { category: 'conversion', kind: 'gate', gate: 'DF-1' },
    'pm.1.setup.bidding_conversion': { category: 'conversion', kind: 'gate', gate: 'GC-1' },
    'pm.1.setup.not_serving': { category: 'delivery', kind: 'gate', gate: 'GC-2' },
    'pm.2.creative_lp.creative_disapproved': { category: 'delivery', kind: 'gate', gate: 'GC-2' },
    'pm.1.setup.eu_declaration_missing': { category: 'delivery', kind: 'gate', gate: 'GC-2' },
    'pm.2.creative_lp.landing_page_error': { category: 'delivery', kind: 'gate', gate: 'GC-2' },
    'pm.1.setup.location_presence_interest': { category: 'structure', kind: 'gate', gate: 'GC-3' },
    'pm.2.creative_lp.no_rsa_in_ad_group': { category: 'structure', kind: 'gate', gate: 'GC-4' },
    'pm.1.setup.target_far_from_actual': { category: 'delivery', kind: 'gate', gate: 'GC-5' },
    'pm.1.setup.bid_cap_on_smart_bidding': { category: 'delivery', kind: 'gate', gate: 'GC-5' },
    'pm.1.setup.broad_without_smart_bidding': { category: 'delivery', kind: 'gate', gate: 'GC-5' },
    // Advisory: Campaign and account setup
    'pm.1.setup.brand_nonbrand_mixed': { category: 'structure', kind: 'advisory' }, 'pm.1.setup.search_budget_limited': { category: 'delivery', kind: 'advisory' },
    'pm.1.setup.no_shared_negative_list': { category: 'structure', kind: 'advisory' }, 'pm.1.setup.meta_learning_limited': { category: 'delivery', kind: 'advisory' },
    'pm.1.setup.fragmented_budgets': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.auto_applied_recommendations': { category: 'delivery', kind: 'advisory' },
    'pm.1.setup.search_network_expansion': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.pmax_brand_not_excluded': { category: 'structure', kind: 'advisory' },
    'pm.1.setup.ai_max_expansion': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.pmax_final_url_expansion': { category: 'delivery', kind: 'advisory' },
    'pm.1.setup.meta_creative_enhancements': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.meta_placements_manual': { category: 'delivery', kind: 'advisory' },
    'pm.1.setup.products_not_serving': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.retargeting_optimized_targeting': { category: 'structure', kind: 'advisory' },
    'pm.1.setup.no_placement_exclusions': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.keyword_conflicts': { category: 'structure', kind: 'advisory' },
    'pm.1.setup.pmax_without_merchant_center': { category: 'delivery', kind: 'advisory' }, 'pm.1.setup.brand_absolute_top_low': { category: 'delivery', kind: 'advisory' },
    'pm.1.setup.ecom_count_bidding': { category: 'conversion', kind: 'advisory' }, 'pm.1.setup.lead_form_volume': { category: 'conversion', kind: 'advisory' },
    // Advisory: Creative and landing pages
    'pm.2.creative_lp.landing_page_cvr_low': { category: 'structure', kind: 'advisory' }, 'pm.2.creative_lp.creative_fatigue': { category: 'structure', kind: 'advisory' },
    'pm.2.creative_lp.ad_strength_poor': { category: 'structure', kind: 'advisory' }, 'pm.2.creative_lp.mobile_lcp_slow': { category: 'structure', kind: 'advisory' },
    'pm.2.creative_lp.core_assets_missing': { category: 'structure', kind: 'advisory' }, 'pm.2.creative_lp.promotion_ended': { category: 'structure', kind: 'advisory' },
    'pm.2.creative_lp.rsa_assets_unserved': { category: 'structure', kind: 'advisory' }, 'pm.2.creative_lp.google_ad_enhancements': { category: 'structure', kind: 'advisory' },
    'pm.2.creative_lp.products_no_impressions': { category: 'delivery', kind: 'advisory' }, 'pm.2.creative_lp.meta_quality_ranking_low': { category: 'structure', kind: 'advisory' },
    'pm.2.creative_lp.meta_low_creative_diversity': { category: 'structure', kind: 'advisory' },
    // Advisory: Audiences and targeting, Spend and optimization
    'pm.2.audiences.prospecting_hits_existing': { category: 'structure', kind: 'advisory' }, 'pm.2.audiences.frequency_high': { category: 'structure', kind: 'advisory' },
    'pm.2.audiences.segment_cpa_outlier': { category: 'structure', kind: 'advisory' }, 'pm.2.audiences.placement_waste': { category: 'structure', kind: 'advisory' },
    'pm.2.spend.spend_no_conversions': { category: 'conversion', kind: 'advisory' }, 'pm.2.spend.cpa_rising': { category: 'delivery', kind: 'advisory' },
    'pm.2.spend.roas_falling': { category: 'delivery', kind: 'advisory' }, 'pm.2.spend.conversions_falling': { category: 'conversion', kind: 'advisory' },
    'pm.2.spend.budget_shift': { category: 'delivery', kind: 'advisory' }, 'pm.2.spend.invalid_clicks_spike': { category: 'delivery', kind: 'advisory' },
    'pm.2.spend.recent_major_edit': { category: 'delivery', kind: 'advisory' },
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
