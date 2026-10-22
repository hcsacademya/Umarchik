# Rasm promptlari (4-bosqich): otliq, sarkardalar, qo'mondon, dushmanning to'liq to'plami

Hammasi **qismlar varag'i** usulida (skelet animatsiya uchun): har bir jangchi alohida bo'laklarga bo'lib chiziladi,
dastur ularni o'zi kesib yig'adi. Har prompt alohida va to'liq, shablonsiz. Har birini ChatGPT'ga **ilova qilinadigan
rasm bilan** birga yuboring.

## Umumiy qoidalar
- Rasm kelgach tekshiring: shim va etik **bitta pochali**, qo'l **mushtlangan**, bo'laklar **bir-biriga tegmagan**,
  gavdada qo'l/yelka plastinasi **qolmagan**, mato rangi (dushmanda) **sof ko'k**.
- Bitta bo'lak buzilsa, butun rasmni emas, faqat shuni so'rang: *"same sheet, redo only part 6, …"*.
- Natijalarni menga **oddiy xabar bilan** tashlang.
- Dushman varaqlarida har xalq **faqat bitta qator** (takrorlanmasin).

## Tartib (muhimligi bo'yicha)

| # | Nima | Ilova qilinadigan rasm |
|---|---|---|
| 1 | Otliq (bizniki) | `art/otliq_vaqtincha.jpg` + `art/qismlar_amir.webp` |
| 2–4 | Sarkarda: qilichli, nayzachi, kamonchi | mos `art/qismlar_*.webp` |
| 5 | Sarkarda: otliq | 1-rasm natijasi |
| 6 | Qo'mondon | 5-rasm natijasi |
| 7 | Dushman konchi (ikki xalq) | `art/dushman_qilichli.webp` + `art/qismlar_konchi.webp` |
| 8–9 | Dushman otliq: ko'chmanchi, sovutli | `art/qismlar_dushman_*` + 1-rasm |
| 10–12 | Dushman sarkarda: qilichli, nayzachi, kamonchi (ikki xalq) | mos dushman varag'i |
| 13–14 | Dushman sarkarda otliq: ko'chmanchi, sovutli | 8–9 natijalari |
| 15–16 | Dushman qo'mondon: ko'chmanchi, sovutli | 13–14 natijalari |

Avval **1–6** (bizniki), keyin **7–16** (dushman). Limit kam bo'lsa, dushman sarkarda va qo'mondon (10–16) o'rniga
oddiy dushman rasmlari kattalashtirilib, tilla halqa bilan ishlatiladi — shu bilan ham o'yin to'liq ishlaydi.

## Boshqa qolgan rasmlar (promptlari oldin yozilgan)
- Tog', cho'l va ikki poytaxt tayanchi: `art/promptlar_v3.md`, 12, 14, 15, 16-promptlar.
- Yopiq darvoza: v3, 3-prompt (ixtiyoriy: eshik kod bilan chizilyapti).
- Ekinzor va yaylov foni: `art/promptlar.md`, 6-prompt.
- Dushman qasrining yiqilishi uchun rasm kerak emas: o'yin uni o'zi bo'laklarga bo'lib qulatadi.

---

## 1. Otliq (bizniki)

**Ilova qiling:** `art/otliq_vaqtincha.jpg` va `art/qismlar_amir.webp`.

```
Use the attached image as the strict reference: it shows our cavalryman on a horse.
Create ONE parts sheet of this exact horseman for 2D cut-out (skeletal) animation, laid out as a 5-column x 3-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE: a light cavalryman of our army: steel helmet with a cream cloth wrap, brown leather armor vest over a cream tunic with a red sash, leather bracers, dark trousers, brown boots, a long lance with a small pennant, a small round wooden shield with a metal boss; a brown horse with a red saddle blanket, leather saddle and bridle. The second reference (the Amir parts sheet) shows the exact painting style and clothing look to match.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. LANCE, laid HORIZONTAL across the full width of its cell, steel head on the right, small red pennant near the head, about 130 units long
15. SMALL ROUND SHIELD alone, seen from the side as a thin ellipse with the boss

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Do not redesign the character or add clothing: keep exactly what the reference shows.
```

