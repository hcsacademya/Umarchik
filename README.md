# Umar

Yon tomondan ko'rinadigan 2D strategiya: qasringizdan askar chiqarib, dushman qasrini yiqitasiz.
Telegram Mini App sifatida ishlaydi (oddiy brauzerda ham ochiladi), ekran **gorizontal**.

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:5173 (telefonda: kompyuter IP manzili orqali)
npm run build      # tayyor sayt dist/ papkasida
```

## Ekranlar

- **Bosh sahifa:** chapda ingichka panel (profil rasmi, ID, oltin, sozlamalar), markazda xarita va bizning
  bayroq, pastda tablar: **O'yin**, **PvP** (keyin), **Kuchaytirish**, **Market**.
- **Jang:** chap yuqorida yollash tugmalari (ichida jangchi, ostida narxi), o'ng yuqorida kumush, askar soni
  va pauza; pastda Chekinish / Joyida tur / Hujum, kichik xarita, kamera tugmalari.

## O'yin qoidalari

- **Maqsad:** dushman qasrini yiqitish. O'z qasringiz yiqilsa, jang shu joyning o'zida qayta o'ynaladi —
  ochilgan askarlar va kuchaytirishlar saqlanadi.
- **Kumush:** konchi kon og'ziga kirib ketadi, ichkarida qazib, 30 kumushli savat bilan chiqadi va qasr
  darvozasidan kiradi — kumush o'sha zahoti hisobga qo'shiladi (+30 yozuvi chiqadi), hech narsa bosish shart emas.
  Dushman ham xuddi shunday yig'adi, hisobi ko'rinmaydi.
- **Yollash — bitta umumiy navbat:** qaysi tugma birinchi bosilsa, o'sha birinchi tayyorlanadi (tugma pastdan
  to'ladi). 10 tagacha bosib qo'yish mumkin, askarlar bittalab chiqadi. Tugmadagi raqam — navbatda nechta
  kutyapti; × — bittasini olib tashlaydi, puli qaytadi. Qimmatrog'i sekinroq tayyorlanadi.
- **Qasr va kon — bitta yaxlit tayanch** (Grow Empire: Rome uslubida): darvoza va kon og'zi bitta rasmda.
  Askarlar darvozadan, konchilar kon og'zidan ko'rinib kirib-chiqadi.
- **Holatlar:** *Chekinish* — faqat tugma bosilganda: hamma (konchilar ham) darvozadan qasrga kiradi, darvoza
  yopiladi, ichkarida askarlar tuzaladi, kamonchilar devor tepasiga chiqib otadi. *Joyida tur* — bayroq
  turgan joyda bloklarda saf: sarkardalar, otliq, qilichli, Amir, nayzachi, kamonchi (har tur o'z bloki,
  bloklar orasida bo'sh joy). *Hujum*.
- **Amir** ikki qilichli, kuchi: 1 Amir ≈ 5 qilichli ≈ 4 nayzachi ≈ 3 otliq ≈ 6 kamonchi.
  Amir halok bo'lsa, unga eng yaqin askar yangi Amir bo'ladi (oltin nur bilan); qo'shin o'zi chekinmaydi.
  Maydonda hech kim qolmasa, yangi Amir 20 soniyadan keyin qasrdan chiqadi. Dushmanda Amir ham, qo'mondon ham yo'q.
- **Jang:** hujum, chekinish va safga qaytishda askarlar yuguradi (safda joyni sozlashda — sekin qadam). Yaqin jangchi
  dushmanning yoniga (chuqurlikda ham) borib uradi; bitta dushmanga hamma yopirilmaydi (nishonlar taqsimlanadi);
  askarlar bir nuqtaga yig'ilib qolmaydi, zarba dushmanni biroz silkitadi. Dushman yaqin kelsa kamonchi bir necha
  qadam orqaga chekinib o'q otadi. Qalqonli askar dushman yaqin bo'lsa qalqonini ko'taradi. Yangi sotib olingan askar
  darvozadan yurib chiqadi.
- **Harakat takrorlanmaydi:** har askarning o'z qadami va odati, zarbaning 3 xil turi tasodifiy, turganda
  tasodifiy harakatlar (atrofga qarash, oyoq almashtirish, qurolni to'g'rilash), yiqilish turlicha (orqaga, oldinga,
  tiz cho'kib).
- **Qasr yiqilishi:** qasr tayanchi ustunlarga va bo'laklarga bo'linib qulaydi, ekran titraydi, chang ko'tariladi,
  pastida notekis xarobalar qoladi (dushman ham, bizniki ham — alohida rasm kerak emas).
- **Birinchi uch jang** yengilroq: dushman sekinroq boyiydi, kechroq hujum qiladi.
- **Kim kimni yengadi** (real tarixga yaqin, zarba ko'paytmasi):

  | Hujumchi → | Qilichli | Nayzachi | Kamonchi | Otliq |
  |---|---|---|---|---|
  | Qilichli | 1.0 | 1.4 | 1.5 | 0.8 |
  | Nayzachi | 0.8 | 1.0 | 1.0 | 2.0 |
  | Kamonchi | 0.7 | 1.3 | 1.0 | 1.0 |
  | Otliq | 1.3 | 0.5 | 1.8 | 1.0 |

- **Ochilish** (har g'alabadan keyin): nayzachi, kamonchi, otliq, 4 sarkarda (har biri 2 askari bilan),
  qo'mondon (3 otliq bilan). Sarkarda va qo'mondonning har biridan bir jangda 4 tagacha sotib olinadi
  (tugmada nechtasi olingani ko'rinadi, masalan 2/4).
- **Askar chegarasi:** 44 → otliq ochilgach 55 → qo'mondon ochilgach 70.
- **Dushman:** ikki xalq navbatma-navbat — *Ko'chmanchilar* (yengil, tez, otliq va kamonchi ko'p) va
  *Sovutlilar* (og'ir zirhli, chidamli, o'qdan kam zarar ko'radi). Kiyim rangi — xaritadagi qal'a bayrog'i
  rangi. Xarakteri ham har jangda boshqa: shoshqaloq, sabrli yoki reydchi (konchilarga hujum qiladi).
  Dushman doim bir pog'ona oldinda.
- **Kuchaytirish** (oltinga, doimiy): har jangchi turi alohida (jon va zarba +10% har daraja; konchi —
  savat va tezlik), qasr mustahkamligi, qasr o'qi, kon tezligi (qazish vaqti qisqaradi), boshlang'ich kumush.
- **Market — tezlatish** (oltinga): tez konchi (+50%), tez yollash (+50%), jangovar ruh (zarba +30%), tez qadam
  (+25%). Jangda yollash tugmalari ostidagi **⚡** tugmasi bosilsa, zaxiradagi tezlatishlar chiqadi; bittasini bosish
  uni **1 daqiqaga** yoqadi (taymer tugmada va o'ng yuqorida ko'rinadi). Bir jangda bir nechtasini, bir xilini ham
  qayta-qayta ishlatish mumkin — vaqti qo'shiladi. Ishlatilmagani keyingi janglarga qoladi.
- **Mukofot:** g'alabada qolgan kumush 10:1 oltinga + bonus; mag'lubiyatda kumushning yarmi.
- **Saqlash:** Telegram ichida — Telegram bulutida (telefon almashsa ham qoladi), aks holda brauzerda.

Barcha raqamlar bitta faylda: [`src/config.ts`](src/config.ts).

## Kod tuzilmasi

```
src/
  config.ts          balans, askarlar, zarba jadvali, xalqlar, kuchaytirish, market, janglar ro'yxati
  campaign.ts        saqlash, ochilishlar, boshlang'ich qo'shin, mukofot
  battle.ts          jang mantig'i (grafikasiz)
  ai.ts              dushman aqli (xalq va xarakterga qarab)
  render.ts          jang maydonini chizish (canvas); qasr, kon va askarlar hozircha kod bilan oddiy shaklda
  assets.ts          fon va xarita rasmlarini yuklash, tugma belgilari
  telegram.ts        Telegram Mini App: profil, bulutli saqlash, to'liq ekran
  ui/home.ts         bosh sahifa va tablar
  ui/battleScreen.ts jang ekrani
