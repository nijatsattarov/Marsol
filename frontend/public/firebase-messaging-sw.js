/* Firebase Cloud Messaging — Background Service Worker
 *
 * This file MUST be served from the site root at /firebase-messaging-sw.js for
 * Firebase Messaging to discover it. It uses the compat SDK loaded via importScripts
 * since the Firebase modular SDK isn't available inside SW scope.
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBazF9eIgbAXGMgJgUeZEoGI6rKptJWxNs',
  authDomain: 'marsol-mms.firebaseapp.com',
  projectId: 'marsol-mms',
  storageBucket: 'marsol-mms.firebasestorage.app',
  messagingSenderId: '572925182043',
  appId: '1:572925182043:web:5d8969377f0ecc58203f7e',
});

firebase.messaging();

// IMPORTANT: We intentionally do NOT register `onBackgroundMessage`.
// When the FCM payload contains a `notification` field, the browser auto-shows
// the system notification. Registering `onBackgroundMessage` AND calling
// `showNotification` would display the notification twice. The FCM payload's
// `webpush.fcm_options.link` controls the click-through target.

// Force activation immediately when this SW version installs — avoids stale
// duplicate handlers from a previous build sitting in waiting state.
self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// Notification-click: focus an existing tab on the right path, or open a new one.
// We always read `data.link` from the FCM payload — this is set by the backend
// based on the notification type (task/meeting/message/note).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // `data.link` is the absolute URL set by backend (push_service._safe_push)
  // and propagated through FCM's data payload. Fall back to FCM's
  // `FCM_MSG.fcmOptions.link` which Firebase exposes on data as well.
  const fcmOpts = data.FCM_MSG && data.FCM_MSG.fcmOptions;
  const target = data.link || (fcmOpts && fcmOpts.link) || self.location.origin + '/dashboard';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Try to focus an existing tab and navigate it
    for (const client of allClients) {
      try {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); } catch (_) { /* cross-origin */ }
        } else {
          // Older clients lack navigate(); post a message and let the app navigate
          client.postMessage({ type: 'PUSH_NAV', target });
        }
        return;
      } catch (_) { /* try next */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
