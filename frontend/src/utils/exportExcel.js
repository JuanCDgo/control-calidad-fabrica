/**
 * Exportador de reportes a archivo CSV compatible con Excel en español (UTF-8 con BOM y separador ';').
 * Excluye automáticamente cualquier registro de muestra/ejemplo (es_ejemplo === 1).
 */

export function exportarReportesAExcel(reportes, apiBaseUrl = '') {
  const reales = (reportes || []).filter((rep) => !rep.es_ejemplo);
  if (reales.length === 0) {
    alert('No hay reportes reales para exportar (los registros de ejemplo se excluyen automáticamente).');
    return;
  }

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(';') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const headers = [
    'ID',
    'Fecha Captura en Planta (GMT-3)',
    'Fecha Sincronización en PC (GMT-3)',
    'Sector de Planta',
    'Categoría',
    'Modelo de Mueble',
    'Código',
    'Cantidad de Material Afectado',
    'Descripción del Defecto',
    'Ruta de Foto'
  ];

  const rows = reales.map((rep) => [
    escapeCSV(rep.id),
    escapeCSV(rep.fecha_captura_local),
    escapeCSV(rep.fecha_sincronizacion),
    escapeCSV(rep.sector_nombre || 'Sin Sector'),
    escapeCSV(rep.categoria_nombre || 'Sin Categoría'),
    escapeCSV(rep.modelo_nombre || 'Sin Modelo'),
    escapeCSV(rep.modelo_codigo || ''),
    escapeCSV(rep.cantidad_afectada),
    escapeCSV(rep.descripcion_defecto),
    escapeCSV(rep.foto_path ? `${apiBaseUrl}${rep.foto_path}` : '')
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.join(';'))
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const fechaStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const horaStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const filename = `reportes_calidad_${fechaStr}_${horaStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
