# Rasmlar (assets)

Bu papkadagi rasmlar `art/` dagi asl rasmlardan avtomatik tayyorlangan:

```bash
pip install rembg onnxruntime scipy pillow numpy
python tools/prepare_assets.py
```

Skript kulrang fonni olib tashlaydi, 4 bosqichli varaqlarni alohida figuralarga bo'ladi,
portretlarni qirqadi, WebP qilib shu yerga yozadi va `manifest.json` ni yangilaydi.
Umumiy xaritadan `src/world/mapData.json` (relyef, viloyatlar, qal'alar) ham yasaladi.

Rasm topilmagan joylarni o'yin o'zi (kod bilan) chizadi. Qo'lda rasm qo'shish uchun:

1. Rasm faylini shu papkaga (`public/assets/`) qo'ying — PNG (shaffof fon) yoki WebP.
2. `manifest.json` ga kalit va fayl nomini yozing.

```json
{
  "core_1": "qala_1.png",
  "core_2": "qala_2.png",
  "unit_piyoda": "askar.png",
  "portrait_amir": "amir.png"
}
```

Kengaytirilgan yozuv ham mumkin (o'lcham va joylashuvni sozlash uchun):

```json
{ "core_4": { "file": "qala_4.png", "scale": 1.3, "anchorY": 0.85 } }
```

- `scale` — plita eniga nisbatan rasm eni (1 = bitta plita eni, standart 1.1).
- `anchorY` — rasmning qaysi balandligi plita markaziga tushadi (0 = tepasi, 1 = pastki qirrasi; standart 0.85).

## Kalitlar ro'yxati

### Xarita binolari (izometrik, 2:1 romb plitaga mos)

| Kalit | Nima |
|---|---|
| `core_1` … `core_4` | O'yinchi qarorgohi, 4 bosqich: tosh qal'acha-uycha, minorali uy, ikki minorali qo'rg'on, kichik qal'a |
| `ai_core_1` … `ai_core_4` | AI davlatcha poytaxti (bo'lmasa `core_N` ishlatiladi) |
| `capital_rim`, `capital_fors` | Imperiya poytaxtlari (Rim nusxasi, Fors nusxasi) |
| `city_rim`, `city_fors` | Imperiya shaharlari |
| `farm`, `farm_arpa` | Ekinzor (bug'doy / arpa) |
| `pasture` | Yaylov (qo'ra) |
| `mine` | Kon |
| `tower` | Kuzatuv minorasi |
| `fort` | Devor va qal'a |
| `map_background` | Umumiy xarita (o'yin xaritasi shu rasm; to'r va viloyatlar `tools/build_map.py` bilan yasaladi) |

### Jang maydonidagi askarlar

Har bir askar uchun 4 ko'rinish bosqichi: `unit_<tur>_1` … `unit_<tur>_4`
(daraja 1-3, 4-6, 7-9, 10). Bosqichli rasm bo'lmasa `unit_<tur>` ishlatiladi.

`unit_piyoda`, `unit_kamonchi`, `unit_nayzachi`, `unit_otliq`, `unit_zirhli_otliq`, `unit_zirhli_nayzachi`,
`unit_amir`, `unit_qomondon`, `unit_sarkarda_otliq`, `unit_sarkarda_nayzachi`, `unit_sarkarda_kamonchi`, `unit_sarkarda_piyoda`

### Panellardagi portretlar (kvadrat)

`portrait_<askar turi>` (masalan `portrait_amir`, `portrait_qomondon`) va
`portrait_dehqon`, `portrait_chopon`, `portrait_konchi`; bosqichlilari `portrait_<tur>_<1..4>`.
Portret berilmasa `unit_…` rasmi, u ham bo'lmasa emoji ishlatiladi.
