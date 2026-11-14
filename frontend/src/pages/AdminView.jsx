import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchReportesAdmin,
  updateReporteAdmin,
  deleteReporteAdmin,
  deleteEjemploReporteAdmin,
  exportarAPlanillasAdmin,
  fetchPlanillasDisponiblesAdmin,
  fetchCategoriasAdmin,
  createCategoriaAdmin,
  updateCategoriaAdmin,
  deleteCategoriaAdmin,
  fetchModelosAdmin,
  createModeloAdmin,
  updateModeloAdmin,
  deleteModeloAdmin,
  fetchSectoresAdmin,
  createSectorAdmin,
  updateSectorAdmin,
  deleteSectorAdmin,
  fetchEncargadosAdmin,
  createEncargadoAdmin,
  updateEncargadoAdmin,
  deleteEncargadoAdmin,
  fetchTiposProblemaAdmin,
  createTipoProblemaAdmin,
  updateTipoProblemaAdmin,
  deleteTipoProblemaAdmin,
  fetchPinStatusAdmin,
  setupAdminPin,
  verifyAdminPin,
  changeAdminPin,
  fetchServerInfo,
  getApiBaseUrl
} from '../services/api';
import { exportarReportesAExcel } from '../utils/exportExcel';
import { DashboardView } from '../components/DashboardView';
import {
  ClipboardList,
  Layers,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Power,
  X,
  Check,
  RefreshCw,
  Search,
  ZoomIn,
  QrCode,
  Copy,
  CheckCheck,
  Smartphone,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  Lock,
  Unlock,
  KeyRound,
  FolderOpen,
  Send,
  Link2,
  UserCheck,
  AlertTriangle,
  ImageOff
} from 'lucide-react';

const PIN_SESSION_KEY = 'admin_catalog_pin';
const IMPACTOS = ['FALTA', 'SOBRA', 'DEFECTO', 'OTRO'];
const ESTADOS = ['Abierto', 'En Proceso', 'Resuelto'];