## 2. Sarkarda: qilichli

**Ilova qiling:** `art/qismlar_qilichli.webp`.

```
Use the attached image as the strict reference: it shows our sword infantry soldier.
Create ONE parts sheet of this exact character as an ELITE OFFICER for 2D cut-out (skeletal) animation, laid out as a 3-column x 3-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE, BUT AS AN ELITE OFFICER (sarkarda): same armor type as the reference, now richer: gold trim and gold rivets, a tall RED PLUME on the helmet, a dark-red cloak with gold embroidery, polished metal. Weapon: sword and round shield.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with the crested helmet and red plume, side view facing right, neck cut flat at the bottom
2. TORSO with the ornate armor, sash and tunic down to the knees as one piece, side view facing right, NO arms, NO head, NO legs, shoulder hole open
3. CLOAK alone, dark red with gold border, hanging straight down, side view facing right
4. ROUND SHIELD alone, seen from the side as a thin ellipse, gold rim and a lion-like boss
5. UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
6. FOREARM with bracer and a CLOSED FIST (nothing in the hand), perfectly VERTICAL, cut flat at the elbow
7. ONE SINGLE THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
8. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
9. ONE sword, laid HORIZONTAL, hilt on the left, blade pointing right, gold guard and pommel

SCALE: all parts at the SAME scale as one standing figure 100 units tall: head 14, torso with tunic 40, upper arm 15, forearm with fist 15, thigh 22, lower leg with boot 28. The officer figure is built exactly like the ordinary soldier, only richer.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
```

## 3. Sarkarda: nayzachi

**Ilova qiling:** `art/qismlar_nayzachi.webp`.

```
Use the attached image as the strict reference: it shows our spearman soldier.
Create ONE parts sheet of this exact character as an ELITE OFFICER for 2D cut-out (skeletal) animation, laid out as a 3-column x 3-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE, BUT AS AN ELITE OFFICER (sarkarda): same armor type as the reference, now richer: gold trim and gold rivets, a tall RED PLUME on the helmet, a dark-red cloak with gold embroidery, polished metal. Weapon: long spear and round shield.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with the crested helmet and red plume, side view facing right, neck cut flat at the bottom
2. TORSO with the ornate armor, sash and tunic down to the knees as one piece, side view facing right, NO arms, NO head, NO legs, shoulder hole open
3. CLOAK alone, dark red with gold border, hanging straight down, side view facing right
4. ROUND SHIELD alone, seen from the side as a thin ellipse, gold rim
5. UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
6. FOREARM with bracer and a CLOSED FIST (nothing in the hand), perfectly VERTICAL, cut flat at the elbow
7. ONE SINGLE THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
8. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
9. ONE long spear, laid HORIZONTAL across the full width of its cell, steel spearhead on the right, red tassel below the head, about 130 units long

SCALE: all parts at the SAME scale as one standing figure 100 units tall: head 14, torso with tunic 40, upper arm 15, forearm with fist 15, thigh 22, lower leg with boot 28. The officer figure is built exactly like the ordinary soldier, only richer.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
```

## 4. Sarkarda: kamonchi

**Ilova qiling:** `art/qismlar_kamonchi.webp`.

