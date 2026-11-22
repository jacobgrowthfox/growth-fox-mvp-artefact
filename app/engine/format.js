  /* ---------- Formatting helpers ---------- */
  function money(v, cfg, dec = 0) {
    if (!isFinite(v)) return '—'; // e.g. cost per lead with no leads
    const s = Math.abs(v).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const sign = v < 0 ? '−' : '';
    return cfg.currency === 'DKK' ? `${sign}${s} kr` : `${sign}€${s}`;
  }
  function n0r(v) { return Math.round(v).toLocaleString('en'); }
  function fmt1(v) { return v >= 10 ? Math.round(v).toLocaleString('en') : v.toFixed(1); }
  function short(name) { return name.replace(/^(Search|PMax|Meta) · /, '').replace(/ \((non-brand|generic)\)/, ''); }
  function dayLabel(daysAgo) { const d = new Date(END - (daysAgo - 1) * DAY); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function fillDates(s) { return s.replace(/\{d(\d+)\}/g, (_, k) => dayLabel(+k)); }


  /* The engine's public interface, used by the UI files as GF.* */
  const GF = { PM_CHECKS, PM_TAGS, PROFILE_FIELDS, PROFILE_QUESTIONS, FIELD_LABEL, OBJECTIVES, COUNTRY_NAMES, setProfile, profileOf, CHECK_INPUTS, checkInputs, CATEGORIES, GATES, readiness, gateRecs, reliability, eligibility, applyEligibility, recIntent, rubricCheck, SETUP_SCAN, checksRun, scanSetup, periodRecs, settingsRecs, REAL, setReal, realDay, isoD, SPEND_SCAN, scanSpend, spanTxt, SEGMENT_SCAN, scanSegments, VOL_MIN, validRule, ENGINEER, coverage, CLIENTS, CHECK_GROUPS, PLATFORMS, CONF_W, CATS, CAT_W, END, DAY, generate, win, campWindow, dqByPlatform, dqOverall, epWindow, epTrend, epStatus, missAny, build, money, fmt1, short, dayLabel, fillDates };
