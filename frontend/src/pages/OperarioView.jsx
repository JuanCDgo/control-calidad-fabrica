import React, { useState, useEffect, useMemo } from 'react';
import { CameraCapture } from '../components/CameraCapture';
import {
  guardarReportePendiente,
  guardarCatalogosCache,
  obtenerCatalogosCache,
  obtenerReportesPendientes
} from '../db/indexedDB';
import { fetchCatalogosOffline } from '../services/api';
import { getArgentinaNowString } from '../utils/argentinaTime';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  MapPin,
  FileText,
  Hash,
  Send,
  Search,
  Tag,
  Wrench,
  X
} from 'lucide-react';

export function OperarioView({ backendReachable, onReportSaved, isSyncing }) {
  const [categorias, setCategorias] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [isLoadingCatalogos, setIsLoadingCatalogos] = useState(true);

  // Selección de Categoría / Modelo / Prototipo
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('');
  const [searchModelo, setSearchModelo] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [isPrototipo, setIsPrototipo] = useState(false);
  const [prototipoNombre, setPrototipoNombre] = useState('');

  // Otros campos del formulario
  const [sectorId, setSectorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [photoData, setPhotoData] = useState(null); // { blob, previewUrl }

  // Estados de Interfaz
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingList, setPendingList] = useState([]);

  const loadCatalogos = async () => {
    setIsLoadingCatalogos(true);
    try {
      const cached = await obtenerCatalogosCache();
      if (
        cached.modelos.length > 0 ||
        cached.sectores.length > 0 ||
        cached.categorias.length > 0
      ) {
        setCategorias(cached.categorias || []);
        setModelos(cached.modelos || []);
        setSectores(cached.sectores || []);
      }

      if (backendReachable) {
        const fresh = await fetchCatalogosOffline();
        if (fresh && fresh.modelos && fresh.sectores) {
          setCategorias(fresh.categorias || []);
          setModelos(fresh.modelos || []);
          setSectores(fresh.sectores || []);
          await guardarCatalogosCache(
            fresh.sectores,
            fresh.modelos,
            fresh.servidor_timestamp_gmt3,
            fresh.categorias || []
          );
        }
      }
    } catch (err) {
      console.warn('Usando catálogo local de IndexedDB:', err);
    } finally {
      setIsLoadingCatalogos(false);
    }
  };

  const loadPendingList = async () => {
    try {
      const items = await obtenerReportesPendientes();
      setPendingList(items);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCatalogos();
    loadPendingList();
  }, [backendReachable]);

  const filteredModelos = useMemo(() => {
    const query = searchModelo.trim().toLowerCase();
    return modelos.filter((m) => {
      if (selectedCategoriaId && String(m.categoria_id || '') !== String(selectedCategoriaId)) {
        return false;
      }
      if (!query) return true;
      const matchNombre = (m.nombre || '').toLowerCase().includes(query);
      const matchCodigo = (m.codigo || '').toLowerCase().includes(query);
      const matchCat = (m.categoria_nombre || '').toLowerCase().includes(query);
      return matchNombre || matchCodigo || matchCat;
    });
  }, [modelos, selectedCategoriaId, searchModelo]);

  const selectedModeloObj = useMemo(
    () => modelos.find((m) => String(m.id) === String(modeloId)) || null,
    [modelos, modeloId]
  );

  const handleSelectCategoria = (catId) => {
    setIsPrototipo(false);
    setPrototipoNombre('');
    setSelectedCategoriaId(catId);
    if (catId && selectedModeloObj && String(selectedModeloObj.categoria_id || '') !== String(catId)) {
      setModeloId('');
    }
  };

  const handleActivatePrototipo = () => {
    setIsPrototipo(true);
    setSelectedCategoriaId('');
    setModeloId('');
    setSearchModelo('');
  };

  const handlePhotoCaptured = (blob, previewUrl) => {
    setPhotoData({ blob, previewUrl });
  };

  const handleClearPhoto = () => {
    setPhotoData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!photoData || !photoData.blob) {
      setFeedback({ tipo: 'error', mensaje: 'Debes sacar una foto del defecto para continuar.' });
      return;
    }
    if (isPrototipo) {
      if (!prototipoNombre.trim()) {
        setFeedback({ tipo: 'error', mensaje: 'Escribí el nombre o referencia del prototipo.' });
        return;
      }
    } else if (!modeloId) {
      setFeedback({
        tipo: 'error',
        mensaje: 'Elegí un modelo de la lista o tocá "Otro / Prototipo".'
      });
      return;
    }
    if (!sectorId) {
      setFeedback({ tipo: 'error', mensaje: 'Selecciona el sector de la fábrica.' });
      return;
    }
    if (!cantidad.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Indica la cantidad de material afectado.' });
      return;
    }
    if (!descripcion.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Escribe una breve descripción del defecto.' });
      return;
    }

    setIsSaving(true);

    try {
      const client_uuid = crypto.randomUUID();
      const fechaLocalGMT3 = getArgentinaNowString();
      const selectedSector = sectores.find((s) => String(s.id) === String(sectorId));

      const nuevoReporte = {
        client_uuid,
        modelo_id: isPrototipo ? null : Number(modeloId),
        modelo_manual: isPrototipo ? prototipoNombre.trim() : null,
        modelo_nombre: isPrototipo
          ? `Prototipo: ${prototipoNombre.trim()}`
          : selectedModeloObj?.nombre || 'Modelo',
        categoria_nombre: isPrototipo
          ? 'Otro / Prototipo'
          : selectedModeloObj?.categoria_nombre || 'Sin categoría',
        sector_id: Number(sectorId),
        sector_nombre: selectedSector ? selectedSector.nombre : 'Sector',
        descripcion_defecto: descripcion.trim(),
        cantidad_afectada: cantidad.trim(),
        fecha_captura_local: fechaLocalGMT3,
        foto_blob: photoData.blob,
        foto_preview: photoData.previewUrl
      };

      await guardarReportePendiente(nuevoReporte);

      // Limpiar formulario
      setSelectedCategoriaId('');
      setSearchModelo('');
      setModeloId('');
      setIsPrototipo(false);
      setPrototipoNombre('');
      setSectorId('');
      setDescripcion('');
      setCantidad('');
      setPhotoData(null);

      setFeedback({
        tipo: 'success',
        mensaje: backendReachable
          ? 'Reporte guardado. Enviando a la PC central...'
          : 'Reporte guardado localmente en el celular (Se enviará al recuperar WiFi).'
      });

      await onReportSaved();
      await loadPendingList();
    } catch (err) {
      console.error('Error al guardar reporte:', err);
      setFeedback({ tipo: 'error', mensaje: `Error al guardar: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="operario-container">
      <div className="form-card">
        <div className="form-card-header">
          <h2>Nuevo Reporte de Defecto</h2>
          <p className="form-subtitle">Completá los datos y sacá la foto del producto afectado.</p>
        </div>

        {feedback && (
          <div className={`feedback-banner ${feedback.tipo}`}>
            {feedback.tipo === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.mensaje}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="defect-form">
          {/* Captura de Foto en 1 toque */}
          <div className="form-group">
            <label className="field-label">Foto del Defecto (Obligatoria)</label>
            <CameraCapture
              onPhotoCaptured={handlePhotoCaptured}
              currentPhoto={photoData}
              onClearPhoto={handleClearPhoto}
            />
          </div>

          {/* Selección por Categoría + Lista cerrada de Modelos + Opción Prototipo */}
          <div className="form-group">
            <label className="field-label">
              <Layers size={16} /> Modelo del Mueble (por Categoría)
            </label>

            {/* Chips de Categorías */}
            <div className="cat-chips-row">
              <button
                type="button"
                onClick={() => handleSelectCategoria('')}
                className={`cat-chip ${!isPrototipo && selectedCategoriaId === '' ? 'active' : ''}`}
              >
                <Tag size={13} />
                <span>Todas ({modelos.length})</span>
              </button>

              {categorias.map((cat) => {
                const count = modelos.filter((m) => m.categoria_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategoria(String(cat.id))}
                    className={`cat-chip ${!isPrototipo && String(selectedCategoriaId) === String(cat.id) ? 'active' : ''}`}
                  >
                    <span>
                      {cat.nombre} ({count})
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleActivatePrototipo}
                className={`cat-chip prototype-chip ${isPrototipo ? 'active' : ''}`}
              >
                <Wrench size={13} />
                <span>Otro / Prototipo</span>
              </button>
            </div>

            {isPrototipo ? (
              <div className="prototipo-box">
                <div className="prototipo-box-header">
                  <span>Modo Prototipo / Mueble sin nombre en catálogo</span>
                  <button
                    type="button"
                    onClick={() => setIsPrototipo(false)}
                    className="btn-link-muted"
                  >
                    Volver a lista
                  </button>
                </div>
                <input
                  type="text"
                  value={prototipoNombre}
                  onChange={(e) => setPrototipoNombre(e.target.value)}
                  placeholder="Escribí el nombre o referencia del prototipo..."
                  className="input-text"
                />
              </div>
            ) : (
              <div className="modelo-picker-box">
                <div className="modelo-search-wrapper">
                  <Search size={16} className="search-icon-inline" />
                  <input
                    type="text"
                    value={searchModelo}
                    onChange={(e) => setSearchModelo(e.target.value)}
                    placeholder="Buscar modelo por nombre o código..."
                    className="input-search-modelo"
                    disabled={isLoadingCatalogos}
                  />
                  {searchModelo && (
                    <button
                      type="button"
                      onClick={() => setSearchModelo('')}
                      className="btn-clear-search"
                      title="Limpiar búsqueda"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {selectedModeloObj && (
                  <div className="selected-modelo-banner">
                    <div>
                      <strong>Seleccionado:</strong> {selectedModeloObj.nombre}
                      {selectedModeloObj.codigo ? ` (${selectedModeloObj.codigo})` : ''}
                      <span className="selected-cat-pill">
                        {selectedModeloObj.categoria_nombre || 'Sin categoría'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModeloId('')}
                      className="btn-link-muted"
                    >
                      Cambiar
                    </button>
                  </div>
                )}

                {filteredModelos.length > 0 ? (
                  <div className="modelo-list-scroll">
                    {filteredModelos.map((m) => {
                      const isSel = String(modeloId) === String(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setModeloId(String(m.id))}
                          className={`modelo-option-btn ${isSel ? 'selected' : ''}`}
                        >
                          <div className="modelo-option-main">
                            <span className="modelo-option-name">{m.nombre}</span>
                            {m.codigo && <span className="modelo-code-badge">{m.codigo}</span>}
                          </div>
                          <span className="modelo-option-cat">
                            {m.categoria_nombre || 'Sin categoría'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="modelo-empty-hint">
                    <p>
                      {modelos.length === 0
                        ? 'Todavía no hay modelos cargados desde Admin PC.'
                        : 'No hay modelos que coincidan con esa búsqueda.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleActivatePrototipo}
                      className="btn-secondary-sm"
                    >
                      <Wrench size={14} />
                      <span>Cargar como Otro / Prototipo</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selector de Sector */}
          <div className="form-group">
            <label className="field-label">
              <MapPin size={16} /> Sector de Planta
            </label>
            <select
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              className="select-input"
              disabled={isLoadingCatalogos}
            >
              <option value="">-- Seleccionar Sector --</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad Afectada */}
          <div className="form-group">
            <label className="field-label">
              <Hash size={16} /> Cantidad Afectada
            </label>
            <input
              type="text"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 2 tableros, 1 lateral, 5 piezas"
              className="input-text"
            />
          </div>

          {/* Descripción del Defecto */}
          <div className="form-group">
            <label className="field-label">
              <FileText size={16} /> Descripción del Defecto
            </label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detallá qué ocurrió: astillado, raya en laca, corte fuera de escuadra..."
              className="textarea-input"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-submit-report"
          >
            <Send size={18} />
            <span>{isSaving ? 'Guardando en celular...' : 'Guardar Reporte'}</span>
          </button>
        </form>
      </div>

      {/* Lista de Reportes Pendientes en este Celular */}
      {pendingList.length > 0 && (
        <div className="pending-queue-card">
          <div className="queue-header">
            <Clock size={18} />
            <h3>Pendientes de Sincronización ({pendingList.length})</h3>
          </div>
          <p className="queue-desc">
            Estos reportes están resguardados en este celular y se subirán a la PC central cuando toques "Sincronizar" o haya conexión estable.
          </p>
          <div className="queue-list">
            {pendingList.map((item) => (
              <div key={item.client_uuid} className="queue-item">
                <img src={item.foto_preview} alt="Defecto" className="queue-thumb" />
                <div className="queue-item-info">
                  <div className="queue-item-title">
                    <strong>{item.modelo_nombre}</strong> • {item.sector_nombre}
                  </div>
                  <div className="queue-item-sub">
                    <span>Cant: {item.cantidad_afectada}</span>
                    <span className="queue-timestamp">{item.fecha_captura_local}</span>
                  </div>
                  <div className="queue-item-desc">{item.descripcion_defecto}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
