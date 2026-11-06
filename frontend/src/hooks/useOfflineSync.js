import { useState, useEffect, useCallback } from 'react';
import { contarReportesPendientes } from '../db/indexedDB';
import { sincronizarReportesPendientes, sincronizarCatalogos } from '../services/syncService';

export function useOfflineSync(backendReachable) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await contarReportesPendientes();
      setPendingCount(count);
    } catch (err) {
      console.error('Error al contar pendientes en IndexedDB:', err);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(null);

    try {
      const resultado = await sincronizarReportesPendientes((progreso) => {
        setSyncProgress(progreso);
      });
      setLastSyncResult(resultado);
      await refreshPendingCount();
      return resultado;
    } catch (err) {
      console.error('Error durante sincronización:', err);
      setLastSyncResult({ error: err.message });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [isSyncing, refreshPendingCount]);

  // Al montar o cuando se recupera conectividad con la PC central
  useEffect(() => {
    refreshPendingCount();

    if (backendReachable) {
      // Intentar sincronizar catálogos y reportes pendientes al reconectar
      sincronizarCatalogos();
      contarReportesPendientes().then((count) => {
        if (count > 0) {
          triggerSync();
        }
      });
    }
  }, [backendReachable, refreshPendingCount, triggerSync]);

  return {
    pendingCount,
    isSyncing,
    syncProgress,
    lastSyncResult,
    triggerSync,
    refreshPendingCount
  };
}
