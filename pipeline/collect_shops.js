// AlmaRadar – napi bolti árgyűjtő (új és felújított Apple-termékek).
// Három adapter, a legtartósabbtól a legtörékenyebbig:
//   shopify     – a bolt nyilvános /products.json végpontja (pl. iStyle)
//   woocommerce – a WooCommerce Store API (pl. iBerry)
//   generic     – kategóriaoldal: először schema.org JSON-LD, ha nincs, link + ár a környezetből
// Az Apple saját árait a src/catalog.js tartalmazza (ritkán változnak), azokat a build.js teszi hozzá.
// Futtatás: node pipeline/collect_shops.js   (Node 20+, külső csomag nélkül)
'use strict';
const { scrub } = require('../src/parse.js');
const fs = require('fs');
const path = require('path');

const UA = 'AlmaRadar/0.2 (+https://github.com/czakopeti/almaradar; arosszehasonlito, napi 1 futas)';
const APPLE_RE = /\b(iphone|ipad|macbook)\b/i;
const NOT_DEVICE_RE = /\b(tok|case|fólia|folia|üvegfólia|kábel|cable|töltő|charger|adapter|pencil|toll|keyboard|billentyűzet|smart folio|cover|szíj|pánt|band|magsafe|airtag|matrica|védő)\b/i;

const SHOPS = [
  { shop: 'iStyle', kind: 'new', type: 'shopify', base: 'https://istyle.hu' },
  { shop: 'iBerry', kind: 'refurb', type: 'woocommerce', base: 'https://iberry.hu', search: ['iphone', 'ipad', 'macbook'], warrantyMonths: 24 },
  // Az Alza (403) és az eMAG (511) letiltja az automatikus lekérést: ezt tiszteletben tartjuk,
  // náluk a partnerprogram termékfeedje lesz a megoldás. A MediaMarkt-címeket pontosítani kell.
  { shop: 'Alza', kind: 'new', type: 'generic', disabled: 'a bolt letiltja (403), partnerfeed kell', urls: [
    'https://www.alza.hu/iphone/18851638.htm', 'https://www.alza.hu/apple-ipad/18851916.htm',
    'https://www.alza.hu/macbook-air/18900519.htm', 'https://www.alza.hu/macbook-pro/18900520.htm'] },
  { shop: 'iCentre', kind: 'new', type: 'woocommerce', base: 'https://icentre.hu', search: ['iphone', 'ipad', 'macbook'], fallback: 'generic', urls: [
    'https://icentre.hu/kategoria/iphone', 'https://icentre.hu/kategoria/ipad', 'https://icentre.hu/kategoria/mac'] },
  { shop: 'eMAG', kind: 'new', type: 'generic', disabled: 'a bolt letiltja (511), partnerfeed kell', urls: [
    'https://www.emag.hu/mobiltelefonok/brand/apple/c', 'https://www.emag.hu/tablet-pc/brand/apple/c', 'https://www.emag.hu/laptopok/brand/apple/c'] },
  { shop: 'MediaMarkt', kind: 'new', type: 'generic', disabled: 'a kategória-címek 404-et adnak, pontosítani kell', urls: [
    'https://www.mediamarkt.hu/hu/brand/apple/iphone', 'https://www.mediamarkt.hu/hu/brand/apple/ipad', 'https://www.mediamarkt.hu/hu/brand/apple/mac'] },
  { shop: 'Rejoy', kind: 'refurb', type: 'generic', warrantyMonths: 24, urls: [
    'https://rejoy.hu/telefon/apple/', 'https://rejoy.hu/telefon/apple/iphone-15/', 'https://rejoy.hu/telefon/apple/iphone-16/', 'https://rejoy.hu/telefon/apple/iphone-17/'] },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const strip = s => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const num = v => { const n = +String(v).replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? Math.round(n) : null; };

async function get(url, json) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'hu-HU,hu;q=0.9', Accept: json ? 'application/json' : 'text/html' } });
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return json ? res.json() : res.text();
}

function keep(o) {
  return o.title && o.price && APPLE_RE.test(o.title) && !NOT_DEVICE_RE.test(o.title) && o.price >= 20000 && o.price <= 5000000;
}

// ---- Shopify: /products.json?limit=250&page=N ----
async function shopify(cfg) {
  const out = [];
  for (let page = 1; page <= 8; page++) {
    const data = await get(`${cfg.base}/products.json?limit=250&page=${page}`, true);
    if (!data.products || !data.products.length) break;
    for (const p of data.products) {
      for (const v of p.variants || []) {
        const title = `${p.title} ${v.title && v.title !== 'Default Title' ? v.title : ''}`.trim();
        out.push({ title, price: num(v.price), oldPrice: num(v.compare_at_price) || undefined, sku: v.sku || undefined,
          url: `${cfg.base}/products/${p.handle}${v.id ? '?variant=' + v.id : ''}`, stock: v.available === false ? 'elfogyott' : undefined });
      }
    }
    await sleep(2500);
  }
  return out;
}

