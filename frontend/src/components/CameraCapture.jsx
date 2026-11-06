import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { compressImage } from '../services/compressor';

export function CameraCapture({ onPhotoCaptured, currentPhoto, onClearPhoto }) {
  const fileInputRef = useRef(null);
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
      // Limpiar input para permitir seleccionar la misma foto si se desea
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="camera-capture-container">
      {/* Input nativo oculto que dispara la cámara oficial del celular */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {!currentPhoto && !isCompressing && (
        <button
          type="button"
          onClick={triggerCamera}
          className="btn-camera-trigger"
        >
          <Camera size={28} className="camera-icon" />
          <div className="camera-trigger-texts">
            <span className="camera-main-text">Capturar Foto del Defecto</span>
            <span className="camera-sub-text">Abre la cámara trasera en 1 toque</span>
          </div>
        </button>
      )}

      {isCompressing && (
        <div className="camera-compressing-box">
          <Loader2 size={24} className="spin-icon" />
          <span>Comprimiendo foto para guardado ultra-rápido...</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-error-box">
          <span>{errorMsg}</span>
        </div>
      )}

      {currentPhoto && (
        <div className="photo-preview-card">
          <div className="preview-image-wrapper">
            <img src={currentPhoto.previewUrl} alt="Defecto capturado" className="preview-img" />
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
                onClick={triggerCamera}
                className="btn-secondary-action"
              >
                <Camera size={16} />
                <span>Volver a sacar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompressInfo(null);
                  onClearPhoto();
                }}
                className="btn-danger-action"
              >
                <Trash2 size={16} />
                <span>Quitar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
