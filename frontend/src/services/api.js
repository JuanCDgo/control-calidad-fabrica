/**
 * Cliente API para comunicación con el backend central FastAPI.
 */

export function getApiBaseUrl() {
  const customUrl = localStorage.getItem('backend_url_custom');
  if (customUrl) {
    return customUrl.replace(/\/+$/, '');
  }
  return window.location.origin;
}

export function setCustomBackendUrl(url) {
  if (!url) {
    localStorage.removeItem('backend_url_custom');
  } else {
    localStorage.setItem('backend_url_custom', url.trim());
  }
}

async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  if (!response.ok) {
    let errorDetail = `Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {}
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

// --- ENDPOINTS PWA / OFFLINE ---

export async function checkBackendHealth() {
  try {
    const data = await request('/api/health');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function fetchServerInfo() {
  return request('/api/server-info');
}

export async function fetchCatalogosOffline() {
  return request('/api/v1/catalogos/offline');
}

export async function enviarReporteAPI(reporte) {
  const formData = new FormData();
  formData.append('client_uuid', reporte.client_uuid);

  if (reporte.encargado_id !== null && reporte.encargado_id !== undefined && reporte.encargado_id !== '') {
    formData.append('encargado_id', String(reporte.encargado_id));
  }
  if (reporte.tipo_problema_id !== null && reporte.tipo_problema_id !== undefined && reporte.tipo_problema_id !== '') {
    formData.append('tipo_problema_id', String(reporte.tipo_problema_id));
  }
  formData.append('impacto', reporte.impacto || 'DEFECTO');

  if (reporte.modelo_id !== null && reporte.modelo_id !== undefined && reporte.modelo_id !== '') {
    formData.append('modelo_id', String(reporte.modelo_id));
  }
  if (reporte.modelo_manual) {
    formData.append('modelo_manual', reporte.modelo_manual);
  }
  if (reporte.detalle_pieza) {
    formData.append('detalle_pieza', reporte.detalle_pieza);
  }
  formData.append('sector_id', String(reporte.sector_id));
  formData.append('descripcion_defecto', reporte.descripcion_defecto);
  formData.append('cantidad_afectada', reporte.cantidad_afectada);
  if (reporte.accion_inmediata) {
    formData.append('accion_inmediata', reporte.accion_inmediata);
  }
  formData.append('estado', reporte.estado || 'Abierto');
  formData.append('fecha_captura_local', reporte.fecha_captura_local);

  if (reporte.foto_blob) {
    const filename = `problema_${reporte.client_uuid.substring(0, 8)}.jpg`;
    formData.append('foto', reporte.foto_blob, filename);
  }

  return request('/api/v1/reportes/', {
    method: 'POST',
    body: formData
  });
}

// --- ENDPOINTS ADMINISTRACIÓN: REPORTES ---

export async function fetchReportesAdmin(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.sector_id) params.append('sector_id', filtros.sector_id);
  if (filtros.encargado_id) params.append('encargado_id', filtros.encargado_id);
  if (filtros.tipo_problema_id) params.append('tipo_problema_id', filtros.tipo_problema_id);
  if (filtros.estado) params.append('estado', filtros.estado);
  if (filtros.categoria_id) params.append('categoria_id', filtros.categoria_id);
  if (filtros.modelo_id) params.append('modelo_id', filtros.modelo_id);
  if (filtros.solo_prototipos) params.append('solo_prototipos', 'true');
  if (filtros.limite) params.append('limite', filtros.limite);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/v1/reportes/${qs}`);
}

