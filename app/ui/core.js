/* ===== GrowthFox MVP: UI (styled after the GrowthFox v1 dashboard design) ===== */
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('gf.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('gf.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------- Icons ---------- */
  const I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 7"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
    list: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M3 8h10M3 12h6"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
    book: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z"/><path d="M3 11.5a2 2 0 0 1 2-2h7.5M6 5.5h4"/></svg>',
    download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>',
    pulse: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8h3l1.5-4 3 8 1.5-4h4"/></svg>',
  };

  /* ---------- Foxes (artwork from the GrowthFox v1 dashboard design) ---------- */
  const FOX = {
    executive: { name: 'Executive Fox', c: 'var(--primary)', t: 'var(--primary-soft)', w: '#F1F8F4', g: ['#23876A', '#0E5A47'], ink: '#073A2D', role: 'Sums up how the business is doing, what the team has done and what to do next, for the people who sign off the budget.' },
    engineer: { name: 'Engineer Fox', c: 'var(--com)', t: 'var(--com-tint)', w: 'var(--com-wash)', g: ['#D2703A', '#B4551F'], ink: '#7A3510', role: 'Makes sure every connection is set up properly and data keeps arriving: flags sudden dips, spikes and gaps between browser and server counts.' },
    crm: { name: 'CRM Fox', c: '#B8436F', t: '#F8E4EC', w: '#FCF2F6', g: ['#D9618F', '#B8436F'], ink: '#6E1F40', role: 'Email, loyalty and repeat customers. Coming in V2.' },
    seo: { name: 'SEO/GEO Fox', c: '#1B7F78', t: '#DDF2EF', w: '#F0FAF8', g: ['#2AA198', '#1B7F78'], ink: '#0E4A46', role: 'Organic search, and how AI answers mention you. Coming in V2.' },
    commercial: { name: 'Commercial Fox', c: '#B7841A', t: '#F8EED6', w: '#FCF7EA', g: ['#D9A426', '#B7841A'], ink: '#5E430A', role: 'Watches overall revenue. Extends to profit and margin once that data comes in.' },
    paid: { name: 'Paid Media Fox', c: 'var(--med)', t: 'var(--med-tint)', w: 'var(--med-wash)', g: ['#4474D6', '#2F5BBD'], ink: '#1C377A', role: 'Watches blended return on ad spend across Google Ads and Meta, within each channel.' },
    analytics: { name: 'Data Fox', c: 'var(--ana)', t: 'var(--ana-tint)', w: 'var(--ana-wash)', g: ['#8A69CF', '#6E4FB6'], ink: '#43307A', role: 'Watches every endpoint your numbers depend on, parameter by parameter: critical, warning and optional.' },
  };
  const foxVars = k => `--c:${FOX[k].c};--t:${FOX[k].t};--w:${FOX[k].w}`;
  const HEAD = 'M24 45 C13 45 5 37.6 5 27.4 C5 22.6 6.2 18.6 8.2 15.4 C7.4 11 7.8 7 9.2 4.2 C10 2.8 11.6 2.4 13 3.2 C15.6 4.6 18.2 7 20 9.8 C22.6 9.2 25.4 9.2 28 9.8 C29.8 7 32.4 4.6 35 3.2 C36.4 2.4 38 2.8 38.8 4.2 C40.2 7 40.6 11 39.8 15.4 C41.8 18.6 43 22.6 43 27.4 C43 37.6 35 45 24 45 Z';
  let foxSeq = 0;
  function foxSvg(kind, label) {
    const f = FOX[kind]; const id = 'fx' + (++foxSeq);
    const extra = {
      commercial: `<path d="M22.4 43.4 C19.6 40.6 16.4 40.2 15.6 42 C15.1 43 15.1 44 15.6 45 C16.4 46.8 19.6 46.2 22.4 43.4 Z M25.6 43.4 C28.4 40.6 31.6 40.2 32.4 42 C32.9 43 32.9 44 32.4 45 C31.6 46.8 28.4 46.2 25.6 43.4 Z" fill="${f.ink}"/><ellipse cx="24" cy="43.4" rx="2.2" ry="2" fill="${f.ink}"/>`,
      crm: `<path d="M8.4 27.4 C8.4 1.6 39.6 1.6 39.6 27.4" fill="none" stroke="${f.ink}" stroke-width="2.6" stroke-linecap="round"/><rect x="5.4" y="23.6" width="5.6" height="9.4" rx="2.6" fill="${f.ink}"/><rect x="37" y="23.6" width="5.6" height="9.4" rx="2.6" fill="${f.ink}"/><path d="M8.2 33 C8.8 38.8 13.4 41.2 18.6 41" fill="none" stroke="${f.ink}" stroke-width="1.8" stroke-linecap="round"/><circle cx="19.6" cy="40.9" r="1.9" fill="${f.ink}"/>`,
      seo: `<circle cx="34.4" cy="33.4" r="5.4" fill="#FFFFFF" fill-opacity="0.4" stroke="${f.ink}" stroke-width="2"/><path d="M38.3 37.3 L42.6 41.6" stroke="${f.ink}" stroke-width="2.8" stroke-linecap="round"/><path d="M24 4.2 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3z" fill="#FFFFFF"/>`,
      engineer: `<path d="M11.2 15.8 C11.6 9.2 16.8 5.6 24 5.6 C31.2 5.6 36.4 9.2 36.8 15.8 Z" fill="#F2B233"/><rect x="22.4" y="5.8" width="3.2" height="10" rx="1.4" fill="#D8921C"/><path d="M8.4 15.4 C14.6 13.6 33.4 13.6 39.6 15.4 C41 15.8 40.8 18 39.4 18 C33 17 15 17 8.6 18 C7.2 18 7 15.8 8.4 15.4 Z" fill="#D8921C"/>`,
      paid: `<path d="M10.4 15.6 C11.6 9.4 17 6 24 6 C31 6 36.4 9.4 37.6 15.6 Z" fill="${f.ink}"/><path d="M15.4 10.6 C17.4 8.6 20.2 7.6 23 7.4" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="1.4" stroke-linecap="round"/><path d="M8.6 15.2 C14.6 13.4 33.4 13.4 39.4 15.2 C40.8 15.6 40.6 17.8 39.2 17.8 C33 16.8 15 16.8 8.8 17.8 C7.4 17.8 7.2 15.6 8.6 15.2 Z" fill="${f.ink}"/>`,
      executive: `<path d="M18.6 38.8 L22.4 40.6 L19.8 42.6 Z M29.4 38.8 L25.6 40.6 L28.2 42.6 Z" fill="#FFFFFF" stroke="#E4D9CF" stroke-width="0.5"/><path d="M21.7 39.4 L26.3 39.4 L25.4 41.8 L22.6 41.8 Z" fill="${f.ink}"/><path d="M22.6 41.8 L25.4 41.8 L26.6 44.6 L24 46.2 L21.4 44.6 Z" fill="${f.ink}"/>`,
      analytics: `<circle cx="16.9" cy="24.6" r="6.8" fill="#FFFFFF" fill-opacity="0.22" stroke="${f.ink}" stroke-width="1.1"/><circle cx="31.1" cy="24.6" r="6.8" fill="#FFFFFF" fill-opacity="0.22" stroke="${f.ink}" stroke-width="1.1"/><path d="M23.5 23.4 C23.8 22.8 24.2 22.8 24.5 23.4" fill="none" stroke="${f.ink}" stroke-width="1.1" stroke-linecap="round"/>`,
    }[kind];
    const shine = kind === 'paid' || kind === 'engineer' ? '' : '<ellipse cx="14.6" cy="13.6" rx="3.2" ry="1.8" transform="rotate(-30 14.6 13.6)" fill="#FFFFFF" fill-opacity="0.18"/>';
    return `<svg class="fox" viewBox="0 0 48 48" ${label ? `role="img" aria-label="${esc(f.name)}"` : 'aria-hidden="true"'}><defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.g[0]}"/><stop offset="1" stop-color="${f.g[1]}"/></linearGradient><clipPath id="${id}c"><path d="${HEAD}"/></clipPath></defs><g class="head">
      <path d="${HEAD}" fill="url(#${id}g)"/><path d="M10.6 7.2 C11 6 12.2 5.8 13.2 6.6 C15 8 16.6 9.8 17.6 11.6 C15.4 12.4 13.4 13.6 11.6 15.2 C10.6 12.6 10.2 9.6 10.6 7.2 Z M37.4 7.2 C37 6 35.8 5.8 34.8 6.6 C33 8 31.4 9.8 30.4 11.6 C32.6 12.4 34.6 13.6 36.4 15.2 C37.4 12.6 37.8 9.6 37.4 7.2 Z" fill="${f.ink}" fill-opacity="0.55"/>${shine}
      <path class="muz" d="M7.4 33 C12 31.6 18 32.6 21.6 36.4 C22.6 37.4 23.3 38 24 38 C24.7 38 25.4 37.4 26.4 36.4 C30 32.6 36 31.6 40.6 33 C38.4 40.2 31.8 45 24 45 C16.2 45 9.6 40.2 7.4 33 Z" fill="#FFF7F0"/>
      <path d="${HEAD}" fill="none" stroke="url(#${id}g)" stroke-width="3.4" clip-path="url(#${id}c)"/>
      ${kind === 'paid' || kind === 'engineer' ? extra : ''}<g class="eyes"><rect class="eye" x="16.4" y="21.4" width="3.6" height="6.4" rx="1.8" fill="#1B1D22"/><rect class="eye" x="28" y="21.4" width="3.6" height="6.4" rx="1.8" fill="#1B1D22"/>${kind === 'analytics' ? extra : ''}</g><ellipse class="nose" cx="24" cy="37.2" rx="2" ry="1.4" fill="#1B1D22"/>${['commercial', 'executive', 'crm', 'seo'].includes(kind) ? extra : ''}</g></svg>`;
  }
