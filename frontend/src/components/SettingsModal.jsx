import React, { useState } from 'react';
import { X, Server, Check, ShieldCheck, Download } from 'lucide-react';
import { getApiBaseUrl, setCustomBackendUrl } from '../services/api';

export function SettingsModal({ isOpen, onClose, onSaved }) {
  const [url, setUrl] = useState(localStorage.getItem('backend_url_custom') || '');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setCustomBackendUrl(url);
    onSaved();
    onClose();
  };

  const handleReset = () => {
    setUrl('');
    setCustomBackendUrl('');
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-box">
            <Server size={20} />
            <h3>Configuración de Red (PC Central)</h3>
          </div>
          <button onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <p className="modal-help-text">
            Ingresá la IP o dirección del backend FastAPI en la red local. Si dejás vacío, usa el mismo origen del navegador.
          </p>

          <label className="field-label">URL del Backend Central:</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://192.168.8.101:8000"
            className="input-text"
          />

          <div className="current-url-indicator">
            <span>URL Activa:</span>
            <code>{getApiBaseUrl()}</code>
          </div>

          <div className="cert-settings-box">
            <div className="cert-settings-info">
              <ShieldCheck size={16} />
              <span>¿Chrome muestra alerta de seguridad o no deja instalar la PWA?</span>
            </div>
            <a href={`${getApiBaseUrl()}/api/ca-cert`} className="btn-cert-download">
              <Download size={16} />
              <span>Descargar Certificado SSL (.crt)</span>
            </a>
          </div>

          <div className="modal-footer-buttons">
            <button type="button" onClick={handleReset} className="btn-secondary">
              Restablecer por defecto
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
