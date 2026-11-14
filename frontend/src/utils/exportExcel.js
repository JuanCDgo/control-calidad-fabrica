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
    'Fecha Captura (GMT-3)',
    'Encargado',
    'Sector / Área',
    'Tipo de Problema',
    'Impacto',
    'Producto / Mueble',
    'Código',
    'Detalle Pieza o Insumo',
    'Cant. Afectada',
    'Descripción del Problema',
    'Acción Inmediata Tomada',
    'Estado',
    'Enviado a Planilla',
    'Link Foto'
  ];

  const rows = reales.map((rep) => [
    escapeCSV(rep.id),
    escapeCSV(rep.fecha_captura_local),
    escapeCSV(rep.encargado_nombre || 'Sin asignar'),
    escapeCSV(rep.sector_nombre || 'Sin Sector'),
    escapeCSV(rep.tipo_problema_nombre || 'OTRO / CLIMA LABORAL'),
    escapeCSV(rep.impacto || 'DEFECTO'),
    escapeCSV(rep.modelo_nombre || 'General'),
    escapeCSV(rep.modelo_codigo || ''),
    escapeCSV(rep.detalle_pieza || ''),
    escapeCSV(rep.cantidad_afectada),
    escapeCSV(rep.descripcion_defecto),
    escapeCSV(rep.accion_inmediata || ''),
    escapeCSV(rep.estado || 'Abierto'),
    escapeCSV(rep.exportado_excel ? `Sí (${rep.exportado_archivo || ''})` : 'Pendiente'),
    escapeCSV(rep.foto_link_corto ? `${apiBaseUrl}${rep.foto_link_corto}` : 'Sin foto')
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
  const filename = `reportes_problemas_${fechaStr}_${horaStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
