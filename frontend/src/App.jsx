import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { OperarioView } from './pages/OperarioView';
import { AdminView } from './pages/AdminView';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useOfflineSync } from './hooks/useOfflineSync';

export function App() {
  const [currentView, setCurrentView] = useState('operario');
  const { isOnline, backendReachable, checkConnection } = useNetworkStatus();
  const {
    pendingCount,
    isSyncing,
    triggerSync,
    refreshPendingCount
  } = useOfflineSync(backendReachable);

  return (
    <div className="app-layout">
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        isOnline={isOnline}
        backendReachable={backendReachable}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSyncTrigger={triggerSync}
        onRefreshStatus={checkConnection}
      />

      <main className="app-main-content">
        {currentView === 'operario' ? (
          <OperarioView
            backendReachable={backendReachable}
            onReportSaved={async () => {
              await refreshPendingCount();
              if (backendReachable) {
                await triggerSync();
              }
            }}
            isSyncing={isSyncing}
          />
        ) : (
          <AdminView backendReachable={backendReachable} />
        )}
      </main>
    </div>
  );
}

export default App;
