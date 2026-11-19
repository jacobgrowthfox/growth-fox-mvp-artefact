/* ===== GrowthFox MVP: sample data + rule engine (no AI; every number comes from code) ===== */
  const DAY = 864e5;
  const END = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - DAY; })(); // last complete day

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const WEEKDAY = [0.86, 1.05, 1.06, 1.02, 1.0, 0.96, 0.88]; // Sun..Sat
