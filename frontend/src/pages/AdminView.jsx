import React, { useState, useEffect } from 'react';
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
  getApiBaseUrl
} from '../services/api';
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
  ZoomIn
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

  // Modales de CRUD
  const [modalModelo, setModalModelo] = useState({ isOpen: false, item: null });
  const [modalSector, setModalSector] = useState({ isOpen: false, item: null });

  // Cargas de datos
  const loadAll = async () => {
    if (!backendReachable) return;
    setIsLoading(true);
    try {
      const [reps, mods, secs] = await Promise.all([
        fetchReportesAdmin({
          sector_id: filtroSector || undefined,
          modelo_id: filtroModelo || undefined
        }),
        fetchModelosAdmin(false),
        fetchSectoresAdmin(false)
      ]);
      setReportes(reps);
      setModelos(mods);
      setSectores(secs);
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
