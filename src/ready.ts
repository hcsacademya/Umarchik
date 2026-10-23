// Rasm chizishga tayyormi (yuklangan yoki kanvas). Alohida faylda: skelet kodi DOM'siz (Node'da) ham ishlasin
export function ready(img: HTMLImageElement | HTMLCanvasElement): boolean {
  if (!('complete' in img)) return true; // kanvas
  return img.complete && img.naturalWidth > 0;
}
