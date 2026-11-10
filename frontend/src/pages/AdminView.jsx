import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchReportesAdmin,
  deleteEjemploReporteAdmin,
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
  FolderOpen
} from 'lucide-react';

const PIN_SESSION_KEY = 'admin_catalog_pin';

export function AdminView({ backendReachable }) {
  const [activeTab, setActiveTab] = useState('reportes'); // 'reportes' | 'modelos' | 'sectores' | 'dashboard'

  // Datos
  const [reportes, setReportes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [sectores, setSectores] = useState([]);

  // Filtros de reportes (en memoria sobre los recibidos para no afectar Dashboard)
  const [filtroSector, setFiltroSector] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pestaña Categorías y Muebles (Opción A)
  const [selectedCatId, setSelectedCatId] = useState('ALL');
  const [searchCatalogo, setSearchCatalogo] = useState('');

  // Seguridad PIN (exclusivo para Categorías y Modelos)
  const [pinConfigurado, setPinConfigurado] = useState(false);
  const [adminPin, setAdminPin] = useState(() => sessionStorage.getItem(PIN_SESSION_KEY) || '');
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    mode: 'verify', // 'setup' | 'verify' | 'change'
    pendingAction: null
  });

  // Modal de Zoom de Foto
  const [zoomedPhoto, setZoomedPhoto] = useState(null);

  // Modales de CRUD y QR
  const [modalCategoria, setModalCategoria] = useState({ isOpen: false, item: null });
  const [modalModelo, setModalModelo] = useState({ isOpen: false, item: null });
  const [modalSector, setModalSector] = useState({ isOpen: false, item: null });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrMode, setQrMode] = useState('app');
  const [serverInfo, setServerInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadAll = async () => {
    if (!backendReachable) return;
    setIsLoading(true);
    try {
      const [reps, cats, mods, secs, sInfo, pinStat] = await Promise.all([
        fetchReportesAdmin({ limite: 500 }),
        fetchCategoriasAdmin(false),
        fetchModelosAdmin(false),
        fetchSectoresAdmin(false),
        fetchServerInfo().catch(() => null),
        fetchPinStatusAdmin().catch(() => ({ pin_configurado: false }))
      ]);
      setReportes(reps);
      setCategorias(cats);
      setModelos(mods);
      setSectores(secs);
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

  // Reportes filtrados para la pestaña Reportes
  const filteredReportes = useMemo(() => {
    return reportes.filter((rep) => {
      if (filtroSector && String(rep.sector_id) !== String(filtroSector)) return false;
      if (filtroCategoria === '__PROTOTIPO__' && rep.modelo_id !== null) return false;
      if (
        filtroCategoria &&
        filtroCategoria !== '__PROTOTIPO__' &&
        String(rep.categoria_id || '') !== String(filtroCategoria)
      ) {
        return false;
      }
      if (filtroModelo && String(rep.modelo_id || '') !== String(filtroModelo)) return false;
      return true;
    });
  }, [reportes, filtroSector, filtroCategoria, filtroModelo]);

  const reportesRealesCount = useMemo(
    () => reportes.filter((r) => !r.es_ejemplo).length,
    [reportes]
  );

  // Modelos filtrados en pestaña Categorías y Muebles
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

  // Guardián de acciones protegidas por PIN
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

  // Manejo de Categorías (protegido con PIN)
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

  // Manejo de Modelos (protegido con PIN)
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
        if (!handlePinAuthError(err)) alert(`Error al guardar modelo: ${err.message}`);
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
    if (!window.confirm('¿Confirmás eliminar o desactivar este modelo?')) return;
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

  // Manejo de Sectores (sin PIN)
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

  const handleDeleteEjemploReporte = async (id) => {
    if (!window.confirm('¿Quitar el reporte de muestra de ejemplo?')) return;
    try {
      await deleteEjemploReporteAdmin(id);
      loadAll();
    } catch (err) {
      alert(`No se pudo eliminar: ${err.message}`);
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
            <h3 className="qr-card-title">Acceso Móvil para Operarios y Jefes</h3>
            <p className="qr-card-subtitle">
              IP Servidor: <strong className="ip-highlight">{serverInfo?.local_ip || 'Detectando IP...'}</strong> • Escaneá para abrir e instalar la PWA sin escribir la dirección.
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
          <span>Reportes ({reportesRealesCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('modelos')}
          className={`admin-tab-btn ${activeTab === 'modelos' ? 'active' : ''}`}
        >
          <Layers size={18} />
          <span>Categorías y Muebles ({modelos.filter((m) => !m.es_ejemplo).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('sectores')}
          className={`admin-tab-btn ${activeTab === 'sectores' ? 'active' : ''}`}
        >
          <MapPin size={18} />
          <span>Sectores de Planta ({sectores.length})</span>
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
          La PC Central no responde. Asegurate de que el servidor esté ejecutándose con <code>iniciar_servidor.bat</code>.
        </div>
      )}

      {/* CONTENIDO TAB 1: REPORTES */}
      {activeTab === 'reportes' && (
        <div className="tab-pane">
          <div className="pane-toolbar">
            <div className="filters-row">
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
                value={filtroCategoria}
                onChange={(e) => {
                  setFiltroCategoria(e.target.value);
                  setFiltroModelo('');
                }}
                className="select-input-sm"
              >
                <option value="">Todas las Categorías</option>
                {categoriasReales.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
                <option value="__PROTOTIPO__">Otro / Prototipo</option>
              </select>

              <select
                value={filtroModelo}
                onChange={(e) => setFiltroModelo(e.target.value)}
                className="select-input-sm"
                disabled={filtroCategoria === '__PROTOTIPO__'}
              >
                <option value="">Todos los Modelos</option>
                {modelos
                  .filter(
                    (m) =>
                      !m.es_ejemplo &&
                      (!filtroCategoria || String(m.categoria_id || '') === String(filtroCategoria))
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
              </select>

              <button onClick={loadAll} className="btn-secondary-sm" title="Refrescar">
                <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
              </button>

              <button
                onClick={() => exportarReportesAExcel(filteredReportes, apiBase)}
                className="btn-export-excel"
                title="Descargar reportes reales filtrados a Excel (.csv con delimitador ;)"
              >
                <FileSpreadsheet size={16} />
                <span>Exportar a Excel</span>
              </button>
            </div>
          </div>

          {filteredReportes.length === 0 ? (
            <div className="empty-state-box">
              <ClipboardList size={40} className="empty-icon" />
              <p>No hay reportes de defectos registrados con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="reports-grid">
              {filteredReportes.map((rep) => {
                const fullPhotoUrl = `${apiBase}${rep.foto_path}`;
                return (
                  <div
                    key={rep.id}
                    className={`report-card ${rep.es_ejemplo ? 'report-card-sample' : ''}`}
                  >
                    <div
                      className="report-card-media"
                      onClick={() => setZoomedPhoto(fullPhotoUrl)}
                    >
                      <img src={fullPhotoUrl} alt="Defecto" className="report-card-img" />
                      {rep.es_ejemplo === 1 && (
                        <span className="sample-corner-badge">Ejemplo (No suma)</span>
                      )}
                      <div className="zoom-hint">
                        <ZoomIn size={16} /> Ver Foto
                      </div>
                    </div>
                    <div className="report-card-body">
                      <div className="report-header-line">
                        <div className="report-tags-group">
                          <span className="report-sector-tag">{rep.sector_nombre || 'Sector'}</span>
                          <span className="report-cat-tag">
                            {rep.categoria_nombre || 'Sin categoría'}
                          </span>
                        </div>
                        <span className="report-id-tag">#{rep.id}</span>
                      </div>

                      <h4 className="report-model-title">
                        {rep.modelo_nombre || 'Modelo'}
                        {rep.modelo_codigo && (
                          <span className="modelo-code-badge inline-code">{rep.modelo_codigo}</span>
                        )}
                      </h4>
                      <p className="report-defect-desc">{rep.descripcion_defecto}</p>
                      <div className="report-meta-box">
                        <div className="meta-item">
                          <strong>Material afectado:</strong> {rep.cantidad_afectada}
                        </div>
                        <div className="meta-item">
                          <strong>Captura en planta:</strong> {rep.fecha_captura_local} (GMT-3)
                        </div>
                        <div className="meta-item">
                          <strong>Sincronizado en PC:</strong> {rep.fecha_sincronizacion} (GMT-3)
                        </div>
                      </div>

                      {rep.es_ejemplo === 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEjemploReporte(rep.id)}
                          className="btn-dismiss-sample"
                        >
                          <Trash2 size={13} />
                          <span>Quitar reporte de ejemplo</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB 2: CATEGORÍAS Y MUEBLES (OPCIÓN A + PIN) */}
      {activeTab === 'modelos' && (
        <div className="tab-pane">
          {/* Barra de Seguridad PIN */}
          <div className={`pin-security-bar ${isCatalogUnlocked ? 'unlocked' : 'locked'}`}>
            <div className="pin-bar-status">
              {!pinConfigurado ? (
                <>
                  <KeyRound size={18} />
                  <span>
                    <strong>PIN no configurado:</strong> creá un PIN de seguridad para proteger categorías y modelos.
                  </span>
                </>
              ) : isCatalogUnlocked ? (
                <>
                  <Unlock size={18} />
                  <span>
                    <strong>Catálogo desbloqueado:</strong> podés agregar, editar y organizar categorías y muebles.
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
            {/* COLUMNA IZQUIERDA: CATEGORÍAS */}
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
                          {cat.es_ejemplo === 1 && (
                            <span className="sample-pill-sm">Muestra</span>
                          )}
                          {cat.activo === 0 && (
                            <span className="inactive-pill-sm">Inactiva</span>
                          )}
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

                {modelos.some((m) => m.categoria_id === null) && (
                  <button
                    type="button"
                    onClick={() => setSelectedCatId('NONE')}
                    className={`category-row-btn ${selectedCatId === 'NONE' ? 'active' : ''}`}
                  >
                    <span className="cat-row-name">Sin categoría</span>
                    <span className="cat-row-count">
                      {modelos.filter((m) => m.categoria_id === null).length}
                    </span>
                  </button>
                )}
              </div>
            </aside>

            {/* COLUMNA DERECHA: MODELOS DE LA CATEGORÍA */}
            <section className="models-panel">
              <div className="pane-toolbar">
                <div className="modelo-search-wrapper admin-search">
                  <Search size={15} className="search-icon-inline" />
                  <input
                    type="text"
                    value={searchCatalogo}
                    onChange={(e) => setSearchCatalogo(e.target.value)}
                    placeholder="Buscar modelo por nombre o código..."
                    className="input-search-modelo"
                  />
                </div>
                <button
                  type="button"
                  onClick={openNuevoModeloModal}
                  className="btn-primary"
                >
                  <Plus size={16} /> Nuevo Modelo
                </button>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Modelo de Mueble</th>
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
                          No hay modelos en esta categoría todavía. Tocá <strong>"+ Nuevo Modelo"</strong> para cargar el primero.
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
                                  Ejemplo (No cuenta en datos)
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
                                title="Eliminar o Soft-Delete"
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

      {/* CONTENIDO TAB 3: SECTORES */}
      {activeTab === 'sectores' && (
        <div className="tab-pane">
          <div className="pane-toolbar right">
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
                  <th style={{ width: '150px' }}>Acciones</th>
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
                        <button
                          onClick={() => setModalSector({ isOpen: true, item: s })}
                          className="btn-icon-action"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleSectorActivo(s)}
                          className={`btn-icon-action ${s.activo === 1 ? 'btn-deactivate' : 'btn-activate'}`}
                          title={s.activo === 1 ? 'Desactivar' : 'Activar'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSector(s.id)}
                          className="btn-icon-action btn-delete"
                          title="Eliminar o Soft-Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* MODAL EDITAR / CREAR CATEGORÍA */}
      {modalCategoria.isOpen && (
        <CategoriaModalForm
          item={modalCategoria.item}
          onClose={() => setModalCategoria({ isOpen: false, item: null })}
          onSave={handleSaveCategoria}
        />
      )}

      {/* MODAL EDITAR / CREAR MODELO */}
      {modalModelo.isOpen && (
        <ModeloModalForm
          item={modalModelo.item}
          categorias={categoriasReales}
          defaultCategoriaId={modalModelo.defaultCategoriaId}
          onClose={() => setModalModelo({ isOpen: false, item: null })}
          onSave={handleSaveModelo}
        />
      )}

      {/* MODAL EDITAR / CREAR SECTOR */}
      {modalSector.isOpen && (
        <SectorModalForm
          item={modalSector.item}
          onClose={() => setModalSector({ isOpen: false, item: null })}
          onSave={handleSaveSector}
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
                    <span>App Operarios</span>
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
                      <span>Conectá el celular a la red WiFi de la fábrica.</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">2</span>
                      <span>Escaneá este QR con la cámara. Si aparece aviso de privacidad, instalá primero el <strong>Certificado SSL</strong> (pestaña de arriba).</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">3</span>
                      <span>En Chrome tocá <strong>"Instalar aplicación"</strong> para usar cámara y guardado offline.</span>
                    </div>
                  </div>
                ) : (
                  <div className="qr-steps-list">
                    <div className="qr-step-item">
                      <span className="step-num">1</span>
                      <span>Escaneá este QR desde el celular para bajar <code>FabricaCalidadRootCA.crt</code> (o descargalo acá abajo).</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">2</span>
                      <span>En Android: <strong>Ajustes → Seguridad → Más ajustes → Instalar certificado → Certificado de CA</strong> y elegí el archivo bajado.</span>
                    </div>
                    <div className="qr-step-item">
                      <span className="step-num">3</span>
                      <span>En iPhone: abrí el perfil bajado en <strong>Ajustes</strong> e instalalo, luego activalo en <strong>General → Información → Confianza en certificados</strong>.</span>
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
      : 'Desbloquear Categorías y Modelos';

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-box">
            <KeyRound size={18} />
            <h3>{title}</h3>
          </div>
          <button onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {mode === 'setup' && (
            <p className="modal-help-text">
              Este PIN protege los nombres de tus categorías y modelos para que nadie en planta pueda alterarlos ni borrarlos.
            </p>
          )}
          {error && <div className="alert-error-box">{error}</div>}

          {mode === 'change' && (
            <>
              <label className="field-label">PIN Actual:</label>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pinActual}
                onChange={(e) => setPinActual(e.target.value)}
                placeholder="PIN actual"
                className="input-text"
              />
            </>
          )}

          <label className="field-label">
            {mode === 'verify' ? 'Ingresá tu PIN:' : 'Nuevo PIN (4 a 12 caracteres):'}
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoFocus={mode !== 'change'}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Ej: 4826"
            className="input-text"
          />

          {(mode === 'setup' || mode === 'change') && (
            <>
              <label className="field-label">Confirmar PIN:</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                placeholder="Repetí el PIN"
                className="input-text"
              />
            </>
          )}

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              <Check size={16} /> {busy ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoriaModalForm({ item, onClose, onSave }) {
  const [nombre, setNombre] = useState(item?.nombre || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('El nombre de la categoría es obligatorio.');
    onSave(nombre.trim());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{item ? 'Editar Categoría' : 'Nueva Categoría de Mueble'}</h3>
          <button onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field-label">Nombre de la Categoría:</label>
          <input
            type="text"
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Mesas, Sillas, Placares, Racks..."
            className="input-text"
          />
          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} /> Guardar
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
          <h3>{item ? 'Editar Modelo' : 'Nuevo Modelo de Mueble'}</h3>
          <button onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field-label">Categoría:</label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="select-input"
          >
            <option value="">-- Sin categoría --</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <label className="field-label">Nombre del Modelo:</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Mesa Comedor 1.60m"
            className="input-text"
          />

          <label className="field-label">Código / SKU (Opcional):</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej: MC-160"
            className="input-text"
          />

          <label className="field-label">Descripción (Opcional):</label>
          <textarea
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalles de fabricación..."
            className="textarea-input"
          />

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectorModalForm({ item, onClose, onSave }) {
  const [nombre, setNombre] = useState(item?.nombre || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('El nombre del sector es obligatorio');
    onSave(nombre.trim());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{item ? 'Editar Sector' : 'Nuevo Sector de Planta'}</h3>
          <button onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field-label">Nombre del Sector:</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Maquinado, Lijado, Tapicería..."
            className="input-text"
          />

          <div className="modal-footer-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
