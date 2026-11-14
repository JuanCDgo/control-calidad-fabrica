import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Settings, ShieldCheck, Smartphone, Monitor, QrCode } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { QrConnectModal } from './QrConnectModal';

export function Navbar({
  currentView,
  onViewChange,
  isOnline,
  backendReachable,
  pendingCount,
  isSyncing,
  onSyncTrigger,
  onRefreshStatus
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  return (
    <>
      <header className="app-navbar">
        <div className="navbar-brand">
          <div className="brand-logo-badge">
            <ShieldCheck size={22} />
          </div>
          <div className="brand-titles">
            <h1 className="brand-name">Control de Planta Patria v1.2</h1>
            <span className="brand-subtitle">Auditoría, Fotos y Planillas</span>
          </div>
        </div>

        {/* Selector de Vistas: Operario / Admin */}
        <div className="view-switcher">
          <button
            onClick={() => onViewChange('operario')}
            className={`nav-tab-btn ${currentView === 'operario' ? 'active' : ''}`}
          >
            <Smartphone size={16} />
            <span>Operario</span>
          </button>
          <button
            onClick={() => onViewChange('admin')}
            className={`nav-tab-btn ${currentView === 'admin' ? 'active' : ''}`}
          >
            <Monitor size={16} />
            <span>Admin PC</span>
          </button>
        </div>

        {/* Estado de Red & Botón de Sincronización */}
        <div className="navbar-actions">
          <div
            className={`network-badge ${backendReachable ? 'online' : 'offline'}`}
            title={backendReachable ? 'Conectado a la PC central' : 'Trabajando en modo local (Offline)'}
          >
            {backendReachable ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="network-text">
              {backendReachable ? 'Online' : 'Sin WiFi'}
            </span>
          </div>

          <button
            onClick={onSyncTrigger}
            disabled={isSyncing}
            className={`btn-sync ${pendingCount > 0 ? 'has-pending' : ''}`}
            title="Sincronizar reportes locales con la PC central"
          >
            <RefreshCw size={16} className={isSyncing ? 'spin-icon' : ''} />
            <span className="btn-sync-label">
              {isSyncing ? 'Enviando...' : 'Sincronizar'}
            </span>
            {pendingCount > 0 && (
              <span className="pending-badge-count">{pendingCount}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsQrOpen(true)}
            className="btn-qr-navbar"
            title="Mostrar código QR para conectar celular por Wi-Fi"
          >
            <QrCode size={17} />
            <span className="btn-sync-label">QR Celular</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="btn-settings-icon"
            title="Configurar IP de PC central"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <QrConnectModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={onRefreshStatus}
      />
    </>
  );
}
