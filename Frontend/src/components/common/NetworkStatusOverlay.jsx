import React from 'react';
import { FiWifiOff, FiWifi, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { useNetwork } from '../../context/NetworkContext';

const NetworkStatusOverlay = () => {
  const { isOnline, isReconnecting, wasOffline, checkConnectivity } = useNetwork();

  // If online, not reconnecting, and was not recently offline, don't show anything
  if (isOnline && !isReconnecting && !wasOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[99999] max-w-sm sm:max-w-md w-[92%] transition-all duration-300 pointer-events-none"
    >
      <div className="pointer-events-auto shadow-2xl rounded-2xl border backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-medium transition-all duration-300">
        {/* Offline State */}
        {!isOnline && (
          <div className="flex items-center justify-between w-full bg-rose-600/95 text-white p-3 rounded-xl shadow-lg border border-rose-400/30 animate-pulse">
            <div className="flex items-center gap-2.5 min-w-0">
              <FiWifiOff className="h-5 w-5 shrink-0 text-rose-200" />
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-bold text-xs sm:text-sm tracking-tight truncate">Connection Interrupted</span>
                <span className="text-[11px] text-rose-100 opacity-90 truncate">Reconnecting to server...</span>
              </div>
            </div>
            <button
              onClick={() => checkConnectivity()}
              className="ml-2 shrink-0 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1"
            >
              <FiRefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Reconnecting / Switching Network State */}
        {isOnline && isReconnecting && (
          <div className="flex items-center justify-between w-full bg-amber-500/95 text-white p-3 rounded-xl shadow-lg border border-amber-300/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <FiRefreshCw className="h-4 w-4 shrink-0 animate-spin text-amber-100" />
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-bold text-xs sm:text-sm tracking-tight truncate">Connecting to server...</span>
                <span className="text-[11px] text-amber-100 opacity-90 truncate">Switching network connection</span>
              </div>
            </div>
          </div>
        )}

        {/* Just Restored Online State */}
        {isOnline && !isReconnecting && wasOffline && (
          <div className="flex items-center justify-center w-full bg-emerald-600/95 text-white p-2.5 rounded-xl shadow-lg border border-emerald-400/30 transition-all duration-500">
            <div className="flex items-center gap-2">
              <FiWifi className="h-4 w-4 shrink-0 text-emerald-200" />
              <span className="font-bold text-xs sm:text-sm tracking-tight">Internet connection restored</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkStatusOverlay;
