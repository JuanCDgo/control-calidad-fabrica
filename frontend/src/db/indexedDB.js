import { openDB } from 'idb';

const DB_NAME = 'CalidadFabrica_DB';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Almacén de reportes pendientes de sincronizar
      if (!db.objectStoreNames.contains('reportes_pendientes')) {
        const store = db.createObjectStore('reportes_pendientes', {
          keyPath: 'client_uuid'
        });
        store.createIndex('fecha_captura', 'fecha_captura_local');
      }

      // 2. Almacén de catálogos (Sectores y Modelos) cacheados para uso offline
      if (!db.objectStoreNames.contains('catalogos_cache')) {
        db.createObjectStore('catalogos_cache', { keyPath: 'clave' });
      }
    }
  });
}

// --- REPORTES PENDIENTES ---

export async function guardarReportePendiente(reporte) {
  const db = await getDB();
  return db.put('reportes_pendientes', reporte);
}

export async function obtenerReportesPendientes() {
  const db = await getDB();
  return db.getAll('reportes_pendientes');
}

export async function eliminarReportePendiente(client_uuid) {
  const db = await getDB();
  return db.delete('reportes_pendientes', client_uuid);
}

export async function contarReportesPendientes() {
  const db = await getDB();
  return db.count('reportes_pendientes');
}

// --- CATÁLOGOS CACHEADOS ---

export async function guardarCatalogosCache(sectores, modelos, timestamp) {
  const db = await getDB();
  const tx = db.transaction('catalogos_cache', 'readwrite');
  await Promise.all([
    tx.store.put({ clave: 'sectores', data: sectores, timestamp }),
    tx.store.put({ clave: 'modelos', data: modelos, timestamp }),
    tx.done
  ]);
}

export async function obtenerCatalogosCache() {
  const db = await getDB();
  const [sectoresItem, modelosItem] = await Promise.all([
    db.get('catalogos_cache', 'sectores'),
    db.get('catalogos_cache', 'modelos')
  ]);

  return {
    sectores: sectoresItem ? sectoresItem.data : [],
    modelos: modelosItem ? modelosItem.data : [],
    timestamp: sectoresItem ? sectoresItem.timestamp : null
  };
}
