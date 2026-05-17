import { initializeApp, FirebaseApp } from 'firebase/app';
import { getMessaging, Messaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function initFirebase() {
  if (!firebaseConfig.apiKey) return false;
  app = initializeApp(firebaseConfig);
  try { messaging = getMessaging(app); } catch { /* no messaging available */ }
  return true;
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || '',
    });
    return token;
  } catch { return null; }
}

export function onForegroundMessage(callback: (payload: unknown) => void) {
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => callback(payload));
  return unsub;
}

export function getFirebaseApp() {
  return app;
}