tools/
  prepare_assets.py  art/ dagi fon va xarita rasmlarini o'yin rasmlariga aylantiradi
  shablon.py         askar shabloni (bo'lakli qo'g'irchoq) va bo'yalgan varaqni tekshirish
  sim.ts             balans sinovi: bot hamma janglarni o'ynaydi
  duel.ts            kuch nisbati sinovi: 1 Amir N ta askarga qarshi
```

Balansni tekshirish: `node tools/sim.ts` (hammasi), `node tools/sim.ts 9 5` (9-jang, 5 marta),
`node tools/sim.ts 15 6 600` (15-jang, qo'shimcha 600 oltin bilan), `node tools/duel.ts` (Amir kuchi).

## Rasmlar

Qasrlar, kon, Amir, jangchilar (qilichli, konchi, nayzachi, kamonchi, otliq), sarkardalar, qo'mondon va dushman
xalqlarining rasmlari olib tashlandi — ular yangi dizayn bilan noldan qilinadi. Shu paytgacha o'yin ularni
`src/render.ts` da kod bilan oddiy shaklda chizadi (joylari va o'lchamlari jang mantig'iga mos: darvoza — `CASTLE_X`,
kon — `mineX`, devor tepasi — `WALL_SPOTS`), tugma belgilari — `src/assets.ts` dagi harfli doirachalar.

Qolgan rasmlar: jang fonlari (`art/fon_*.webp`) va bosh sahifa xaritasi (`art/xarita.jpg`).

```bash
pip install pillow numpy
python3 tools/prepare_assets.py --preview
```

Skript ularni `public/assets/` + `src/assets.json` ga yozadi.

**Yangi askarlar (shablon usuli).** Askar Stick War Legacy uslubida: tanasi qora, ustida tarixiy kiyim, bo'laklarga
ajratilgan qo'g'irchoq (bosh, gavda, yeng, bilak, son, etik, etak, plash, qurol). Bo'laklarning o'lchami, joyi va
bo'g'imlari `tools/shablon.py` da belgilanadi: u `art/shablon/<tur>.png` (ChatGPT bo'yaydigan shablon), `<tur>.json`
(har bo'lakning qutisi, aylanish nuqtasi, chizish tartibi) va `<tur>_pozalar.png` (yig'ilgan askar uch pozada) ni
yasaydi hamda pozalarda yashirin uchlar ko'rinib qolmaganini sanaydi. Bo'g'imda pastki bo'lakning uchi yarim doira,
aylanish nuqtasi — uning markazi; yuqori bo'lak shu doirani to'liq yopadi, shuning uchun qo'l-oyoq qanday bukilsa ham
tirqish ochilmaydi. Prompt va qo'llanma: [`art/promptlar_v5.md`](art/promptlar_v5.md). Bo'yalgan varaqni tekshirish:
`python3 tools/shablon.py --tekshir natija.png`.
Hisob sekundiga 30 marta, ekran esa 60+ marta yangilanadi — ekran ikki hisob qadami orasini to'ldiradi.

## Telegram'ga joylash

To'liq bosqichma-bosqich qo'llanma: [`docs/joylash.md`](docs/joylash.md).
Qisqasi: o'yin Cloudflare Workers'ga joylanadi (`wrangler.jsonc`, build: `npm run build`, deploy:
`npx wrangler deploy`), keyin @BotFather'da bot ochilib, unga shu manzil Mini App sifatida ulanadi.

## Hali qilinmagan

- Yangi dizayn: qasrlar, kon, Amir, barcha jangchilar, sarkardalar, qo'mondon, dushman xalqlari va ularning harakatlari.
- Ekinzor va yaylov foni — hozir vaqtincha dasht va o'rmon foni ishlatiladi.
- Telegram Stars orqali Market, PvP, ovoz.
