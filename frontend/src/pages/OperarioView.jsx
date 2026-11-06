import React, { useState, useEffect } from 'react';
import { CameraCapture } from '../components/CameraCapture';
import { guardarReportePendiente, obtenerCatalogosCache, obtenerReportesPendientes } from '../db/indexedDB';
import { fetchCatalogosOffline } from '../services/api';
import { getArgentinaNowString } from '../utils/argentinaTime';
import { CheckCircle2, Clock, AlertCircle, Layers, MapPin, FileText, Hash, Send } from 'lucide-react';

export function OperarioView({ backendReachable, onReportSaved, isSyncing }) {
  const [modelos, setModelos] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [isLoadingCatalogos, setIsLoadingCatalogos] = useState(true);

  // Estados del Formulario
  const [modeloId, setModeloId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [photoData, setPhotoData] = useState(null); // { blob, previewUrl }

  // Estados de Interfaz
  const [feedback, setFeedback] = useState(null); // { tipo: 'success'|'error', mensaje }
  const [isSaving, setIsSaving] = useState(false);
  const [pendingList, setPendingList] = useState([]);

  // Carga inicial de catálogos (desde IndexedDB primero, y de API si hay red)
  const loadCatalogos = async () => {
    setIsLoadingCatalogos(true);
    try {
      // 1. Cargar lo que tengamos en IndexedDB inmediatamente (sin esperar red)
      const cached = await obtenerCatalogosCache();
      if (cached.modelos.length > 0 || cached.sectores.length > 0) {
        setModelos(cached.modelos);
        setSectores(cached.sectores);
      }

      // 2. Si la PC central está accesible, refrescar catálogos frescos
      if (backendReachable) {
        const fresh = await fetchCatalogosOffline();
        if (fresh && fresh.modelos && fresh.sectores) {
          setModelos(fresh.modelos);
          setSectores(fresh.sectores);
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

  const handlePhotoCaptured = (blob, previewUrl) => {
    setPhotoData({ blob, previewUrl });
  };

  const handleClearPhoto = () => {
    setPhotoData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // Validaciones
    if (!photoData || !photoData.blob) {
      setFeedback({ tipo: 'error', mensaje: 'Debes sacar una foto del defecto para continuar.' });
      return;
    }
    if (!modeloId) {
      setFeedback({ tipo: 'error', mensaje: 'Selecciona el modelo del mueble.' });
      return;
    }
    if (!sectorId) {
      setFeedback({ tipo: 'error', mensaje: 'Selecciona el sector de la fábrica.' });
      return;
    }
    if (!descripcion.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Escribe una breve descripción del defecto.' });
      return;
    }
    if (!cantidad.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Indica la cantidad de material afectado.' });
      return;
    }

    setIsSaving(true);

    try {
      const client_uuid = crypto.randomUUID();
      const fechaLocalGMT3 = getArgentinaNowString();

      const selectedModelo = modelos.find((m) => String(m.id) === String(modeloId));
      const selectedSector = sectores.find((s) => String(s.id) === String(sectorId));

      const nuevoReporte = {
        client_uuid,
        modelo_id: Number(modeloId),
        sector_id: Number(sectorId),
        modelo_nombre: selectedModelo ? selectedModelo.nombre : 'Modelo',
        sector_nombre: selectedSector ? selectedSector.nombre : 'Sector',
        descripcion_defecto: descripcion.trim(),
        cantidad_afectada: cantidad.trim(),
        fecha_captura_local: fechaLocalGMT3,
        foto_blob: photoData.blob,
        foto_preview: photoData.previewUrl
      };

      // Guardado seguro e inmediato en IndexedDB
      await guardarReportePendiente(nuevoReporte);

      // Limpiar formulario
      setModeloId('');
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

      // Refrescar contador y disparar sincronización si hay red
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

          {/* Selector de Modelo */}
          <div className="form-group">
            <label className="field-label">
              <Layers size={16} /> Modelo del Mueble
            </label>
            <select
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
              className="select-input"
              disabled={isLoadingCatalogos}
            >
              <option value="">-- Seleccionar Modelo --</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} {m.codigo ? `(${m.codigo})` : ''}
                </option>
              ))}
            </select>
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

          {/* Cantidad Afectada (Texto libre y ágil) */}
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

          {/* Botón Principal de Envío */}
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
