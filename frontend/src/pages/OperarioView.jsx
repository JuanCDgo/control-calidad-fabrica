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
  UserCheck,
  AlertTriangle,
  Package,
  ShieldAlert,
  X
} from 'lucide-react';

export function OperarioView({ backendReachable, onReportSaved }) {
  const [categorias, setCategorias] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [tiposProblema, setTiposProblema] = useState([]);
  const [impactos, setImpactos] = useState(['FALTA', 'SOBRA', 'DEFECTO', 'OTRO']);
  const [estados, setEstados] = useState(['Abierto', 'En Proceso', 'Resuelto']);
  const [isLoadingCatalogos, setIsLoadingCatalogos] = useState(true);

  // Campos de planilla unificada
  const [encargadoId, setEncargadoId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [tipoProblemaId, setTipoProblemaId] = useState('');
  const [impacto, setImpacto] = useState('DEFECTO');

  // Selección de Producto / Mueble / Otro
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('');
  const [searchModelo, setSearchModelo] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [isPrototipo, setIsPrototipo] = useState(false);
  const [prototipoNombre, setPrototipoNombre] = useState('');

  // Detalle, Cantidad, Descripción, Acción, Estado y Foto (Opcional)
  const [detallePieza, setDetallePieza] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [accionInmediata, setAccionInmediata] = useState('');
  const [estado, setEstado] = useState('Abierto');
  const [photoData, setPhotoData] = useState(null); // { blob, previewUrl } | null

  // Estados de Interfaz
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingList, setPendingList] = useState([]);

  const applyCatalogs = (data) => {
    setCategorias(data.categorias || []);
    setModelos(data.modelos || []);
    setSectores(data.sectores || []);
    setEncargados(data.encargados || []);
    setTiposProblema(data.tipos_problema || []);
    if (data.impactos?.length) setImpactos(data.impactos);
    if (data.estados?.length) setEstados(data.estados);
  };

  const loadCatalogos = async () => {
    setIsLoadingCatalogos(true);
    try {
      const cached = await obtenerCatalogosCache();
      if (
        cached.modelos.length > 0 ||
        cached.sectores.length > 0 ||
        cached.encargados.length > 0
      ) {
        applyCatalogs(cached);
      }

      if (backendReachable) {
        const fresh = await fetchCatalogosOffline();
        if (fresh && fresh.modelos && fresh.sectores) {
          applyCatalogs(fresh);
          await guardarCatalogosCache(
            fresh.sectores,
            fresh.modelos,
            fresh.servidor_timestamp_gmt3,
            fresh.categorias || [],
            fresh.encargados || [],
            fresh.tipos_problema || [],
            fresh.impactos || ['FALTA', 'SOBRA', 'DEFECTO', 'OTRO'],
            fresh.estados || ['Abierto', 'En Proceso', 'Resuelto']
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

  const handleEncargadoChange = (newEncId) => {
    setEncargadoId(newEncId);
    const encObj = encargados.find((e) => String(e.id) === String(newEncId));
    if (encObj?.sector_default) {
      const matchSector = sectores.find(
        (s) => s.nombre.toLowerCase() === encObj.sector_default.toLowerCase()
      );
      if (matchSector) {
        setSectorId(String(matchSector.id));
      }
    }
  };

  const handleSelectCategoria = (catId) => {
    setIsPrototipo(false);
    setPrototipoNombre('');
    setSelectedCategoriaId(catId);
    if (catId && selectedModeloObj && String(selectedModeloObj.categoria_id || '') !== String(catId)) {
      setModeloId('');
    }
  };

  const handleActivatePrototipo = (preset = '') => {
    setIsPrototipo(true);
    setSelectedCategoriaId('');
    setModeloId('');
    setSearchModelo('');
    if (preset) setPrototipoNombre(preset);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!encargadoId && encargados.length > 0) {
      setFeedback({ tipo: 'error', mensaje: 'Seleccioná el encargado responsable de la planilla.' });
      return;
    }
    if (!sectorId) {
      setFeedback({ tipo: 'error', mensaje: 'Seleccioná el sector o área de planta.' });
      return;
    }
    if (!tipoProblemaId && tiposProblema.length > 0) {
      setFeedback({ tipo: 'error', mensaje: 'Seleccioná el tipo de problema.' });
      return;
    }
    if (isPrototipo) {
      if (!prototipoNombre.trim()) {
        setFeedback({ tipo: 'error', mensaje: 'Escribí el nombre del producto / referencia general.' });
        return;
      }
    } else if (!modeloId) {
      setFeedback({
        tipo: 'error',
        mensaje: 'Elegí un producto de la lista o tocá "Otro / General".'
      });
      return;
    }
    if (!cantidad.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Indicá la cantidad afectada (ej. 1 lote, 15 unid).' });
      return;
    }
    if (!descripcion.trim()) {
      setFeedback({ tipo: 'error', mensaje: 'Describí brevemente el problema encontrado.' });
      return;
    }

    setIsSaving(true);

    try {
      const client_uuid = crypto.randomUUID();
      const fechaLocalGMT3 = getArgentinaNowString();
      const selectedSector = sectores.find((s) => String(s.id) === String(sectorId));
      const selectedEnc = encargados.find((enc) => String(enc.id) === String(encargadoId));
      const selectedTipo = tiposProblema.find((t) => String(t.id) === String(tipoProblemaId));

      const nuevoReporte = {
        client_uuid,
        encargado_id: encargadoId ? Number(encargadoId) : null,
        encargado_nombre: selectedEnc ? selectedEnc.nombre : 'Sin asignar',
        sector_id: Number(sectorId),
        sector_nombre: selectedSector ? selectedSector.nombre : 'Sector',
        tipo_problema_id: tipoProblemaId ? Number(tipoProblemaId) : null,
        tipo_problema_nombre: selectedTipo ? selectedTipo.nombre : 'OTRO',
        impacto,
        modelo_id: isPrototipo ? null : Number(modeloId),
        modelo_manual: isPrototipo ? prototipoNombre.trim() : null,
        modelo_nombre: isPrototipo
          ? prototipoNombre.trim()
          : selectedModeloObj?.nombre || 'Producto',
        categoria_nombre: isPrototipo
          ? 'Otro / General'
          : selectedModeloObj?.categoria_nombre || 'Sin categoría',
        detalle_pieza: detallePieza.trim(),
        cantidad_afectada: cantidad.trim(),
        descripcion_defecto: descripcion.trim(),
        accion_inmediata: accionInmediata.trim(),
        estado,
        fecha_captura_local: fechaLocalGMT3,
        foto_blob: photoData?.blob || null,
        foto_preview: photoData?.previewUrl || null
      };

      await guardarReportePendiente(nuevoReporte);

      // Limpiar formulario (dejamos Encargado/Sector si cargan varios seguidos? Mejor limpiar campos de problema)
      setTipoProblemaId('');
      setImpacto('DEFECTO');
      setSelectedCategoriaId('');
      setSearchModelo('');
      setModeloId('');
      setIsPrototipo(false);
      setPrototipoNombre('');
      setDetallePieza('');
      setCantidad('');
      setDescripcion('');
      setAccionInmediata('');
      setEstado('Abierto');
      setPhotoData(null);

      setFeedback({
        tipo: 'success',
        mensaje: backendReachable
          ? 'Problema guardado y sincronizado con la PC central.'
          : 'Problema guardado localmente (se enviará automáticamente al recuperar WiFi).'
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
          <h2>Nuevo Reporte de Problema</h2>
          <p className="form-subtitle">
            Cargá el problema desde planta o con una foto compartida; luego se suma directo a la planilla del encargado.
          </p>
        </div>

        {feedback && (
          <div className={`feedback-banner ${feedback.tipo}`} role="status" aria-live="polite">
            {feedback.tipo === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.mensaje}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="defect-form" noValidate>
          {/* 1. Foto (Opcional - Cámara o Galería/WhatsApp) */}
          <div className="form-group">
            <span className="field-label">
              Foto del Problema <span className="label-optional-pill">(Opcional)</span>
            </span>
            <CameraCapture
              onPhotoCaptured={(blob, previewUrl) => setPhotoData({ blob, previewUrl })}
              currentPhoto={photoData}
              onClearPhoto={() => setPhotoData(null)}
            />
          </div>

          {/* 2. Encargado y Sector (2 columnas en desktop, 1 en móvil) */}
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="select-encargado" className="field-label">
                <UserCheck size={16} /> Encargado / Planilla
              </label>
              <select
                id="select-encargado"
                name="encargado_id"
                value={encargadoId}
                onChange={(e) => handleEncargadoChange(e.target.value)}
                className="select-input"
                disabled={isLoadingCatalogos}
                required
              >
                <option value="">-- Seleccionar Encargado --</option>
                {encargados.map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {enc.nombre} {enc.sector_default ? `(${enc.sector_default})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="select-sector" className="field-label">
                <MapPin size={16} /> Sector / Área
              </label>
              <select
                id="select-sector"
                name="sector_id"
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="select-input"
                disabled={isLoadingCatalogos}
                required
              >
                <option value="">-- Seleccionar Sector --</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Tipo de Problema + Impacto */}
          <div className="form-group">
            <label htmlFor="select-tipo-problema" className="field-label">
              <AlertTriangle size={16} /> Tipo de Problema
            </label>
            <select
              id="select-tipo-problema"
              name="tipo_problema_id"
              value={tipoProblemaId}
              onChange={(e) => {
                const val = e.target.value;
                setTipoProblemaId(val);
                const tp = tiposProblema.find((t) => String(t.id) === String(val));
                if (tp) {
                  const nom = tp.nombre.toUpperCase();
                  if (nom.includes('FALTA')) setImpacto('FALTA');
                  else if (nom.includes('SOBRANTE')) setImpacto('SOBRA');
                  else if (nom.includes('DEFECTO') || nom.includes('MATERIA') || nom.includes('FALLA')) setImpacto('DEFECTO');
                }
              }}
              className="select-input"
              disabled={isLoadingCatalogos}
              required
            >
              <option value="">-- Seleccionar Tipo de Problema --</option>
              {tiposProblema.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.nombre}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="impacto-fieldset">
            <legend className="field-label">Impacto</legend>
            <div className="impacto-chips-row">
              {impactos.map((imp) => {
                const radioId = `impacto-${imp}`;
                return (
                  <label
                    key={imp}
                    htmlFor={radioId}
                    className={`impacto-chip impacto-${imp.toLowerCase()} ${impacto === imp ? 'active' : ''}`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="impacto"
                      value={imp}
                      checked={impacto === imp}
                      onChange={() => setImpacto(imp)}
                      className="visually-hidden"
                    />
                    <span>{imp}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 4. Producto / Mueble afectado */}
          <div className="form-group">
            <label htmlFor="search-modelo" className="field-label">
              <Layers size={16} /> Producto / Mueble Afectado
            </label>

            <div className="cat-chips-row">
              <button
                type="button"
                onClick={() => handleSelectCategoria('')}
                className={`cat-chip ${!isPrototipo && selectedCategoriaId === '' ? 'active' : ''}`}
              >
                <Tag size={13} />
                <span>Todos ({modelos.length})</span>
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
                onClick={() => handleActivatePrototipo('')}
                className={`cat-chip prototype-chip ${isPrototipo ? 'active' : ''}`}
              >
                <Wrench size={13} />
                <span>Otro / General</span>
              </button>
            </div>

            {isPrototipo ? (
              <div className="prototipo-box">
                <div className="prototipo-box-header">
                  <span>Producto manual / Prototipo / Área general</span>
                  <button
                    type="button"
                    onClick={() => setIsPrototipo(false)}
                    className="btn-link-muted"
                  >
                    Volver a lista
                  </button>
                </div>
                <input
                  id="input-prototipo"
                  type="text"
                  value={prototipoNombre}
                  onChange={(e) => setPrototipoNombre(e.target.value)}
                  placeholder="Ej: Parrillas 0.80, Línea Mesas y Sillas (General)..."
                  className="input-text"
                />
                <div className="quick-preset-row">
                  <button
                    type="button"
                    onClick={() => setPrototipoNombre('Línea Mesas y Sillas (General)')}
                    className="btn-quick-chip"
                  >
                    General Planta
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrototipoNombre('Máquinas / Mantenimiento')}
                    className="btn-quick-chip"
                  >
                    Máquinas / Mantenimiento
                  </button>
                </div>
              </div>
            ) : (
              <div className="modelo-picker-box">
                <div className="modelo-search-wrapper">
                  <Search size={16} className="search-icon-inline" />
                  <input
                    id="search-modelo"
                    type="search"
                    value={searchModelo}
                    onChange={(e) => setSearchModelo(e.target.value)}
                    placeholder="Buscar producto por nombre o código (ej: Docta, 505001)..."
                    className="input-search-modelo"
                    autocorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
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
                    <p>No hay productos que coincidan con esa búsqueda.</p>
                    <button
                      type="button"
                      onClick={() => handleActivatePrototipo(searchModelo)}
                      className="btn-secondary-sm"
                    >
                      <Wrench size={14} />
                      <span>Cargar como Otro / General</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Detalle de Pieza o Insumo + Cantidad Afectada */}
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="input-detalle-pieza" className="field-label">
                <Package size={16} /> Detalle de Pieza o Insumo
              </label>
              <input
                id="input-detalle-pieza"
                name="detalle_pieza"
                type="text"
                value={detallePieza}
                onChange={(e) => setDetallePieza(e.target.value)}
                placeholder="Ej: Escuadras de madera, guías correderas..."
                className="input-text"
              />
            </div>

            <div className="form-group">
              <label htmlFor="input-cantidad" className="field-label">
                <Hash size={16} /> Cantidad Afectada *
              </label>
              <input
                id="input-cantidad"
                name="cantidad_afectada"
                type="text"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej: 1 lote, 25 unid, 10 pares"
                className="input-text"
                required
              />
            </div>
          </div>

          {/* 6. Descripción del Problema */}
          <div className="form-group">
            <label htmlFor="input-descripcion" className="field-label">
              <FileText size={16} /> Descripción del Problema *
            </label>
            <textarea
              id="input-descripcion"
              name="descripcion_defecto"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detallá qué ocurrió: sin escuadras en planta, canto despegado, falta de tornillos..."
              className="textarea-input"
              required
            />
          </div>

          {/* 7. Acción Inmediata Tomada + Estado */}
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="input-accion" className="field-label">
                <ShieldAlert size={16} /> Acción Inmediata Tomada
              </label>
              <input
                id="input-accion"
                name="accion_inmediata"
                type="text"
                value={accionInmediata}
                onChange={(e) => setAccionInmediata(e.target.value)}
                placeholder="Ej: Aviso a Maquinado, Pedido a Pañol..."
                className="input-text"
              />
            </div>

            <div className="form-group">
              <label htmlFor="select-estado" className="field-label">
                Estado del Problema
              </label>
              <select
                id="select-estado"
                name="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="select-input"
              >
                {estados.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-submit-report"
          >
            <Send size={18} />
            <span>{isSaving ? 'Guardando reporte...' : 'Guardar Problema'}</span>
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
            Estos problemas están guardados en este dispositivo y se enviarán a la PC central al recuperar WiFi.
          </p>
          <div className="queue-list">
            {pendingList.map((item) => (
              <div key={item.client_uuid} className="queue-item">
                {item.foto_preview ? (
                  <img src={item.foto_preview} alt="Problema" className="queue-thumb" />
                ) : (
                  <div className="queue-thumb-empty">Sin foto</div>
                )}
                <div className="queue-item-info">
                  <div className="queue-item-title">
                    <strong>{item.modelo_nombre}</strong> • {item.sector_nombre}
                  </div>
                  <div className="queue-item-sub">
                    <span>{item.encargado_nombre} • {item.impacto}</span>
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
