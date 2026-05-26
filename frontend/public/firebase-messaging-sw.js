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

const messaging = firebase.messaging();

// Background message handler. Firebase automatically displays the notification
// payload if present; we override to add icon + click-through link.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, badge } = payload.notification || {};
  const data = payload.data || {};
  const notificationTitle = title || 'Marsol MMS';
  // Resolve icons against the SW origin so iOS Safari/APNS accepts them
  const origin = self.location.origin;
  const notificationOptions = {
    body: body || '',
    icon: icon || `${origin}/icon-192.png`,
    badge: badge || `${origin}/favicon-64.png`,
    tag: data.task_id || data.conversation_id || data.note_id || 'mms',
    renotify: true,
    data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification-click: focus an existing tab on the right path, or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.link || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Try to focus an existing tab and navigate it
      for (const win of wins) {
        if ('focus' in win) {
          win.focus();
          if ('navigate' in win) {
            try { win.navigate(target); } catch (_) { /* same-origin only */ }
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
