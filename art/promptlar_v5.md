# Rasm promptlari (5-bosqich): shablon ustiga bo'yash

Yangi dizayn: askar Stick War Legacy uslubida — tanasi qora, ustida tarixiy kiyim. Askar bo'laklarga
ajratilgan qo'g'irchoq: bosh, gavda, yeng, bilak, son, etik, etak, plash va qurol alohida chiziladi, o'yin ularni
bo'g'imlardan yig'ib harakatlantiradi.

Bo'laklarning o'lchami, joyi va bo'g'imlari **shablonda** belgilangan (`tools/shablon.py` yasaydi). ChatGPT
faqat shablon ustiga bo'yaydi, shuning uchun bo'laklar yig'ilganda bir-biriga aniq mos keladi.

## Qanday ishlatiladi
1. ChatGPT'da **yangi suhbat** oching.
2. **Faqat bitta rasm** ilova qiling: `art/shablon/qilichli.png`. Eski varaqlarni ilova qilmang — ChatGPT ularni
   qayta chizib qo'yadi.
3. Pastdagi promptni yuboring.
4. Natijani tekshirish: `python3 tools/shablon.py --tekshir natija.png` — har bo'lak shablondagi joyi va
   o'lchamidan qanchalik siljiganini ko'rsatadi.
5. Kiyim namunaga o'xshamasa, **shu suhbatda** eng birinchi realistik rasmni ilova qilib so'rang:
   *"same template, costume reference only, keep every piece exactly in place"*.

Shablon ranglari: kulrang — kiyim, to'q kulrang — yashirin uch (qo'shni bo'lak ostida qoladi, bezaksiz
bo'yaladi), qora — teri, oqish — temir. Yig'ilgan askar uch pozada: `art/shablon/qilichli_pozalar.png`.

## Qilichli

```
The attached image is an exact LAYOUT TEMPLATE for a 2D cut-out animation puppet of one soldier (side view, facing right), split into separate pieces. Paint the costume described below onto the template.

TEMPLATE RULES (most important)
- Keep every piece exactly where it is, exactly this size and exactly this silhouette. Do not move, enlarge, shrink, rotate, add, merge or remove any piece. The result must lie exactly on top of the template.
- Black areas = the soldier's skin (head, neck, fist). Keep them matte black. Add two small white eye glints on the right (front) side of the black head, just below the headgear.
- Light grey areas = paint the garment or item there. Small folds and fringe may go past the outline by a few pixels at most.
- Dark grey areas = hidden overlap zones (they end up under a neighbouring piece). Paint them in the plain base colour of that garment: no ornaments, no buckles, no outline across them.
- Whitish areas on the saber, scabbard and cape clasp = metal (steel blade, brass fittings).
- Keep the flat magenta background (#FF00FF) everywhere else. No shadows, no text, no lines, no extra objects.

STYLE
Like the heroes of "Stick War: Legacy": a slim stylized soldier with matte-black skin, wearing detailed, slightly chunky, hand-painted historical clothing of medieval Central Asia (14th–15th century). Clean dark outline, soft cel shading, light from the upper left. Not photorealistic, not anime, not chibi.

PIECES (as placed in the template)
- Centre column, top — head: cream turban with a dark-red cap on top fills the grey dome; cream face veil covers the lower front of the black head (nose and mouth); the black neck below stays plain black.
- Centre column, second — tunic top: cream tunic with dark-red ornamental borders along the front opening, sleeveless; its lower part is a wide dark-red sash with brass-buckled leather belts.
- Centre column, third — trouser thigh: baggy brown-grey trouser, gathered into a cuff at the bottom.
- Centre column, bottom — boot: brown leather boot, toe to the right, flat sole.
- Left of the centre, upper — skirt FRONT half: cream, dark-red ornamental border along its right edge and along the hem, short fringe at the hem.
- Left of the centre, lower — skirt BACK half: cream, dark-red ornamental border along its left edge and along the hem, short fringe at the hem.
- Far left — cape: olive green, red-and-cream ornamental border along the back edge and the bottom, short fringe at the bottom, round brass clasp at the top.
- Right of the centre, upper — upper sleeve: cream sleeve with a dark-red ornamental cuff at the bottom.
- Right of the centre, lower — forearm: brown leather bracer with a red cuff at the wrist; the black fist below stays plain black.
- Far right, upper — saber (shamshir): curved steel blade pointing up, brass guard and pommel, leather grip.
- Far right, lower — empty scabbard: brown leather, brass throat at the top and brass tip, no strap.
```

Rasm kelgach tekshiring: bo'laklar 11 ta va shablondagi joyida; yashirin (to'q kulrang) joylar bezaksiz;
qora joylar qoraligicha qolgan; fon bir tekis pushti.
