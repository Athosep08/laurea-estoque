import { useEffect, useState } from 'react';

/**
 * Reflete `navigator.onLine`. Usado para bloquear ações de escrita quando o
 * dispositivo está offline — combinado com o service worker (que mantém as
 * leituras recentes em cache), o app funciona offline em modo somente
 * leitura, mas nunca deixa registrar venda/produção/ajuste sem conexão.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
