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
- **Kumush:** konchilar kondan kumush olib, qasr yoniga to'playdi; doirani bosib olasiz.
  Ombor to'lsa konchilar kutib qoladi. Dushman kumushni avtomatik oladi, hisobi ko'rinmaydi.
- **Yollash — bitta umumiy navbat:** qaysi tugma birinchi bosilsa, o'sha birinchi tayyorlanadi (tugma pastdan
  to'ladi). 10 tagacha bosib qo'yish mumkin, askarlar bittalab chiqadi. Tugmadagi raqam — navbatda nechta
  kutyapti; × — bittasini olib tashlaydi, puli qaytadi. Qimmatrog'i sekinroq tayyorlanadi.
- **Holatlar:** *Chekinish* (hamma qasrga kiradi, ichkaridagi kamonchilar otadi), *Joyida tur* (qasr oldida
  saf: sarkardalar, otliq, Amir, qilichli, nayzachi, kamonchi — qatorda 5 tadan), *Hujum*.
- **Amir** halok bo'lsa, qo'shin o'zi qasrga chekinadi va 20 soniyadan keyin yangi Amir bilan chiqadi.
  Dushmanda Amir yo'q.
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
  savat va tezlik), qasr mustahkamligi, qasr o'qi, ombor, boshlang'ich kumush.
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
  render.ts          jang maydonini chizish (canvas)
  assets.ts          rasmlarni yuklash, dushmanni jang rangiga bo'yash
  telegram.ts        Telegram Mini App: profil, bulutli saqlash, to'liq ekran
  ui/home.ts         bosh sahifa va tablar
  ui/battleScreen.ts jang ekrani
tools/
  prepare_assets.py  art/ dagi varaqlarni o'yin rasmlariga aylantiradi
  sim.ts             balans sinovi: bot hamma janglarni o'ynaydi
```

Balansni tekshirish: `node tools/sim.ts` (hammasi), `node tools/sim.ts 9 5` (9-jang, 5 marta),
`node tools/sim.ts 15 6 600` (15-jang, qo'shimcha 600 oltin bilan).

## Rasmlar

Asl varaqlar `art/` papkasida, rasm yaratuvchi uchun promptlar — [`art/promptlar.md`](art/promptlar.md).

```bash
pip install pillow numpy scipy
python3 tools/prepare_assets.py --preview
```

Skript fonni olib tashlaydi, varaqni bo'laklarga ajratadi va `public/assets/` + `src/assets.json` ga yozadi.
Dushman xalqlari varag'i (`art/dushman_*.webp`): tepada ko'chmanchi, pastda sovutli; mato qismlari toza ko'k —
o'yin ularni har jangda bayroq rangiga almashtiradi.

## Telegram'ga joylash

To'liq bosqichma-bosqich qo'llanma: [`docs/joylash.md`](docs/joylash.md).
Qisqasi: o'yin Cloudflare Workers'ga joylanadi (`wrangler.jsonc`, build: `npm run build`, deploy:
`npx wrangler deploy`), keyin @BotFather'da bot ochilib, unga shu manzil Mini App sifatida ulanadi.

## Hali qilinmagan

- Ekinzor va yaylov foni (6-prompt) — hozir vaqtincha dasht va o'rmon foni ishlatiladi.
- Dushman otliq rasmi (12-prompt) — hozircha bizning otliq jang rangiga bo'yalgan. Dushman konchilari ham shunday.
- Bizning otliq, sarkardalar va qo'mondon rasmlari (hozir vaqtincha).
- Telegram Stars orqali Market, PvP, ovoz.
