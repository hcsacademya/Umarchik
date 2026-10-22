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
  Maydonda hech kim qolmasa, yangi Amir 20 soniyadan keyin qasrdan chiqadi. Dushmanda Amir yo'q.
- **Birinchi uch jang** yengilroq: dushman sekinroq boyiydi, kechroq hujum qiladi.
- **Kim kimni yengadi** (real tarixga yaqin, zarba ko'paytmasi):

  | Hujumchi → | Qilichli | Nayzachi | Kamonchi | Otliq |
  |---|---|---|---|---|
  | Qilichli | 1.0 | 1.4 | 1.5 | 0.8 |
  | Nayzachi | 0.8 | 1.0 | 1.0 | 2.0 |
  | Kamonchi | 0.7 | 1.3 | 1.0 | 1.0 |
  | Otliq | 1.3 | 0.5 | 1.8 | 1.0 |

- **Ochilish** (har g'alabadan keyin): nayzachi, kamonchi, otliq, 4 sarkarda (har biri 2 askari bilan),
  qo'mondon (3 otliq bilan). Sarkarda va qo'mondon jangda bir marta sotib olinadi.
- **Askar chegarasi:** 44 → otliq ochilgach 55 → qo'mondon ochilgach 70.
- **Dushman:** ikki xalq navbatma-navbat — *Ko'chmanchilar* (yengil, tez, otliq va kamonchi ko'p) va
  *Sovutlilar* (og'ir zirhli, chidamli, o'qdan kam zarar ko'radi). Kiyim rangi — xaritadagi qal'a bayrog'i
  rangi. Xarakteri ham har jangda boshqa: shoshqaloq, sabrli yoki reydchi (konchilarga hujum qiladi).
  Dushman doim bir pog'ona oldinda.
- **Kuchaytirish** (oltinga, doimiy): har jangchi turi alohida (jon va zarba +10% har daraja; konchi —
  savat va tezlik), qasr mustahkamligi, qasr o'qi, kon tezligi (qazish vaqti qisqaradi), boshlang'ich kumush.
- **Market — tezlatish** (oltinga, bitta jangga): tez konchi, tez yollash, jangovar ruh, tez qadam.
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
  skeleton.ts        skelet animatsiya: har tur pozalari va bo'laklarni chizish
  render.ts          jang maydonini chizish (canvas)
  assets.ts          rasmlarni yuklash, dushmanni jang rangiga bo'yash
  telegram.ts        Telegram Mini App: profil, bulutli saqlash, to'liq ekran
  ui/home.ts         bosh sahifa va tablar
  ui/battleScreen.ts jang ekrani
tools/
  prepare_assets.py  art/ dagi varaqlarni o'yin rasmlariga aylantiradi
  rig_sheets.py      skelet bo'laklarini varaqlardan kesib oladi (python3 tools/rig_sheets.py --preview)
  sim.ts             balans sinovi: bot hamma janglarni o'ynaydi
  duel.ts            kuch nisbati sinovi: 1 Amir N ta askarga qarshi
```

Balansni tekshirish: `node tools/sim.ts` (hammasi), `node tools/sim.ts 9 5` (9-jang, 5 marta),
`node tools/sim.ts 15 6 600` (15-jang, qo'shimcha 600 oltin bilan), `node tools/duel.ts` (Amir kuchi).

## Rasmlar

Asl varaqlar `art/` papkasida, rasm yaratuvchi uchun promptlar — [`art/promptlar.md`](art/promptlar.md).

```bash
pip install pillow numpy scipy
python3 tools/prepare_assets.py --preview
```

Skript fonni olib tashlaydi, varaqni bo'laklarga ajratadi va `public/assets/` + `src/assets.json` ga yozadi.
Dushman xalqlari varag'i (`art/dushman_*.webp`): tepada ko'chmanchi, pastda sovutli; mato qismlari toza ko'k —
o'yin ularni har jangda bayroq rangiga almashtiradi.
Animatsiya varaqlari (`art/anim24_*.webp`) — 24 kadr: 1–8 yurish, 9–10 turish, 11–12 zarba yeyish,
13–16 hujum A, 17–20 hujum B (zarbalar navbatma-navbat), 21–24 o'lim (konchida: 1–8 bo'sh yurish,
9–16 savat bilan yurish, 17–18 turish, 19–20 zarba yeyish, 21–24 o'lim).
**Skelet animatsiya** (hamma jangchi, otliqdan boshqa): har bir askar "qismlar varag'i"dan (`art/qismlar_*.webp`:
bosh, gavda, yuqori qo'l, bilak, son, boldir va qurol-yarog') yig'iladi. `tools/rig_sheets.py` varaqdagi bo'laklarni
o'zi topib kesadi, o'lchamini jangchi bo'yiga moslaydi, burilish nuqtalarini (yelka, tirsak, son, tizza) bo'lak
shaklidan topadi va orqadagi qo'l-oyoq uchun qorong'i nusxasini yasaydi. Dushman xalqlarining ko'k mato qismlari
jang rangiga bo'yaladi. `src/skeleton.ts` har kadrda suyak burchaklarini hisoblaydi: yurish (qadam bosib o'tilgan
yo'lga mos), turish, ikki xil zarba, zarba yeyish, yiqilish; turga xos harakat: Amir — ikki egri qilich va
hilpiragan plash, qilichli — qilich va qalqon, nayzachi — sanchish, kamonchi — o'q tortib otish, konchi — kurak
yelkada va kumushli savat. Yangi varaq qo'shish: `RIGS` ga yozuv (varaq, bo'laklar tartibi, bo'yi) qo'shiladi.
Hisob sekundiga 30 marta, ekran esa 60+ marta yangilanadi — ekran ikki hisob qadami orasini to'ldiradi.

Tayanchlar (`art/baza_*.webp`): skript darvoza va kon og'zini (rasmdagi ikki eng katta qorong'i teshik) o'zi
topadi, rasmni darvoza ostidan kesadi va hamma tayanchni bir xil darvoza balandligiga keltiradi.
O'yin teshiklarni ustki qatlamda ochiq qoldiradi — askar ichkariga kirayotgandek ko'rinadi.

## Telegram'ga joylash

To'liq bosqichma-bosqich qo'llanma: [`docs/joylash.md`](docs/joylash.md).
Qisqasi: o'yin Cloudflare Workers'ga joylanadi (`wrangler.jsonc`, build: `npm run build`, deploy:
`npx wrangler deploy`), keyin @BotFather'da bot ochilib, unga shu manzil Mini App sifatida ulanadi.

## Hali qilinmagan

- Tog', cho'l va ikki poytaxt tayanchlari — hozir o'rmon, dasht, ekinzor va ko'l tayanchlari ishlatiladi.
- Yopiq darvoza rasmi — hozir yog'och eshik kod bilan chiziladi.
- Ekinzor va yaylov foni — hozir vaqtincha dasht va o'rmon foni ishlatiladi.
- Otliq skeleti (ot va chavandoz) — hozircha bitta rasm; yon tomondan otliq (bizniki va dushmanniki), sarkardalar va qo'mondon rasmlari (hozir vaqtincha).
- Telegram Stars orqali Market, PvP, ovoz.
