/**
 * Tayyor rasmlar uchun slot tizimi.
 *
 * `public/assets/manifest.json` ichida kalit -> fayl nomi yoziladi, masalan:
 *   { "core_1": "qala_1.png", "unit_piyoda": "askar.png" }
 * Rasm berilmagan kalitlar uchun o'yin rasmni o'zi (kod bilan) chizadi.
 * Kalitlar ro'yxati: public/assets/README.md
 */

export interface AssetSpec {
  file: string;
  /** Rasm pastki markazi plita markaziga nisbatan qanchaga tushadi (0..1, rasm balandligiga nisbatan). */
  anchorY?: number;
  /** Plita kengligiga nisbatan o'lcham (1 = plita kengligi). */
  scale?: number;
}

const images = new Map<string, { img: HTMLImageElement; spec: AssetSpec }>();

export async function loadAssets(): Promise<number> {
  let manifest: Record<string, string | AssetSpec> = {};
  try {
    const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch {
    // manifest yo'q — hammasi kod bilan chiziladi
  }
  const entries = Object.entries(manifest).filter(([k]) => !k.startsWith('_'));
  await Promise.all(
    entries.map(
      ([key, v]) =>
        new Promise<void>((resolve) => {
          const spec: AssetSpec = typeof v === 'string' ? { file: v } : v;
          const img = new Image();
          img.onload = () => {
            images.set(key, { img, spec });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = 'assets/' + spec.file;
        }),
    ),
  );
  return images.size;
}

export function getAsset(key: string): { img: HTMLImageElement; spec: AssetSpec } | null {
  return images.get(key) ?? null;
}

export function hasAsset(key: string): boolean {
  return images.has(key);
}
