// Notifiche sul telefono (Web Push). Il server (api/notify.js) le manda ogni mattina.
import { actions } from './store.js';

// chiave pubblica VAPID: va bene che sia nel codice (quella privata sta solo su Vercel)
export const VAPID_PUBLIC = 'BA5EDCSshccalQv-siJt9BRXUhxBXxZiQkEK9g-mxyfr3b0s9XXF2-I8GVVHZ8rHX10bTIABDeCfbCPOWu-g4zA';
const LS_ID = 'dm_push_id';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'ios-home' (su iPhone va prima aggiunta alla schermata Home) | 'no'
export function pushSupport() {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  if (isIOS() && !isStandalone()) return 'ios-home';
  return 'no';
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function currentSubscription() {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(days) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Le notifiche sono bloccate: sbloccale nelle impostazioni del telefono per questo sito, poi riprova.' : 'Non hai dato il permesso per le notifiche.');
  const reg = (await registerSW()) || (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  let id = localStorage.getItem(LS_ID);
  if (!id) {
    id = 'd' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(LS_ID, id);
  }
  await actions.savePush(id, sub.toJSON(), days);
  return id;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) await sub.unsubscribe().catch(() => {});
  const id = localStorage.getItem(LS_ID);
  if (id) await actions.removePush(id);
}

// chiede al server di mandare subito una notifica di prova a questo account
export async function testPush() {
  const token = await actions.idToken();
  const r = await fetch('/api/notify?test=1', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Il server non risponde.');
  return data;
}
