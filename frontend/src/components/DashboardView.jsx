import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Layers,
  Calendar,
  Edit3,
  RotateCcw,
  CheckCircle2,
  Tv
} from 'lucide-react';
import { EditableText } from './EditableText';
import {
  loadDashboardTexts,
  saveDashboardTexts,
  resetDashboardTexts
} from '../utils/dashboardConfig';

const PIE_COLORS = [
  '#3b82f6', // azul
  '#10b981', // verde
  '#f59e0b', // ámbar
  '#8b5cf6', // violeta
  '#ec4899', // rosa
  '#06b6d4', // cian
  '#f97316'  // naranja
];

export function DashboardView({ reportes = [], sectores = [], modelos = [] }) {
  // Filtro de Fechas
  const [dateFilter, setDateFilter] = useState('mes'); // 'hoy' | 'semana' | 'mes' | 'todos'

  // Textos Personalizables
  const [texts, setTexts] = useState(loadDashboardTexts);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleUpdateText = (key, newValue) => {
    const updated = { ...texts, [key]: newValue };
    setTexts(updated);
    saveDashboardTexts(updated);
  };

  const handleResetTexts = () => {
    if (window.confirm('¿Restablecer los textos del tablero a sus valores por defecto?')) {
      const def = resetDashboardTexts();
      setTexts(def);
    }
  };

  // Filtrado de reportes por fecha
  const filteredReports = useMemo(() => {
    if (dateFilter === 'todos') return reportes;

    const now = new Date();
    const hoyStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    return reportes.filter((rep) => {
      const fecha = rep.fecha_captura_local || rep.fecha_sincronizacion || '';
      const repFechaStr = fecha.slice(0, 10);

      if (dateFilter === 'hoy') {
        return repFechaStr === hoyStr;
      }

      if (dateFilter === 'semana') {
        const hace7dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const hace7diasStr = hace7dias.toISOString().slice(0, 10);
        return repFechaStr >= hace7diasStr;
      }

      if (dateFilter === 'mes') {
        const mesActual = hoyStr.slice(0, 7); // YYYY-MM
        return repFechaStr.startsWith(mesActual);
      }

      return true;
    });
  }, [reportes, dateFilter]);

  // Cálculos de KPIs
  const totalReportes = filteredReports.length;

  // Cálculo del Diagrama de Pareto (por Sector)
  const paretoData = useMemo(() => {
    if (totalReportes === 0) return [];

    // 1. Contar frecuencias por sector
    const sectorCounts = {};
    filteredReports.forEach((rep) => {
      const sectorNom = rep.sector_nombre || 'Sin Sector';
      sectorCounts[sectorNom] = (sectorCounts[sectorNom] || 0) + 1;
    });

    // 2. Ordenar descendente (de mayor frecuencia a menor)
    const sorted = Object.entries(sectorCounts)
      .map(([nombre, frecuencia]) => ({ nombre, frecuencia }))
      .sort((a, b) => b.frecuencia - a.frecuencia);

    // 3. Calcular acumulados y porcentaje acumulado (0 a 100%)
    let acumulado = 0;
    return sorted.map((item) => {
      acumulado += item.frecuencia;
      const acumuladoPorcentaje = Number(((acumulado / totalReportes) * 100).toFixed(1));
      return {
        ...item,
        acumulado,
        acumuladoPorcentaje
      };
    });
  }, [filteredReports, totalReportes]);

  // Sector con mayor incidencia
  const sectorMayorIncidencia = paretoData.length > 0 ? paretoData[0] : null;

  // Distribución por Modelo (para gráfico de torta/dona)
  const pieData = useMemo(() => {
    if (totalReportes === 0) return [];
    const modelCounts = {};
    filteredReports.forEach((rep) => {
      const modelNom = rep.modelo_nombre || 'Sin Modelo';
      modelCounts[modelNom] = (modelCounts[modelNom] || 0) + 1;
    });

    return Object.entries(modelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredReports, totalReportes]);

  return (
    <div className="dashboard-container">
      {/* BARRA SUPERIOR DE CONTROL DEL DASHBOARD */}
      <div className="dashboard-toolbar">
        <div className="dashboard-header-texts">
          <EditableText
            textKey="dashboard_header_title"
            isEditMode={isEditMode}
            texts={texts}
            onUpdateText={handleUpdateText}
            tag="h2"
            className="dashboard-title"
          />
          <EditableText
            textKey="dashboard_header_subtitle"
            isEditMode={isEditMode}
            texts={texts}
            onUpdateText={handleUpdateText}
            tag="p"
            className="dashboard-subtitle"
          />
        </div>

        <div className="dashboard-actions">
          {/* Filtro Rápido de Fechas */}
          <div className="date-filter-group">
            <Calendar size={14} className="filter-icon" />
            <button
              onClick={() => setDateFilter('hoy')}
              className={`date-pill ${dateFilter === 'hoy' ? 'active' : ''}`}
            >
              Hoy
            </button>
            <button
              onClick={() => setDateFilter('semana')}
              className={`date-pill ${dateFilter === 'semana' ? 'active' : ''}`}
            >
              Últimos 7 días
            </button>
            <button
              onClick={() => setDateFilter('mes')}
              className={`date-pill ${dateFilter === 'mes' ? 'active' : ''}`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setDateFilter('todos')}
              className={`date-pill ${dateFilter === 'todos' ? 'active' : ''}`}
            >
              Todos
            </button>
          </div>

          {/* Toggle Modo Edición de Textos */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`btn-toggle-edit-mode ${isEditMode ? 'active' : ''}`}
            title="Activa el modo para cambiar cualquier título o etiqueta con un clic"
          >
            <Edit3 size={15} />
            <span>{isEditMode ? 'Listo / Guardar Textos' : 'Editar Textos'}</span>
          </button>

          {isEditMode && (
            <button
              onClick={handleResetTexts}
              className="btn-reset-texts"
              title="Restablecer todos los textos a los valores de fábrica"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="edit-mode-notice">
          ✏️ <strong>Modo Edición Activo:</strong> Hacé clic sobre cualquier título, etiqueta o descripción marcada con subrayado para escribir tu propia terminología antes de proyectar.
        </div>
      )}

      {/* TARJETAS KPI */}
      <div className="kpi-grid">
        {/* KPI 1: Total Reportes */}
        <div className="kpi-card">
          <div className="kpi-icon-box blue">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-content">
            <EditableText
              textKey="kpi_total_label"
              isEditMode={isEditMode}
              texts={texts}
              onUpdateText={handleUpdateText}
              tag="span"
              className="kpi-label"
            />
            <div className="kpi-number">{totalReportes}</div>
          </div>
        </div>

        {/* KPI 2: Sector con Mayor Incidencia */}
        <div className="kpi-card highlight">
          <div className="kpi-icon-box amber">
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-content">
            <EditableText
              textKey="kpi_sector_label"
              isEditMode={isEditMode}
              texts={texts}
              onUpdateText={handleUpdateText}
              tag="span"
              className="kpi-label"
            />
            <div className="kpi-value-text">
              {sectorMayorIncidencia
                ? `${sectorMayorIncidencia.nombre} (${sectorMayorIncidencia.frecuencia})`
                : 'Sin incidencias'}
            </div>
          </div>
        </div>

        {/* KPI 3: Cantidad Afectada */}
        <div className="kpi-card">
          <div className="kpi-icon-box violet">
            <Layers size={22} />
          </div>
          <div className="kpi-content">
            <EditableText
              textKey="kpi_cantidad_label"
              isEditMode={isEditMode}
              texts={texts}
              onUpdateText={handleUpdateText}
              tag="span"
              className="kpi-label"
            />
            <div className="kpi-number">{filteredReports.length}</div>
          </div>
        </div>
      </div>

      {totalReportes === 0 ? (
        <div className="empty-dashboard-box">
          <p>No se registraron reportes en el rango de fecha seleccionado.</p>
        </div>
      ) : (
        <div className="charts-grid">
          {/* GRÁFICO DE PARETO (80/20) */}
          <div className="chart-card pareto-card">
            <div className="chart-header">
              <EditableText
                textKey="pareto_title"
                isEditMode={isEditMode}
                texts={texts}
                onUpdateText={handleUpdateText}
                tag="h3"
                className="chart-title"
              />
              <EditableText
                textKey="pareto_subtitle"
                isEditMode={isEditMode}
                texts={texts}
                onUpdateText={handleUpdateText}
                tag="p"
                className="chart-subtitle"
              />
            </div>

            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={paretoData} margin={{ top: 20, right: 20, bottom: 25, left: 0 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.6} />
                  <XAxis
                    dataKey="nombre"
                    stroke="#94a3b8"
                    tick={{ fill: '#cbd5e1', fontSize: 12 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  {/* Eje izquierdo: Frecuencia de fallas */}
                  <YAxis
                    yAxisId="left"
                    stroke="#60a5fa"
                    tick={{ fill: '#93c5fd', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  {/* Eje derecho: Porcentaje acumulado (0 a 100%) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    unit="%"
                    stroke="#f59e0b"
                    tick={{ fill: '#fcd34d', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#475569',
                      borderRadius: '8px',
                      color: '#ffffff'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  {/* Línea de corte Pareto 80/20 */}
                  <ReferenceLine
                    yAxisId="right"
                    y={80}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: 'Corte 80% (Vitales)',
                      fill: '#f87171',
                      position: 'top',
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  />
                  {/* Barras de Frecuencia */}
                  <Bar
                    yAxisId="left"
                    dataKey="frecuencia"
                    name={texts.pareto_bar_name}
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                  {/* Curva de % Acumulado */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumuladoPorcentaje"
                    name={texts.pareto_line_name}
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#f59e0b' }}
                    activeDot={{ r: 7 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO DE TORTA / DONA (MODELOS DE MUEBLE) */}
          <div className="chart-card pie-card">
            <div className="chart-header">
              <EditableText
                textKey="pie_title"
                isEditMode={isEditMode}
                texts={texts}
                onUpdateText={handleUpdateText}
                tag="h3"
                className="chart-title"
              />
              <EditableText
                textKey="pie_subtitle"
                isEditMode={isEditMode}
                texts={texts}
                onUpdateText={handleUpdateText}
                tag="p"
                className="chart-subtitle"
              />
            </div>

            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#475569',
                      borderRadius: '8px',
                      color: '#ffffff'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
