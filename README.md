# Umar

Yon tomondan ko'rinadigan 2D strategiya: qasringizdan askar chiqarib, dushman qasrini yiqitasiz.
Platforma — veb-sayt (kompyuter va telefon brauzeri, ekran gorizontal).

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:5173 (telefonda: kompyuter IP manzili orqali)
npm run build      # tayyor sayt dist/ papkasida
```

## O'yin qoidalari

- **Maqsad:** dushman qasrini yiqitish. O'z qasringiz yiqilsa, jang shu joyning o'zida qayta o'ynaladi —
  ochilgan askarlar va kuchaytirishlar saqlanadi.
- **Kumush:** konchilar kondan kumush olib, qasr yoniga to'playdi. Qasr yonidagi doirani bosib olasiz.
  Ombor to'lsa konchilar kutib qoladi. Dushman kumushni avtomatik oladi, hisobi ko'rinmaydi.
- **Yollash:** tepadagi tugmalar; doira aylanib bo'lgach askar qasrdan chiqadi.
- **Holatlar:** *Chekinish* (hamma qasrga kiradi, ichkaridagi kamonchilar qasrdan otadi),
  *Joyida tur* (qasr oldida saf: sarkardalar, otliq, Amir, qilichli, nayzachi, kamonchi — qatorda 5 tadan),
  *Hujum*.
- **Amir** halok bo'lsa, qo'shin o'zi qasrga chekinadi va 20 soniyadan keyin yangi Amir bilan chiqadi.
  Dushmanda Amir yo'q.
- **Tur ustunligi:** nayzachi > otliq > kamonchi > qilichli > nayzachi.
- **Ochilish** (har g'alabadan keyin): nayzachi, kamonchi, otliq, 4 sarkarda (har biri 2 askari bilan),
  qo'mondon (3 otliq bilan). Sarkarda va qo'mondon jangda bir marta sotib olinadi.
- **Askar chegarasi:** 44 → otliq ochilgach 55 → qo'mondon ochilgach 70.
- **Boshlang'ich qo'shin:** 1-jang Amir + 2 konchi; keyingi janglarda 2 qilichli, 2 nayzachi,
  2 kamonchi qo'shiladi (4-jangdan keyin o'zgarmaydi). Dushman doim bir pog'ona oldinda.
- **Mukofot:** g'alabada qolgan kumush 10:1 oltinga + bonus; mag'lubiyatda kumushning yarmi.
  Oltinga: qasr mustahkamligi, qasr o'qi, konchi savati, askar kuchi, boshlang'ich kumush, ombor.
- **Xarita:** 15 jang — g'arbdagi o'rmondan boshlanib, chetidan aylanib, markazdagi ikki poytaxtda tugaydi.

Barcha raqamlar bitta faylda: [`src/config.ts`](src/config.ts).

## Kod tuzilmasi

```
src/
  config.ts      balans, askarlar, kuchaytirishlar, janglar ro'yxati
  campaign.ts    saqlash, ochilishlar, boshlang'ich qo'shin, mukofot
  battle.ts      jang mantig'i (grafikasiz)
  ai.ts          dushman aqli
  render.ts      jang maydonini chizish (canvas)
  assets.ts      rasmlarni yuklash
  ui.ts          menyu, xarita, jang tugmalari, oynalar
tools/
  prepare_assets.py   art/ dagi varaqlarni o'yin rasmlariga aylantiradi
  sim.ts              balans sinovi: bot hamma janglarni o'ynaydi
```

Balansni tekshirish: `node tools/sim.ts` (hammasi) yoki `node tools/sim.ts 9 5` (9-jang, 5 marta).

## Rasmlar

Asl varaqlar `art/` papkasida (qasrlar, konlar, shaharlar, jangchilar — yon tomondan, kulrang fonda).
`art/namuna/` — personajlarning old tomondan chizilgan asl rasmlari (keyingi rasmlar uchun namuna).

```bash
pip install pillow numpy scipy
python3 tools/prepare_assets.py --preview
```

Skript fonni olib tashlaydi, varaqni bo'laklarga ajratadi, dushman uchun qizil nusxa yasaydi va
`public/assets/` + `src/assets.json` ga yozadi. `--preview` bilan `scratch/preview.png` da natijani ko'rsatadi.

Yangi varaq qo'shish: rasmni `art/` ga qo'yib, `tools/prepare_assets.py` dagi `UNITS` yoki
`BUILDINGS` ro'yxatiga qator yozing.

## Hali qilinmagan

- **Otliq** — yon tomondan rasmi chizilguncha namuna rasm (bitta holat) ishlatiladi.
- **Sarkardalar va qo'mondon** — o'z rasmlari yo'q: oddiy askar rasmi kattalashtirilib, oyog'i ostida
  oltin doira bilan chiziladi.
- **Jang foni** — hozircha kod bilan chiziladi (7 xil joy), keyin rasm qo'yiladi.
- **Dushman jangchilari** — o'zimiznikining qizil nusxasi; keyin alohida chizilishi mumkin.
- Ovoz, 4 bosqichli kuchayish ko'rinishi.