```
Use the attached image as the strict reference: it shows our archer soldier.
Create ONE parts sheet of this exact character as an ELITE OFFICER for 2D cut-out (skeletal) animation, laid out as a 4-column x 3-row grid (the last two cells stay empty).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE, BUT AS AN ELITE OFFICER (sarkarda): same armor type as the reference, now richer: gold trim and gold rivets, a tall RED PLUME on the helmet, a dark-red cloak with gold embroidery, polished metal. Weapon: recurve bow and quiver.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with the crested helmet and red plume, side view facing right, neck cut flat at the bottom
2. TORSO with the ornate armor, sash and tunic down to the knees as one piece, side view facing right, NO arms, NO head, NO legs, shoulder hole open
3. CLOAK alone, dark red with gold border, hanging straight down, side view facing right
4. QUIVER with arrows, upright, alone, ornate leather with gold
5. UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
6. FOREARM with bracer and a CLOSED FIST (nothing in the hand), perfectly VERTICAL, cut flat at the elbow
7. ONE SINGLE THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
8. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
9. RECURVE BOW with string, upright, curve bulging to the right, decorated with gold
10. ONE arrow laid HORIZONTAL, arrowhead on the right, feathers on the left

SCALE: all parts at the SAME scale as one standing figure 100 units tall: head 14, torso with tunic 40, upper arm 15, forearm with fist 15, thigh 22, lower leg with boot 28, bow height about 62. The officer figure is built exactly like the ordinary soldier, only richer.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
```

## 5. Sarkarda: otliq

