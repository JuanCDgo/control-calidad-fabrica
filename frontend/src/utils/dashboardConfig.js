const STORAGE_KEY = 'dashboard_textos_config_v1';

export const DEFAULT_DASHBOARD_TEXTS = {
  dashboard_header_title: 'Tablero de Control de Calidad',
  dashboard_header_subtitle: 'Métricas de no conformidades para auditorías y capacitación de planta',
  kpi_total_label: 'Total de Reportes',
  kpi_sector_label: 'Sector con Mayor Incidencia',
  kpi_cantidad_label: 'Total Incidentes Registrados',
  pareto_title: 'Diagrama de Pareto: Defectos por Sector (Regla 80/20)',
  pareto_subtitle: 'Frecuencia de no conformidades y curva acumulada para priorización de mejoras',
  pareto_bar_name: 'Frecuencia de Defectos',
  pareto_line_name: '% Acumulado',
  pie_title: 'Distribución de Fallas por Modelo de Mueble',
  pie_subtitle: 'Proporción de no conformidades según el tipo de mueble fabricado'
};

export function loadDashboardTexts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_DASHBOARD_TEXTS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Error al cargar textos personalizados del dashboard:', err);
  }
  return { ...DEFAULT_DASHBOARD_TEXTS };
}

export function saveDashboardTexts(texts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(texts));
  } catch (err) {
    console.error('Error al guardar textos personalizados del dashboard:', err);
  }
}

export function resetDashboardTexts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
  return { ...DEFAULT_DASHBOARD_TEXTS };
}
