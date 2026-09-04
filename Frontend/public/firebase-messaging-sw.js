/**
 * Firebase Messaging Service Worker
 * Handles background push notifications with sound alerts
 * Version: 1.0.5
 */


// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase configuration - Production values
const firebaseConfig = {
  apiKey: 'AIzaSyCbz4QqWm_o2rRxGEGDN3n4kGCjmCnWWdY',
  authDomain: 'truliq.firebaseapp.com',
  projectId: 'truliq',
  storageBucket: 'truliq.firebasestorage.app',
  messagingSenderId: '268401383377',
  appId: '1:268401383377:web:ccd98bba66f06603f332f0',
  measurementId: 'G-51TK8SKZFS'
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Notification sounds based on type
const NOTIFICATION_SOUNDS = {
  new_booking: '/booking-alert.mp3',
  booking_accepted: '/success.mp3',
  worker_assigned: '/notification.mp3',
  job_assigned: '/booking-alert.mp3',
  booking_completed: '/success.mp3',
  default: '/notification.mp3'
};

// To prevent duplicate displays in background (SOP Section 7, Step 3)
const shownNotifications = new Set();

// ✅ CORRECT APPROACH per SOP:
// - payload.notification → used for system notification (background/closed tab)
// - payload.data → used for relay to foreground tabs
messaging.onBackgroundMessage(async (payload) => {
  console.log('[SW] 🔔 Firebase onBackgroundMessage received:', payload);

  const data = payload.data || {};
  const notification = payload.notification || {}; // ✅ from backend notification field
  const notificationId = data.notificationId;

  // 🚫 Prevent duplicate display
  if (notificationId && shownNotifications.has(notificationId)) {
    console.log('[SW] 🚫 Deduplicated message:', notificationId);
    return;
  }
  if (notificationId) {
    shownNotifications.add(notificationId);
    setTimeout(() => shownNotifications.delete(notificationId), 60000);
  }

  // ✅ STEP 1: Relay to ALL open foreground clients (for toast/sound in foreground)
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      client.postMessage({ type: 'FCM_FOREGROUND_MESSAGE', payload: data });
    });
  } catch (e) {
    // Ignore relay errors — notification will still show
  }

  // ✅ STEP 2: Build title/body for system notification
  const notificationType = data.type || 'default';
  let notificationTitle = notification.title || data.title || 'App Notification';
  let notificationBody = notification.body || data.body || 'You have a new update.';

  if (!notificationTitle && !notificationBody) {
    console.log('[SW] 🚫 Skipping empty notification');
    return;
  }


  let icon = data.icon || notification.icon || '/truliq-logo.png';
  let badge = '/truliq-logo.png';
  let tag = data.bookingId || `notification-${Date.now()}`;
  let requireInteraction = false;
  let vibrate = [200, 100, 200];
  let actions = [];

  // Enhanced styling for different notification types
  switch (notificationType) {
    case 'booking_requested':
      notificationTitle = notificationTitle || '📅 Booking Created!';
      notificationBody = notificationBody || 'Your service request has been received.';
      vibrate = [200, 100];
      actions = [{ action: 'view', title: '👁️ View Status' }];
      break;

    case 'new_booking':
      notificationTitle = data.title || notification.title || '🔔 New Booking Request!';
      notificationBody = data.body || notification.body || 'You have a new service request.';
      requireInteraction = true;
      vibrate = [500, 200, 500, 200, 500];
      actions = [
        { action: 'accept', title: '✓ Accept', icon: '/icons/accept.png' },
        { action: 'reject', title: '✗ Decline', icon: '/icons/reject.png' }
      ];
      break;

    case 'job_assigned':
      notificationTitle = data.title || notification.title || '🔔 New Job Assigned!';
      notificationBody = data.body || notification.body || 'You have been assigned a new job.';
      requireInteraction = true;
      vibrate = [500, 200, 500, 200, 500];
      actions = [
        { action: 'accept', title: '✓ Accept Job', icon: '/icons/accept.png' },
        { action: 'view', title: '👁️ View Details' }
      ];
      break;

    case 'booking_accepted':
    case 'worker_accepted':
      notificationTitle = data.title || notification.title || '✅ Professional Confirmed!';
      notificationBody = data.body || notification.body || 'A professional has accepted your booking.';
      vibrate = [200, 100, 200];
      actions = [{ action: 'view', title: '👁️ View Booking' }];
      break;

    case 'job_accepted':
      notificationTitle = data.title || notification.title || '✅ Job Confirmed!';
      notificationBody = data.body || notification.body || 'You have successfully accepted the job.';
      vibrate = [200, 100, 200];
      actions = [{ action: 'view', title: '👁️ View Job' }];
      break;

    case 'visit_verified':
      notificationTitle = data.title || notification.title || '📍 Visit Verified';
      notificationBody = data.body || notification.body || 'The professional has arrived and verified the visit.';
      vibrate = [200, 100, 200];
      break;

    case 'work_completed':
    case 'work_done':
    case 'worker_completed':
      notificationTitle = data.title || notification.title || '✅ Work Finished!';
      notificationBody = data.body || notification.body || 'Professional has finished the work. Please verify and pay.';
      requireInteraction = true;
      vibrate = [200, 100, 200, 100, 200];
      actions = [{ action: 'view', title: '👁️ View Summary' }];
      break;

    case 'earnings_credited':
    case 'payment_received':
      notificationTitle = data.title || notification.title || '💰 Payment Received!';
      notificationBody = data.body || notification.body || 'Payment has been successfully processed.';
      vibrate = [200, 500, 200];
      break;

    case 'worker_assigned':
      notificationTitle = data.title || notification.title || '👷 Worker Assigned';
      notificationBody = data.body || notification.body || 'A professional has been assigned to your booking.';
      vibrate = [200, 100, 200];
      actions = [{ action: 'track', title: '📍 Track Worker' }];
      break;

    case 'journey_started':
    case 'worker_started':
      notificationTitle = data.title || notification.title || '📍 Professional is on the way!';
      notificationBody = data.body || notification.body || 'Your service provider has started their journey.';
      requireInteraction = true;
      vibrate = [500, 200, 500];
      actions = [{ action: 'track', title: '📍 Track Arrival', icon: '/icons/track.png' }];
      break;

    case 'booking_completed':
      notificationTitle = data.title || notification.title || '🎉 Booking Completed!';
      notificationBody = data.body || notification.body || 'Service has been completed successfully.';
      vibrate = [200, 100, 200, 100, 200];
      actions = [{ action: 'rate', title: '⭐ Rate Now' }];
      break;
  }

  const notificationOptions = {
    body: notificationBody,
    icon: icon,
    badge: badge,
    tag: tag,
    sound: NOTIFICATION_SOUNDS[notificationType] || NOTIFICATION_SOUNDS.default,
    data: {
      ...data,
      notificationType: notificationType,
      url: data.link || '/',
      timestamp: Date.now()
    },
    vibrate: vibrate,
    requireInteraction: requireInteraction,
    actions: actions,
    silent: false,
    renotify: true,
    timestamp: Date.now()
  };

  // IMMEDIATELY show notification to prevent OS from killing SW
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 📱 Notification clicked:', event.action, event.notification.data);

  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;

  // Close the notification
  notification.close();

  let urlToOpen = data.url || data.link || '/';

  // Handle different actions
  switch (action) {
    case 'accept':
      // Accept booking/job - navigate to details page
      if (data.bookingId) {
        if (data.notificationType === 'job_assigned') {
          urlToOpen = `/worker/job/${data.bookingId}`;
        } else {
          urlToOpen = `/vendor/bookings/${data.bookingId}`;
        }
      }
      break;

    case 'reject':
    case 'decline':
      // User rejected - just close notification
      return;

    case 'view':
    case 'track':
      // View details
      if (data.bookingId) {
        urlToOpen = data.link || `/user/booking/${data.bookingId}`;
      }
      break;

    case 'rate':
      // Navigate to rating page
      if (data.bookingId) {
        urlToOpen = `/user/booking/${data.bookingId}?rate=true`;
      }
      break;

    default:
      // Default click - open the link
      urlToOpen = data.link || data.url || '/';
  }

  // Ensure URL is absolute
  const origin = self.location.origin;
  if (urlToOpen && !urlToOpen.startsWith('http')) {
    urlToOpen = new URL(urlToOpen, origin).href;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // Navigate to the specific URL
          if (urlToOpen) {
            return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] ❌ Notification closed:', event.notification.data);
});

