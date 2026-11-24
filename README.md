# AlmaRadar

Apple-árfigyelő magyar vásárlóknak: mennyit ér **valójában** egy használt iPhone, iPad vagy MacBook,
a mai magyar hirdetések alapján. Új, kereskedői (garanciás) és magánszemélyes árak egy helyen.

## Mit tud

- **Ár-ellenőrző**: bármelyik hirdetés címét és árát bemásolva (Hardverapró, Jófogás, Facebook) megmondja, korrekt-e.
- **Eladnád? (Mennyit kapok a gépemért?)**: gyors eladási, korrekt és „ráérős” ár; mennyit ér fél és egy év múlva; kész hirdetésszöveg másolásra.
- **Vásárlás előtti ellenőrzőlista**: az ár-ellenőrző kigyűjti, mi hiányzik a hirdetésből, és kész üzenetet ír az eladónak.
- **Hol a legolcsóbb ma?** Árösszehasonlító modellenként és tárhelyenként: Apple-ár, boltok (új), felújított boltok (2 év garancia) és a használt piac egy táblázatban, árelőzménnyel és álakció-jelzéssel.
- **Mit kapok ennyi pénzért?** Keretből visszafelé a legújabb gépek, amik ma beleférnek, és meddig kapnak frissítést.
- **Mai legjobb vételek**: a fair ár alatti hirdetések, a gyanúsan olcsók külön jelölve.
- **Piac**: mi mozgatja az árat (kor, garancia, tárhely, akku), értékvesztés-térkép, új vagy használt összevetés.
- **Modellek**: árkalauz tárhely × állapot szerint (kopott / szép / újszerű / kereskedőtől / új), napi ártrend, mai hirdetések, várható frissítési év.
- **Riasztás** (prototípus): a beállítás a böngészőben marad. Az e-mailes értesítés a következő lépés.

## Hogyan működik

```
pipeline/collect.js        -> data/snapshots/ÉÉÉÉ-HH-NN/hardverapro.json   (használt hirdetések)
pipeline/collect_shops.js  -> data/snapshots/ÉÉÉÉ-HH-NN/shops.json         (bolti új és felújított árak)
pipeline/build.js          -> site/data/listings.json, offers.json, market.json, history.json, prices.json
pipeline/site.js     -> site/index.html   (a src/ fájlokat beágyazza)
```

- `src/catalog.js`: modellek, megjelenés és az **Apple saját árai (ezeket kézzel frissítjük**, ritkán változnak).
- `pipeline/collect_shops.js`: bolti árak három módon, a legtartósabbtól kezdve: Shopify `products.json` (iStyle),
  WooCommerce Store API (iBerry), egyébként a kategóriaoldal schema.org JSON-LD adatai, végső esetben link + ár a környezetből.
  Új bolt felvétele: egy sor a `SHOPS` listában.
- `src/parse.js`: hirdetéscím-értelmező (modell, tárhely, akku, állapot, garancia, kereskedő/magán). Ugyanez fut az oldalon is.
- `src/model.js` + `pipeline/fit.js`: fair-ár modell. Családonként logaritmikus ridge-regresszió, kétszeri kiugró-szűréssel.
  A kevés hirdetésű modelleket a közös értékvesztési görbe felé húzza. Ahol nincs adat (túl új modell, új változat), nem becsül.

Külső csomag nem kell, csak Node 20.

## Beüzemelés (egyszer, kb. 15 perc)

1. Töltsd fel ezt a mappát a `czakopeti/almaradar` (nyilvános) repóba. Nyilvános repóban a GitHub Actions ingyenes.
2. **Cloudflare Pages** → Create → Pages → Connect to Git → válaszd a repót.
   Build command: *üres*, Build output directory: `site`. Ezután minden napi commit után magától frissül az oldal.
3. GitHub → a repó **Actions** füle → *Napi frissítés* → **Run workflow**. Ezzel kipróbálod az első gyűjtést.
   Utána minden reggel magától fut.

## Fontos tudnivalók

- A gyűjtő csak nyilvános adatot ment: címet, árat, dátumot és linket. Személyes adatot (név, telefonszám, kép) nem tárol, és minden sor az eredeti hirdetésre mutat.
  A Hardverapró felhasználási feltételeit érdemes átnézni. Hosszabb távon a legjobb, ha velük is beszélsz (partnerség, forgalmat viszünk nekik).
- A Facebook Marketplace-ről automatikus gyűjtés nem megoldható (bejelentkezés kell, és a Meta tiltja).
  Ezért van az **ár-ellenőrző**: a felhasználó maga másolja be a hirdetést.
- Az első pillanatkép (2026-11-24) kézzel gyűjtött mintából van: kb. 435 hirdetés (a rovatok első oldalai) és kb. 90 bolti ajánlat (Alza, iStyle, iCentre, Rejoy, iBerry).
  A napi gyűjtő ennél többet lát. Az első éles futás után érdemes ránézni a számokra.
- Ha egy gyűjtő elhasal, a futás nem áll le: a build a legutóbbi napot használja, amelyben az a forrás megvolt.
- Az `extract()` szerkezet-független (a hirdetéslinkek környezetéből olvas), de ha a Hardverapró átalakítja az oldalt,
  a futás hibával áll le (50 hirdetés alatt), és nem írja felül a jó adatot.

## Következő lépések

1. Felvásárlási ajánlatok összehasonlítása (Rejoy, iBerry, Yettel/Telekom beszámítás), ahogy a SellCell csinálja.
2. Apple Watch és AirPods használt árak (a gyűjtő már lekéri az AirPods rovatot, a parsert kell bővíteni).
3. Jófogás és további boltok (Yettel, Telekom, One, Extreme Digital, Euronics) bekötése.
4. Ártrend-értesítés: ha egy modell ára X%-ot esik.
5. E-mailes riasztás (pl. Cloudflare Worker + egy ingyenes e-mail-küldő).
6. Bevétel: boltok partnerprogramja az új és felújított ajánlatoknál.
