/**
 * Cliente API para comunicación con el backend central FastAPI.
 * Soporta configuración dinámica de IP del servidor para redes LAN de planta.
 */

export function getApiBaseUrl() {
  const customUrl = localStorage.getItem('backend_url_custom');
  if (customUrl) {
    return customUrl.replace(/\/+$/, '');
  }
  // En producción o con proxy en Vite:
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
    throw new Error(errorDetail);
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

export async function fetchCatalogosOffline() {
  return request('/api/v1/catalogos/offline');
}

export async function enviarReporteAPI(reporte) {
  const formData = new FormData();
  formData.append('client_uuid', reporte.client_uuid);
  formData.append('modelo_id', String(reporte.modelo_id));
  formData.append('sector_id', String(reporte.sector_id));
  formData.append('descripcion_defecto', reporte.descripcion_defecto);
  formData.append('cantidad_afectada', reporte.cantidad_afectada);
  formData.append('fecha_captura_local', reporte.fecha_captura_local);

  // El blob de la foto comprimida
  const filename = `defecto_${reporte.client_uuid.substring(0, 8)}.jpg`;
  formData.append('foto', reporte.foto_blob, filename);

  return request('/api/v1/reportes/', {
    method: 'POST',
    body: formData
  });
}

// --- ENDPOINTS ADMINISTRACIÓN ---

export async function fetchReportesAdmin(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.sector_id) params.append('sector_id', filtros.sector_id);
  if (filtros.modelo_id) params.append('modelo_id', filtros.modelo_id);
  if (filtros.limite) params.append('limite', filtros.limite);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/v1/reportes/${qs}`);
}

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

export async function fetchModelosAdmin(soloActivos = false) {
  return request(`/api/v1/admin/modelos?solo_activos=${soloActivos}`);
}

export async function createModeloAdmin(datos) {
  return request('/api/v1/admin/modelos', {
    method: 'POST',
    body: JSON.stringify(datos)
  });
}

export async function updateModeloAdmin(id, datos) {
  return request(`/api/v1/admin/modelos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

export async function deleteModeloAdmin(id) {
  return request(`/api/v1/admin/modelos/${id}`, {
    method: 'DELETE'
  });
}
