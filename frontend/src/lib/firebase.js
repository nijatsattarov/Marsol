// Firebase Cloud Messaging client — Web Push for Marsol MMS
//
// Usage:
//   import { initPush } from './firebase';
//   initPush(); // call once after the user logs in.
//
// Behaviour:
//   - Lazily initialises Firebase App + Messaging
//   - Requests Notification permission (no-op if already granted/denied)
//   - Registers /firebase-messaging-sw.js (must exist in public/)
//   - Calls getToken({ vapidKey }) → POSTs to /api/push/subscribe
//   - Installs an onMessage handler so foreground tabs also surface notifications

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import axios from 'axios';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;
const API = process.env.REACT_APP_BACKEND_URL;

let _messaging = null;
let _initialised = false;

function getFirebaseApp() {
  return getApps()[0] || initializeApp(firebaseConfig);
}

async function ensureMessaging() {
  if (_messaging) return _messaging;
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.info('[push] FCM messaging is not supported on this browser');
    return null;
  }
  _messaging = getMessaging(getFirebaseApp());
  return _messaging;
}

/**
 * Request Notification permission + register SW + obtain & persist FCM token.
 * Safe to call multiple times; subsequent calls re-use the same token.
 *
 * @returns {Promise<{ ok: boolean, token?: string, reason?: string }>}
 */
export async function initPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'no_sw' };
  }
  if (!VAPID_KEY) {
    return { ok: false, reason: 'no_vapid_key' };
  }
  if (_initialised) return { ok: true, reason: 'already_initialised' };

  // Request permission — browsers may auto-resolve to denied if previously dismissed.
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: `permission_${permission}` };
  }

  // Register the dedicated FCM service worker file. The SW lives at /firebase-messaging-sw.js.
  let registration;
  try {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('[push] SW register failed', err);
    return { ok: false, reason: 'sw_register_failed' };
  }

  const messaging = await ensureMessaging();
  if (!messaging) return { ok: false, reason: 'unsupported' };

  let token;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (err) {
    console.error('[push] getToken failed', err);
    return { ok: false, reason: 'token_failed' };
  }
  if (!token) {
    return { ok: false, reason: 'no_token' };
  }

  // Persist to backend
  try {
    const authToken = localStorage.getItem('token');
    if (authToken) {
      await axios.post(
        `${API}/api/push/subscribe`,
        { token, platform: 'web' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    }
  } catch (err) {
    console.error('[push] subscribe failed', err);
  }

  // Foreground message handler — show a toast/notification when the tab is focused
  onMessage(messaging, (payload) => {
    const { title, body } = payload.notification || {};
    const link = payload.data?.link;
    // Inform the rest of the app via a custom event so any toast layer can react.
    window.dispatchEvent(
      new CustomEvent('fcm-foreground', { detail: { title, body, link, data: payload.data } })
    );
    // Best-effort native banner if the page is hidden
    if (document.visibilityState !== 'visible' && 'Notification' in window) {
      try {
        const n = new Notification(title || 'Marsol MMS', {
          body: body || '',
          icon: '/icon-192.png',
          badge: '/favicon-64.png',
          data: payload.data || {},
        });
        n.onclick = () => {
          window.focus();
          if (link) window.location.href = link;
          n.close();
        };
      } catch (_) { /* ignore */ }
    }
  });

  _initialised = true;
  return { ok: true, token };
}

/**
 * Trigger a test push to the current user. Returns the backend response.
 */
export async function sendTestPush() {
  const authToken = localStorage.getItem('token');
  if (!authToken) throw new Error('Auth tələb olunur');
  const r = await axios.post(
    `${API}/api/push/test`,
    {},
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return r.data;
}

/**
 * Lookup current registered devices for the user (for Settings UI).
 */
export async function fetchPushStatus() {
  const authToken = localStorage.getItem('token');
  if (!authToken) return { devices: [], count: 0 };
  const r = await axios.get(`${API}/api/push/status`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  return r.data;
}

/**
 * Disable push on this device only (token-scoped) or for the user across all devices.
 */
export async function unsubscribePush({ allDevices = false } = {}) {
  const authToken = localStorage.getItem('token');
  if (!authToken) return false;
  let token = null;
  if (!allDevices) {
    const messaging = await ensureMessaging();
    if (messaging) {
      try { token = await getToken(messaging, { vapidKey: VAPID_KEY }); } catch (_) { /* ignore */ }
    }
  }
  await axios.post(
    `${API}/api/push/unsubscribe`,
    { token },
    { headers: { Authorization: `Bearer ${authToken}` } }
  ).catch(() => {});
  _initialised = false;
  return true;
}
