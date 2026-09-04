import React, { lazy, useState, useEffect } from 'react';
import { FiRefreshCw, FiWifiOff, FiArrowLeft } from 'react-icons/fi';
import Logo from '../components/common/Logo';

/**
 * Helper to retry a dynamic import multiple times before giving up.
 * Helps smoothly bridge network handovers (e.g. WiFi to 4G/5G).
 */
const retryImport = async (componentImport, retriesLeft = 3, interval = 800) => {
  try {
    return await componentImport();
  } catch (error) {
    if (retriesLeft <= 0) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    return retryImport(componentImport, retriesLeft - 1, interval * 1.5);
  }
};

/**
 * Fallback component shown when dynamic chunk loading fails after retries
 */
const ChunkLoadingFallback = ({ onRetry }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleNetworkRestored = () => {
      console.log('[lazyWithRetry] Network restored, retrying chunk load...');
      setIsRetrying(true);
      setTimeout(() => {
        if (onRetry) onRetry();
        else window.location.reload();
      }, 500);
    };

    window.addEventListener('online', handleNetworkRestored);
    window.addEventListener('appNetworkRestored', handleNetworkRestored);

    return () => {
      window.removeEventListener('online', handleNetworkRestored);
      window.removeEventListener('appNetworkRestored', handleNetworkRestored);
    };
  }, [onRetry]);

  const handleManualRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      if (onRetry) onRetry();
      else window.location.reload();
    }, 400);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 relative">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-500 shadow-inner">
          <FiWifiOff className="w-8 h-8 text-[#347989] animate-pulse" />
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">Connecting to Server</h2>
        <p className="text-sm text-gray-600 mb-6">
          The network connection was momentarily interrupted. Please check your internet or retry below.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="w-full py-3.5 px-4 bg-[#347989] hover:bg-[#285d69] text-white font-bold rounded-xl shadow-lg shadow-[#347989]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            <FiRefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Connecting...' : 'Retry Connection'}</span>
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 px-4 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Resilient lazy load wrapper with automatic retries and network reconnection handling
 */
export const lazyWithRetry = (importFunc, options = { maxRetries: 3, retryDelay: 800 }) => {
  return lazy(() => {
    return retryImport(importFunc, options.maxRetries, options.retryDelay).catch((error) => {
      console.warn('[lazyWithRetry] Chunk import failed after retries:', error.message);
      
      // Return a graceful fallback component
      return {
        default: () => <ChunkLoadingFallback onRetry={() => window.location.reload()} />,
      };
    });
  });
};

export default lazyWithRetry;
