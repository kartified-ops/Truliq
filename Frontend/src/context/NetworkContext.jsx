import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const NetworkContext = createContext({
  isOnline: true,
  isReconnecting: false,
  wasOffline: false,
  networkType: 'unknown',
  checkConnectivity: () => Promise.resolve(true),
});

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [networkType, setNetworkType] = useState('unknown');
  const checkTimeoutRef = useRef(null);
  const backOnlineTimerRef = useRef(null);

  // Ping a fast, lightweight endpoint or origin to verify actual internet connectivity
  const checkConnectivity = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    try {
      // Use timestamp cache-busting on favicon or lightweight public asset
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch(`/truliq-logo.png?_ping=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const online = response.ok || response.status < 500;
      setIsOnline(online);
      return online;
    } catch (error) {
      // If HEAD fails, assume connection is momentarily interrupted
      console.warn('[Network] Connectivity check failed or switching network:', error.message);
      // If navigator.onLine is true, it might be a temporary network switch handshake
      setIsOnline(navigator.onLine);
      return navigator.onLine;
    }
  }, []);

  useEffect(() => {
    // Detect network type if Network Information API is available
    const updateNetworkInfo = () => {
      if ('connection' in navigator && navigator.connection) {
        const conn = navigator.connection;
        setNetworkType(conn.effectiveType || conn.type || 'cellular/wifi');
      }
    };

    updateNetworkInfo();

    const handleOnline = async () => {
      console.log('[Network] 🌐 Browser online event detected. Verifying connectivity...');
      setIsReconnecting(true);
      
      // Wait a moment for network switch handshake to settle
      setTimeout(async () => {
        const actuallyOnline = await checkConnectivity();
        setIsReconnecting(false);

        if (actuallyOnline) {
          setIsOnline(true);
          setWasOffline(true);
          
          // Clear any previous dismiss timer
          if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
          backOnlineTimerRef.current = setTimeout(() => {
            setWasOffline(false);
          }, 2500);

          // Notify components that network is back
          window.dispatchEvent(new CustomEvent('appNetworkRestored'));
        }
      }, 500);
    };

    const handleOffline = () => {
      console.warn('[Network] ⚠️ Browser offline event detected.');
      setIsOnline(false);
      setIsReconnecting(false);
      window.dispatchEvent(new CustomEvent('appNetworkOffline'));
    };

    const handleConnectionChange = () => {
      console.log('[Network] 🔄 Network connection changed (e.g. WiFi/Cellular switch).');
      updateNetworkInfo();
      setIsReconnecting(true);
      
      // Re-verify after network switch
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(async () => {
        await checkConnectivity();
        setIsReconnecting(false);
      }, 800);
    };

    // Custom API failure event from Axios
    const handleApiNetworkError = () => {
      console.warn('[Network] API Network Error detected. Checking connectivity status...');
      setIsReconnecting(true);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(async () => {
        await checkConnectivity();
        setIsReconnecting(false);
      }, 600);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('appApiNetworkError', handleApiNetworkError);

    if ('connection' in navigator && navigator.connection) {
      navigator.connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('appApiNetworkError', handleApiNetworkError);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
      if ('connection' in navigator && navigator.connection) {
        navigator.connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [checkConnectivity]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isReconnecting,
        wasOffline,
        networkType,
        checkConnectivity,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
export default NetworkContext;
