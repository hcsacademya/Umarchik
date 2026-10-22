# O'yinni internetga joylash va Telegram Mini App qilish

Bu qo'llanma bo'yicha o'yin internetga chiqadi va Telegram botingiz ichida ochiladigan bo'ladi.
Ketadigan vaqt — taxminan 20–30 daqiqa. Hammasi **bepul**.

**Nima kerak bo'ladi:**
- GitHub akkaunti (bor: `hcsacademya`, repo `umarchik`).
- Cloudflare akkaunti (bepul, yo'q bo'lsa 1-qismda ochamiz; bank kartasi shart emas).
- Telegram (telefonda).

**Umumiy reja:**

| Qism | Nima qilinadi | Natija |
|---|---|---|
| 0 | GitHub'da asosiy branchni almashtirish | Cloudflare yangi o'yinni oladi |
| 1 | Cloudflare'ga joylash | `https://umar.....workers.dev` manzil |
| 2 | @BotFather'da bot ochish | `@umar_..._bot` |
| 3 | Botga o'yinni ulash | Botda "O'ynash" tugmasi |
| 4 | Sinash | Telefonda gorizontal o'yin |

> Menyu nomlari vaqt o'tib biroz o'zgarishi mumkin. Qo'llanmadagi nom aynan topilmasa, ma'nosi yaqin
> tugmani bosing yoki shu qadamning skrinshotini menga tashlang.

---

## 0-qism. GitHub: asosiy branchni almashtirish

Repoda hozir asosiy (default) branch — `claude/bold-planck-jnqmmn`, unda **eski** o'yin turibdi.
Yangi o'yin — `claude/sweet-davinci-4b69a2` branchida. Cloudflare asosiy branchni joylaydi, shuning uchun
avval asosiy branchni almashtiramiz.

1. Brauzerda oching: `https://github.com/hcsacademya/umarchik`
2. Yuqoridagi **Settings** (⚙ Sozlamalar) bo'limiga kiring.
3. **General** sahifasida **Default branch** qismini toping.
4. Branch nomi yonidagi **⇄** (almashtirish) tugmasini bosing.
5. Ro'yxatdan `claude/sweet-davinci-4b69a2` ni tanlang → **Update** → ogohlantirishda
   **I understand, update the default branch** ni bosing.

✅ Repo bosh sahifasida yangi o'yin fayllari (`wrangler.jsonc`, `docs/` papkasi) ko'rinishi kerak.

> Eski o'yin o'chmaydi — u `claude/bold-planck-jnqmmn` branchida qoladi.

---

## 1-qism. Cloudflare: o'yinni internetga joylash

### 1.1. Akkaunt ochish
1. Oching: `https://dash.cloudflare.com/sign-up`
2. Email va parol kiriting → **Sign up**.
3. Emailingizga kelgan xatdagi havolani bosib, emailni tasdiqlang.
4. Cloudflare "domen qo'shing" yoki tarif tanlashni taklif qilsa — **o'tkazib yuboring** (domen shart emas).

### 1.2. Loyiha yaratish
1. Chap menyudan **Workers & Pages** (yoki **Compute (Workers)**) bo'limiga kiring.
2. **Create** (yoki **Create application**) tugmasini bosing.
3. **Import a repository** (Git repozitoriyni ulash) ni tanlang.
4. **Connect GitHub** → GitHub oynasi ochiladi:
   - GitHub'ga kiring (kirmagan bo'lsangiz).
   - **Only select repositories** ni tanlang → `hcsacademya/umarchik` ni belgilang.
   - **Install & Authorize** (yoki **Install**) ni bosing.
5. Cloudflare'ga qaytgach, ro'yxatdan `umarchik` reposini tanlang → **Next** / **Begin setup**.

### 1.3. Sozlamalar (muhim!)
Quyidagilarni aynan shunday yozing:

| Maydon | Qiymat |
|---|---|
| **Project name** (Worker nomi) | `umar` |
| **Build command** | `npm run build` |
| **Deploy command** | `npx wrangler deploy` (odatda o'zi yozilgan bo'ladi) |
| **Path** / Root directory | bo'sh qoldiring (yoki `/`) |

