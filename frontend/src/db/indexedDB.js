import { openDB } from 'idb';

const DB_NAME = 'CalidadFabrica_DB';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('reportes_pendientes')) {
        const store = db.createObjectStore('reportes_pendientes', {
          keyPath: 'client_uuid'
        });
        store.createIndex('fecha_captura', 'fecha_captura_local');
      }

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

export async function guardarCatalogosCache(
  sectores,
  modelos,
  timestamp,
  categorias = [],
  encargados = [],
  tipos_problema = [],
  impactos = ['FALTA', 'SOBRA', 'DEFECTO', 'OTRO'],
  estados = ['Abierto', 'En Proceso', 'Resuelto']
) {
  const db = await getDB();
  const tx = db.transaction('catalogos_cache', 'readwrite');
  await Promise.all([
    tx.store.put({ clave: 'sectores', data: sectores, timestamp }),
    tx.store.put({ clave: 'categorias', data: categorias, timestamp }),
    tx.store.put({ clave: 'modelos', data: modelos, timestamp }),
    tx.store.put({ clave: 'encargados', data: encargados, timestamp }),
    tx.store.put({ clave: 'tipos_problema', data: tipos_problema, timestamp }),
    tx.store.put({ clave: 'impactos', data: impactos, timestamp }),
    tx.store.put({ clave: 'estados', data: estados, timestamp }),
    tx.done
  ]);
}

export async function obtenerCatalogosCache() {
  const db = await getDB();
  const [
    sectoresItem,
    categoriasItem,
    modelosItem,
    encargadosItem,
    tiposItem,
    impactosItem,
    estadosItem
  ] = await Promise.all([
    db.get('catalogos_cache', 'sectores'),
    db.get('catalogos_cache', 'categorias'),
    db.get('catalogos_cache', 'modelos'),
    db.get('catalogos_cache', 'encargados'),
    db.get('catalogos_cache', 'tipos_problema'),
    db.get('catalogos_cache', 'impactos'),
    db.get('catalogos_cache', 'estados')
  ]);

  return {
    sectores: sectoresItem ? sectoresItem.data : [],
    categorias: categoriasItem ? categoriasItem.data : [],
    modelos: modelosItem ? modelosItem.data : [],
    encargados: encargadosItem ? encargadosItem.data : [],
    tipos_problema: tiposItem ? tiposItem.data : [],
    impactos: impactosItem ? impactosItem.data : ['FALTA', 'SOBRA', 'DEFECTO', 'OTRO'],
    estados: estadosItem ? estadosItem.data : ['Abierto', 'En Proceso', 'Resuelto'],
    timestamp: sectoresItem ? sectoresItem.timestamp : null
  };
}
