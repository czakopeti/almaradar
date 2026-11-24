// AlmaRadar – adatépítés: nyers hirdetések -> értelmezés -> fair-ár modell -> oldal adatfájljai.
// Futtatás: node pipeline/build.js [--snapshot 2026-11-24]
'use strict';
const fs = require('fs');
const path = require('path');
const CAT = require('../src/catalog.js');
const { parseListing, parsePrice } = require('../src/parse.js');
const { predict, verdict } = require('../src/model.js');
const { fitFamily, median } = require('./fit.js');

const ROOT = path.join(__dirname, '..');
const SNAPS = path.join(ROOT, 'data', 'snapshots');
const OUT = path.join(ROOT, 'site', 'data');
const argSnap = process.argv.indexOf('--snapshot');
// alapból a legfrissebb pillanatkép-mappa
const SNAP = argSnap > 0 ? process.argv[argSnap + 1] : fs.readdirSync(SNAPS).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
const RAW = path.join(SNAPS, SNAP);
const snapDate = new Date(SNAP + 'T12:00:00Z');
const TODAY = snapDate.getUTCFullYear() + (snapDate.getUTCMonth() + snapDate.getUTCDate() / 31) / 12;

function isoDay(offset) { const d = new Date(snapDate); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
function normDate(s) {
  s = (s || '').trim();
  if (/^ma\b/i.test(s) || /n\/?a|–/.test(s) || !s) return SNAP;
  if (/^tegnap/i.test(s)) return isoDay(-1);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : SNAP;
}

// ---- 1. nyers sorok beolvasása (Hardverapró-pillanatképek + gyűjtő JSON-jai) ----
const raw = [];
for (const f of fs.readdirSync(RAW).sort()) {
  const full = path.join(RAW, f);
  if (f.endsWith('.txt')) {
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const parts = line.split(' | ');
      if (parts.length < 4) continue;
      const [title, priceStr, date, slug] = parts;
      const u = slug.trim().startsWith('http') ? slug.trim() : `https://hardverapro.hu/apro/${slug.trim()}/friss.html`;
      raw.push({ title: title.trim(), price: parsePrice(priceStr), frozen: /jegelve/.test(priceStr), date: normDate(date), url: u, src: 'hardverapro', file: f });
    }
  } else if (f.endsWith('.json')) {
    for (const r of JSON.parse(fs.readFileSync(full, 'utf8'))) raw.push(Object.assign({ src: 'hardverapro', file: f }, r, { date: normDate(r.date) }));
  }
}

// ---- 2. értelmezés, szűrés, duplikátumok ----
const seen = new Set();
const listings = [];
const skipped = { noModel: 0, accessory: 0, multi: 0, price: 0, dup: 0, defect: 0 };
for (const r of raw) {
  const key = r.title.toLowerCase() + '|' + r.price;
  if (seen.has(key)) { skipped.dup++; continue; }
  seen.add(key);
  const p = parseListing(r.title, { today: TODAY });
  if (p.accessory) { skipped.accessory++; continue; }
  if (p.multi) { skipped.multi++; continue; }
  if (!p.modelId || !CAT.byId[p.modelId]) { skipped.noModel++; continue; }
  if (!r.price || r.price < 8000 || r.price > 4000000) { skipped.price++; continue; }
  listings.push(Object.assign(p, { price: r.price, frozen: !!r.frozen, date: r.date, url: r.url, src: r.src }));
}

// ---- 3. illesztés családonként ----
const coef = { today: +TODAY.toFixed(3), snapshot: SNAP };
for (const fam of ['iphone', 'ipad', 'mac']) {
  const rows = listings.filter(l => l.family === fam && !l.defect && !l.bundle);
  if (rows.length < 15) continue;
  coef[fam] = fitFamily(rows, fam, TODAY);
}

// ---- 4. pontozás ----
for (const l of listings) {
  const pr = predict(coef, l);
  if (!pr) continue;
  l.fair = Math.round(pr.fair / 100) * 100;
  l.dev = +(l.price / pr.fair - 1).toFixed(3);
  l.verdict = l.defect ? 'defect' : verdict(l.dev).key;
}