> Nom aynan `umar` bo'lishi shart — repodagi `wrangler.jsonc` faylida ham shu nom yozilgan.
> Boshqa nom kerak bo'lsa, menga ayting, faylni o'zgartirib beraman.

Keyin **Create and deploy** (yoki **Deploy**) ni bosing. Yig'ish 1–3 daqiqa davom etadi.
Ekranda jarayon yozuvlari chiqadi, oxirida **Success** (muvaffaqiyatli) chiqishi kerak.

### 1.4. Branchni tekshirish
1. Yaratilgan `umar` Worker sahifasida **Settings** → **Build** bo'limiga kiring.
2. **Branch control** → **Production branch** `claude/sweet-davinci-4b69a2` ekanini tekshiring.
   Boshqa branch bo'lsa — shuni tanlab **Save** bosing, keyin **Deployments** bo'limida qayta yig'ing
   (**Retry build** / **Redeploy**).

### 1.5. O'yin manzili
1. Worker sahifasida **Visit** tugmasi yoki **Settings → Domains & Routes** bo'limida manzil turadi:
   `https://umar.<sizning-nomingiz>.workers.dev`
2. Shu manzilni **nusxalab oling** — 3-qismda kerak bo'ladi.
3. Telefonda yoki kompyuterda brauzerda ochib ko'ring: xarita va pastda tablar chiqishi kerak
   (chapdagi panelda "Mehmon" yozuvi bo'ladi — bu normal, Telegram'dan ochilmagani uchun).

> Birinchi marta ochilganda "manzil topilmadi" chiqsa, 1–2 daqiqa kutib qayta oching.

---

## 2-qism. Telegram bot ochish (@BotFather)

1. Telegram'da qidiruvga `@BotFather` yozing. **Ko'k galochkali** rasmiy botni oching → **Start** (/start).
2. `/newbot` buyrug'ini yuboring.
3. BotFather botning **nomini** so'raydi (odamlar ko'radigan nom). Masalan: `Umar`
4. Keyin **username** so'raydi — oxiri albatta `bot` bilan tugashi kerak.
   Masalan: `umar_oyin_bot`. Band bo'lsa, boshqasini yozing (`umar_qasr_bot`, `umarchik_bot` …).
5. BotFather tabrik xabari va **token** beradi (uzun kod: `1234567890:AA...`).
   - **Tokenni hech kimga bermang** va hech qayerga joylamang — u botni boshqarish kaliti.
   - Hozir u kerak emas. Keyinroq (Telegram Stars, `/start` javobi) kerak bo'ladi — xavfsiz joyda saqlang.

**Bot ko'rinishi (ixtiyoriy, lekin tavsiya qilinadi):**
- `/setuserpic` → botni tanlang → rasm yuboring (masalan qasr yoki Amir rasmi).
- `/setdescription` → botni tanlang → matn, masalan:
  `Qasrma-qasr yurish! Kumush yig'ing, qo'shin to'plang, dushman qasrlarini yiqiting. "O'ynash" tugmasini bosing.`
- `/setabouttext` → botni tanlang → qisqa matn: `Tarixiy strategiya o'yini`

---

## 3-qism. Botga o'yinni ulash (Mini App)

### 3.1. Asosiy Mini App — eng muhimi
1. BotFather'ga `/mybots` yuboring → botingizni tanlang.
2. **Bot Settings** → **Configure Mini App** → **Enable Mini App**.
3. BotFather manzil so'raydi — 1.5-qadamdagi manzilni yuboring:
   `https://umar.<sizning-nomingiz>.workers.dev`

✅ Natija: bot profilida **Open** (Ochish) tugmasi paydo bo'ladi, o'yin shu orqali ochiladi.
O'yin havolasi: `https://t.me/<bot_username>?startapp` — buni do'stlaringizga yuborsangiz bo'ladi.