**Ilova qiling:** 1-rasm natijasi (bizning otliq varag'i).

```
Use the attached image as the strict reference: it shows our ordinary cavalryman parts sheet.
Create ONE parts sheet of this exact horseman for 2D cut-out (skeletal) animation, laid out as a 4-column x 4-row grid (the last cell stays empty if there are 15 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE, BUT AS AN ELITE CAVALRY OFFICER (sarkarda): same armor type, now richer: gold trim and rivets, a tall RED PLUME on the helmet, a dark-red cloak with gold embroidery; the horse is a powerful dark bay with a red-and-gold saddle blanket and a decorated bridle.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. LANCE, laid HORIZONTAL across the full width of its cell, steel head on the right, red-and-gold pennant, about 130 units long
15. SMALL ROUND SHIELD alone, seen from the side as a thin ellipse, gold rim
16. CLOAK alone, dark red with gold border, hanging straight down, side view facing right

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
```

## 6. Qo'mondon

**Ilova qiling:** 5-rasm natijasi (sarkarda otliq varag'i).

```
Use the attached image as the strict reference: it shows our elite cavalry officer parts sheet.
Create ONE parts sheet of this exact horseman for 2D cut-out (skeletal) animation, laid out as a 6-column x 3-row grid (18 cells, the last cell stays empty if there are 17 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER: the supreme COMMANDER on horseback, the most majestic figure of our army: ornate full armor in cream, red and gold, a helmet with a large red-and-gold crest, a long royal green cloak with gold embroidery, a gilded sword at the belt; the horse is a huge white-and-grey war horse with a rich gold-and-red caparison covering the body and a protective chamfron on the head. Keep the painting style of the reference.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. COMMANDER'S SWORD (long straight sabre with a gilded hilt), laid HORIZONTAL, hilt on the left, blade pointing right
15. ROUND SHIELD alone, seen from the side as a thin ellipse, gilded, with a sun emblem
16. ROYAL CLOAK alone, green with gold embroidery, hanging straight down, side view facing right
17. COMMAND BANNER: a tall pole with a large rectangular red-and-gold flag with a sun emblem, laid HORIZONTAL across the full width of its cell, pole base on the left, flag near the right end

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
```

## 7. Dushman konchi: ko'chmanchi va sovutli

**Ilova qiling:** `art/dushman_qilichli.webp` va `art/qismlar_konchi.webp`.

```
Use the attached image as the strict reference: the first image shows the two enemy factions, the second shows our miner parts sheet (copy its parts layout and its painting style).
Create ONE parts sheet for 2D cut-out (skeletal) animation of an enemy MINER of both factions: the same worker role as our miner, but dressed in each faction's own style (the nomad miner in a fur-trimmed cap and royal-blue quilted coat under a leather apron; the armored-faction miner in a mail coif and royal-blue surcoat under a leather apron, simple iron plates on the forearms), laid out as a 9-column x 2-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

ROW 1 = the NOMAD faction (match the nomad reference): brown pointed cap with fur trim and a tassel, black braid, quilted royal-blue coat with fur trim, brown leather lamellar vest, leather bracers, brown trousers, laced brown boots.
ROW 2 = the ARMORED faction (match the armored reference): steel helmet with face opening and mail coif, steel shoulder and arm plates, mail sleeves, royal-blue surcoat with a belt, mail skirt, steel leg armor, steel boots.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.
Each faction is drawn EXACTLY ONCE: row 1 is ONLY the nomad faction, row 2 is ONLY the armored faction. Do NOT repeat or duplicate a row.

PARTS, in row 1 the nomad parts, in row 2 the armored parts, in the same order, left to right, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with cap or helmet, side view facing right, neck cut flat
2. TORSO with the work clothing and leather apron down to the knees, NO arms, NO head, NO legs, open shoulder hole
3. UPPER ARM in the sleeve, hanging VERTICAL, cut flat at both ends
4. FOREARM with a CLOSED FIST (nothing in the hand), hanging VERTICAL
5. ONE SINGLE THIGH: ONE trouser leg only, hanging VERTICAL
6. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right
7. PICKAXE, laid HORIZONTAL, handle on the left, iron head on the right
8. EMPTY carrying basket with shoulder straps, side view, worn on the back
9. The SAME basket FULL of shiny silver ore chunks, same size

SCALE: all parts at the SAME scale as one standing figure 96 units tall: head 14, torso with apron 38, upper arm 14, forearm with fist 14, thigh 21, lower leg with boot 27. Every limb straight, not bent, not rotated.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Do not redesign the character or add clothing: keep exactly what the reference shows.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 8. Dushman otliq: ko'chmanchi

**Ilova qiling:** `art/qismlar_dushman_qilichli_kochmanchi.webp` va 1-rasm natijasi (bizning otliq varag'i).

```
Use the attached image as the strict reference: the first image shows the nomad soldier (match its clothing and painting), the second shows our cavalry parts sheet (copy its parts layout).
Create ONE parts sheet of this enemy horseman for 2D cut-out (skeletal) animation, laid out as a 5-column x 3-row grid (15 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE FACTION: a light nomad horse warrior: brown pointed cap with fur trim and a tassel, black braid, quilted royal-blue coat with fur trim, brown leather lamellar vest, leather bracers, brown trousers, laced brown boots, a short spear with a blue pennant, a small round blue shield with a gold rim; a sturdy steppe horse in light brown with a blue saddle blanket with fur edge and leather bridle with tassels.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. SHORT SPEAR, laid HORIZONTAL across the full width of its cell, steel head on the right, blue pennant near the head, about 120 units long
15. SMALL ROUND SHIELD alone, seen from the side as a thin ellipse, royal-blue face with a gold rim

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Do not redesign the character or add clothing: keep exactly what the reference shows.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 9. Dushman otliq: sovutli

**Ilova qiling:** `art/qismlar_dushman_qilichli_sovutli.webp` va 1-rasm natijasi.

```
Use the attached image as the strict reference: the first image shows the armored soldier (match its armor and painting), the second shows our cavalry parts sheet (copy its parts layout).
Create ONE parts sheet of this enemy horseman for 2D cut-out (skeletal) animation, laid out as a 5-column x 3-row grid (15 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE FACTION: a heavy armored horse knight: steel helmet with face opening and mail coif, steel shoulder and arm plates, mail sleeves, royal-blue surcoat with a belt, mail skirt, steel leg armor, steel boots, a long lance with a blue pennant, a small round blue shield with a gold rim; a strong dark horse with a royal-blue caparison covering its body and a steel chamfron on its head.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. LANCE, laid HORIZONTAL across the full width of its cell, steel head on the right, blue pennant near the head, about 130 units long
15. SMALL ROUND SHIELD alone, seen from the side as a thin ellipse, royal-blue face with a gold rim

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Do not redesign the character or add clothing: keep exactly what the reference shows.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 10. Dushman sarkarda qilichli (ikki xalq)

**Ilova qiling:** `art/qismlar_dushman_qilichli_kochmanchi.webp` va `art/qismlar_dushman_qilichli_sovutli.webp`.

```
Use the attached image as the strict reference: the first image shows the nomad sword soldier, the second shows the armored sword soldier.
Create ONE parts sheet for 2D cut-out (skeletal) animation of an ELITE OFFICER (sarkarda) sword soldier of both factions, laid out as a 9-column x 2-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

ROW 1 = the NOMAD faction (match the nomad reference): brown pointed cap with fur trim and a tassel, black braid, quilted royal-blue coat with fur trim, brown leather lamellar vest, leather bracers, brown trousers, laced brown boots.
ROW 2 = the ARMORED faction (match the armored reference): steel helmet with face opening and mail coif, steel shoulder and arm plates, mail sleeves, royal-blue surcoat with a belt, mail skirt, steel leg armor, steel boots.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.
Each faction is drawn EXACTLY ONCE: row 1 is ONLY the nomad faction, row 2 is ONLY the armored faction. Do NOT repeat or duplicate a row. The NOMAD officer is richer than the ordinary nomad: gold trim on the coat, a tall red-and-black horsehair plume on the cap, a fur-lined royal-blue cloak with gold stitching. The ARMORED officer is richer than the ordinary one: gold trim on the armor, a tall red plume on the helmet, a royal-blue cloak with gold border.

PARTS, in row 1 the nomad parts, in row 2 the armored parts, in the same order, left to right, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with the cap/helmet and plume, side view facing right, neck cut flat
2. TORSO with coat/surcoat and armor down to the knees as one piece, NO arms, NO head, NO legs, open shoulder hole
3. CLOAK alone, royal-blue with gold border, hanging straight down, side view facing right
4. ROUND SHIELD alone, seen from the side as a thin ellipse, royal-blue face with a gold rim and boss
5. UPPER ARM (with the shoulder plate and mail sleeve for the armored faction), hanging VERTICAL, cut flat at both ends
6. FOREARM with bracer/gauntlet and a CLOSED FIST, hanging VERTICAL
7. ONE SINGLE THIGH: ONE trouser leg or leg armor only, hanging VERTICAL
8. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right
9. ONE sword (curved sabre for the nomads, straight sword for the armored, both with gold guards), laid HORIZONTAL, hilt on the left

SCALE: all parts at the SAME scale as one standing figure 100 units tall: head 14, torso 40, upper arm 15, forearm with fist 15, thigh 22, lower leg with boot 28. Every limb straight, not bent, not rotated.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 11. Dushman sarkarda nayzachi (ikki xalq)

**Ilova qiling:** `art/qismlar_dushman_nayzachi.webp`.

```
Use the attached image as the strict reference: it shows the nomad spearman (row 1) and the armored spearman (row 2).
Create ONE parts sheet for 2D cut-out (skeletal) animation of an ELITE OFFICER (sarkarda) spearman of both factions, laid out as a 9-column x 2-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

ROW 1 = the NOMAD faction (match the nomad reference): brown pointed cap with fur trim and a tassel, black braid, quilted royal-blue coat with fur trim, brown leather lamellar vest, leather bracers, brown trousers, laced brown boots.
ROW 2 = the ARMORED faction (match the armored reference): steel helmet with face opening and mail coif, steel shoulder and arm plates, mail sleeves, royal-blue surcoat with a belt, mail skirt, steel leg armor, steel boots.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.
Each faction is drawn EXACTLY ONCE: row 1 is ONLY the nomad faction, row 2 is ONLY the armored faction. Do NOT repeat or duplicate a row. The NOMAD officer is richer than the ordinary nomad: gold trim on the coat, a tall red-and-black horsehair plume on the cap, a fur-lined royal-blue cloak with gold stitching. The ARMORED officer is richer than the ordinary one: gold trim on the armor, a tall red plume on the helmet, a royal-blue cloak with gold border.

PARTS, in row 1 the nomad parts, in row 2 the armored parts, in the same order, left to right, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with the cap/helmet and plume, side view facing right, neck cut flat
2. TORSO with coat/surcoat and armor down to the knees as one piece, NO arms, NO head, NO legs, open shoulder hole
3. CLOAK alone, royal-blue with gold border, hanging straight down, side view facing right
4. ROUND SHIELD alone, seen from the side as a thin ellipse, royal-blue face with a gold rim
5. UPPER ARM (with the shoulder plate and mail sleeve for the armored faction), hanging VERTICAL, cut flat at both ends
6. FOREARM with bracer/gauntlet and a CLOSED FIST, hanging VERTICAL
7. ONE SINGLE THIGH: ONE trouser leg or leg armor only, hanging VERTICAL
8. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right
9. ONE long spear laid HORIZONTAL across the full width of its cell, steel head on the right, red tassel below the head, about 130 units long

SCALE: all parts at the SAME scale as one standing figure 100 units tall: head 14, torso 40, upper arm 15, forearm with fist 15, thigh 22, lower leg with boot 28. Every limb straight, not bent, not rotated.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 12. Dushman sarkarda kamonchi (ikki xalq)

**Ilova qiling:** `art/qismlar_dushman_kamonchi.webp`.

```
Use the attached image as the strict reference: it shows the nomad archer (row 1) and the armored archer (row 2).
Create ONE parts sheet for 2D cut-out (skeletal) animation of an ELITE OFFICER (sarkarda) archer of both factions, laid out as a 10-column x 2-row grid.
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

ROW 1 = the NOMAD faction (match the nomad reference): brown pointed cap with fur trim and a tassel, black braid, quilted royal-blue coat with fur trim, brown leather lamellar vest, leather bracers, brown trousers, laced brown boots.
ROW 2 = the ARMORED faction (match the armored reference): steel helmet with face opening and mail coif, steel shoulder and arm plates, mail sleeves, royal-blue surcoat with a belt, mail skirt, steel leg armor, steel boots.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.
Each faction is drawn EXACTLY ONCE: row 1 is ONLY the nomad faction, row 2 is ONLY the armored faction. Do NOT repeat or duplicate a row. The NOMAD officer is richer than the ordinary nomad: gold trim on the coat, a tall red-and-black horsehair plume on the cap, a fur-lined royal-blue cloak with gold stitching. The ARMORED officer is richer than the ordinary one: gold trim on the armor, a tall red plume on the helmet, a royal-blue cloak with gold border.

PARTS, in row 1 the nomad parts, in row 2 the armored parts, in the same order, left to right, each fully separated with large empty space around it, nothing overlapping or touching:
1. HEAD with the cap/helmet and plume, side view facing right, neck cut flat
2. TORSO with coat/surcoat and armor down to the knees as one piece, NO arms, NO head, NO legs, open shoulder hole
3. CLOAK alone, royal-blue with gold border, hanging straight down, side view facing right
4. QUIVER with arrows, upright, alone, ornate
5. UPPER ARM (with the shoulder plate and mail sleeve for the armored faction), hanging VERTICAL, cut flat at both ends
6. FOREARM with bracer/gauntlet and a CLOSED FIST, hanging VERTICAL
7. ONE SINGLE THIGH: ONE trouser leg or leg armor only, hanging VERTICAL
8. ONE SINGLE LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right
9. RECURVE BOW with string, upright, curve bulging to the right, decorated with gold
10. ONE arrow laid HORIZONTAL, arrowhead on the right, feathers on the left

SCALE: all parts at the SAME scale as one standing figure 100 units tall: head 14, torso 40, upper arm 15, forearm with hand 15, thigh 22, lower leg with boot 28. Bow height about 62. Every limb straight, not bent, not rotated.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 13. Dushman sarkarda otliq: ko'chmanchi

**Ilova qiling:** 8-rasm natijasi va 5-rasm natijasi.

```
Use the attached image as the strict reference: the first image shows the ordinary nomad horseman parts sheet, the second shows our elite cavalry officer parts sheet (copy its richness).
Create ONE parts sheet of this enemy horseman for 2D cut-out (skeletal) animation, laid out as a 4-column x 4-row grid (16 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE FACTION, BUT AS: an ELITE NOMAD CAVALRY OFFICER (sarkarda): richer than the ordinary nomad horseman: gold trim on the royal-blue coat, a tall red-and-black horsehair plume on the cap, a fur-lined royal-blue cloak with gold stitching; a powerful dark steppe horse with a royal-blue-and-gold saddle blanket and a decorated bridle.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. SHORT SPEAR, laid HORIZONTAL across the full width of its cell, steel head on the right, blue-and-gold pennant, about 120 units long
15. SMALL ROUND SHIELD alone, seen from the side as a thin ellipse, royal-blue face with a gold rim
16. CLOAK alone, royal-blue with gold border, hanging straight down, side view facing right

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 14. Dushman sarkarda otliq: sovutli

**Ilova qiling:** 9-rasm natijasi va 5-rasm natijasi.

```
Use the attached image as the strict reference: the first image shows the ordinary armored horseman parts sheet, the second shows our elite cavalry officer parts sheet (copy its richness).
Create ONE parts sheet of this enemy horseman for 2D cut-out (skeletal) animation, laid out as a 4-column x 4-row grid (16 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE FACTION, BUT AS: an ELITE ARMORED CAVALRY OFFICER (sarkarda): richer than the ordinary armored horseman: gold trim on the armor, a tall red plume on the helmet, a royal-blue cloak with gold border; a powerful black horse with a royal-blue-and-gold caparison and a steel chamfron.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. LANCE, laid HORIZONTAL across the full width of its cell, steel head on the right, blue-and-gold pennant, about 130 units long
15. SMALL ROUND SHIELD alone, seen from the side as a thin ellipse, royal-blue face with a gold rim
16. CLOAK alone, royal-blue with gold border, hanging straight down, side view facing right

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 15. Dushman qo'mondon: ko'chmanchi

**Ilova qiling:** 13-rasm natijasi va 6-rasm natijasi.

```
Use the attached image as the strict reference: the first image shows the nomad elite officer parts sheet, the second shows our commander parts sheet (copy its majesty).
Create ONE parts sheet of this enemy horseman for 2D cut-out (skeletal) animation, laid out as a 6-column x 3-row grid (18 cells, the last cell stays empty if there are 17 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE FACTION, BUT AS: the supreme NOMAD KHAN-COMMANDER on horseback, the most fearsome figure of the enemy nomads: ornate lamellar armor with gold plates under a royal-blue fur-trimmed coat, a tall pointed golden helmet with a long black horsehair plume, a long royal-blue cloak with gold embroidery; a huge dark war horse with a royal-blue-and-gold caparison and a decorated chamfron.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. COMMANDER'S CURVED SABRE with a gilded hilt, laid HORIZONTAL, hilt on the left, blade pointing right
15. ROUND SHIELD alone, seen from the side as a thin ellipse, gilded rim, royal-blue face with a horsehead emblem
16. ROYAL CLOAK alone, royal-blue with gold embroidery, hanging straight down, side view facing right
17. COMMAND BANNER: a tall pole with a large royal-blue-and-gold flag with a horsehead emblem and hanging horsehair tassels, laid HORIZONTAL across the full width of its cell

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## 16. Dushman qo'mondon: sovutli

**Ilova qiling:** 14-rasm natijasi va 6-rasm natijasi.

```
Use the attached image as the strict reference: the first image shows the armored elite officer parts sheet, the second shows our commander parts sheet (copy its majesty).
Create ONE parts sheet of this enemy horseman for 2D cut-out (skeletal) animation, laid out as a 6-column x 3-row grid (18 cells, the last cell stays empty if there are 17 parts).
Painted realistic style, same as the reference image. Flat light-gray background, no shadows, no ground, soft even lighting.

CHARACTER MUST STAY IDENTICAL TO THE REFERENCE FACTION, BUT AS: the supreme ARMORED COMMANDER on horseback, the most fearsome figure of the enemy knights: gleaming full plate armor with a royal-blue surcoat, a great helmet with a tall red-and-gold crest, a long royal-blue cloak with gold embroidery; a huge black war horse with a royal-blue-and-gold caparison down to the knees and a full steel chamfron.
COLOR RULE: all cloth parts (coat, surcoat, sleeves, cloak, shield face, horse blanket, banner) must be a PURE SATURATED ROYAL BLUE (#1f3fd0), flat and clean, with no other blue anywhere else. The game recolors it.

PARTS, each part in its own grid cell, left to right, row by row, each fully separated with large empty space around it, nothing overlapping or touching:
1. HORSE BODY: the barrel of the horse with saddle, saddle blanket and girth, side view facing right, NO head, NO neck, NO legs, NO tail; plain cut where they join
2. HORSE NECK AND HEAD with mane and bridle, one piece, side view facing right, neck base cut flat
3. HORSE TAIL alone, hanging straight down
4. HORSE FORELEG UPPER (shoulder to knee), hanging perfectly VERTICAL, cut flat at both ends
5. HORSE FORELEG LOWER (knee to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
6. HORSE HINDLEG UPPER (thigh to hock), hanging perfectly VERTICAL, cut flat at both ends
7. HORSE HINDLEG LOWER (hock to hoof) with hoof, perfectly VERTICAL, hoof flat at the bottom, toe pointing right
8. RIDER HEAD with helmet, side view facing right, neck cut flat at the bottom
9. RIDER TORSO with armor and tunic down to the waist, side view facing right, NO arms, NO head, NO legs, open shoulder hole
10. RIDER UPPER ARM in the sleeve, hanging perfectly VERTICAL, cut flat at shoulder and elbow
11. RIDER FOREARM with the bracer and a CLOSED FIST (holding a shaft, nothing in the hand), perfectly VERTICAL, cut flat at the elbow
12. RIDER THIGH: ONE trouser leg only (NOT a pair), perfectly VERTICAL, cut flat at hip and knee
13. RIDER LOWER LEG: ONE boot with the shin, VERTICAL, toe pointing right, cut flat at the knee
14. COMMANDER'S LONG SWORD with a gilded hilt, laid HORIZONTAL, hilt on the left, blade pointing right
15. ROUND SHIELD alone, seen from the side as a thin ellipse, gilded rim, royal-blue face with a crown emblem
16. ROYAL CLOAK alone, royal-blue with gold embroidery, hanging straight down, side view facing right
17. COMMAND BANNER: a tall pole with a large royal-blue-and-gold flag with a crown emblem, laid HORIZONTAL across the full width of its cell

SCALE: all parts at the SAME scale as one standing figure 100 units tall: horse body 62 long and 30 tall, neck and head 40 long, tail 28, foreleg upper 22, foreleg lower 24, hindleg upper 26, hindleg lower 26, rider head 14, rider torso 36, rider upper arm 15, rider forearm with fist 15, rider thigh 22, rider lower leg with boot 28.
Every part is in pure SIDE view facing RIGHT. Every limb is perfectly straight and VERTICAL (hanging down), not bent, not rotated, not in a walking pose. Keep the reference's armor type, proportions and painting style; the only new things are the richer details described above.
The TORSO has NO arm, NO sleeve, NO shoulder plate, NO pauldron attached: only the chest piece with an open empty shoulder hole. Shoulder plates and mail sleeves belong to the UPPER ARM part.
```

## Tekshirish (har rasmdan keyin)
- Hamma bo'laklar bor va bir-biriga tegmaydimi? Soni to'g'rimi (9, 10, 15, 16 yoki 17)?
- Hammasi **o'ngga qaragan**, qo'l-oyoq **tik** (egilmagan)mi?
- Shim va etik **bitta pochali**mi? Qo'l **mushtlanganmi**?
- Gavdada qo'l, yelka plastinasi yoki yeng **qolmaganmi**?
- Dushmanda mato **sof ko'k**mi, boshqa joyda ko'k yo'qmi? Har xalq **bir marta** chizilganmi?
- Otda: oyoqlar tanadan **alohida**, bosh-bo'yin **bitta bo'lak**, dum **alohida**mi?
