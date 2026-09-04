import React, { useEffect } from 'react'; // Updated index to .jsx
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import AppRoutes from './routes';
import { SocketProvider } from './context/SocketContext';
import { CartProvider } from './context/CartContext';
import { CityProvider } from './context/CityContext';
import { NetworkProvider } from './context/NetworkContext';
import { initializePushNotifications, setupForegroundNotificationHandler } from './services/pushNotificationService';
import { LocationPermissionChecker } from './components/common';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
import NetworkStatusOverlay from './components/common/NetworkStatusOverlay';

function App() {
  // Initialize push notifications on app load
  useEffect(() => {
    console.log('[App] 🚀 Initializing Notification System...');
    initializePushNotifications();

    // Setup foreground notification handler
    setupForegroundNotificationHandler((payload) => {
      // Dispatch update events for listening components to refresh UI
      window.dispatchEvent(new Event('vendorJobsUpdated'));
      window.dispatchEvent(new Event('vendorStatsUpdated'));
      window.dispatchEvent(new Event('workerJobsUpdated'));
      window.dispatchEvent(new Event('userBookingsUpdated'));

      // Also dispatch generic one if needed
      window.dispatchEvent(new CustomEvent('appNotificationReceived', { detail: payload }));
    });
  }, []);

  return (
    <GlobalErrorBoundary>
      <NetworkProvider>
        <BrowserRouter>
          <SocketProvider>
            <CityProvider>
              <CartProvider>
                <div className="App">
                  <NetworkStatusOverlay />
                  <AppRoutes />
                  <LocationPermissionChecker />
                  <Toaster
                    position="top-center"
                    reverseOrder={false}
                    toastOptions={{
                      duration: 2000, // Global default (reduced from 3000)
                      style: {
                        background: '#333',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '12px 20px',
                      },
                      success: {
                        duration: 1000, // 1 second as requested
                        style: {
                          background: '#10B981',
                        },
                      },
                      error: {
                        duration: 2000, // Reduced from 4000
                        style: {
                          background: '#EF4444',
                        },
                      },
                    }}
                  />
                </div>
              </CartProvider>
            </CityProvider>
          </SocketProvider>
        </BrowserRouter>
      </NetworkProvider>
    </GlobalErrorBoundary>
  );
}

export default App;