export async function updateReporteAdmin(id, datos) {
  return request(`/api/v1/reportes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

export async function deleteEjemploReporteAdmin(id) {
  return request(`/api/v1/reportes/${id}`, { method: 'DELETE' });
}

export async function deleteReporteAdmin(id) {
  return request(`/api/v1/reportes/${id}?forzar=true`, { method: 'DELETE' });
}

export async function exportarAPlanillasAdmin(reporteIds = null) {
  return request('/api/v1/reportes/exportar-planillas', {
    method: 'POST',
    body: JSON.stringify({ reporte_ids: reporteIds })
  });
}

export async function fetchPlanillasDisponiblesAdmin() {
  return request('/api/v1/reportes/planillas-disponibles');
}

// --- ENDPOINTS ADMINISTRACIÓN: PIN DE SEGURIDAD ---

export async function fetchPinStatusAdmin() {
  return request('/api/v1/admin/pin/status');
}

export async function setupAdminPin(pin) {
  return request('/api/v1/admin/pin/setup', {
    method: 'POST',
    body: JSON.stringify({ pin })
  });
}

export async function verifyAdminPin(pin) {
  return request('/api/v1/admin/pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin })
  });
}

export async function changeAdminPin(pin_actual, pin_nuevo) {
  return request('/api/v1/admin/pin/change', {
    method: 'POST',
    body: JSON.stringify({ pin_actual, pin_nuevo })
  });
}

// --- ENDPOINTS ADMINISTRACIÓN: SECTORES ---

export async function fetchSectoresAdmin(soloActivos = false) {
  return request(`/api/v1/admin/sectores?solo_activos=${soloActivos}`);
}

export async function createSectorAdmin(nombre) {
  return request('/api/v1/admin/sectores', {
    method: 'POST',
    body: JSON.stringify({ nombre })
  });
}

export async function updateSectorAdmin(id, datos) {
  return request(`/api/v1/admin/sectores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

export async function deleteSectorAdmin(id) {
  return request(`/api/v1/admin/sectores/${id}`, {
    method: 'DELETE'
  });
}

// --- ENDPOINTS ADMINISTRACIÓN: ENCARGADOS ---

export async function fetchEncargadosAdmin(soloActivos = false) {
  return request(`/api/v1/admin/encargados?solo_activos=${soloActivos}`);
}

export async function createEncargadoAdmin(datos) {
  return request('/api/v1/admin/encargados', {
    method: 'POST',
    body: JSON.stringify(datos)
  });
}

export async function updateEncargadoAdmin(id, datos) {
  return request(`/api/v1/admin/encargados/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

export async function deleteEncargadoAdmin(id) {
  return request(`/api/v1/admin/encargados/${id}`, {
    method: 'DELETE'
  });
}

// --- ENDPOINTS ADMINISTRACIÓN: TIPOS DE PROBLEMA ---

export async function fetchTiposProblemaAdmin(soloActivos = false) {
  return request(`/api/v1/admin/tipos-problema?solo_activos=${soloActivos}`);
}

export async function createTipoProblemaAdmin(nombre) {
  return request('/api/v1/admin/tipos-problema', {
    method: 'POST',
    body: JSON.stringify({ nombre })
  });
}

export async function updateTipoProblemaAdmin(id, datos) {
  return request(`/api/v1/admin/tipos-problema/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

export async function deleteTipoProblemaAdmin(id) {
  return request(`/api/v1/admin/tipos-problema/${id}`, {
    method: 'DELETE'
  });
}

// --- ENDPOINTS ADMINISTRACIÓN: CATEGORÍAS Y MODELOS (PROTEGIDOS CON PIN) ---

function pinHeaders(adminPin) {
  return adminPin ? { 'X-Admin-Pin': adminPin } : {};
}

export async function fetchCategoriasAdmin(soloActivos = false) {
  return request(`/api/v1/admin/categorias?solo_activos=${soloActivos}`);
}

export async function createCategoriaAdmin(nombre, adminPin) {
  return request('/api/v1/admin/categorias', {
    method: 'POST',
    headers: pinHeaders(adminPin),
    body: JSON.stringify({ nombre })
  });
}

export async function updateCategoriaAdmin(id, datos, adminPin) {
  return request(`/api/v1/admin/categorias/${id}`, {
    method: 'PUT',
    headers: pinHeaders(adminPin),
    body: JSON.stringify(datos)
  });
}

export async function deleteCategoriaAdmin(id, adminPin) {
  return request(`/api/v1/admin/categorias/${id}`, {
    method: 'DELETE',
    headers: pinHeaders(adminPin)
  });
}

export async function fetchModelosAdmin(soloActivos = false, categoriaId = null) {
  const params = new URLSearchParams();
  params.append('solo_activos', String(soloActivos));
  if (categoriaId !== null && categoriaId !== '') {
    params.append('categoria_id', String(categoriaId));
  }
  return request(`/api/v1/admin/modelos?${params.toString()}`);
}

export async function createModeloAdmin(datos, adminPin) {
  return request('/api/v1/admin/modelos', {
    method: 'POST',
    headers: pinHeaders(adminPin),
    body: JSON.stringify(datos)
  });
}

export async function updateModeloAdmin(id, datos, adminPin) {
  return request(`/api/v1/admin/modelos/${id}`, {
    method: 'PUT',
    headers: pinHeaders(adminPin),
    body: JSON.stringify(datos)
  });
}

export async function deleteModeloAdmin(id, adminPin) {
  return request(`/api/v1/admin/modelos/${id}`, {
    method: 'DELETE',
    headers: pinHeaders(adminPin)
  });
}
