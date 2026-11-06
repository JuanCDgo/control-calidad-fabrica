import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchReportesAdmin,
  fetchModelosAdmin,
  createModeloAdmin,
  updateModeloAdmin,
  deleteModeloAdmin,
  fetchSectoresAdmin,
  createSectorAdmin,
  updateSectorAdmin,
  deleteSectorAdmin,
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
  ExternalLink,
  ZoomIn,
  QrCode,
  Copy,
  CheckCheck,
  Smartphone,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';

export function AdminView({ backendReachable }) {
  const [activeTab, setActiveTab] = useState('reportes'); // 'reportes' | 'modelos' | 'sectores'

  // Datos
  const [reportes, setReportes] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [sectores, setSectores] = useState([]);

  // Filtros de reportes
  const [filtroSector, setFiltroSector] = useState('');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal de Zoom de Foto
  const [zoomedPhoto, setZoomedPhoto] = useState(null);

  // Modales de CRUD y QR
  const [modalModelo, setModalModelo] = useState({ isOpen: false, item: null });
  const [modalSector, setModalSector] = useState({ isOpen: false, item: null });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  // Cargas de datos
  const loadAll = async () => {
    if (!backendReachable) return;
    setIsLoading(true);
    try {
      const [reps, mods, secs, sInfo] = await Promise.all([
        fetchReportesAdmin({
          sector_id: filtroSector || undefined,
          modelo_id: filtroModelo || undefined
        }),
        fetchModelosAdmin(false),
        fetchSectoresAdmin(false),
        fetchServerInfo().catch(() => null)
      ]);
      setReportes(reps);
      setModelos(mods);
      setSectores(secs);
      if (sInfo) setServerInfo(sInfo);
    } catch (err) {
      console.error('Error al cargar datos de admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [backendReachable, filtroSector, filtroModelo]);

  // Manejo de Modelos
  const handleSaveModelo = async (formData) => {
    try {
      if (modalModelo.item) {
        await updateModeloAdmin(modalModelo.item.id, formData);
      } else {
        await createModeloAdmin(formData);
      }
      setModalModelo({ isOpen: false, item: null });
      loadAll();
    } catch (err) {
      alert(`Error al guardar modelo: ${err.message}`);
    }
  };

  const handleToggleModeloActivo = async (item) => {
    try {
      await updateModeloAdmin(item.id, { activo: item.activo === 1 ? 0 : 1 });
      loadAll();
    } catch (err) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleDeleteModelo = async (id) => {
    if (!window.confirm('¿Confirmás eliminar o desactivar este modelo?')) return;
    try {
      const res = await deleteModeloAdmin(id);
      alert(res.mensaje);
      loadAll();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Manejo de Sectores
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

  const apiBase = getApiBaseUrl();

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
          <span>Reportes de Calidad ({reportes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('modelos')}
          className={`admin-tab-btn ${activeTab === 'modelos' ? 'active' : ''}`}
        >
          <Layers size={18} />
          <span>Modelos de Muebles ({modelos.length})</span>
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
          ⚠️ La PC Central no responde. Asegurate de que el backend FastAPI esté corriendo en <code>backend/run_server.py</code>.
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
                value={filtroModelo}
                onChange={(e) => setFiltroModelo(e.target.value)}
                className="select-input-sm"
              >
                <option value="">Todos los Modelos</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>

              <button onClick={loadAll} className="btn-secondary-sm" title="Refrescar">
                <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
              </button>

              <button
                onClick={() => exportarReportesAExcel(reportes, apiBase)}
                className="btn-export-excel"
                title="Descargar reportes filtrados a Excel (.csv con delimitador ; y formato UTF-8)"
              >
                <FileSpreadsheet size={16} />
                <span>Exportar a Excel</span>
              </button>
            </div>
          </div>

          {reportes.length === 0 ? (
            <div className="empty-state-box">
              <ClipboardList size={40} className="empty-icon" />
              <p>No hay reportes de defectos registrados con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="reports-grid">
              {reportes.map((rep) => {
                const fullPhotoUrl = `${apiBase}${rep.foto_path}`;
                return (
                  <div key={rep.id} className="report-card">
                    <div
                      className="report-card-media"
                      onClick={() => setZoomedPhoto(fullPhotoUrl)}
                    >
                      <img src={fullPhotoUrl} alt="Defecto" className="report-card-img" />
                      <div className="zoom-hint">
                        <ZoomIn size={16} /> Ver Foto
                      </div>
                    </div>
                    <div className="report-card-body">
                      <div className="report-header-line">
                        <span className="report-sector-tag">{rep.sector_nombre || 'Sector'}</span>
                        <span className="report-id-tag">#{rep.id}</span>
                      </div>
                      <h4 className="report-model-title">{rep.modelo_nombre || 'Modelo'}</h4>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB 2: MODELOS */}
      {activeTab === 'modelos' && (
        <div className="tab-pane">
          <div className="pane-toolbar right">
            <button
              onClick={() => setModalModelo({ isOpen: true, item: null })}
              className="btn-primary"
            >
              <Plus size={16} /> Nuevo Modelo
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre del Modelo</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ width: '150px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id} className={m.activo === 0 ? 'row-inactive' : ''}>
                    <td className="bold-cell">{m.nombre}</td>
                    <td>{m.codigo || '-'}</td>
                    <td>{m.descripcion || '-'}</td>
                    <td>
                      <span className={`status-pill ${m.activo === 1 ? 'active' : 'inactive'}`}>
                        {m.activo === 1 ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          onClick={() => setModalModelo({ isOpen: true, item: m })}
                          className="btn-icon-action"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleModeloActivo(m)}
                          className={`btn-icon-action ${m.activo === 1 ? 'btn-deactivate' : 'btn-activate'}`}
                          title={m.activo === 1 ? 'Desactivar' : 'Activar'}
                        >
                          <Power size={16} />
                        </button>
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
                ))}
              </tbody>
            </table>
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

      {/* MODAL EDITAR / CREAR MODELO */}
      {modalModelo.isOpen && (
        <ModeloModalForm
          item={modalModelo.item}
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
      {isQrModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsQrModalOpen(false)}>
          <div className="modal-card qr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-box">
                <QrCode size={20} />
                <h3>Código QR para Celulares</h3>
              </div>
              <button onClick={() => setIsQrModalOpen(false)} className="btn-close-modal">
                <X size={20} />
              </button>
            </div>
            <div className="qr-modal-body">
              <div className="qr-code-wrapper">
                <QRCodeSVG
                  value={serverInfo?.server_url || window.location.origin}
                  size={240}
                  level="M"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>

              <div className="qr-url-box">
                <span className="qr-url-text">{serverInfo?.server_url || window.location.origin}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(serverInfo?.server_url || window.location.origin);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="btn-copy-url"
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="qr-steps-list">
                <div className="qr-step-item">
                  <span className="step-num">1</span>
                  <span>Conectá el celular a la red WiFi de la fábrica.</span>
                </div>
                <div className="qr-step-item">
                  <span className="step-num">2</span>
                  <span>Abrí la cámara nativa del celular y apuntá al código QR.</span>
                </div>
                <div className="qr-step-item">
                  <span className="step-num">3</span>
                  <span>Tocá el link para abrir la app y seleccioná <strong>"Instalar aplicación"</strong> en Chrome.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeloModalForm({ item, onClose, onSave }) {
  const [nombre, setNombre] = useState(item?.nombre || '');
  const [codigo, setCodigo] = useState(item?.codigo || '');
  const [descripcion, setDescripcion] = useState(item?.descripcion || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('El nombre es obligatorio');
    onSave({
      nombre: nombre.trim(),
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
          <label className="field-label">Nombre del Modelo:</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Mesa Comedor Nórdica"
            className="input-text"
          />

          <label className="field-label">Código / SKU (Opcional):</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej: MCN-01"
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