// ---- WooCommerce Store API ----
async function woocommerce(cfg) {
  const out = [];
  for (const q of cfg.search) {
    for (let page = 1; page <= 5; page++) {
      const data = await get(`${cfg.base}/wp-json/wc/store/v1/products?per_page=100&page=${page}&search=${encodeURIComponent(q)}`, true);
      if (!Array.isArray(data) || !data.length) break;
      for (const p of data) {
        const minor = (p.prices && p.prices.currency_minor_unit) || 0;
        const price = p.prices ? Math.round(+p.prices.price / 10 ** minor) : null;
        const reg = p.prices ? Math.round(+p.prices.regular_price / 10 ** minor) : null;
        out.push({ title: strip(p.name), price, oldPrice: reg && reg > price ? reg : undefined, url: p.permalink,
          stock: p.is_in_stock === false ? 'elfogyott' : undefined, from: !!(p.type === 'variable') || undefined });
      }
      await sleep(2500);
    }
  }
  return out;
}

// ---- Általános: JSON-LD, utána link + ár heurisztika ----
function fromJsonLd(html, baseUrl) {
  const out = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    const t = [].concat(n['@type'] || []);
    if (t.includes('Product') && n.name) {
      const offers = [].concat(n.offers || []);
      for (const o of offers) {
        const price = num(o.price || o.lowPrice);
        if (price) out.push({ title: strip(n.name), price, url: o.url || n.url || baseUrl, sku: n.mpn || n.sku || undefined,
          stock: /OutOfStock/i.test(o.availability || '') ? 'elfogyott' : undefined, from: o.lowPrice ? true : undefined });
      }
    }
    for (const k of ['itemListElement', 'item', '@graph', 'mainEntity']) if (n[k]) visit(n[k]);
  };
  while ((m = re.exec(html))) { try { visit(JSON.parse(m[1].trim())); } catch (e) { /* hibás JSON-LD */ } }
  return out;
}
function fromLinks(html, baseUrl) {
  const out = []; const origin = new URL(baseUrl).origin; const seen = new Set();
  const re = /<a[^>]+href="([^"#]+)"[^>]*>([\s\S]{3,400}?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const title = strip(m[2]);
    if (!APPLE_RE.test(title) || title.length > 160) continue;
    const url = m[1].startsWith('http') ? m[1] : origin + (m[1].startsWith('/') ? '' : '/') + m[1];
    if (seen.has(url)) continue;
    const block = strip(html.slice(m.index, m.index + 2500));
    const prices = [...block.matchAll(/(\d{1,3}(?:[ .  ]\d{3})+)\s*(Ft|HUF)/g)].map(x => num(x[1])).filter(Boolean);
    if (!prices.length) continue;
    seen.add(url);
    const price = Math.min(...prices.slice(0, 2)); const old = Math.max(...prices.slice(0, 2));
    out.push({ title, price, oldPrice: old > price ? old : undefined, url });
  }
  return out;
}
const DEBUG = process.env.DEBUG_HTML || null;
function debugSave(name, body) {
  if (!DEBUG) return;
  fs.mkdirSync(DEBUG, { recursive: true });
  fs.writeFileSync(path.join(DEBUG, name.replace(/[^a-z0-9]+/gi, '_').slice(0, 90) + '.html'), body);
}
async function generic(cfg) {
  const out = [];
  for (const u of cfg.urls) {
    try {
      const html = await get(u);
      debugSave(cfg.shop + '_' + u, html);
      let rows = fromJsonLd(html, u).filter(keep);
      if (rows.length < 3) rows = fromLinks(html, u);
      console.log('   ', rows.length.toString().padStart(3), u);
      out.push(...rows);
    } catch (e) { console.warn('    hiba:', e.message); }
    await sleep(5000 + Math.random() * 3000);
  }
  return out;
}

if (require.main === module) {
  (async () => {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(__dirname, '..', 'data', 'snapshots', day);
    fs.mkdirSync(dir, { recursive: true });
    const all = [];
    for (const cfg of SHOPS) {
      if (cfg.disabled) { console.log(cfg.shop.padEnd(11), 'kihagyva:', cfg.disabled); continue; }
      try {
        const fn = { shopify, woocommerce, generic }[cfg.type];
        let got = [];
        try { got = await fn(cfg); } catch (e) { console.warn('   ', cfg.shop, cfg.type, 'hiba:', e.message); }
        if (!got.filter(keep).length && cfg.fallback) got = await ({ shopify, woocommerce, generic }[cfg.fallback])(cfg);
        const rows = got.filter(keep).map(r => Object.assign({ shop: cfg.shop, kind: cfg.kind }, cfg.warrantyMonths ? { warrantyMonths: cfg.warrantyMonths } : {}, r));
        const uniq = [...new Map(rows.map(r => [r.url + '|' + r.title, r])).values()];
        console.log(cfg.shop.padEnd(11), uniq.length, 'ajánlat');
        all.push(...uniq);
      } catch (e) { console.warn(cfg.shop, 'hiba:', e.message); }
    }
    fs.writeFileSync(path.join(dir, 'shops.json'), JSON.stringify(all, null, 0).replace(/},{/g, '},\n{'));
    console.log(`${all.length} bolti ajánlat -> data/snapshots/${day}/shops.json`);
    // ha egy bolt sem adott semmit, ne írjuk felül a jó adatot üressel
    if (all.length < 20) { console.error('Túl kevés bolti ajánlat.'); process.exit(1); }
  })();
}

module.exports = { fromJsonLd, fromLinks, keep };