### 3.2. Chatdagi "O'ynash" tugmasi (menyu tugmasi)
1. `/mybots` → botingiz → **Bot Settings** → **Menu Button** → **Configure menu button**.
2. Manzilni yuboring (o'sha `https://umar....workers.dev`).
3. Tugma nomini yuboring: `O'ynash`

✅ Natija: bot bilan chatda, yozish joyining chap tomonida **O'ynash** tugmasi chiqadi.

### 3.3. Alohida havola (ixtiyoriy)
Chiroyli havola kerak bo'lsa (`t.me/umar_oyin_bot/oyin`):
1. `/newapp` → botingizni tanlang.
2. **Title** (nomi): `Umar`
3. **Description** (tavsifi): qisqa matn.
4. **Photo**: 640×360 o'lchamli rasm.
5. **GIF**: kerak bo'lmasa `/empty` deb yozing.
6. **URL**: o'sha manzil.
7. **Short name**: masalan `oyin` → havola: `https://t.me/<bot_username>/oyin`

### To'liq ekran va gorizontal holat
O'yin Telegram ichida o'zi **to'liq ekranga** o'tadi va telefon gorizontal turganda shu holatda
**qulflanadi** (Telegram 8.0 va undan yangi versiyalarda).
Agar o'yin yarim ekranda ochilsa, havolaga `&mode=fullscreen` qo'shib ko'ring:
`https://t.me/<bot_username>?startapp&mode=fullscreen`

---

## 4-qism. Sinash

1. Telefonda botingizni oching → **O'ynash** (yoki profildagi **Open**).
2. Telefonni **gorizontal** buring (avtomatik burish yoqilgan bo'lsin).
3. Tekshiring:
   - Chapdagi panelda **Telegram rasmingiz va ID raqamingiz** chiqyaptimi ("Mehmon" emas).
   - 1-jangni o'ynab yuting → oltin qo'shildimi.
   - Telegram'ni butunlay yopib, qayta oching → **yutuqlar saqlanib qolganmi** (Telegram bulutida).
   - Boshqa telefon yoki kompyuterdagi Telegram'dan kirsangiz ham yutuqlar turishi kerak.
4. Muammo bo'lsa — skrinshot olib menga tashlang.

---

## 5-qism. O'yinni yangilash

Hech narsa qilish shart emas: men yangi o'zgarishni branchga yuklaganimda Cloudflare uni
**1–3 daqiqada o'zi qayta yig'ib joylaydi**. Telegram'da o'yinni yopib, qayta ochsangiz yangi versiya chiqadi.

Yig'ish holatini ko'rish: Cloudflare → **Workers & Pages** → `umar` → **Deployments**.

---

## 6-qism. Muammolar va yechimlar

| Muammo | Yechim |
|---|---|
| Cloudflare'da build **xato** bilan tugadi | **Project name** aynan `umar` ekanini va branch `claude/sweet-davinci-4b69a2` ekanini tekshiring. Xato matnining skrinshotini menga yuboring. |
| Manzil ochilganda **eski o'yin** chiqyapti | 0-qism (default branch) va 1.4-qism (Production branch) bajarilganini tekshiring, keyin qayta yig'ing. |
| Telegram'da **"Mehmon"** yozuvi chiqyapti | O'yin Telegram tugmasi orqali emas, oddiy brauzerda ochilgan. Bot ichidagi **O'ynash** / **Open** dan oching. |
| O'yin **gorizontal/to'liq ekranga** o'tmayapti | Telegram'ni yangilang. Telefonning avtomatik burilishi yoqilganini tekshiring. `&mode=fullscreen` havolasini sinab ko'ring. |
| Botga `/start` yozsam **javob bermayapti** | Hozircha normal: botda o'z serveri yo'q. O'yin **O'ynash** tugmasidan ochiladi. Keyingi bosqichda `/start` javobini qo'shamiz. |
| O'yin **eski versiyada** turibdi | Telegram'ni butunlay yopib, qayta oching. |

---

## Narx

- **Cloudflare (bepul tarif):** o'yin fayllarini berish bepul va amalda cheklanmagan. Keyinchalik server
  qismi (Stars to'lovlari, PvP) qo'shilganda ham boshida bepul tarif yetadi.
- **Telegram, BotFather:** bepul.
- **Domen** (masalan `umar.uz`) — ixtiyoriy, kerak bo'lsa keyin ulaymiz.

## Keyingi bosqichlar (shu Worker'ga qo'shiladi)
- Botga `/start` javobi va chiroyli kutib olish xabari.
- Market uchun **Telegram Stars** orqali to'lov.
- **PvP** — boshqa o'yinchilar bilan jang.
