# Tarixiy strategiya o'yini

Tarixiy muhitdagi strategiya o'yini (dizayn hujjati 1-qoralamasi asosida). Hozircha **bir kishilik**:
o'yinchi kompyuter (AI) davlatlari va ikki imperiyaga qarshi o'ynaydi. Grafika **2D izometrik**,
ekran **gorizontal**, platforma — **veb-sayt** (kompyuter va telefon brauzeri).

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:5173 (telefonda: kompyuter IP manzili orqali)
npm run build      # tayyor sayt dist/ papkasida
```

`dist/` papkasini istalgan statik hostingga (GitHub Pages, Netlify, Vercel…) qo'yish mumkin.

## Hozir o'yinda nima bor

- **Xarita**: 40×40 romb plita, 12 viloyat (oltin nuqtali chegaralar). Shimolda qorli tog'lar va
  kumush konlari, markazdan daryo o'tib janubi-g'arbdagi katta ko'lga quyiladi, g'arbda o'rmon,
  sharqda yaylov, janubi-sharqda cho'l. Markazda ikki imperiya (Rumiya, Parsiya — vaqtinchalik nomlar).
- **Boshlanish**: chet viloyatni tanlaysiz; tosh qal'acha-uycha, 3 dehqon, 2 cho'pon, 4 konchi,
  4 piyoda va Amir. Yonida kichik kon, ekin yeri va yaylov bor. Dastlabki 5 kun himoya.
- **Yer**: faqat tutash va o'sha viloyatdagi yer sotib olinadi; boshqa viloyatga faqat jang orqali.
  Narx zona bo'yicha (chet / o'rta / markaz).
- **Iqtisod**: kumush (yer, qurilish, kuchaytirish), bronza (maosh, soliq, ta'mir), don, qo'y.
  Ishxonalar o'z omborida mahsulot to'playdi, dushman olsa ombordagisi ham ketadi.
  Ortiqcha mahsulot AI davlatlarga sotiladi — AI yutilsa xaridor kamayadi.
- **Qo'shin**: piyoda → kamonchi → nayzachi va otliq (mashg'ulot maydoni darajasi bilan ochiladi).
  Tur ustunligi: nayzachi > otliq > kamonchi > piyoda. Qo'mondon (zirhli guruh) va 4 sarkarda
  qarorgoh darajasi + kumush + g'alabalar soni bilan ochiladi. Oziq-ovqat tugasa askarlar kuchsizlanadi.
- **Kuchaytirish**: har askar va ishchi turi uchun 10 daraja, ko'rinish 4 bosqichda o'zgaradi.
  Qarorgoh 4 bosqichda o'sadi va ishchi/yer/askar chegarasini belgilaydi.
- **Jang**: qo'shin xaritada yurib boradi; ayg'oqchi va kuzatuv minoralari hujum haqida oldinroq va
  aniqroq xabar beradi. Uchrashganda alohida jang maydoni ochiladi (relyef xaritadan ko'chadi,
  qal'ada devor bor). Guruhlarga buyruq beriladi, jang 4 daqiqa, vaqt tugasa mudofaachi yutadi,
  1 daqiqadan keyin chekinish mumkin. Yoki "Avto-jang".
- **Egallash**: g'alabadan keyin taymer; shu vaqtda himoyachi qaytarib olishga urinadi.
  Yadro qarorgoh hech qachon olinmaydi (faqat talon). AI poytaxti olinsa butun yerlari o'tadi va
  boshqa joyda yangi AI davlat paydo bo'ladi.
- **AI**: hujumda kuchsiz, himoyada kuchli; yaqindagilari zaif, uzoqdagilari kuchli; qasos reydi;
  o'zaro urushadi; imperiyalar bir-biri bilan jang qiladi.
- **Saqlash**: avtomatik, brauzer xotirasida.

Barcha balans raqamlari bitta faylda: [`src/config.ts`](src/config.ts) — narxlar, maoshlar,
askar kuchi, jang vaqti, egallash taymeri va hokazo.

## Rasmlar

Hozircha binolar, askarlar va relyefni o'yin kod bilan chizadi. Tayyor rasmlar (qal'a, uy, askar,
amir, qo'mondon, sarkarda, dehqon…) `public/assets/` papkasiga qo'yiladi va `manifest.json` da
kalitga bog'lanadi — kod o'zgarmaydi. Kalitlar ro'yxati: [`public/assets/README.md`](public/assets/README.md).

## Kod tuzilmasi

```
src/
  config.ts          balans va nomlar
  types.ts           o'yin holati turlari
  world/mapgen.ts    xarita generatori (relyef, viloyatlar)
  game/state.ts      yangi o'yin, AI davlatlar va imperiyalarni joylash
  game/economy.ts    ishlab chiqarish, bozor, qurilish, yollash, kuchaytirish
  game/sim.ts        vaqt, qo'shin yurishi, AI xatti-harakati, egallash
  game/combat.ts     avto-jang hisobi
  game/battle.ts     taktik jang simulyatsiyasi
  render/            xarita (izometrik), binolar, jang maydoni, rasm slotlari
  ui/                panellar, boshlash ekrani, jang interfeysi
```

O'yin mantig'i (`game/`, `world/`) grafikadan alohida — keyinchalik jang sahnasini 3D ga
(masalan Three.js) o'tkazish yoki onlayn server qo'shishda shu qism qayta ishlatiladi.

## Keyingi qadamlar (rejada)

- Tayyor rasmlarni ulash (zip kelgach).
- Telegram mini app, keyin mobil ilova (Capacitor orqali shu kod bilan).
- Jang sahnasi 3D, xarita 2D qoladi.
- Onlayn o'yinchilar, klanlar, olamlar (300 o'yinchi).
- Hujjatdagi ochiq savollar: nomlar, aniq raqamlar, imperiya konlari, g'oliblik iqtisodi.