// ---- 5. modell-összesítők ----
function ref(modelId, storage, extra = {}) {
  const m = CAT.byId[modelId];
  const p = Object.assign({ modelId, family: m.family, storage: storage || m.base, dealer: false, isNew: false, battery: 90, grade: 'B', cellular: false, ram: m.ram, size: m.size, tier: '' }, extra);
  return predict(coef, p);
}
const models = {};
for (const m of CAT.models) {
  const ls = listings.filter(l => l.modelId === m.id);
  const s = { n: ls.length };
  if (coef[m.family]) {
    const r = ref(m.id);
    if (r && r.reliable) Object.assign(s, { fair: Math.round(r.fair / 100) * 100, low: Math.round(r.low / 100) * 100, high: Math.round(r.high / 100) * 100, seen: r.seen });
    const dealer = ref(m.id, null, { dealer: true, warrantyMonths: 12, grade: 'A', battery: 100 });
    if (dealer && r && r.reliable) s.fairDealer = Math.round(dealer.fair / 100) * 100;
    const stor = [...new Set([m.base, ...ls.map(l => l.storage).filter(Boolean)])].filter(x => m.family !== 'mac' || x >= 256).sort((a, b) => a - b).slice(0, 5);
    if (r && r.reliable) s.byStorage = Object.fromEntries(stor.map(st => [st, Math.round(ref(m.id, st).fair / 100) * 100]));
  }
  if (ls.length) {
    s.median = median(ls.filter(l => !l.defect).map(l => l.price));
    s.min = Math.min(...ls.map(l => l.price));
  }
  models[m.id] = s;
}

// ---- 6. piaci összefüggések az együtthatókból ----
const pct = x => +((Math.exp(x) - 1) * 100).toFixed(1);
const insights = {};
for (const fam of ['iphone', 'ipad', 'mac']) {
  const c = coef[fam]; if (!c) continue;
  const b = c.beta;
  insights[fam] = {
    dealer: pct(b.dealer || 0), isNew: pct(b.isNew || 0), batt10: pct(b.batt || 0),
    storageDouble: pct(b.storage || 0), gradeA: pct(b.gradeA || 0),
    perYear: pct((b.age || 0) + 2 * (b.age2 || 0) * 2), // 2 évesnél mért éves csökkenés
    n: c.nAll, nFit: c.nFit, sigma: c.sigma,
  };
}

const counts = { raw: raw.length, usable: listings.length, skipped, byFamily: {} };
for (const l of listings) counts.byFamily[l.family] = (counts.byFamily[l.family] || 0) + 1;

// ---- 7. kiírás ----
fs.mkdirSync(OUT, { recursive: true });
const compact = listings.map((l, i) => ({
  i, t: l.title, p: l.price, d: l.date, u: l.url, m: l.modelId, f: l.family, s: l.storage, r: l.ram, z: l.size, tr: l.tier,
  b: l.battery, bf: l.batteryFresh || undefined, n: l.isNew || undefined, dl: l.dealer || undefined, w: l.warrantyMonths, g: l.grade,
  df: l.defect || undefined, bu: l.bundle || undefined, c: l.cellular || undefined, fz: l.frozen || undefined, fair: l.fair, dev: l.dev, v: l.verdict,
}));
fs.writeFileSync(path.join(OUT, 'listings.json'), '[\n' + compact.map(x => JSON.stringify(x)).join(',\n') + '\n]\n');
fs.writeFileSync(path.join(OUT, 'market.json'), JSON.stringify({ snapshot: SNAP, coef, models, insights, counts, sources: CAT.PRICE_SOURCES }, null, 1));
// napi idősor modellenként (későbbi ártrend-grafikonokhoz)
const histFile = path.join(OUT, 'history.json');
let hist = {}; try { hist = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch (e) {}
hist[SNAP] = Object.fromEntries(Object.entries(models).filter(([, v]) => v.fair && v.n).map(([k, v]) => [k, { fair: v.fair, n: v.n, median: v.median }]));
fs.writeFileSync(histFile, JSON.stringify(hist));
console.log(JSON.stringify(counts));
for (const fam of ['iphone', 'ipad', 'mac']) if (coef[fam]) console.log(fam, 'sigma', coef[fam].sigma, 'nFit', coef[fam].nFit, '/', coef[fam].nAll, JSON.stringify(insights[fam]));
