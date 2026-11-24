// AlmaRadar – napi gyűjtő a Hardverapró nyilvános Apple-rovataiból.
// Csak címet, árat, dátumot és linket ment. Eladói nevet, telefonszámot, képet nem.
// Udvarias: robots.txt-t ellenőriz, kérések között 6–9 mp szünet, oldalanként max. 2 lap.
// Futtatás: node pipeline/collect.js   (Node 20+, külső csomag nélkül)
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = 'https://hardverapro.hu';
const CATEGORIES = [
  '/aprok/mobil/mobil/iphone/iphone_12_2/index.html',
  '/aprok/mobil/mobil/iphone/iphone_13_2/index.html',
  '/aprok/mobil/mobil/iphone/iphone_14_2/index.html',
  '/aprok/mobil/mobil/iphone/iphone_15_2/index.html',
  '/aprok/mobil/mobil/iphone/iphone_16/index.html',
  '/aprok/mobil/mobil/iphone/iphone_17/index.html',
  '/aprok/mobil/tablet/apple_tablet/ipad/index.html',
  '/aprok/mobil/tablet/apple_tablet/ipad_air/index.html',
  '/aprok/notebook/apple/macbook_air/index.html',
  '/aprok/notebook/apple/macbook_pro/index.html',
  '/aprok/hazimozi_hifi/fejhallgato_fulhallgato/fulhallgato/vezeteknelkuli/apple_airpods/index.html',
];
const PAGES_PER_CATEGORY = 2;
const UA = 'AlmaRadar/0.1 (+https://github.com/czakopeti/almaradar; arfigyelo, napi 1 futas)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const strip = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'hu-HU,hu;q=0.9' } });
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.text();
}

async function allowed(paths) {
  try {
    const txt = await get(BASE + '/robots.txt');
    let applies = false; const dis = [];
    for (const line of txt.split('\n')) {
      const [k, ...v] = line.split(':'); const val = v.join(':').trim();
      if (/^user-agent$/i.test(k.trim())) applies = val === '*' || /almaradar/i.test(val);
      else if (applies && /^disallow$/i.test(k.trim()) && val) dis.push(val);
    }
    return paths.filter(p => !dis.some(d => p.startsWith(d)));
  } catch (e) { console.warn('robots.txt nem olvasható, óvatosan folytatjuk:', e.message); return paths; }
}

// Szerkezet-független kinyerés: minden hirdetéslinkhez a környező blokkból ár, dátum, jegelés.
function extract(html) {
  const out = [];
  const re = /<a[^>]+href="((?:https:\/\/hardverapro\.hu)?\/apro\/[^"]+\/(?:friss|hsz_1-50)\.html)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m; const seen = new Set();
  while ((m = re.exec(html))) {
    const url = (m[1].startsWith('http') ? '' : BASE) + m[1];
    const title = strip(m[2]);
    if (!title || title.length < 6 || seen.has(url)) continue;
    // a link utáni ~1500 karakter a hirdetés sora
    const block = html.slice(m.index, m.index + 1500);
    const text = strip(block);
    const pm = text.match(/(\d{1,3}(?:[ .]\d{3})+|\d{4,7})\s*Ft/);
    if (!pm) continue;
    seen.add(url);
    const dm = text.match(/\b(ma|tegnap)\s+\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}/);
    out.push({ title, price: +pm[1].replace(/[ .]/g, ''), date: dm ? dm[0] : '', frozen: /jegelve/i.test(text.slice(0, 300)), url });
  }
  return out.filter(x => !/^keres|^vennék|^veszek/i.test(x.title));
}

(async () => {
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', 'data', 'snapshots', day);
  fs.mkdirSync(dir, { recursive: true });
  const cats = await allowed(CATEGORIES);
  const all = [];
  for (const c of cats) {
    for (let page = 0; page < PAGES_PER_CATEGORY; page++) {
      const url = BASE + c + (page ? `?offset=${page * 100}` : '');
      try {
        const rows = extract(await get(url));
        console.log(rows.length.toString().padStart(4), url);
        all.push(...rows);
        if (rows.length < 20) break;
      } catch (e) { console.warn('hiba:', e.message); break; }
      await sleep(6000 + Math.random() * 3000);
    }
  }
  const uniq = [...new Map(all.map(r => [r.url, r])).values()];
  fs.writeFileSync(path.join(dir, 'hardverapro.json'), JSON.stringify(uniq, null, 0).replace(/},{/g, '},\n{'));
  console.log(`${uniq.length} hirdetés -> data/snapshots/${day}/hardverapro.json`);
  if (uniq.length < 50) { console.error('Túl kevés hirdetés, valószínűleg megváltozott az oldal szerkezete.'); process.exit(1); }
})();
