# Rasm promptlari (3-bosqich): yaxlit tayanch va 24 kadrli animatsiya

## Qoidalar
- Avvalgi chatda davom eting. Yangi chat ochsangiz, avval **ASOSIY G'OYA** ni yuboring (2-bosqich faylida).
- Har bir promptdan oldin ESLATMA yuboriladi:

```
Follow the fixed concept and sprite sheet rules from my first message exactly.
```

- Har promptda **"Biriktiring"** yozilgan: o'sha rasm(lar)ni promptga qo'shib yuborasiz.
- Bir kadr noto'g'ri chiqsa, butun rasmni qayta chizdirmang: *"same sheet, redo only frame 7, …"* deb so'rang.
- Natijalarni menga **oddiy xabar bilan** tashlang (ish paytida yuborilgan rasm fayl bo'lib saqlanmaydi).

## Tartib (muhimligi bo'yicha)

| # | Nima | Rasm soni |
|---|---|---|
| 1 | Bizning tayanch: qasr + kon, butun | 1 |
| 2 | Bizning tayanch: vayron | 1 |
| 3 | Yopiq darvoza | 1 |
| 4 | Amir: ikki qilich, 24 kadr | 1 |
| 5–8 | Qilichli, nayzachi, kamonchi, konchi: 24 kadr | 4 |
| 9–16 | Dushman tayanchlari: 6 joy + 2 poytaxt | 8 |
| 17–22 | Dushman askarlari: 3 tur × 2 xalq, 24 kadr | 6 |

Avval **1–4**, keyin **5–8**. Dushmanlarniki (9–22) undan keyin.

---

## 24 kadrli varaqning tuzilishi (hamma askarlar uchun bir xil)
6 ustun × 4 qator, chapdan o'ngga, yuqoridan pastga o'qiladi:

| Qator | Kadrlar |
|---|---|
| 1 | 1–6: yurish |
| 2 | 7–8: yurish oxiri · 9–10: turish · 11–12: zarba yeyish |
| 3 | 13–16: 1-zarba · 17–18: 2-zarba boshi |
| 4 | 19–20: 2-zarba oxiri · 21–24: o'lim |

Konchida boshqacha: 1–8 bo'sh yurish, 9–16 savat bilan yurish, 17–18 turish, 19–20 zarba yeyish, 21–24 o'lim.

---

## 1. Bizning tayanch: qasr va kon, butun holat
**Biriktiring:** `qasr_biz.webp` (uslub va material uchun)
```
Draw OUR fortified base for a side-scrolling battle game, in the spirit of the player's city in "Grow Empire: Rome", using the same sandstone material, art style and blue-and-gold banners as the attached castle. ONE single wide composition that fills the whole image (1536x1024). Camera: three-quarter side view; the front of the base faces RIGHT toward the battlefield.

FROM LEFT TO RIGHT:
- Left part (about 45% of the width): a tall, long city wall with crenellations that continues off the LEFT edge of the image (cut by the image border). Behind the wall, the roofs, domes and towers of our city are visible.
- Center: a strong gatehouse in the wall with two round towers and a large arched gate at ground level. Gate OPEN, dark passage inside; the opening faces right and is turned about 30 degrees toward the viewer so it is clearly visible. On top of the gatehouse and the wall: an EMPTY wall-walk behind the crenellations where archers will stand.
- Right part (about 25% of the width): a rocky hill leaning against the right tower, with a timber-framed silver mine entrance at ground level. The dark tunnel opening faces the viewer and the right, clearly visible, with a hanging lantern, shiny veins of raw silver in the rock, a small ore cart and a pile of silver ore BESIDE (not in front of) the entrance.

GROUND: everything stands on ONE straight horizontal base line at the very bottom of the image. Do NOT draw a ground patch, grass island, road or terrain under or around the buildings — the bottom edge of the buildings and the hill is a clean straight line.
SCALE: the gate opening is about 30% of the image height; the towers reach about 85% of the image height; the mine entrance is about 25% of the image height.
NO people, NO animals, NO text. Plain flat light-gray background (#D8D8D8) above and around the buildings.
```

## 2. Bizning tayanch: vayron
**Biriktiring:** 1-promptning natijasi
```
Draw EXACTLY the same base as in the attached image — same composition, same size, same position of every part, same straight bottom line — but completely RUINED after a siege: the gatehouse and towers collapsed into rubble and broken stones, charred wooden beams, the city wall broken with big gaps, burnt roofs behind it, smoke stains; the gate is a heap of rubble; the mine entrance timber frame is broken but the hill stays. A torn blue banner hanging on a broken pole. NO people, NO fire, NO smoke clouds (only black soot stains). Plain flat light-gray background (#D8D8D8).
```

## 3. Yopiq darvoza
**Biriktiring:** 1-promptning natijasi
```
Draw ONLY the CLOSED GATE of the attached base: the two heavy wooden door leaves with iron bands and big iron rings, closed, shaped exactly like the arched gate opening in the attached image and seen from the same angle. One single object, large, in the center of the image, nothing else around it (no wall, no towers). Plain flat light-gray background (#D8D8D8), no shadow.
```

## 4. Amir: ikki qilich bilan, 24 kadr
**Biriktiring:** `anim_amir.webp` (hozirgi 16 kadrli Amir varag'i)
```
Draw the attached character (the Amir: cream turban, face scarf covering mouth and nose, olive-green cloak with patterned border, cream embroidered tunic, red sash, leather belts, baggy trousers, wrapped leather boots) as an ANIMATION sprite sheet of 24 frames. He now fights with TWO curved sabres with golden hilts — one in each hand — in EVERY frame (also while walking and standing); only in the death frames do the sabres fall.

LAYOUT: 6 columns x 4 rows of EQUAL cells, image 1536x1024. Read the cells left to right, top to bottom. Do NOT draw any numbers, text, lines or borders.

FRAMES:
Row 1 — walk cycle part 1 (both sabres held low, points slightly forward):
 1) CONTACT: left leg forward, left heel touching the ground, right leg far behind on its toes; legs wide apart
 2) DOWN: weight on the bent left leg, body slightly lower
 3) PASSING: right leg swinging forward right next to the left leg, right knee lifted; legs CLOSE TOGETHER
 4) UP: left leg straight, right leg reaching forward, body at its highest
 5) CONTACT: right leg forward, right heel touching the ground, left leg far behind; legs wide apart
 6) DOWN: weight on the bent right leg, body slightly lower
Row 2 — walk end, idle, hit:
 7) PASSING: left leg swinging forward right next to the right leg; legs CLOSE TOGETHER
 8) UP: right leg straight, left leg reaching forward, body at its highest
 9) idle: standing proudly, both sabres lowered at his sides, points down
 10) idle: same as 9, chest slightly raised as if breathing in, cloak moved slightly
 11) hit 1: flinching backward, head turned away
 12) hit 2: recovering, stepping back with both sabres raised to guard
Row 3 — attack A (right sabre), then attack B start:
 13) A wind-up: right sabre raised high behind the head, left sabre forward in guard
 14) A strike: lunging forward, the right sabre slashing diagonally downward in front
 15) A follow-through: right sabre low in front, body leaning forward
 16) A recovery: back to guard, both sabres in front at chest height
 17) B wind-up: both sabres crossed high behind the head, weight on the back leg
 18) B first cut: right sabre slashing downward in front
Row 4 — attack B end, death:
 19) B second cut: left sabre slashing horizontally forward, body turning with it
 20) B recovery: both sabres crossed in front of the chest
 21) death 1: hit hard, staggering backward, arms spread
 22) death 2: falling to his knees, both sabres slipping from his hands
 23) death 3: collapsing forward toward the ground
 24) death 4: lying face down on the ground, completely still, two sabres on the ground beside him

RULES: Frames 3 and 7 MUST show the legs close together (one leg passing the other), not a wide stride. The same character, same outfit, same proportions and the same size as in the attached sheet in all 24 frames. Pure side profile view (90 degrees), facing RIGHT. In every cell the feet (or the body lying on the ground) rest on the same baseline near the bottom of the cell. Each figure stays fully inside its own cell; the sabres never cross into another cell. Plain flat light-gray background (#D8D8D8), no shadows, no ground, no text.
```

---

## 5. Qilichli: 24 kadr
**Biriktiring:** `anim_qilichli.webp`
```
Draw the attached character (swordsman: iron helmet with cheek flaps, brown leather vest with buckles, beige tunic, red sash, baggy brown trousers, wrapped leather boots, round wooden shield with metal rim and boss, straight sword) as an ANIMATION sprite sheet of 24 frames. He holds the sword in his right hand and the shield on his left arm in EVERY frame; only in the death frames do they fall.

LAYOUT: 6 columns x 4 rows of EQUAL cells, image 1536x1024. Read the cells left to right, top to bottom. Do NOT draw any numbers, text, lines or borders.

FRAMES:
Row 1 — walk cycle part 1 (shield in front, sword lowered):
 1) CONTACT: left leg forward, left heel touching the ground, right leg far behind on its toes; legs wide apart
 2) DOWN: weight on the bent left leg, body slightly lower
 3) PASSING: right leg swinging forward right next to the left leg, right knee lifted; legs CLOSE TOGETHER
 4) UP: left leg straight, right leg reaching forward, body at its highest
 5) CONTACT: right leg forward, right heel touching the ground, left leg far behind; legs wide apart
 6) DOWN: weight on the bent right leg, body slightly lower
Row 2 — walk end, idle, hit:
 7) PASSING: left leg swinging forward right next to the right leg; legs CLOSE TOGETHER
 8) UP: right leg straight, left leg reaching forward, body at its highest
 9) idle: standing ready, shield raised in front of the chest, sword lowered
 10) idle: same as 9, chest slightly raised as if breathing in
 11) hit 1: flinching backward behind the shield, head turned away
 12) hit 2: recovering, stepping back, shield raised
Row 3 — attack A (diagonal slash), then attack B start:
 13) A wind-up: sword raised high over the right shoulder, shield forward
 14) A strike: lunging forward, slashing the sword diagonally downward in front
 15) A follow-through: sword low in front, body leaning forward
 16) A recovery: back to guard, shield up, sword at chest height
 17) B shield bash: stepping forward and punching the shield forward
 18) B wind-up: sword pulled back at waist height behind the shield
Row 4 — attack B end, death:
 19) B strike: horizontal sword cut forward at chest height
 20) B recovery: back to guard behind the shield
 21) death 1: hit hard, staggering backward, shield arm dropping
 22) death 2: falling to his knees, the sword slipping from his hand
 23) death 3: collapsing forward toward the ground, shield sliding off
 24) death 4: lying face down on the ground, completely still, sword and shield on the ground beside him

RULES: Frames 3 and 7 MUST show the legs close together (one leg passing the other), not a wide stride. The same character, same outfit, same proportions and the same size as in the attached sheet in all 24 frames. Pure side profile view (90 degrees), facing RIGHT. In every cell the feet (or the body lying on the ground) rest on the same baseline near the bottom of the cell. Each figure stays fully inside its own cell. Plain flat light-gray background (#D8D8D8), no shadows, no ground, no text.
```

## 6. Nayzachi: 24 kadr
**Biriktiring:** `anim_nayzachi.webp`
```
Draw the attached character (spearman: iron helmet with mail coif, scale-and-leather lamellar armor over a quilted beige tunic, shoulder guards, round wooden shield with metal rim and boss, long spear with a steel leaf-shaped head, baggy brown trousers, wrapped leather boots) as an ANIMATION sprite sheet of 24 frames. He holds the spear in his right hand and the shield on his left arm in EVERY frame (while walking and standing the spear is upright, slightly tilted forward); he has NO sword in his hand. Only in the death frames do they fall.

LAYOUT: 6 columns x 4 rows of EQUAL cells, image 1536x1024. Read the cells left to right, top to bottom. Do NOT draw any numbers, text, lines or borders.

FRAMES:
Row 1 — walk cycle part 1:
 1) CONTACT: left leg forward, left heel touching the ground, right leg far behind on its toes; legs wide apart
 2) DOWN: weight on the bent left leg, body slightly lower
 3) PASSING: right leg swinging forward right next to the left leg, right knee lifted; legs CLOSE TOGETHER
 4) UP: left leg straight, right leg reaching forward, body at its highest
 5) CONTACT: right leg forward, right heel touching the ground, left leg far behind; legs wide apart
 6) DOWN: weight on the bent right leg, body slightly lower
Row 2 — walk end, idle, hit:
 7) PASSING: left leg swinging forward right next to the right leg; legs CLOSE TOGETHER
 8) UP: right leg straight, left leg reaching forward, body at its highest
 9) idle: standing firm, spear upright beside him, shield in front
 10) idle: same as 9, chest slightly raised as if breathing in
 11) hit 1: flinching backward behind the shield, head turned away
 12) hit 2: recovering, stepping back, shield raised
Row 3 — attack A (straight thrust), then attack B start:
 13) A ready: spear lowered to waist height and pulled back, pointing forward, shield in front
 14) A thrust: lunging forward, spear thrust straight ahead at chest height
 15) A full extension: arms fully extended, body leaning forward
 16) A recovery: pulling the spear back behind the shield
 17) B raise: spear lifted over the shoulder, point forward and down
 18) B overhand stab: driving the spear forward and downward from above the shoulder
Row 4 — attack B end, death:
 19) B follow-through: spear point low in front, body leaning forward
 20) B recovery: spear back upright, shield in front
 21) death 1: hit hard, staggering backward
 22) death 2: falling to his knees, the spear falling from his hand
 23) death 3: collapsing forward toward the ground
 24) death 4: lying face down on the ground, completely still, spear and shield on the ground beside him

RULES: Frames 3 and 7 MUST show the legs close together (one leg passing the other), not a wide stride. The same character, same outfit, same proportions and the same size as in the attached sheet in all 24 frames. Pure side profile view (90 degrees), facing RIGHT. In every cell the feet (or the body lying on the ground) rest on the same baseline near the bottom of the cell. The spear always stays fully inside its own cell — shorten its angle if needed. Plain flat light-gray background (#D8D8D8), no shadows, no ground, no text.
```

## 7. Kamonchi: 24 kadr
**Biriktiring:** `anim_kamonchi.webp`
```
Draw the attached character (archer: cream turban cloth, long hair and beard, brown leather vest with crossed straps, leather bracers, quiver of arrows on the back, red patterned sash, beige tunic, baggy brown trousers, wrapped leather boots, composite recurve bow with carved ornament) as an ANIMATION sprite sheet of 24 frames. He holds the bow in his left hand in EVERY frame; the quiver stays on his back. Only in the death frames does the bow fall.

LAYOUT: 6 columns x 4 rows of EQUAL cells, image 1536x1024. Read the cells left to right, top to bottom. Do NOT draw any numbers, text, lines or borders.

FRAMES:
Row 1 — walk cycle part 1 (bow held low):
 1) CONTACT: left leg forward, left heel touching the ground, right leg far behind on its toes; legs wide apart
 2) DOWN: weight on the bent left leg, body slightly lower
 3) PASSING: right leg swinging forward right next to the left leg, right knee lifted; legs CLOSE TOGETHER
 4) UP: left leg straight, right leg reaching forward, body at its highest
 5) CONTACT: right leg forward, right heel touching the ground, left leg far behind; legs wide apart
 6) DOWN: weight on the bent right leg, body slightly lower
Row 2 — walk end, idle, hit:
 7) PASSING: left leg swinging forward right next to the right leg; legs CLOSE TOGETHER
 8) UP: right leg straight, left leg reaching forward, body at its highest
 9) idle: standing, bow lowered in the left hand
 10) idle: same as 9, chest slightly raised as if breathing in
 11) hit 1: flinching backward, head turned away
 12) hit 2: recovering, stepping back
Row 3 — attack A (straight shot), then attack B start:
 13) A reach: right hand pulling an arrow from the quiver on his back, bow raised in front
 14) A nock: arrow placed on the string, bow raised forward
 15) A full draw: bow pointing straight forward, string pulled back to the cheek, aiming
 16) A release: the arrow has just left, string straight, right hand open behind the head
 17) B nock high: arrow on the string, bow raised and tilted UPWARD at about 40 degrees for a long-range shot
 18) B full draw high: bow tilted upward, string pulled back to the cheek
Row 4 — attack B end, death:
 19) B release high: the arrow has just left upward, string straight, right hand open behind the head
 20) B recovery: lowering the bow, reaching back toward the quiver
 21) death 1: hit hard, staggering backward
 22) death 2: falling to his knees, the bow slipping from his hand
 23) death 3: collapsing forward toward the ground
 24) death 4: lying face down on the ground, completely still, bow on the ground beside him

RULES: Frames 3 and 7 MUST show the legs close together (one leg passing the other), not a wide stride. NO flying arrows anywhere in the image. The same character, same outfit, same proportions and the same size as in the attached sheet in all 24 frames. Pure side profile view (90 degrees), facing RIGHT. In every cell the feet (or the body lying on the ground) rest on the same baseline near the bottom of the cell. The bow stays fully inside its own cell. Plain flat light-gray background (#D8D8D8), no shadows, no ground, no text.
```

## 8. Konchi: 24 kadr
**Biriktiring:** `anim_konchi.webp`
```
Draw the attached character (silver miner: wrapped beige head cloth, graying beard, dirty linen shirt with rolled sleeves, brown leather apron with straps, red sash belt, small lantern on the belt, baggy trousers, leg wraps, worn leather boots, iron pickaxe) as an ANIMATION sprite sheet of 24 frames.

LAYOUT: 6 columns x 4 rows of EQUAL cells, image 1536x1024. Read the cells left to right, top to bottom. Do NOT draw any numbers, text, lines or borders.

FRAMES:
Row 1 — walking EMPTY, pickaxe over the right shoulder:
 1) CONTACT: left leg forward, left heel touching the ground, right leg far behind; legs wide apart
 2) DOWN: weight on the bent left leg, body slightly lower
 3) PASSING: right leg passing right next to the left leg; legs CLOSE TOGETHER
 4) UP: left leg straight, right leg reaching forward, body at its highest
 5) CONTACT: right leg forward, left leg far behind; legs wide apart
 6) DOWN: weight on the bent right leg, body slightly lower
Row 2 — walking empty end, then walking with the FULL BASKET (a woven basket full of shiny raw silver ore strapped on his back, bent slightly forward under the weight, pickaxe in his right hand):
 7) empty PASSING: left leg passing right next to the right leg; legs CLOSE TOGETHER
 8) empty UP: right leg straight, left leg reaching forward
 9) basket CONTACT: left leg forward, right leg behind; legs wide apart
 10) basket DOWN: weight on the bent left leg
 11) basket PASSING: right leg passing next to the left leg; legs CLOSE TOGETHER
 12) basket UP: left leg straight, right leg reaching forward
Row 3 — basket walk end, standing, hit:
 13) basket CONTACT: right leg forward, left leg behind; legs wide apart
 14) basket DOWN: weight on the bent right leg
 15) basket PASSING: left leg passing next to the right leg; legs CLOSE TOGETHER
 16) basket UP: right leg straight, left leg reaching forward
 17) idle: standing, leaning on the pickaxe handle (no basket)
 18) idle: same as 17, wiping his forehead with the free hand
Row 4 — hit and death (no basket):
 19) hit 1: flinching backward, head turned away
 20) hit 2: recovering, stepping back
 21) death 1: hit hard, staggering backward
 22) death 2: falling to his knees, the pickaxe falling from his hands
 23) death 3: collapsing forward toward the ground
 24) death 4: lying face down on the ground, completely still, pickaxe on the ground beside him

RULES: Frames 3, 7, 11 and 15 MUST show the legs close together (one leg passing the other), not a wide stride. The same character, same outfit, same proportions and the same size as in the attached sheet in all 24 frames. Pure side profile view (90 degrees), facing RIGHT. In every cell the feet (or the body lying on the ground) rest on the same baseline near the bottom of the cell. Each figure stays fully inside its own cell. Plain flat light-gray background (#D8D8D8), no shadows, no ground, no text.
```

---

## 9–16. Dushman tayanchlari (har biri alohida rasm)
**Biriktiring:** 1-promptning natijasi (bizning tayanch). O'yin dushman tayanchini ko'zgudek aylantirib, o'ng chetga qo'yadi.

Har biriga shu umumiy matn, oxiriga o'sha joyning qatori qo'shiladi:
```
Using EXACTLY the same composition, camera angle, scale and art style as the attached base (a long city wall going off the LEFT edge of the image, a gatehouse with two towers and an OPEN arched gate facing right in the center, an EMPTY wall-walk on top, a rocky hill with a timber-framed mine entrance on the right, everything standing on one clean straight bottom line, no ground patch), draw an ENEMY base with this style:
STYLE: <shu yerga pastdagi qatorlardan birini qo'ying>
All banners and flags are plain solid ROYAL BLUE without emblems; nothing else in the image is blue. NO people, NO text. Plain flat light-gray background (#D8D8D8).
```
STYLE qatorlari:
- **9. O'rmon:** `dark mossy stone walls with a log palisade, pine trees behind the wall, a forested rocky hill with the mine`
- **10. Ko'l bo'yi:** `white limestone walls, a small wooden pier and moored boat beside the gate on green-grey water (not blue), a pale rocky hill with the mine`
- **11. Ekinzor:** `brick walls and towers with red clay-tile roofs, hay stacks and a farm cart beside the wall, a grassy hill with the mine`
- **12. Tog':** `grey granite walls on rocks, snow on all roofs and battlements, snowy pines, a snowy rocky mountain slope with the mine`
- **13. Dasht:** `timber walls and felt-roofed wooden towers, horse skulls above the gate, yurts behind the wall, a dry grassy hill with the mine`
- **14. Cho'l:** `sun-baked mud-brick walls with palm trees, clay pots, a red sandstone rock with the mine`

**15–16. Poytaxtlar** — ko'k rang qoidasi BU YERDA YO'Q, o'z ranglarida:
```
Using EXACTLY the same composition, camera angle and art style as the attached base, but about 1.4 times taller and grander, draw a huge enemy CAPITAL CITY base: <STYLE>. A rocky hill with a mine entrance on the right as in the attached image. NO people, NO text. Plain flat light-gray background (#D8D8D8).
```
- **15. Rim uslubi:** `grey stone city walls and a massive gatehouse, red tile roofs and a round amphitheater rising behind the wall, RED banners with golden laurel emblems`
- **16. Fors uslubi:** `blue-and-white tiled city walls, a grand gatehouse with a pointed arch, blue domes and minarets rising behind the wall, BLUE-and-GOLD banners`

---

## 17–22. Dushman askarlari: 24 kadr
Har bir rasmda **bitta xalqning bitta askari**.
**Biriktiring:** 2 ta rasm:
- **(a)** bizning o'sha turdagi yangi 24 kadrli varaq (5, 6 yoki 7-prompt natijasi). U pozalar uchun kerak.
- **(b)** `dushman_qilichli.webp` / `dushman_nayzachi.webp` / `dushman_kamonchi.webp`. U personajning ko'rinishi uchun kerak.

```
Use the FIRST attached sprite sheet ONLY as the reference for the 24 poses, their order, the layout (6 columns x 4 rows, 1536x1024) and the figure size. Use the SECOND attached image ONLY as the reference for the character's look: draw the <TOP ROW / BOTTOM ROW> character from it — <XALQ>.
Draw this character in exactly the same 24 poses as the first sheet, with his own weapons from the second image.
COLOR RULE: all fabric parts (kaftan, tabard, sash, cloak) and the shield faces are ONE solid ROYAL BLUE color; nothing else in the image is blue.
Same character, same outfit and proportions in all 24 frames. Pure side profile, facing RIGHT, feet on the same baseline in every cell. NO numbers, text, lines or borders. Plain flat light-gray background (#D8D8D8), no shadows, no ground.
```
`<TOP ROW / BOTTOM ROW>` va `<XALQ>` o'rniga:
- **Ko'chmanchi:** `TOP ROW` — `the light steppe nomad with the fur-trimmed pointed felt cap`
- **Sovutli:** `BOTTOM ROW` — `the heavily armored soldier in chain mail and a closed steel helmet`

| # | Tur | Xalq | (a) | (b) |
|---|---|---|---|---|
| 17 | Qilichli | Ko'chmanchi | 5-natija | dushman_qilichli |
| 18 | Qilichli | Sovutli | 5-natija | dushman_qilichli |
| 19 | Nayzachi | Ko'chmanchi | 6-natija | dushman_nayzachi |
| 20 | Nayzachi | Sovutli | 6-natija | dushman_nayzachi |
| 21 | Kamonchi | Ko'chmanchi | 7-natija | dushman_kamonchi |
| 22 | Kamonchi | Sovutli | 7-natija | dushman_kamonchi |

---

## Tekshirish (har rasmdan keyin)
- **Tayanch:** darvoza o'ngga qaragan va ichi qorong'i; devor tepasi bo'sh; kon og'zi ko'rinib turibdi; pastki chet tekis chiziq, ostida o't yoki yer dog'i yo'q.
- **Askarlar:** 24 katak to'liq; hamma kadrda bir xil personaj va bir xil o'lcham; o'ngga qaragan; raqam va chiziq yo'q; 3- va 7-kadrlarda oyoqlar yaqin.
