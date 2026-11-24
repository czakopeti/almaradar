/* AlmaRadar – hirdetéscím-értelmező.
 * Egy szabad szöveges hirdetéscímből (Hardverapró, Jófogás, Facebook…)
 * kiszedi a modellt, tárhelyet, akkut, állapotot, garanciát és az eladó típusát.
 * Ugyanez a fájl fut a napi gyűjtőben (Node) és az oldal ár-ellenőrzőjében (böngésző). */
(function (root) {
  'use strict';

  function norm(s) {
    return (' ' + String(s || '') + ' ')
      .toLowerCase()
      .replace(/[“”″]/g, '"')
      .replace(/(\d)(?=[a-z])/g, '$1 ')          // 15pro -> 15 pro, 256gb marad (lent kezeljük)
      .replace(/([a-z])(?=\d)/g, '$1 ')          // iphone15 -> iphone 15
      .replace(/\bpro\s*max\b/g, 'pro max')
      .replace(/\bpromax\b/g, 'pro max')
      .replace(/\bpus\b/g, 'plus')
      .replace(/\s+/g, ' ');
  }

  // ---- tárhely / memória ----
  function sizes(t) {
    // "256 gb", "1 tb", "1tb", "8/256", "16 gb/512 gb"
    const out = [];
    const re = /(\d{1,4})\s*(tb|gb|g|gn)\b/g;
    let m;
    while ((m = re.exec(t))) {
      let v = +m[1];
      if (m[2] === 'tb') v *= 1024;
      out.push({ v, i: m.index, ram: /^\s*(ram|memória|memoria|ram\b)/.test(t.slice(re.lastIndex, re.lastIndex + 9)) });
    }
    const slash = /\b(\d{1,3})\s*(?:gb)?\s*\/\s*(\d{2,4}|1|2)\s*(tb|gb)?\b/g;
    while ((m = slash.exec(t))) {
      const a = +m[1]; let b = +m[2];
      if (m[3] === 'tb' || b <= 4) b *= 1024;
      if ([8, 16, 18, 24, 32, 36, 48, 64, 96, 128].includes(a) && b >= 128) {
        out.push({ v: a, i: m.index, ram: true }, { v: b, i: m.index + 1, ram: false });
      }
    }
    return out;
  }
  const STORAGES = [16, 32, 64, 128, 256, 512, 1024, 2048];
  function pickStorage(t) {
    const s = sizes(t).filter(x => !x.ram && STORAGES.includes(x.v));
    if (!s.length) return null;
    return s[0].v;
  }
  function pickMacMem(t) {
    const s = sizes(t);
    const ramCand = s.filter(x => x.ram || [8, 16, 18, 24, 32, 36, 48, 64, 96].includes(x.v));
    const ssdCand = s.filter(x => !x.ram && x.v >= 256);
    const ssd = ssdCand.length ? Math.max(...ssdCand.map(x => x.v)) : null;
    let ram = null;
    const explicit = s.find(x => x.ram);
    if (explicit) ram = explicit.v;
    else {
      const r = ramCand.filter(x => x.v !== ssd && x.v < 256);
      if (r.length) ram = r[0].v;
    }
    return { ram, ssd };
  }

  // ---- akku ----
  function battery(t) {
    if (/(^|[^a-záéíóöőúüű])(új|uj)\s*(gyári\s*|eredeti\s*|apple\s*|100\s*%?(-os)?\s*)?(akku|akksi|aksi|aku|akkumulátor)/.test(t) ||
        /(akku|akksi|aksi)\s*csere/.test(t)) return { pct: 100, fresh: true };
    const m = t.match(/(\d{2,3})\s*%/);
    if (m) {
      const v = +m[1];
      if (v >= 60 && v <= 100) return { pct: v, fresh: false };
    }
    const m2 = t.match(/(akku|akksi|aksi|akkumulátor)[^0-9]{0,6}(\d{2,3})\b/);
    if (m2 && +m2[2] >= 60 && +m2[2] <= 100) return { pct: +m2[2], fresh: false };
    return { pct: null, fresh: false };
  }

  // ---- garancia (hónap) ----
  function warranty(t, today) {
    let m = t.match(/(20[2-3]\d)\s*[.\-\/]\s*(\d{1,2})(?:\s*[.\-\/]\s*(\d{1,2}))?/) || t.match(/(20[2-3]\d)\s*()()(-?ig|hó)/);
    if (m && /gar|apple|jótáll|jotall|applecare/.test(t)) {
      const y = +m[1], mo = m[2] ? +m[2] : 6;
      const months = Math.round((y + (mo - 1) / 12 - today) * 12);
      if (months > 0 && months < 60) return months;
    }
    m = t.match(/(\d{1,2})\s*(hó|hónap|honap|hónapos)\s*(apple\s*)?(garancia|garanciával|gar|gari|jótáll)/);
    if (m) return +m[1];
    m = t.match(/(\d)\s*(év|éves|ev)\s*(apple\s*|nemzetközi\s*|hivatalos\s*)?(garancia|garanciával|garanciás|gari|jótáll)/);
    if (m) return +m[1] * 12;
    if (/garancia|garanciával|garanciás|garanciális|gari\b|jótállás/.test(t)) return 6;
    return null;
  }

  function isNewItem(t) {
    if (/bontatlan|aktiválatlan|aktivalatlan|0 perces/.test(t)) return true;
    if (/ciklus|használt|hasznalt|\d{2}\s*%|akku\s*\d|cserélt|cserelt|kipróbált/.test(t) && !/0\s*ciklus|bontatlan/.test(t)) return false;
    if (/\bbontatlan|aktiválatlan|0 perces|vadonatúj|vadonatuj|\bújonnan\b/.test(t)) return true;
    if (/(^|\s)(új|uj)[\s,!-]+(apple|iphone|ipad|macbook|bontatlan|garanciális)/.test(t) &&
        !/(új|uj)\s*(akku|akksi|aksi|aku|kijelző|tok|fólia|folia|ház)/.test(t)) return true;
    return false;
  }

  function grade(t) {
    if (/karcos|átlagos|atlagos|erősen használt|erosen hasznalt|\bd,\s|"b"|\bb\b,? használt|sérült/.test(t)) return 'C';
    if (/újszerű|ujszeru|karcmentes|hibátlan|hibatlan|makulátlan|mint az új|mint egy új|szinte új|új állapot|uj allapot|a\+|kvázi új|gyakorlatilag új/.test(t)) return 'A';
    if (/kiváló|gyönyörű|gyonyoru|szép|szep|megkímélt|megkimelt|nagyon jó|"a"|\ba\b"? használt/.test(t)) return 'B';
    return null;
  }

  function defect(t) {
    return /hibás|hibas|face\s*id\s*nincs|fece\s*id|alkatrész|alkatresz|háttérvilágítás|kijelzőhibás|repedt|törött|one\s*függő|one\s*fuggo|hálózatfüggő|halozatfuggo|icloud\s*zár|zárolt|nem kapcsol|vízkár/.test(t);
  }

  function isDealer(raw, t) {
    return /\(újszerű\)|\(kiváló\)|\(nagyon jó\)|\(jó\)|részletfizetés|&k\d+|\(flp|\(ffk|\(beszl|\(gd\d|macszerez|iking\.hu|üzletből|uzletbol|27\s*%\s*(áfa|áfá)|áfás|áfá-s|áfával|számla\s*\+\s*garancia|1 év garanciával|1[2-9] hónap garanci|1[2-9] hó garanci|\d\s*év garanci|\d{4}\s*(ibrány|budapest)|beszámítás|0\d{3}ab\b|0\d{3}ar\b|\(\d{3}\),/.test(t) ||
      /^ÚJ Apple /.test(String(raw || ''));
  }

  function accessory(t) {
    return /^\s*(magyar kiosztású )?billentyűzet|^\s*(tok|toll|pencil|töltő|kábel)\b|applecare\+? biztosítás|telefonszerviz|javítás a-z/.test(t);
  }

  // ---- modell ----
  function iphoneModel(t) {
    if (/iphone\s*duo\b/.test(t)) return 'iphone-duo';
    if (/iphone\s*(17\s*)?air\b/.test(t)) return 'iphone-air';
    const m = t.match(/iphone\s*(1[2-8])\s*(e\b|mini|plus|pro max|pro)?/);
    if (!m) return null;
    const gen = m[1]; const v = (m[2] || '').trim();
    const suffix = { '': '', e: 'e', mini: '-mini', plus: '-plus', pro: '-pro', 'pro max': '-pro-max' }[v];
    const id = 'iphone-' + gen + (suffix === 'e' ? 'e' : suffix);
    return id;
  }

  function ipadModel(t) {
    if (!/ipad/.test(t)) return null;
    if (/ipad\s*air/.test(t)) {
      if (/\bm\s*4\b/.test(t)) return 'ipad-air-m4';
      if (/\bm\s*3\b/.test(t)) return 'ipad-air-m3';
      if (/\bm\s*2\b|air\s*6\b|2024/.test(t)) return 'ipad-air-m2';
      if (/\bm\s*1\b|air\s*5\b/.test(t)) return 'ipad-air-m1';
      return null;
    }
    if (/ipad\s*mini/.test(t)) {
      if (/oled|2026|mini\s*8/.test(t)) return 'ipad-mini-oled';
      if (/a\s*17|2024|mini\s*7/.test(t)) return 'ipad-mini-a17';
      return null;
    }
    if (/ipad\s*pro/.test(t)) {
      if (/\bm\s*5\b/.test(t)) return 'ipad-pro-m5';
      if (/\bm\s*4\b/.test(t)) return 'ipad-pro-m4';
      return null;
    }
    if (/\ba\s*16\b|11\s*(th|\.)?\s*gen|11\s*\.?\s*generáció|ipad\s*11\b|ipad\s*\(?2025|11"\s*\(?2025/.test(t)) return 'ipad-a16';
    if (/10[,.]2/.test(t)) {
      if (/2021|9\s*(th|\.)/.test(t)) return 'ipad-9';
      if (/2020|8\s*(th|\.)/.test(t)) return 'ipad-8';
      if (/2019|7\s*(th|\.)/.test(t)) return 'ipad-7';
    }
    if (/10[,.]9|ipad\s*10\b|10\s*(th|\.)?\s*gen/.test(t)) return 'ipad-10';
    const g = t.match(/ipad\s*(\d{1,2})\s*(th|\.)?\s*(gen|generáció|generation)?|(\d{1,2})\s*(th|\.)\s*(gen|generáció)/);
    const n = g ? +(g[1] || g[4]) : null;
    if (n === 9) return 'ipad-9';
    if (n === 8) return 'ipad-8';
    if (n === 7) return 'ipad-7';
    if (n === 6) return 'ipad-6';
    return null;
  }

  function macModel(t) {
    if (!/macbook|mac\s*book/.test(t)) return null;
    const air = /air/.test(t) && !/pro\s*air/.test(t);
    const neo = /\bneo\b/.test(t);
    if (neo) return { id: 'macbook-neo', tier: '' };
    const chip = t.match(/\bm\s*([1-6])\b\s*(pro|max|ultra)?/);
    if (!chip) {
      if (/\bi[3579]\b|intel|201[5-9]|a1466|a1708|a1989|a2159|a2251|a1278|retina|touch\s*bar|11\.4|8\.3/.test(t)) return { id: 'mac-intel', tier: '' };
      return null;
    }
    const n = +chip[1]; const tier = chip[2] || '';
    if (air) return n <= 5 ? { id: 'mba-m' + n, tier: '' } : null;
    if (n <= 5) return { id: 'mbp-m' + n, tier };
    return null;
  }

  function screen(t, fam) {
    const m = t.match(/\b(13|14|15|16)\s*([.,]\s*\d)?\s*("|''|'|inch|hüvelyk|col)?/);
    if (!m) return null;
    return +m[1];
  }

  function parseListing(raw, opts = {}) {
    const today = opts.today || 2026.9;
    const t = norm(raw);
    const r = {
      title: String(raw || '').trim(), modelId: null, family: null,
      storage: null, ram: null, size: null, tier: '',
      battery: null, batteryFresh: false, isNew: false, dealer: false,
      warrantyMonths: null, grade: null, defect: false, cellular: false,
      accessory: false, multi: false, bundle: false,
    };
    r.accessory = accessory(t);
    r.bundle = /\+\s*(apple\s*)?(pencil|ceruza|smart\s*keyboard|magic\s*keyboard|billentyűzet)|ceruzával|tollal|keyboard\s*\(|smart keyboard/.test(t);
    r.multi = /összes\s*(szín|tárhely)|minden\s*szín|\d+\s*-\s*\d+\s*gb|128\/256\/512|2 db/.test(t);
    let id = iphoneModel(t);
    if (id) { r.modelId = id; r.family = 'iphone'; r.storage = pickStorage(t); }
    if (!id) { id = ipadModel(t); if (id) { r.modelId = id; r.family = 'ipad'; r.storage = pickStorage(t); r.cellular = /cellular|lte|\b5\s*g\b|gsm|sim/.test(t); } }
    if (!id) {
      const mm = macModel(t);
      if (mm) {
        r.modelId = mm.id; r.family = 'mac'; r.tier = mm.tier;
        const mem = pickMacMem(t); r.ram = mem.ram; r.storage = mem.ssd;
        r.size = screen(t);
      }
    }
    const b = battery(t); r.battery = b.pct; r.batteryFresh = b.fresh;
    r.isNew = isNewItem(t);
    r.dealer = isDealer(raw, t);
    r.warrantyMonths = warranty(t, today);
    r.grade = grade(t);
    r.defect = defect(t);
    return r;
  }

  function parsePrice(s) {
    const m = String(s || '').replace(/[\u00a0\u202f\u2009]/g, ' ').match(/(\d{1,3}(?:[ .]\d{3})+|\d+)\s*(ft|huf)?/i);
    return m ? +m[1].replace(/[ .]/g, '') : null;
  }

  const api = { parseListing, parsePrice, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ALMA_PARSE = api;
})(typeof window !== 'undefined' ? window : globalThis);