export function AdminView({ backendReachable }) {
  const [activeTab, setActiveTab] = useState('reportes'); // 'reportes' | 'modelos' | 'listas' | 'dashboard'

  // Datos
  const [reportes, setReportes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [tiposProblema, setTiposProblema] = useState([]);
  const [planillasDisponibles, setPlanillasDisponibles] = useState([]);

  // Filtros de reportes
  const [filtroEncargado, setFiltroEncargado] = useState('');
  const [filtroSector, setFiltroSector] = useState('');
  const [filtroTipoProblema, setFiltroTipoProblema] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportBanner, setExportBanner] = useState(null);

  // Pestaña Categorías y Muebles
  const [selectedCatId, setSelectedCatId] = useState('ALL');
  const [searchCatalogo, setSearchCatalogo] = useState('');

  // Seguridad PIN (para Categorías y Modelos)
  const [pinConfigurado, setPinConfigurado] = useState(false);
  const [adminPin, setAdminPin] = useState(() => sessionStorage.getItem(PIN_SESSION_KEY) || '');
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    mode: 'verify',
    pendingAction: null
  });

  // Modales
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [modalReporteEdit, setModalReporteEdit] = useState({ isOpen: false, item: null });
  const [modalCategoria, setModalCategoria] = useState({ isOpen: false, item: null });
  const [modalModelo, setModalModelo] = useState({ isOpen: false, item: null });
  const [modalSector, setModalSector] = useState({ isOpen: false, item: null });
  const [modalEncargado, setModalEncargado] = useState({ isOpen: false, item: null });
  const [modalTipoProblema, setModalTipoProblema] = useState({ isOpen: false, item: null });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrMode, setQrMode] = useState('app');
  const [serverInfo, setServerInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadAll = async () => {
    if (!backendReachable) return;
    setIsLoading(true);
    try {
      const [reps, cats, mods, secs, encs, tipos, planillas, sInfo, pinStat] = await Promise.all([
        fetchReportesAdmin({ limite: 500 }),
        fetchCategoriasAdmin(false),
        fetchModelosAdmin(false),
        fetchSectoresAdmin(false),
        fetchEncargadosAdmin(false),
        fetchTiposProblemaAdmin(false),
        fetchPlanillasDisponiblesAdmin().catch(() => ({ archivos: [] })),
        fetchServerInfo().catch(() => null),
        fetchPinStatusAdmin().catch(() => ({ pin_configurado: false }))
      ]);
      setReportes(reps);
      setCategorias(cats);
      setModelos(mods);
      setSectores(secs);
      setEncargados(encs);
      setTiposProblema(tipos);
      setPlanillasDisponibles(planillas?.archivos || []);
      if (sInfo) setServerInfo(sInfo);
      setPinConfigurado(Boolean(pinStat?.pin_configurado));
    } catch (err) {
      console.error('Error al cargar datos de admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [backendReachable]);

  const filteredReportes = useMemo(() => {
    return reportes.filter((rep) => {
      if (filtroEncargado && String(rep.encargado_id || '') !== String(filtroEncargado)) return false;
      if (filtroSector && String(rep.sector_id) !== String(filtroSector)) return false;
      if (filtroTipoProblema && String(rep.tipo_problema_id || '') !== String(filtroTipoProblema)) return false;
      if (filtroEstado && rep.estado !== filtroEstado) return false;
      if (filtroCategoria === '__PROTOTIPO__' && rep.modelo_id !== null) return false;
      if (
        filtroCategoria &&
        filtroCategoria !== '__PROTOTIPO__' &&
        String(rep.categoria_id || '') !== String(filtroCategoria)
      ) {
        return false;
      }
      return true;
    });
  }, [reportes, filtroEncargado, filtroSector, filtroTipoProblema, filtroEstado, filtroCategoria]);

  const reportesRealesCount = useMemo(
    () => reportes.filter((r) => !r.es_ejemplo).length,
    [reportes]
  );

  const pendientesPlanillaCount = useMemo(
    () => reportes.filter((r) => !r.es_ejemplo && r.exportado_excel === 0).length,
    [reportes]
  );

  const modelosEnCategoria = useMemo(() => {
    const q = searchCatalogo.trim().toLowerCase();
    return modelos.filter((m) => {
      if (selectedCatId === 'NONE' && m.categoria_id !== null) return false;
      if (selectedCatId !== 'ALL' && selectedCatId !== 'NONE' && String(m.categoria_id || '') !== String(selectedCatId)) {
        return false;
      }
      if (!q) return true;
      return (
        (m.nombre || '').toLowerCase().includes(q) ||
        (m.codigo || '').toLowerCase().includes(q) ||
        (m.categoria_nombre || '').toLowerCase().includes(q)
      );
    });
  }, [modelos, selectedCatId, searchCatalogo]);

  // PIN Guard
  const runProtectedAction = (actionFn) => {
    if (!pinConfigurado) {
      setPinModal({ isOpen: true, mode: 'setup', pendingAction: actionFn });
      return;
    }
    if (!adminPin) {
      setPinModal({ isOpen: true, mode: 'verify', pendingAction: actionFn });
      return;
    }
    actionFn(adminPin);
  };

  const handleLockCatalog = () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    setAdminPin('');
  };

  const handlePinAuthError = (err) => {
    if (err.status === 401 || err.status === 403) {
      sessionStorage.removeItem(PIN_SESSION_KEY);
      setAdminPin('');
      alert('El PIN ingresado no es válido o expiró. Desbloqueá el catálogo nuevamente.');
      return true;
    }
    return false;
  };

  // --- EXPORTAR A PLANILLAS DE ENCARGADOS ---
  const handleEnviarAPlanillas = async (reporteIds = null) => {
    setIsExportingExcel(true);
    setExportBanner(null);
    try {
      const res = await exportarAPlanillasAdmin(reporteIds);
      const msgs = [];
      if (res.exportados > 0) {
        msgs.push(`${res.exportados} problema(s) agregado(s) a: ${res.archivos_actualizados.join(', ')}.`);
      } else if (res.errores.length === 0) {
        msgs.push('No había reportes pendientes por enviar (todos ya estaban sumados en sus planillas).');
      }
      if (res.errores.length > 0) {
        msgs.push(`Avisos: ${res.errores.join(' | ')}`);
      }
      setExportBanner({
        tipo: res.errores.length > 0 ? 'warning' : 'success',
        texto: msgs.join(' ')
      });
      await loadAll();
    } catch (err) {
      setExportBanner({ tipo: 'error', texto: `Error al enviar a planillas: ${err.message}` });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // --- EDICIÓN / ELIMINACIÓN DE REPORTES ---
  const handleSaveReporteEdit = async (datos) => {
    try {
      await updateReporteAdmin(modalReporteEdit.item.id, datos);
      setModalReporteEdit({ isOpen: false, item: null });
      await loadAll();
    } catch (err) {
      alert(`Error al actualizar el reporte: ${err.message}`);
    }
  };

  const handleDeleteReporte = async (rep) => {
    const esEjemplo = rep.es_ejemplo === 1;
    const msg = esEjemplo
      ? '¿Quitar el reporte de muestra de ejemplo?'
      : `¿Eliminar definitivamente el reporte #${rep.id} (${rep.modelo_nombre})? Esta acción no se puede deshacer.`;
    if (!window.confirm(msg)) return;
    try {
      if (esEjemplo) {
        await deleteEjemploReporteAdmin(rep.id);
      } else {
        await deleteReporteAdmin(rep.id);
      }
      await loadAll();
    } catch (err) {
      alert(`No se pudo eliminar: ${err.message}`);
    }
  };

  // --- CRUD CATEGORÍAS Y MODELOS (con PIN) ---
  const handleSaveCategoria = async (nombre) => {
    runProtectedAction(async (pinToUse) => {
      try {
        if (modalCategoria.item) {
          await updateCategoriaAdmin(modalCategoria.item.id, { nombre }, pinToUse);
        } else {
          await createCategoriaAdmin(nombre, pinToUse);
        }
        setModalCategoria({ isOpen: false, item: null });
        loadAll();
      } catch (err) {
        if (!handlePinAuthError(err)) alert(`Error al guardar categoría: ${err.message}`);
      }
    });
  };

  const handleToggleCategoriaActivo = (cat) => {
    runProtectedAction(async (pinToUse) => {
      try {
        await updateCategoriaAdmin(cat.id, { activo: cat.activo === 1 ? 0 : 1 }, pinToUse);
        loadAll();
      } catch (err) {
        if (!handlePinAuthError(err)) alert(`Error al cambiar estado: ${err.message}`);
      }
    });
  };

  const handleDeleteCategoria = (cat) => {
    if (!window.confirm(`¿Eliminar o desactivar la categoría "${cat.nombre}"?`)) return;
    runProtectedAction(async (pinToUse) => {
      try {
        const res = await deleteCategoriaAdmin(cat.id, pinToUse);
        alert(res.mensaje);
        if (String(selectedCatId) === String(cat.id)) setSelectedCatId('ALL');
        loadAll();
      } catch (err) {
        if (!handlePinAuthError(err)) alert(`Error al eliminar: ${err.message}`);
      }
    });
  };

  const handleSaveModelo = async (formData) => {
    runProtectedAction(async (pinToUse) => {
      try {
        if (modalModelo.item) {
          await updateModeloAdmin(modalModelo.item.id, formData, pinToUse);
        } else {
          await createModeloAdmin(formData, pinToUse);
        }
        setModalModelo({ isOpen: false, item: null });
        loadAll();
      } catch (err) {
        if (!handlePinAuthError(err)) alert(`Error al guardar producto: ${err.message}`);
      }
    });
  };

  const handleToggleModeloActivo = (item) => {
    runProtectedAction(async (pinToUse) => {
      try {
        await updateModeloAdmin(item.id, { activo: item.activo === 1 ? 0 : 1 }, pinToUse);
        loadAll();
      } catch (err) {
        if (!handlePinAuthError(err)) alert(`Error al cambiar estado: ${err.message}`);
      }
    });
  };

  const handleDeleteModelo = (id) => {
    if (!window.confirm('¿Confirmás eliminar o desactivar este producto?')) return;
    runProtectedAction(async (pinToUse) => {
      try {
        const res = await deleteModeloAdmin(id, pinToUse);
        alert(res.mensaje);
        loadAll();
      } catch (err) {
        if (!handlePinAuthError(err)) alert(`Error al eliminar: ${err.message}`);
      }
    });
  };

  // --- CRUD SECTORES, ENCARGADOS Y TIPOS DE PROBLEMA ---
  const handleSaveSector = async (nombre) => {
    try {
      if (modalSector.item) {
        await updateSectorAdmin(modalSector.item.id, { nombre });
      } else {
        await createSectorAdmin(nombre);
      }
      setModalSector({ isOpen: false, item: null });
      loadAll();
    } catch (err) {
      alert(`Error al guardar sector: ${err.message}`);
    }
  };

  const handleToggleSectorActivo = async (item) => {
    try {
      await updateSectorAdmin(item.id, { activo: item.activo === 1 ? 0 : 1 });
      loadAll();
    } catch (err) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleDeleteSector = async (id) => {
    if (!window.confirm('¿Confirmás eliminar o desactivar este sector?')) return;
    try {
      const res = await deleteSectorAdmin(id);
      alert(res.mensaje);
      loadAll();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSaveEncargado = async (datos) => {
    try {
      if (modalEncargado.item) {
        await updateEncargadoAdmin(modalEncargado.item.id, datos);
      } else {
        await createEncargadoAdmin(datos);
      }
      setModalEncargado({ isOpen: false, item: null });
      loadAll();
    } catch (err) {
      alert(`Error al guardar encargado: ${err.message}`);
    }
  };

  const handleToggleEncargadoActivo = async (item) => {
    try {
      await updateEncargadoAdmin(item.id, { activo: item.activo === 1 ? 0 : 1 });
      loadAll();
    } catch (err) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleDeleteEncargado = async (id) => {
    if (!window.confirm('¿Confirmás eliminar o desactivar este encargado?')) return;
    try {
      const res = await deleteEncargadoAdmin(id);
      alert(res.mensaje);
      loadAll();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSaveTipoProblema = async (nombre) => {
    try {
      if (modalTipoProblema.item) {
        await updateTipoProblemaAdmin(modalTipoProblema.item.id, { nombre });
      } else {
        await createTipoProblemaAdmin(nombre);
      }
      setModalTipoProblema({ isOpen: false, item: null });
      loadAll();
    } catch (err) {
      alert(`Error al guardar tipo de problema: ${err.message}`);
    }
  };

  const handleToggleTipoProblemaActivo = async (item) => {
    try {
      await updateTipoProblemaAdmin(item.id, { activo: item.activo === 1 ? 0 : 1 });
      loadAll();
    } catch (err) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleDeleteTipoProblema = async (id) => {
    if (!window.confirm('¿Confirmás eliminar o desactivar este tipo de problema?')) return;
    try {
      const res = await deleteTipoProblemaAdmin(id);
      alert(res.mensaje);
      loadAll();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const openNuevoModeloModal = () => {
    runProtectedAction(() => {
      const catObj = categorias.find((c) => String(c.id) === String(selectedCatId));
      const defaultCatId = catObj && catObj.es_ejemplo === 0 ? catObj.id : '';
      setModalModelo({ isOpen: true, item: null, defaultCategoriaId: defaultCatId });
    });
  };

  const apiBase = getApiBaseUrl();
  const isCatalogUnlocked = pinConfigurado && Boolean(adminPin);
  const categoriasReales = categorias.filter((c) => c.es_ejemplo === 0);

  return (
    <div className="admin-container">
      {/* TARJETA DESTACADA: QR PARA CELULARES */}
      <div className="qr-access-card">
        <div className="qr-card-info">
          <div className="qr-card-badge">
            <QrCode size={24} />
          </div>
          <div>
            <h3 className="qr-card-title">Control de Planta Patria v1.2 — Acceso Wi-Fi</h3>
            <p className="qr-card-subtitle">
              IP Servidor: <strong className="ip-highlight">{serverInfo?.local_ip || 'Detectando IP...'}</strong> • Planillas: <code>{serverInfo?.carga_semanal_dir || 'Carga_Semanal'}</code>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsQrModalOpen(true)}
          className="btn-qr-giant"
        >
          <QrCode size={22} />
          <span>QR para Celulares</span>
        </button>
      </div>

      {/* Pestañas Superiores */}
      <div className="admin-tabs">
        <button
          onClick={() => setActiveTab('reportes')}
          className={`admin-tab-btn ${activeTab === 'reportes' ? 'active' : ''}`}
        >
          <ClipboardList size={18} />
          <span>Problemas ({reportesRealesCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('modelos')}
          className={`admin-tab-btn ${activeTab === 'modelos' ? 'active' : ''}`}
        >
          <Layers size={18} />
          <span>Productos Vigentes ({modelos.filter((m) => !m.es_ejemplo).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('listas')}
          className={`admin-tab-btn ${activeTab === 'listas' ? 'active' : ''}`}
        >
          <UserCheck size={18} />
          <span>Encargados, Tipos y Sectores</span>
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <BarChart3 size={18} />
          <span>Dashboard & Pareto</span>
        </button>
      </div>

      {!backendReachable && (
        <div className="admin-offline-notice">
          La PC Central no responde. Asegurate de que el servidor esté ejecutándose con <code>INICIAR_APP_WIFI.bat</code>.
        </div>
      )}

      {/* CONTENIDO TAB 1: PROBLEMAS */}
      {activeTab === 'reportes' && (
        <div className="tab-pane">
          <div className="pane-toolbar">
            <div className="filters-row">
              <select
                value={filtroEncargado}
                onChange={(e) => setFiltroEncargado(e.target.value)}
                className="select-input-sm"
              >
                <option value="">Todos los Encargados</option>
                {encargados.map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {enc.nombre}
                  </option>
                ))}
              </select>

              <select
                value={filtroSector}
                onChange={(e) => setFiltroSector(e.target.value)}
                className="select-input-sm"
              >
                <option value="">Todos los Sectores</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>

              <select
                value={filtroTipoProblema}
                onChange={(e) => setFiltroTipoProblema(e.target.value)}
                className="select-input-sm"
              >
                <option value="">Todos los Tipos</option>
                {tiposProblema.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="select-input-sm"
              >
                <option value="">Todos los Estados</option>
                {ESTADOS.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="select-input-sm"
              >
                <option value="">Todas las Categorías</option>
                {categoriasReales.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
                <option value="__PROTOTIPO__">Otro / General</option>
              </select>

              <button onClick={loadAll} className="btn-secondary-sm" title="Refrescar">
                <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
              </button>

              <button
                onClick={() => exportarReportesAExcel(filteredReportes, apiBase)}
                className="btn-secondary-sm"
                title="Descargar respaldo en CSV"
              >
                <FileSpreadsheet size={15} />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => handleEnviarAPlanillas(null)}
                disabled={isExportingExcel}
                className="btn-export-excel"
                title="Agrega los reportes nuevos directo a Carga_Semanal/Encargado_*.xlsx sin duplicar"
              >
                <Send size={15} />
                <span>
                  {isExportingExcel
                    ? 'Enviando...'
                    : `Enviar a Planillas (${pendientesPlanillaCount})`}
                </span>
              </button>
            </div>
          </div>

          {exportBanner && (
            <div className={`feedback-banner ${exportBanner.tipo}`} role="status">
              <span>{exportBanner.texto}</span>
              <button
                type="button"
                onClick={() => setExportBanner(null)}
                className="btn-link-muted"
                style={{ marginLeft: 'auto' }}
              >
                Cerrar
              </button>
            </div>
          )}

          {filteredReportes.length === 0 ? (
            <div className="empty-state-box">
              <ClipboardList size={40} className="empty-icon" />
              <p>No hay problemas registrados con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="reports-grid">
              {filteredReportes.map((rep) => {
                const fullPhotoUrl = rep.foto_path ? `${apiBase}${rep.foto_path}` : null;
                const shortPhotoUrl = rep.foto_link_corto ? `${apiBase}${rep.foto_link_corto}` : null;
                return (
                  <div
                    key={rep.id}
                    className={`report-card ${rep.es_ejemplo ? 'report-card-sample' : ''}`}
                  >
                    {fullPhotoUrl ? (
                      <div
                        className="report-card-media"
                        onClick={() => setZoomedPhoto(fullPhotoUrl)}
                      >
                        <img src={fullPhotoUrl} alt="Problema" className="report-card-img" />
                        {rep.es_ejemplo === 1 && (
                          <span className="sample-corner-badge">Ejemplo (No suma)</span>
                        )}
                        <div className="zoom-hint">
                          <ZoomIn size={16} /> Ver Foto
                        </div>
                      </div>
                    ) : (
                      <div className="report-card-media report-card-no-photo">
                        <ImageOff size={28} />
                        <span>Sin foto adjunta</span>
                      </div>
                    )}

                    <div className="report-card-body">
                      <div className="report-header-line">
                        <div className="report-tags-group">
                          <span className="report-sector-tag">{rep.sector_nombre || 'Sector'}</span>
                          <span className={`badge-impacto badge-impacto-${(rep.impacto || 'DEFECTO').toLowerCase()}`}>
                            {rep.impacto || 'DEFECTO'}
                          </span>
                          <span className={`badge-estado badge-estado-${(rep.estado || 'Abierto').toLowerCase().replace(/\s+/g, '-')}`}>
                            {rep.estado || 'Abierto'}
                          </span>
                        </div>
                        <span className="report-id-tag">#{rep.id}</span>
                      </div>

                      <h4 className="report-model-title">
                        {rep.modelo_nombre || 'General'}
                        {rep.modelo_codigo && (
                          <span className="modelo-code-badge inline-code">{rep.modelo_codigo}</span>
                        )}
                      </h4>

                      {rep.tipo_problema_nombre && (
                        <div className="report-tipo-pill">{rep.tipo_problema_nombre}</div>
                      )}

                      <p className="report-defect-desc">{rep.descripcion_defecto}</p>

                      <div className="report-meta-box">
                        <div className="meta-item">
                          <strong>Encargado:</strong> {rep.encargado_nombre || 'Sin asignar'}
                        </div>
                        {rep.detalle_pieza && (
                          <div className="meta-item">
                            <strong>Pieza / Insumo:</strong> {rep.detalle_pieza}
                          </div>
                        )}
                        <div className="meta-item">
                          <strong>Cant. afectada:</strong> {rep.cantidad_afectada}
                        </div>
                        {rep.accion_inmediata && (
                          <div className="meta-item">
                            <strong>Acción inmediata:</strong> {rep.accion_inmediata}
                          </div>
                        )}
                        <div className="meta-item">
                          <strong>Captura:</strong> {rep.fecha_captura_local}
                        </div>
                        <div className="meta-item">
                          <strong>Planilla Excel:</strong>{' '}
                          {rep.exportado_excel === 1 ? (
                            <span className="badge-excel-ok">
                              Enviado ({rep.exportado_archivo})
                            </span>
                          ) : (
                            <span className="badge-excel-pendiente">Pendiente de envío</span>
                          )}
                        </div>
                        {shortPhotoUrl && (
                          <div className="meta-item">
                            <strong>Link foto:</strong>{' '}
                            <a href={shortPhotoUrl} target="_blank" rel="noreferrer" className="short-photo-link">
                              <Link2 size={12} /> {rep.foto_link_corto}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="report-card-actions">
                        <button
                          type="button"
                          onClick={() => setModalReporteEdit({ isOpen: true, item: rep })}
                          className="btn-secondary-sm"
                        >
                          <Edit2 size={13} />
                          <span>Editar</span>
                        </button>

                        {!rep.es_ejemplo && rep.exportado_excel === 0 && (
                          <button
                            type="button"
                            onClick={() => handleEnviarAPlanillas([rep.id])}
                            className="btn-secondary-sm"
                            title="Enviar solo este reporte a su planilla Excel"
                          >
                            <Send size={13} />
                            <span>A Excel</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteReporte(rep)}
                          className="btn-danger-sm"
                        >
                          <Trash2 size={13} />
                          <span>{rep.es_ejemplo ? 'Quitar muestra' : 'Borrar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB 2: PRODUCTOS VIGENTES (PIN) */}
      {activeTab === 'modelos' && (
        <div className="tab-pane">
          <div className={`pin-security-bar ${isCatalogUnlocked ? 'unlocked' : 'locked'}`}>
            <div className="pin-bar-status">
              {!pinConfigurado ? (
                <>
                  <KeyRound size={18} />
                  <span>
                    <strong>PIN no configurado:</strong> creá un PIN de seguridad para proteger categorías y productos.
                  </span>
                </>
              ) : isCatalogUnlocked ? (
                <>
                  <Unlock size={18} />
                  <span>
                    <strong>Catálogo desbloqueado:</strong> podés agregar, editar y organizar categorías y productos.
                  </span>
                </>
              ) : (
                <>
                  <Lock size={18} />
                  <span>
                    <strong>Catálogo protegido con PIN:</strong> modo solo lectura para evitar cambios accidentales.
                  </span>
                </>
              )}
            </div>

            <div className="pin-bar-actions">
              {!pinConfigurado ? (
                <button
                  type="button"
                  onClick={() => setPinModal({ isOpen: true, mode: 'setup', pendingAction: null })}
                  className="btn-primary"
                >
                  <KeyRound size={15} /> Configurar PIN
                </button>
              ) : isCatalogUnlocked ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPinModal({ isOpen: true, mode: 'change', pendingAction: null })}
                    className="btn-secondary-sm"
                  >
                    <KeyRound size={14} /> Cambiar PIN
                  </button>
                  <button
                    type="button"
                    onClick={handleLockCatalog}
                    className="btn-secondary-sm"
                  >
                    <Lock size={14} /> Bloquear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPinModal({ isOpen: true, mode: 'verify', pendingAction: null })}
                  className="btn-primary"
                >
                  <Unlock size={15} /> Desbloquear con PIN
                </button>
              )}
            </div>
          </div>

          <div className="catalog-master-detail">
            <aside className="categories-panel">
              <div className="panel-section-header">
                <h4>
                  <FolderOpen size={16} /> Categorías
                </h4>
                <button
                  type="button"
                  onClick={() => runProtectedAction(() => setModalCategoria({ isOpen: true, item: null }))}
                  className="btn-primary-sm"
                >
                  <Plus size={14} /> Categoría
                </button>
              </div>

              <div className="categories-list">
                <button
                  type="button"
                  onClick={() => setSelectedCatId('ALL')}
                  className={`category-row-btn ${selectedCatId === 'ALL' ? 'active' : ''}`}
                >
                  <span className="cat-row-name">Todas las categorías</span>
                  <span className="cat-row-count">{modelos.length}</span>
                </button>

                {categorias.map((cat) => {
                  const count = modelos.filter((m) => m.categoria_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className={`category-row-item ${String(selectedCatId) === String(cat.id) ? 'active' : ''} ${cat.activo === 0 ? 'inactive' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCatId(String(cat.id))}
                        className="category-row-select"
                      >
                        <div className="cat-row-title-wrap">
                          <span className="cat-row-name">{cat.nombre}</span>
                          {cat.es_ejemplo === 1 && <span className="sample-pill-sm">Muestra</span>}
                          {cat.activo === 0 && <span className="inactive-pill-sm">Inactiva</span>}
                        </div>
                        <span className="cat-row-count">{count}</span>
                      </button>

                      <div className="category-row-actions">
                        <button
                          type="button"
                          onClick={() => runProtectedAction(() => setModalCategoria({ isOpen: true, item: cat }))}
                          className="btn-icon-xs"
                          title="Editar categoría"
                        >
                          <Edit2 size={13} />
                        </button>
                        {cat.es_ejemplo === 0 && (
                          <button
                            type="button"
                            onClick={() => handleToggleCategoriaActivo(cat)}
                            className="btn-icon-xs"
                            title={cat.activo === 1 ? 'Desactivar' : 'Activar'}
                          >
                            <Power size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCategoria(cat)}
                          className="btn-icon-xs danger"
                          title="Eliminar categoría"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="models-panel">
              <div className="pane-toolbar">
                <div className="modelo-search-wrapper admin-search">
                  <Search size={15} className="search-icon-inline" />
                  <input
                    type="text"
                    value={searchCatalogo}
                    onChange={(e) => setSearchCatalogo(e.target.value)}
                    placeholder="Buscar producto por nombre o código..."
                    className="input-search-modelo"
                  />
                </div>
                <button
                  type="button"
                  onClick={openNuevoModeloModal}
                  className="btn-primary"
                >
                  <Plus size={16} /> Nuevo Producto
                </button>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto / Mueble</th>
                      <th>Categoría</th>
                      <th>Código</th>
                      <th>Estado</th>
                      <th style={{ width: '140px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelosEnCategoria.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                          No hay productos en esta categoría.
                        </td>
                      </tr>
                    ) : (
                      modelosEnCategoria.map((m) => (
                        <tr key={m.id} className={m.activo === 0 ? 'row-inactive' : ''}>
                          <td>
                            <div className="bold-cell">
                              {m.nombre}
                              {m.es_ejemplo === 1 && (
                                <span className="sample-pill-sm" style={{ marginLeft: '8px' }}>
                                  Ejemplo (No suma)
                                </span>
                              )}
                            </div>
                            {m.descripcion && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {m.descripcion}
                              </div>
                            )}
                          </td>
                          <td>{m.categoria_nombre || 'Sin categoría'}</td>
                          <td>{m.codigo || '-'}</td>
                          <td>
                            <span className={`status-pill ${m.activo === 1 ? 'active' : 'inactive'}`}>
                              {m.activo === 1 ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                onClick={() =>
                                  runProtectedAction(() =>
                                    setModalModelo({ isOpen: true, item: m })
                                  )
                                }
                                className="btn-icon-action"
                                title="Editar (requiere PIN)"
                              >
                                <Edit2 size={16} />
                              </button>
                              {m.es_ejemplo === 0 && (
                                <button
                                  onClick={() => handleToggleModeloActivo(m)}
                                  className={`btn-icon-action ${m.activo === 1 ? 'btn-deactivate' : 'btn-activate'}`}
                                  title={m.activo === 1 ? 'Desactivar' : 'Activar'}
                                >
                                  <Power size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteModelo(m.id)}
                                className="btn-icon-action btn-delete"
                                title="Eliminar o desactivar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 3: ENCARGADOS, TIPOS DE PROBLEMA Y SECTORES (TODO EDITABLE) */}
      {activeTab === 'listas' && (
        <div className="tab-pane">
          <div className="lists-sections-stack">
            {/* 1. ENCARGADOS */}
            <section className="list-config-card">
              <div className="pane-toolbar">
                <div>
                  <h3 className="list-section-title">
                    <UserCheck size={18} /> Encargados y Planilla Excel Asignada
                  </h3>
                  <p className="list-section-sub">
                    Cada reporte se envía a la planilla del encargado seleccionado en <code>Carga_Semanal\</code>.
                  </p>
                </div>
                <button
                  onClick={() => setModalEncargado({ isOpen: true, item: null })}
                  className="btn-primary"
                >
                  <Plus size={16} /> Nuevo Encargado
                </button>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Sector habitual</th>
                      <th>Archivo Excel en Carga_Semanal</th>
                      <th>Estado</th>
                      <th style={{ width: '140px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encargados.map((enc) => (
                      <tr key={enc.id} className={enc.activo === 0 ? 'row-inactive' : ''}>
                        <td className="bold-cell">{enc.nombre}</td>
                        <td>{enc.sector_default || '-'}</td>
                        <td><code>{enc.archivo_excel || 'Auto por sector'}</code></td>
                        <td>
                          <span className={`status-pill ${enc.activo === 1 ? 'active' : 'inactive'}`}>
                            {enc.activo === 1 ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button onClick={() => setModalEncargado({ isOpen: true, item: enc })} className="btn-icon-action" title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleToggleEncargadoActivo(enc)} className={`btn-icon-action ${enc.activo === 1 ? 'btn-deactivate' : 'btn-activate'}`} title={enc.activo === 1 ? 'Desactivar' : 'Activar'}>
                              <Power size={16} />
                            </button>
                            <button onClick={() => handleDeleteEncargado(enc.id)} className="btn-icon-action btn-delete" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 2. TIPOS DE PROBLEMA */}
            <section className="list-config-card">
              <div className="pane-toolbar">
                <div>
                  <h3 className="list-section-title">
                    <AlertTriangle size={18} /> Tipos de Problema (Categorías Pareto)
                  </h3>
                  <p className="list-section-sub">
                    Podés renombrar, agregar o quitar categorías de problemas según el vocabulario de planta.
                  </p>
                </div>
                <button
                  onClick={() => setModalTipoProblema({ isOpen: true, item: null })}
                  className="btn-primary"
                >
                  <Plus size={16} /> Nuevo Tipo
                </button>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre del Tipo de Problema</th>
                      <th>Estado</th>
                      <th style={{ width: '140px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiposProblema.map((tp) => (
                      <tr key={tp.id} className={tp.activo === 0 ? 'row-inactive' : ''}>
                        <td className="bold-cell">{tp.nombre}</td>
                        <td>
                          <span className={`status-pill ${tp.activo === 1 ? 'active' : 'inactive'}`}>
                            {tp.activo === 1 ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button onClick={() => setModalTipoProblema({ isOpen: true, item: tp })} className="btn-icon-action" title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleToggleTipoProblemaActivo(tp)} className={`btn-icon-action ${tp.activo === 1 ? 'btn-deactivate' : 'btn-activate'}`} title={tp.activo === 1 ? 'Desactivar' : 'Activar'}>
                              <Power size={16} />
                            </button>
                            <button onClick={() => handleDeleteTipoProblema(tp.id)} className="btn-icon-action btn-delete" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. SECTORES */}
            <section className="list-config-card">
              <div className="pane-toolbar">
                <div>
                  <h3 className="list-section-title">
                    <MapPin size={18} /> Sectores de Planta
                  </h3>
                </div>
                <button
                  onClick={() => setModalSector({ isOpen: true, item: null })}
                  className="btn-primary"
                >
                  <Plus size={16} /> Nuevo Sector
                </button>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre del Sector</th>
                      <th>Estado</th>
                      <th style={{ width: '140px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectores.map((s) => (
                      <tr key={s.id} className={s.activo === 0 ? 'row-inactive' : ''}>
                        <td className="bold-cell">{s.nombre}</td>
                        <td>
                          <span className={`status-pill ${s.activo === 1 ? 'active' : 'inactive'}`}>
                            {s.activo === 1 ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button onClick={() => setModalSector({ isOpen: true, item: s })} className="btn-icon-action" title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleToggleSectorActivo(s)} className={`btn-icon-action ${s.activo === 1 ? 'btn-deactivate' : 'btn-activate'}`} title={s.activo === 1 ? 'Desactivar' : 'Activar'}>
                              <Power size={16} />
                            </button>
                            <button onClick={() => handleDeleteSector(s.id)} className="btn-icon-action btn-delete" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 4: DASHBOARD & PARETO */}
      {activeTab === 'dashboard' && (
        <div className="tab-pane">
          <DashboardView
            reportes={reportes}
            sectores={sectores}
            modelos={modelos}
          />
        </div>
      )}

      {/* MODAL ZOOM FOTO */}
      {zoomedPhoto && (
        <div className="lightbox-backdrop" onClick={() => setZoomedPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={zoomedPhoto} alt="Zoom" className="lightbox-img" />
            <button onClick={() => setZoomedPhoto(null)} className="btn-lightbox-close">
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL EDITAR REPORTE */}
      {modalReporteEdit.isOpen && (
        <ReporteEditModalForm
          item={modalReporteEdit.item}
          encargados={encargados}
          sectores={sectores}
          tiposProblema={tiposProblema}
          modelos={modelos.filter((m) => !m.es_ejemplo)}
          onClose={() => setModalReporteEdit({ isOpen: false, item: null })}
          onSave={handleSaveReporteEdit}
        />
      )}

      {/* MODAL PIN DE SEGURIDAD */}
      {pinModal.isOpen && (
        <PinModal
          mode={pinModal.mode}
          onClose={() => setPinModal({ isOpen: false, mode: 'verify', pendingAction: null })}
          onSuccess={(newValidPin) => {
            if (newValidPin) {
              sessionStorage.setItem(PIN_SESSION_KEY, newValidPin);
              setAdminPin(newValidPin);
            }
            setPinConfigurado(true);
            const act = pinModal.pendingAction;
            setPinModal({ isOpen: false, mode: 'verify', pendingAction: null });
            if (act && newValidPin) act(newValidPin);
          }}
        />
      )}

      {/* MODALES CRUD */}
      {modalCategoria.isOpen && (
        <SimpleNameModal
          title={modalCategoria.item ? 'Editar Categoría' : 'Nueva Categoría de Mueble'}
          label="Nombre de la Categoría:"
          placeholder="Ej: Mesas, Sillas, Placares..."
          initialValue={modalCategoria.item?.nombre || ''}
          onClose={() => setModalCategoria({ isOpen: false, item: null })}
          onSave={handleSaveCategoria}
        />
      )}

      {modalSector.isOpen && (
        <SimpleNameModal
          title={modalSector.item ? 'Editar Sector' : 'Nuevo Sector de Planta'}
          label="Nombre del Sector:"
          placeholder="Ej: Maquinado, Lijado, Armado..."
          initialValue={modalSector.item?.nombre || ''}
          onClose={() => setModalSector({ isOpen: false, item: null })}
          onSave={handleSaveSector}
        />
      )}

      {modalTipoProblema.isOpen && (
        <SimpleNameModal
          title={modalTipoProblema.item ? 'Editar Tipo de Problema' : 'Nuevo Tipo de Problema'}
          label="Nombre del Tipo de Problema:"
          placeholder="Ej: FALTANTE DE PIEZAS, DEFECTO DE MAQUINADO..."
          initialValue={modalTipoProblema.item?.nombre || ''}
          onClose={() => setModalTipoProblema({ isOpen: false, item: null })}
          onSave={handleSaveTipoProblema}
        />
      )}

      {modalEncargado.isOpen && (
        <EncargadoModalForm
          item={modalEncargado.item}
          sectores={sectores}
          planillas={planillasDisponibles}
          onClose={() => setModalEncargado({ isOpen: false, item: null })}
          onSave={handleSaveEncargado}
        />
      )}

      {modalModelo.isOpen && (
        <ModeloModalForm
          item={modalModelo.item}
          categorias={categoriasReales}
          defaultCategoriaId={modalModelo.defaultCategoriaId}
          onClose={() => setModalModelo({ isOpen: false, item: null })}
          onSave={handleSaveModelo}
        />
      )}

      {/* MODAL QR PARA CELULARES */}
      {isQrModalOpen && (() => {
        const baseServerUrl = serverInfo?.server_url || window.location.origin;
        const certDownloadUrl = `${baseServerUrl}/api/ca-cert`;
        const activeQrValue = qrMode === 'cert' ? certDownloadUrl : baseServerUrl;
        return (
          <div className="modal-backdrop" onClick={() => setIsQrModalOpen(false)}>
            <div className="modal-card qr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-box">
                  {qrMode === 'cert' ? <ShieldCheck size={20} /> : <QrCode size={20} />}
                  <h3>{qrMode === 'cert' ? 'Certificado SSL para Celulares' : 'Código QR para Celulares'}</h3>
                </div>
                <button onClick={() => setIsQrModalOpen(false)} className="btn-close-modal">
                  <X size={20} />
                </button>
              </div>
              <div className="qr-modal-body">
                <div className="qr-mode-switcher">
                  <button
                    type="button"
                    onClick={() => setQrMode('app')}
                    className={`qr-mode-btn ${qrMode === 'app' ? 'active' : ''}`}
                  >
                    <Smartphone size={15} />
                    <span>App Celulares</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode('cert')}
                    className={`qr-mode-btn ${qrMode === 'cert' ? 'active' : ''}`}
                  >
                    <ShieldCheck size={15} />
                    <span>Certificado SSL</span>
                  </button>
                </div>

                <div className="qr-code-wrapper">
                  <QRCodeSVG
                    value={activeQrValue}
                    size={220}
                    level="M"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>

                <div className="qr-url-box">
                  <span className="qr-url-text">{activeQrValue}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeQrValue);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="btn-copy-url"
                  >
                    {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                {qrMode === 'app' ? (
                  <div className="qr-steps-list">
                    <div className="qr-step-item">
                      <span className="step-num">1</span>
                      <span>Conectá el celular al Wi-Fi de la fábrica.</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">2</span>
                      <span>Escaneá este QR con la cámara. Si aparece aviso de privacidad, instalá primero el <strong>Certificado SSL</strong>.</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">3</span>
                      <span>En Chrome tocá <strong>"Instalar aplicación"</strong> para sacar o subir fotos rápido.</span>
                    </div>
                  </div>
                ) : (
                  <div className="qr-steps-list">
                    <div className="qr-step-item">
                      <span className="step-num">1</span>
                      <span>Escaneá este QR para bajar <code>FabricaCalidadRootCA.crt</code>.</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">2</span>
                      <span>En Android: <strong>Ajustes → Seguridad → Instalar certificado → Certificado de CA</strong>.</span>
                    </div>
                    <a href={certDownloadUrl} className="btn-cert-download">
                      <Download size={16} />
                      <span>Descargar Certificado (.crt)</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ReporteEditModalForm({
  item,
  encargados,
  sectores,
  tiposProblema,
  modelos,
  onClose,
  onSave
}) {
  const [encargadoId, setEncargadoId] = useState(item?.encargado_id ? String(item.encargado_id) : '');
  const [sectorId, setSectorId] = useState(item?.sector_id ? String(item.sector_id) : '');
  const [tipoProblemaId, setTipoProblemaId] = useState(item?.tipo_problema_id ? String(item.tipo_problema_id) : '');
  const [impacto, setImpacto] = useState(item?.impacto || 'DEFECTO');
  const [modeloId, setModeloId] = useState(item?.modelo_id ? String(item.modelo_id) : '');
  const [modeloManual, setModeloManual] = useState(item?.modelo_manual || '');
  const [detallePieza, setDetallePieza] = useState(item?.detalle_pieza || '');
  const [cantidad, setCantidad] = useState(item?.cantidad_afectada || '');
  const [descripcion, setDescripcion] = useState(item?.descripcion_defecto || '');
  const [accionInmediata, setAccionInmediata] = useState(item?.accion_inmediata || '');
  const [estado, setEstado] = useState(item?.estado || 'Abierto');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cantidad.trim() || !descripcion.trim()) {
      alert('Cantidad y descripción son obligatorias.');
      return;
    }
    onSave({
      encargado_id: encargadoId ? Number(encargadoId) : null,
      sector_id: sectorId ? Number(sectorId) : undefined,
      tipo_problema_id: tipoProblemaId ? Number(tipoProblemaId) : null,
      impacto,
      modelo_id: modeloId ? Number(modeloId) : null,
      modelo_manual: modeloId ? null : (modeloManual.trim() || 'General'),
      detalle_pieza: detallePieza.trim() || null,
      cantidad_afectada: cantidad.trim(),
      descripcion_defecto: descripcion.trim(),
      accion_inmediata: accionInmediata.trim() || null,
      estado
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-wide">
        <div className="modal-header">
          <h3>Editar Problema #{item.id}</h3>
          <button onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid-2">
            <div>
              <label className="field-label">Encargado:</label>
              <select value={encargadoId} onChange={(e) => setEncargadoId(e.target.value)} className="select-input">
                <option value="">-- Sin asignar --</option>
                {encargados.map((enc) => (
                  <option key={enc.id} value={enc.id}>{enc.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Sector / Área:</label>
              <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className="select-input" required>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="field-label">Tipo de Problema:</label>
              <select value={tipoProblemaId} onChange={(e) => setTipoProblemaId(e.target.value)} className="select-input">
                <option value="">-- Sin especificar --</option>
                {tiposProblema.map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Impacto:</label>
              <select value={impacto} onChange={(e) => setImpacto(e.target.value)} className="select-input">
                {IMPACTOS.map((imp) => (
                  <option key={imp} value={imp}>{imp}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="field-label">Producto del catálogo:</label>
              <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className="select-input">
                <option value="">-- Usar nombre manual / General --</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} {m.codigo ? `(${m.codigo})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Producto Manual (si no está en catálogo):</label>
              <input
                type="text"
                value={modeloManual}
                onChange={(e) => setModeloManual(e.target.value)}
                disabled={Boolean(modeloId)}
                placeholder="General / Prototipo"
                className="input-text"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="field-label">Detalle de Pieza o Insumo:</label>
              <input type="text" value={detallePieza} onChange={(e) => setDetallePieza(e.target.value)} className="input-text" />
            </div>
            <div>
              <label className="field-label">Cantidad Afectada:</label>
              <input type="text" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="input-text" required />
            </div>
          </div>

          <label className="field-label">Descripción del Problema:</label>
          <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="textarea-input" required />

          <div className="form-grid-2">
            <div>
              <label className="field-label">Acción Inmediata Tomada:</label>
              <input type="text" value={accionInmediata} onChange={(e) => setAccionInmediata(e.target.value)} className="input-text" />
            </div>
            <div>
              <label className="field-label">Estado:</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="select-input">
                {ESTADOS.map((est) => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary"><Check size={16} /> Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EncargadoModalForm({ item, sectores, planillas, onClose, onSave }) {
  const [nombre, setNombre] = useState(item?.nombre || '');
  const [sectorDefault, setSectorDefault] = useState(item?.sector_default || '');
  const [archivoExcel, setArchivoExcel] = useState(item?.archivo_excel || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('El nombre del encargado es obligatorio.');
    onSave({
      nombre: nombre.trim(),
      sector_default: sectorDefault.trim() || null,
      archivo_excel: archivoExcel.trim() || null
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{item ? 'Editar Encargado' : 'Nuevo Encargado'}</h3>
          <button onClick={onClose} className="btn-close-modal"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field-label">Nombre del Encargado:</label>
          <input
            type="text"
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Lucas L."
            className="input-text"
          />

          <label className="field-label">Sector habitual (auto-selección):</label>
          <select value={sectorDefault} onChange={(e) => setSectorDefault(e.target.value)} className="select-input">
            <option value="">-- Ninguno --</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.nombre}>{s.nombre}</option>
            ))}
          </select>

          <label className="field-label">Archivo Excel en Carga_Semanal:</label>
          <input
            type="text"
            list="planillas-datalist"
            value={archivoExcel}
            onChange={(e) => setArchivoExcel(e.target.value)}
            placeholder="Ej: Encargado_1_Armado.xlsx"
            className="input-text"
          />
          <datalist id="planillas-datalist">
            {planillas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary"><Check size={16} /> Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SimpleNameModal({ title, label, placeholder, initialValue, onClose, onSave }) {
  const [nombre, setNombre] = useState(initialValue || '');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('Este campo es obligatorio.');
    onSave(nombre.trim());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="btn-close-modal"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field-label">{label}</label>
          <input
            type="text"
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={placeholder}
            className="input-text"
          />
          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary"><Check size={16} /> Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PinModal({ mode, onClose, onSuccess }) {
  const [pinActual, setPinActual] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'setup') {
      if (pin.trim().length < 4) return setError('El PIN debe tener al menos 4 caracteres.');
      if (pin !== pinConfirm) return setError('Los PIN ingresados no coinciden.');
      setBusy(true);
      try {
        await setupAdminPin(pin.trim());
        onSuccess(pin.trim());
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode === 'verify') {
      if (!pin.trim()) return setError('Ingresá tu PIN.');
      setBusy(true);
      try {
        await verifyAdminPin(pin.trim());
        onSuccess(pin.trim());
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode === 'change') {
      if (!pinActual.trim()) return setError('Ingresá tu PIN actual.');
      if (pin.trim().length < 4) return setError('El PIN nuevo debe tener al menos 4 caracteres.');
      if (pin !== pinConfirm) return setError('El PIN nuevo y su confirmación no coinciden.');
      setBusy(true);
      try {
        await changeAdminPin(pinActual.trim(), pin.trim());
        onSuccess(pin.trim());
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }
  };

  const title =
    mode === 'setup'
      ? 'Configurar PIN de Seguridad'
      : mode === 'change'
      ? 'Cambiar PIN de Seguridad'
      : 'Desbloquear Productos y Categorías';

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-box">
            <KeyRound size={18} />
            <h3>{title}</h3>
          </div>
          <button onClick={onClose} className="btn-close-modal"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {mode === 'setup' && (
            <p className="modal-help-text">
              Este PIN protege el catálogo de productos y categorías para evitar cambios accidentales.
            </p>
          )}
          {error && <div className="alert-error-box">{error}</div>}

          {mode === 'change' && (
            <>
              <label className="field-label">PIN Actual:</label>
              <input type="password" inputMode="numeric" autoFocus value={pinActual} onChange={(e) => setPinActual(e.target.value)} placeholder="PIN actual" className="input-text" />
            </>
          )}

          <label className="field-label">{mode === 'verify' ? 'Ingresá tu PIN:' : 'Nuevo PIN (4 a 12 caracteres):'}</label>
          <input type="password" inputMode="numeric" autoFocus={mode !== 'change'} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Ej: 4826" className="input-text" />

          {(mode === 'setup' || mode === 'change') && (
            <>
              <label className="field-label">Confirmar PIN:</label>
              <input type="password" inputMode="numeric" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} placeholder="Repetí el PIN" className="input-text" />
            </>
          )}

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={busy} className="btn-primary">
              <Check size={16} /> {busy ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModeloModalForm({ item, categorias, defaultCategoriaId, onClose, onSave }) {
  const [nombre, setNombre] = useState(item?.nombre || '');
  const [categoriaId, setCategoriaId] = useState(
    item?.categoria_id ? String(item.categoria_id) : defaultCategoriaId ? String(defaultCategoriaId) : ''
  );
  const [codigo, setCodigo] = useState(item?.codigo || '');
  const [descripcion, setDescripcion] = useState(item?.descripcion || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('El nombre es obligatorio.');
    onSave({
      nombre: nombre.trim(),
      categoria_id: categoriaId ? Number(categoriaId) : null,
      codigo: codigo.trim() || null,
      descripcion: descripcion.trim() || null
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{item ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button onClick={onClose} className="btn-close-modal"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field-label">Categoría:</label>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="select-input">
            <option value="">-- Sin categoría --</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          <label className="field-label">Nombre del Producto:</label>
          <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Silla Docta" className="input-text" />

          <label className="field-label">Código (Opcional):</label>
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: 505001" className="input-text" />

          <label className="field-label">Nota / Descripción (Opcional):</label>
          <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Notas técnicas..." className="textarea-input" />

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary"><Check size={16} /> Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
