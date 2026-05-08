import { useEffect } from 'react';

const tg = typeof window !== 'undefined' && window.Telegram?.WebApp ? window.Telegram.WebApp : null;
const user = tg?.initDataUnsafe?.user ?? null;
const initData = tg?.initData ?? '';
const colorScheme = tg?.colorScheme ?? 'light';

export function useTelegram() {
  useEffect(() => {
    if (!tg) {
      return;
    }

    tg.ready();
    tg.expand();
  }, []);
}

export { tg, user, initData, colorScheme };
