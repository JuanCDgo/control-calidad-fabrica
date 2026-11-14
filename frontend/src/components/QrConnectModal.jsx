import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, QrCode, ShieldCheck, Smartphone, Copy, CheckCheck, Download } from 'lucide-react';
import { fetchServerInfo } from '../services/api';

export function QrConnectModal({ isOpen, onClose, serverInfo: initialServerInfo = null }) {
  const [qrMode, setQrMode] = useState('app');
  const [copied, setCopied] = useState(false);
  const [serverInfo, setServerInfo] = useState(initialServerInfo);

  useEffect(() => {
    if (initialServerInfo) {
      setServerInfo(initialServerInfo);
    }
  }, [initialServerInfo]);

  useEffect(() => {
    if (!isOpen || initialServerInfo) return;
    let active = true;
    fetchServerInfo()
      .then((info) => {
        if (active && info) setServerInfo(info);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, initialServerInfo]);

  if (!isOpen) return null;

  const baseServerUrl = serverInfo?.server_url || window.location.origin;
  const certDownloadUrl = `${baseServerUrl}/api/ca-cert`;
  const activeQrValue = qrMode === 'cert' ? certDownloadUrl : baseServerUrl;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card qr-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            {qrMode === 'cert' ? <ShieldCheck size={20} /> : <QrCode size={20} />}
            <h3>{qrMode === 'cert' ? 'Certificado SSL para Celulares' : 'Conectar Celular por QR'}</h3>
          </div>
          <button type="button" onClick={onClose} className="btn-close-modal" aria-label="Cerrar">
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
                navigator.clipboard?.writeText(activeQrValue);
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
                <span>Conectá el celular al mismo Wi-Fi que esta PC.</span>
              </div>
              <div className="qr-step-item">
                <span className="step-num">2</span>
                <span>Escaneá este QR con la cámara del celular. Si sale aviso de privacidad, tocá "Continuar" o instalá el <strong>Certificado SSL</strong>.</span>
              </div>
              <div className="qr-step-item">
                <span className="step-num">3</span>
                <span>En Chrome tocá <strong>"Instalar aplicación"</strong> para agregarla directo al inicio del teléfono.</span>
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
}
