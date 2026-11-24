/* AlmaRadar – termékkatalógus.
 * Egy helyen van minden, amit a gépekről tudunk: megjelenés, alap tárhely,
 * hivatalos Apple HU ár és a legjobb ismert bolti új ár.
 * Az árak forrása és dátuma a PRICE_SOURCES listában.
 * A böngésző (window.ALMA_CATALOG) és a Node-os gyűjtő (require) is ezt használja. */
(function (root) {
  'use strict';

  // rel = megjelenés (év + tört év), approx = a dátum becsült
  const M = (id, family, name, rel, opts = {}) => Object.assign({ id, family, name, rel }, opts);

  const models = [
    // ---------- iPhone ----------
    M('iphone-se-2', 'iphone', 'iPhone SE (2020)', 2020.3, { variant: 'e', base: 64 }),
    M('iphone-se-3', 'iphone', 'iPhone SE (2022)', 2022.2, { variant: 'e', base: 64 }),
    M('iphone-11', 'iphone', 'iPhone 11', 2019.7, { variant: 'base', base: 64 }),
    M('iphone-11-pro', 'iphone', 'iPhone 11 Pro', 2019.7, { variant: 'pro', base: 64 }),
    M('iphone-11-pro-max', 'iphone', 'iPhone 11 Pro Max', 2019.7, { variant: 'promax', base: 64 }),
    M('iphone-12', 'iphone', 'iPhone 12', 2020.8, { variant: 'base', base: 64 }),
    M('iphone-12-mini', 'iphone', 'iPhone 12 mini', 2020.85, { variant: 'mini', base: 64 }),
    M('iphone-12-pro', 'iphone', 'iPhone 12 Pro', 2020.8, { variant: 'pro', base: 128 }),
    M('iphone-12-pro-max', 'iphone', 'iPhone 12 Pro Max', 2020.85, { variant: 'promax', base: 128 }),
    M('iphone-13', 'iphone', 'iPhone 13', 2021.7, { variant: 'base', base: 128 }),
    M('iphone-13-mini', 'iphone', 'iPhone 13 mini', 2021.7, { variant: 'mini', base: 128 }),
    M('iphone-13-pro', 'iphone', 'iPhone 13 Pro', 2021.7, { variant: 'pro', base: 128 }),
    M('iphone-13-pro-max', 'iphone', 'iPhone 13 Pro Max', 2021.7, { variant: 'promax', base: 128 }),
    M('iphone-14', 'iphone', 'iPhone 14', 2022.7, { variant: 'base', base: 128 }),
    M('iphone-14-plus', 'iphone', 'iPhone 14 Plus', 2022.8, { variant: 'plus', base: 128 }),
    M('iphone-14-pro', 'iphone', 'iPhone 14 Pro', 2022.7, { variant: 'pro', base: 128 }),
    M('iphone-14-pro-max', 'iphone', 'iPhone 14 Pro Max', 2022.7, { variant: 'promax', base: 128 }),
    M('iphone-15', 'iphone', 'iPhone 15', 2023.7, { variant: 'base', base: 128 }),
    M('iphone-15-plus', 'iphone', 'iPhone 15 Plus', 2023.7, { variant: 'plus', base: 128 }),
    M('iphone-15-pro', 'iphone', 'iPhone 15 Pro', 2023.7, { variant: 'pro', base: 128 }),
    M('iphone-15-pro-max', 'iphone', 'iPhone 15 Pro Max', 2023.7, { variant: 'promax', base: 256 }),
    M('iphone-16', 'iphone', 'iPhone 16', 2024.7, { variant: 'base', base: 128, sold: true }),
    M('iphone-16-plus', 'iphone', 'iPhone 16 Plus', 2024.7, { variant: 'plus', base: 128 }),
    M('iphone-16-pro', 'iphone', 'iPhone 16 Pro', 2024.7, { variant: 'pro', base: 128 }),
    M('iphone-16-pro-max', 'iphone', 'iPhone 16 Pro Max', 2024.7, { variant: 'promax', base: 256 }),
    M('iphone-16e', 'iphone', 'iPhone 16e', 2025.15, { variant: 'e', base: 128 }),
    M('iphone-17', 'iphone', 'iPhone 17', 2025.7, { variant: 'base', base: 256, sold: true,
      apple: { 256: 419990, 512: 519990 } }),
    M('iphone-17-pro', 'iphone', 'iPhone 17 Pro', 2025.7, { variant: 'pro', base: 256 }),
    M('iphone-17-pro-max', 'iphone', 'iPhone 17 Pro Max', 2025.7, { variant: 'promax', base: 256 }),
    M('iphone-air', 'iphone', 'iPhone Air', 2025.7, { variant: 'air', base: 256, sold: true,
      apple: { 256: 499990, 512: 599990, 1024: 799990 } }),
    M('iphone-17e', 'iphone', 'iPhone 17e', 2026.2, { variant: 'e', base: 256, sold: true, approx: true,
      apple: { 256: 319990, 512: 419990 } }),
    M('iphone-18-pro', 'iphone', 'iPhone 18 Pro', 2026.7, { variant: 'pro', base: 256, sold: true,
      apple: { 256: 549990, 512: 649990, 1024: 849990, 2048: 1149990 } }),
    M('iphone-18-pro-max', 'iphone', 'iPhone 18 Pro Max', 2026.7, { variant: 'promax', base: 256, sold: true,
      apple: { 256: 599990, 512: 699990, 1024: 899990, 2048: 1199990 } }),
    M('iphone-duo', 'iphone', 'iPhone Duo', 2026.8, { variant: 'duo', base: 256, sold: true,
      apple: { 256: 899990 } }),

    // ---------- iPad ----------
    M('ipad-6', 'ipad', 'iPad (6. gen)', 2018.2, { variant: 'base', base: 32 }),
    M('ipad-7', 'ipad', 'iPad (7. gen)', 2019.7, { variant: 'base', base: 32 }),
    M('ipad-8', 'ipad', 'iPad (8. gen)', 2020.7, { variant: 'base', base: 32 }),
    M('ipad-9', 'ipad', 'iPad (9. gen)', 2021.7, { variant: 'base', base: 64 }),
    M('ipad-10', 'ipad', 'iPad (10. gen)', 2022.8, { variant: 'base', base: 64 }),
    M('ipad-a16', 'ipad', 'iPad (A16, 11. gen)', 2025.2, { variant: 'base', base: 128, sold: true,
      apple: { 128: 209990, 256: 259990, 512: 359990 } }),
    M('ipad-air-4', 'ipad', 'iPad Air 4', 2020.8, { variant: 'air', base: 64 }),
    M('ipad-air-m1', 'ipad', 'iPad Air 5 (M1)', 2022.2, { variant: 'air', base: 64 }),
    M('ipad-air-m2', 'ipad', 'iPad Air (M2)', 2024.4, { variant: 'air', base: 128 }),
    M('ipad-air-m3', 'ipad', 'iPad Air (M3)', 2025.2, { variant: 'air', base: 128 }),
    M('ipad-air-m4', 'ipad', 'iPad Air (M4)', 2026.2, { variant: 'air', base: 128, sold: true,
      apple: { 128: 349990 } }),
    M('ipad-mini-6', 'ipad', 'iPad mini 6', 2021.7, { variant: 'mini', base: 64 }),
    M('ipad-mini-a17', 'ipad', 'iPad mini (A17 Pro)', 2024.8, { variant: 'mini', base: 128 }),
    M('ipad-mini-oled', 'ipad', 'iPad mini (OLED, 2026)', 2026.8, { variant: 'mini', base: 128, sold: true, approx: true,
      apple: { 128: 329990 } }),
    M('ipad-pro-m1', 'ipad', 'iPad Pro (M1, 2021)', 2021.4, { variant: 'pro', base: 128 }),
    M('ipad-pro-m2', 'ipad', 'iPad Pro (M2, 2022)', 2022.8, { variant: 'pro', base: 128 }),
    M('ipad-pro-m4', 'ipad', 'iPad Pro (M4)', 2024.4, { variant: 'pro', base: 256 }),
    M('ipad-pro-m5', 'ipad', 'iPad Pro (M5)', 2025.8, { variant: 'pro', base: 256, sold: true, approx: true,
      apple: { 256: 549990 } }),

    // ---------- Mac ----------
    M('mba-m1', 'mac', 'MacBook Air M1', 2020.9, { variant: 'air', size: 13, ram: 8, base: 256 }),
    M('mba-m2', 'mac', 'MacBook Air M2', 2022.6, { variant: 'air', size: 13, ram: 8, base: 256 }),
    M('mba-m3', 'mac', 'MacBook Air M3', 2024.2, { variant: 'air', size: 13, ram: 8, base: 256 }),
    M('mba-m4', 'mac', 'MacBook Air M4', 2025.2, { variant: 'air', size: 13, ram: 16, base: 256 }),
    M('mba-m5', 'mac', 'MacBook Air M5', 2026.2, { variant: 'air', size: 13, ram: 16, base: 512, sold: true, approx: true,
      apple: { 512: 499990 }, note: '13" 16 GB / 512 GB; a 15" 599 990 Ft (Alza: 541 900 Ft)' }),
    M('macbook-neo', 'mac', 'MacBook Neo (A18 Pro)', 2026.2, { variant: 'neo', size: 13, ram: 8, base: 256, sold: true, approx: true }),
    M('mbp-m1', 'mac', 'MacBook Pro M1 / M1 Pro / M1 Max', 2021.8, { variant: 'pro', size: 14, ram: 16, base: 512 }),
    M('mbp-m2', 'mac', 'MacBook Pro M2 / M2 Pro / M2 Max', 2023.1, { variant: 'pro', size: 14, ram: 16, base: 512 }),
    M('mbp-m3', 'mac', 'MacBook Pro M3 / M3 Pro / M3 Max', 2023.85, { variant: 'pro', size: 14, ram: 8, base: 512 }),
    M('mbp-m4', 'mac', 'MacBook Pro M4 / M4 Pro / M4 Max', 2024.85, { variant: 'pro', size: 14, ram: 16, base: 512 }),
    M('mbp-m5', 'mac', 'MacBook Pro M5 / M5 Pro / M5 Max', 2025.8, { variant: 'pro', size: 14, ram: 16, base: 512, sold: true, approx: true }),
    M('mac-intel', 'mac', 'Intel MacBook (2017–2020)', 2018.5, { variant: 'intel', size: 13, ram: 8, base: 256, eol: true }),

    // ---------- Watch / AirPods (egyelőre csak új ár) ----------
    M('watch-s12', 'watch', 'Apple Watch Series 12', 2026.7, { sold: true, apple: { 0: 169990 } }),
    M('watch-ultra-4', 'watch', 'Apple Watch Ultra 4', 2026.7, { sold: true, apple: { 0: 349990 } }),
    M('watch-se-3', 'watch', 'Apple Watch SE 3', 2025.7, { sold: true, apple: { 0: 99990 } }),
    M('airpods-5', 'airpods', 'AirPods 5', 2026.7, { sold: true, apple: { 0: 57990 }, note: 'vezeték nélküli tokkal 64 990 Ft' }),
    M('airpods-pro-3', 'airpods', 'AirPods Pro 3', 2025.7, { sold: true, apple: { 0: 99990 } }),
    M('airpods-max-2', 'airpods', 'AirPods Max 2', 2026.7, { sold: true, approx: true, apple: { 0: 229990 } }),
  ];

  // Becsült szoftvertámogatás: az Apple az iPhone-okat és iPadeket a gyakorlatban
  // nagyjából 7 évig frissíti; a macOS 26 az utolsó rendszer Intel Macekre.
  const SUPPORT_YEARS = { iphone: 7, ipad: 7, mac: 8, watch: 6, airpods: 6 };
  function supportUntil(m) {
    if (m.eol) return 2026;
    return Math.floor(m.rel + (SUPPORT_YEARS[m.family] || 6));
  }

  const PRICE_SOURCES = [
    { name: 'Apple Magyarország (apple.com/hu)', date: '2026-11-24' },
    { name: 'Alza, iStyle, iCentre, eMAG, MediaMarkt (új)', date: 'napi' },
    { name: 'Rejoy, iBerry (felújított, 2 év garancia)', date: 'napi' },
  ];

  const FAMILIES = {
    iphone: 'iPhone', ipad: 'iPad', mac: 'Mac', watch: 'Apple Watch', airpods: 'AirPods',
  };

  const byId = Object.fromEntries(models.map(m => [m.id, m]));
  const api = { models, byId, supportUntil, PRICE_SOURCES, FAMILIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ALMA_CATALOG = api;
})(typeof window !== 'undefined' ? window : globalThis);
