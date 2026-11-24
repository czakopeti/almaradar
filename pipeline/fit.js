// Fair-ár modell illesztése: robusztus ridge regresszió családonként.
'use strict';
const { features, VARIANTS } = require('../src/model.js');

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / d;
      if (k) for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

function median(a) { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; }

function fitFamily(rows, fam, today) {
  const modelIds = [...new Set(rows.map(r => r.modelId))].sort();
  let active = rows.slice();
  let beta, names, sigma = 0.2;
  for (let iter = 0; iter < 4; iter++) {
    const F = active.map(r => features(r, fam, today, modelIds));
    names = Object.keys(F[0]);
    // ritkán előforduló (vagy sosem változó) oszlopok kiszűrése
    names = names.filter(k => k === 'const' || F.some(f => f[k] !== 0));
    const X = F.map(f => names.map(k => f[k]));
    const y = active.map(r => Math.log(r.price));
    const p = names.length;
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const b = new Array(p).fill(0);
    for (let i = 0; i < X.length; i++) {
      const x = X[i];
      for (let a = 0; a < p; a++) {
        if (!x[a]) continue;
        b[a] += x[a] * y[i];
        for (let c = 0; c < p; c++) A[a][c] += x[a] * x[c];
      }
    }
    names.forEach((k, i) => {
      // modell-saját eltérés: erős zsugorítás; életkor²: enyhe; többi: minimális
      const lam = k.startsWith('m_') ? 3.0 : k === 'age2' ? 0.5 : k === 'const' ? 0 : 0.05;
      A[i][i] += lam;
    });
    beta = solve(A, b);
    const res = X.map((x, i) => y[i] - x.reduce((s, v, j) => s + v * beta[j], 0));
    sigma = 1.4826 * median(res.map(Math.abs)) || 0.2;
    const keep = active.filter((_, i) => Math.abs(res[i]) <= 2.5 * sigma);
    if (keep.length === active.length) break;
    active = keep;
  }
  const counts = {};
  for (const r of rows) counts[r.modelId] = (counts[r.modelId] || 0) + 1;
  const CAT = require('../src/catalog.js');
  const ages = rows.map(r => today - CAT.byId[r.modelId].rel);
  return {
    ageMin: +Math.min(...ages).toFixed(2), ageMax: +Math.max(...ages).toFixed(2),
    beta: Object.fromEntries(names.map((k, i) => [k, +beta[i].toFixed(5)])),
    sigma: +sigma.toFixed(4), modelIds, counts, nFit: active.length, nAll: rows.length,
  };
}

module.exports = { fitFamily, median };