// Note: Raw push events are handled by Firebase SDK internally.
// We relay messages to foreground clients via onBackgroundMessage above.

// App Shell & Offline Navigation Fallback
const APP_CACHE_NAME = 'truliq-shell-v1';
const PRECACHE_ASSETS = ['/', '/truliq-logo.png'];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Service Worker installing and caching app shell...');
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching assets skipped/failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] ✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('truliq-') && name !== APP_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

// Fetch event: Network-first with App Shell cache fallback for page navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Handle page navigations (HTML document requests)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache latest successful navigation response
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(APP_CACHE_NAME).then((cache) => {
              cache.put('/', responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          console.warn('[SW] ⚠️ Network navigation failed (offline/switching). Serving App Shell fallback.');
          const cachedResponse = await caches.match('/');
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback minimal offline page if root not cached
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Truliq - Reconnecting</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center; padding: 20px; }
                .card { background: white; padding: 32px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-width: 420px; width: 100%; border: 1px solid #e2e8f0; }
                .icon { font-size: 48px; margin-bottom: 16px; }
                h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #0f172a; }
                p { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
                button { background: #347989; color: white; border: none; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 12px; cursor: pointer; width: 100%; }
                button:hover { background: #285d69; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">🔄</div>
                <h1>Connection Interrupted</h1>
                <p>We are waiting for your network connection to stabilize. Please check your internet or tap below.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
              </div>
            </body>
            </html>`,
            {
              headers: { 'Content-Type': 'text/html' },
            }
          );
        })
    );
    return;
  }
});

console.log('[SW] 🚀 Firebase Messaging & Offline Fallback Service Worker loaded');

