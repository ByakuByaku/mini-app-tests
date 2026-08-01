import WebApp from '@twa-dev/sdk';
import { useEffect } from 'react';

export function useTelegram() {
  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
  }, []);

  return {
    initData: WebApp.initData,
    user: WebApp.initDataUnsafe.user,
    hapticFeedback: WebApp.HapticFeedback,
  };
}
