// Telegram Mini App bilan ishlash. Oddiy brauzerda ochilsa ham o'yin ishlayveradi (Telegram qismi jim turadi).

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser };
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  isVersionAtLeast(v: string): boolean;
  ready(): void;
  expand(): void;
  requestFullscreen?(): void;
  lockOrientation?(): void;
  unlockOrientation?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  onEvent(name: string, cb: () => void): void;
  CloudStorage: {
    setItem(key: string, value: string, cb?: (err: unknown, ok?: boolean) => void): void;
    getItem(key: string, cb: (err: unknown, value?: string) => void): void;
  };
  HapticFeedback?: { impactOccurred(style: 'light' | 'medium' | 'heavy'): void };
}

const raw = typeof window === 'undefined' ? undefined : (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
// initData bo'sh bo'lsa — o'yin Telegram ichida emas
export const tg: TgWebApp | null = raw && raw.initData ? raw : null;

function landscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

function applySafeArea(): void {
  const a = tg?.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const c = tg?.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const st = document.documentElement.style;
  st.setProperty('--safe-top', `${a.top + c.top}px`);
  st.setProperty('--safe-bottom', `${a.bottom + c.bottom}px`);
  st.setProperty('--safe-left', `${a.left + c.left}px`);
  st.setProperty('--safe-right', `${a.right + c.right}px`);
}

export function initTelegram(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.('#1c140c');
  tg.setBackgroundColor?.('#1c140c');
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
  if (tg.isVersionAtLeast('8.0')) {
    tg.requestFullscreen?.();
    // Gorizontal holatda qulflaymiz; vertikal ochilgan bo'lsa, burilishini kutamiz
    const lock = () => {
      if (landscape()) tg!.lockOrientation?.();
    };
    lock();
    window.addEventListener('resize', lock);
    tg.onEvent('safeAreaChanged', applySafeArea);
    tg.onEvent('contentSafeAreaChanged', applySafeArea);
    tg.onEvent('fullscreenChanged', applySafeArea);
  }
  applySafeArea();
}

export interface Profile {
  name: string;
  id: string;
  photo: string | null;
}

export function profile(): Profile {
  const u = tg?.initDataUnsafe.user;
  if (u) {
    return {
      name: [u.first_name, u.last_name].filter(Boolean).join(' '),
      id: String(u.id),
      photo: u.photo_url ?? null,
    };
  }
  // Telegramdan tashqarida: mehmon raqami
  let id = '';
  try {
    id = localStorage.getItem('umar-guest-id') ?? '';
    if (!id) {
      id = String(Math.floor(100000 + Math.random() * 900000));
      localStorage.setItem('umar-guest-id', id);
    }
  } catch {
    id = '000000';
  }
  return { name: 'Mehmon', id, photo: null };
}

// Telegram bulutli xotirasi (har foydalanuvchiga alohida, server kerak emas)
function cloudReady(): boolean {
  return !!tg && tg.isVersionAtLeast('6.9');
}

export function cloudGet(key: string): Promise<string | null> {
  if (!cloudReady()) return Promise.resolve(null);
  return new Promise((res) => {
    const timer = setTimeout(() => res(null), 3000);
    tg!.CloudStorage.getItem(key, (err, value) => {
      clearTimeout(timer);
      res(err || !value ? null : value);
    });
  });
}

export function cloudSet(key: string, value: string): void {
  if (!cloudReady()) return;
  tg!.CloudStorage.setItem(key, value);
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  tg?.HapticFeedback?.impactOccurred(style);
}
