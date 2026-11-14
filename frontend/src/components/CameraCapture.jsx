import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { compressImage } from '../services/compressor';

export function CameraCapture({ onPhotoCaptured, currentPhoto, onClearPhoto }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressInfo, setCompressInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setErrorMsg(null);
    setCompressInfo(null);

    try {
      const result = await compressImage(file, 1280, 0.8);
      const origMb = (result.originalSize / (1024 * 1024)).toFixed(2);
      const compKb = (result.compressedSize / 1024).toFixed(0);

      setCompressInfo(`Optimizado: ${origMb} MB → ${compKb} KB`);
      onPhotoCaptured(result.blob, result.previewUrl);
    } catch (err) {
      console.error('Error al procesar foto:', err);
      setErrorMsg(err.message || 'Error al procesar la foto.');
    } finally {
      setIsCompressing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  return (
    <div className="camera-capture-container">
      <input
        ref={cameraInputRef}
        id="input-foto-camara"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="visually-hidden"
        tabIndex={-1}
      />

      <input
        ref={galleryInputRef}
        id="input-foto-galeria"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="visually-hidden"
        tabIndex={-1}
      />

      {!currentPhoto && !isCompressing && (
        <div className="photo-dual-actions">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn-camera-trigger"
          >
            <Camera size={24} className="camera-icon" />
            <div className="camera-trigger-texts">
              <span className="camera-main-text">Sacar Foto</span>
              <span className="camera-sub-text">Abre la cámara del celular</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="btn-gallery-trigger"
          >
            <Upload size={22} className="camera-icon" />
            <div className="camera-trigger-texts">
              <span className="camera-main-text">Subir / WhatsApp</span>
              <span className="camera-sub-text">Elegir imagen de galería o PC</span>
            </div>
          </button>
        </div>
      )}

      {isCompressing && (
        <div className="camera-compressing-box" role="status" aria-live="polite">
          <Loader2 size={24} className="spin-icon" />
          <span>Comprimiendo foto para guardado rápido...</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-error-box" role="alert">
          <span>{errorMsg}</span>
        </div>
      )}

      {currentPhoto && (
        <div className="photo-preview-card">
          <div className="preview-image-wrapper">
            <img src={currentPhoto.previewUrl} alt="Foto del problema" className="preview-img" />
          </div>
          <div className="photo-preview-details">
            <div className="photo-status-badge">
              <CheckCircle2 size={16} />
              <span>Foto lista</span>
            </div>
            {compressInfo && <span className="compress-info-tag">{compressInfo}</span>}
            <div className="preview-actions">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn-secondary-action"
              >
                <Camera size={15} />
                <span>Cámara</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="btn-secondary-action"
              >
                <Upload size={15} />
                <span>Galería</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompressInfo(null);
                  onClearPhoto();
                }}
                className="btn-danger-action"
              >
                <Trash2 size={15} />
                <span>Quitar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
