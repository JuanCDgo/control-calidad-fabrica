import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from '../services/api';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendReachable, setBackendReachable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    if (!navigator.onLine) {
      setIsOnline(false);
      setBackendReachable(false);
      setIsChecking(false);
      return false;
    }

    const res = await checkBackendHealth();
    setIsOnline(true);
    setBackendReachable(res.ok);
    setIsChecking(false);
    return res.ok;
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setBackendReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Chequeo inicial
    checkConnection();

    // Sondeo suave cada 20 segundos para verificar si la PC central responde en la LAN
    const interval = setInterval(checkConnection, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  return {
    isOnline,
    backendReachable,
    isChecking,
    checkConnection
  };
}
