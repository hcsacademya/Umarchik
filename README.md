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

- **Xarita**: umumiy xarita rasmi o'yin xaritasi sifatida ishlatiladi. Rasm ustiga romb plitalar
  to'ri (60×60, shundan ~1450 tasi quruqlik) qo'yilgan; relyef (tog', qor, o'rmon, daryo, ko'l, cho'l,
  ekinzor) va 16 viloyat (rasmdagi oltin nuqtali chegaralar bo'yicha) rasmdan aniqlangan.
  Rasmdagi qal'alarda AI davlatlar, markazdagi ikki shaharda imperiyalar (Rumiya, Parsiya —
  vaqtinchalik nomlar) joylashgan.
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

Asl rasmlar `art/` papkasida (umumiy xarita, ikki imperiya poytaxti, qarorgohning 4 bosqichi,
Amir, qo'mondon, sarkardalar, piyoda, kamonchi, nayzachi, otliq, dehqon, cho'pon, konchi —
har biri 4 bosqichda). `python tools/prepare_assets.py` ularni o'yin uchun tayyorlaydi
(fonni olib tashlash, bo'lish, WebP) va `public/assets/` ga yozadi.
Yangi rasm qo'shish yoki almashtirish: [`public/assets/README.md`](public/assets/README.md).

Hali rasmi yo'q narsalar (ekinzor, yaylov, kon) kod bilan chiziladi; devor-qal'a va kuzatuv
minorasi uchun hozircha qarorgoh rasmlari ishlatiladi.

## Kod tuzilmasi

```
src/
  config.ts          balans va nomlar
  types.ts           o'yin holati turlari
  world/mapgen.ts    xarita (mapData.json dan: relyef, viloyatlar, qal'alar)
  game/state.ts      yangi o'yin, AI davlatlar va imperiyalarni joylash
  game/economy.ts    ishlab chiqarish, bozor, qurilish, yollash, kuchaytirish
  game/sim.ts        vaqt, qo'shin yurishi, AI xatti-harakati, egallash
  game/combat.ts     avto-jang hisobi
  game/battle.ts     taktik jang simulyatsiyasi
  render/            xarita (izometrik), binolar, jang maydoni, rasm slotlari
  ui/                panellar, boshlash ekrani, jang interfeysi
tools/
  prepare_assets.py  art/ dagi rasmlarni o'yinga tayyorlash
  build_map.py       umumiy xarita rasmidan mapData.json yasash
```

O'yin mantig'i (`game/`, `world/`) grafikadan alohida — keyinchalik jang sahnasini 3D ga
(masalan Three.js) o'tkazish yoki onlayn server qo'shishda shu qism qayta ishlatiladi.

## Keyingi qadamlar (rejada)

- Ekinzor, yaylov, kon, minora, devor uchun alohida rasmlar.
- Telegram mini app, keyin mobil ilova (Capacitor orqali shu kod bilan).
- Jang sahnasi 3D, xarita 2D qoladi.
- Onlayn o'yinchilar, klanlar, olamlar (300 o'yinchi).
- Hujjatdagi ochiq savollar: nomlar, aniq raqamlar, imperiya konlari, g'oliblik iqtisodi.
