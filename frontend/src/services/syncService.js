import {
  obtenerReportesPendientes,
  eliminarReportePendiente,
  guardarCatalogosCache
} from '../db/indexedDB';
import { enviarReporteAPI, fetchCatalogosOffline } from './api';

/**
 * Sincroniza los catálogos de sectores y modelos con el backend para tenerlos offline.
 */
export async function sincronizarCatalogos() {
  try {
    const data = await fetchCatalogosOffline();
    if (data && data.sectores && data.modelos) {
      await guardarCatalogosCache(data.sectores, data.modelos, data.servidor_timestamp_gmt3);
      return { ok: true, data };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Sincroniza todos los reportes pendientes almacenados en IndexedDB hacia la PC central.
 */
export async function sincronizarReportesPendientes(onProgreso = null) {
  const pendientes = await obtenerReportesPendientes();
  if (pendientes.length === 0) {
    return { total: 0, sincronizados: 0, fallidos: 0, pendientesRestantes: 0 };
  }

  let sincronizados = 0;
  let fallidos = 0;

  for (let i = 0; i < pendientes.length; i++) {
    const reporte = pendientes[i];
    try {
      if (onProgreso) {
        onProgreso({ actual: i + 1, total: pendientes.length, reporte });
      }

      await enviarReporteAPI(reporte);

      // Si el envío fue exitoso (o ya existía en backend por idempotencia), lo borramos de IndexedDB
      await eliminarReportePendiente(reporte.client_uuid);
      sincronizados++;
    } catch (err) {
      console.error(`Error al sincronizar reporte ${reporte.client_uuid}:`, err);
      fallidos++;
      // Si la falla es por corte de red total, frenamos el bucle para no reintentar en vano
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        break;
      }
    }
  }

  // Refrescar también los catálogos si hay conexión
  try {
    await sincronizarCatalogos();
  } catch (_) {}

  const pendientesRestantes = pendientes.length - sincronizados;
  return {
    total: pendientes.length,
    sincronizados,
    fallidos,
    pendientesRestantes
  };
}
