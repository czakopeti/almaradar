/* AlmaRadar – „fair ár” modell.
 * Log-lineáris modell családonként (iPhone, iPad, Mac):
 *   ln(ár) = életkor + változat (Pro, Max, mini…) + modell-saját eltérés (zsugorítva)
 *          + tárhely + memória + képernyő + kereskedő/garancia + új/bontatlan + akku + állapot
 * A modell-saját eltérést ridge-büntetés húzza a közös görbe felé, így kevés hirdetésből
 * is értelmes becslés jön, és a sosem látott modellekre is ad árat.
 * Itt csak a sorépítés és a becslés van; az illesztés a pipeline/fit.js-ben. */
(function (root) {
  'use strict';
  const CAT = (typeof module !== 'undefined' && module.exports) ? require('./catalog.js') : root.ALMA_CATALOG;

  const VARIANTS = {
    iphone: ['mini', 'plus', 'pro', 'promax', 'e', 'air', 'duo'],
    ipad: ['air', 'mini', 'pro'],
    mac: ['pro', 'neo', 'intel'],
  };

  // Jellemzők neve és értéke egy hirdetéshez. `modelIds` a családban illesztett modellek listája.
  function features(p, fam, today, modelIds) {
    const m = CAT.byId[p.modelId];
    const f = {};
    f.const = 1;
    const age = Math.max(0, today - m.rel);
    f.age = age;
    f.age2 = age * age;
    for (const v of VARIANTS[fam]) f['v_' + v] = m.variant === v ? 1 : 0;
    const storage = p.storage || m.base;
    f.storage = Math.log2(storage / m.base);
    f.dealer = p.dealer ? 1 : 0;
    f.isNew = p.isNew ? 1 : 0;
    f.battKnown = (fam === 'iphone' && p.battery != null && !p.isNew) ? 1 : 0;
    f.batt = f.battKnown ? (p.battery - 90) / 10 : 0;
    f.gradeA = p.grade === 'A' ? 1 : 0;
    if (fam === 'ipad') f.cellular = p.cellular ? 1 : 0;
    if (fam === 'mac') {
      const ram = p.ram || m.ram;
      f.ram = Math.log2(ram / 8);
      f.big = (p.size === 15 || p.size === 16) ? 1 : 0;
      f.tierPro = p.tier === 'pro' ? 1 : 0;
      f.tierMax = p.tier === 'max' ? 1 : 0;
    }
    for (const id of modelIds) f['m_' + id] = p.modelId === id ? 1 : 0;
    return f;
  }

  function predict(coef, p) {
    const fam = p.family;
    const c = coef && coef[fam];
    if (!c || !CAT.byId[p.modelId]) return null;
    const f = features(p, fam, coef.today, c.modelIds);
    let s = 0;
    for (const k in c.beta) s += (f[k] || 0) * c.beta[k];
    const fair = Math.exp(s);
    const m = CAT.byId[p.modelId];
    const ref = { iphone: 'base', ipad: 'base', mac: 'air' }[fam];
    const variantKnown = m.variant === ref || ('v_' + m.variant) in c.beta;
    const seen = c.modelIds.includes(p.modelId);
    return {
      reliable: seen || (variantKnown && (coef.today - m.rel) >= (c.ageMin || 0) - 0.15 && (coef.today - m.rel) <= (c.ageMax || 99) + 0.3),
      fair,
      low: fair * Math.exp(-0.674 * c.sigma),
      high: fair * Math.exp(0.674 * c.sigma),
      sigma: c.sigma,
      seen,
      n: (c.counts && c.counts[p.modelId]) || 0,
    };
  }

  // Ár / fair ár eltérés -> ítélet
  function verdict(dev) {
    if (dev <= -0.3) return { key: 'suspicious', label: 'Gyanúsan olcsó' };
    if (dev <= -0.1) return { key: 'good', label: 'Jó vétel' };
    if (dev < 0.1) return { key: 'fair', label: 'Korrekt ár' };
    return { key: 'pricey', label: 'Drága' };
  }

  const api = { features, predict, verdict, VARIANTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ALMA_MODEL = api;
})(typeof window !== 'undefined' ? window : globalThis);
