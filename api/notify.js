// Notifiche delle scadenze. Vercel la chiama ogni mattina (vedi vercel.json → crons).
//   GET  /api/notify            → giro del mattino (solo Vercel Cron, con CRON_SECRET)
//   POST /api/notify?test=1     → notifica di prova per l'utente che la chiede (con il suo token Firebase)
// Variabili da mettere su Vercel (GUIDA.md, passo "Notifiche"):
//   FIREBASE_SERVICE_ACCOUNT  il file JSON della chiave privata di Firebase, incollato intero
//   VAPID_PRIVATE_KEY         la chiave privata delle notifiche
//   CRON_SECRET               una parola segreta qualsiasi (Vercel la usa per chiamare il giro del mattino)
import * as webpush from 'web-push';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const config = { maxDuration: 30 };

const VAPID_PUBLIC = 'BA5EDCSshccalQv-siJt9BRXUhxBXxZiQkEK9g-mxyfr3b0s9XXF2-I8GVVHZ8rHX10bTIABDeCfbCPOWu-g4zA';

function setup() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!raw || !priv) throw Object.assign(new Error('Mancano FIREBASE_SERVICE_ACCOUNT o VAPID_PRIVATE_KEY su Vercel (vedi GUIDA.md).'), { code: 500 });
  if (!getApps().length) {
    let acc;
    try {
      acc = JSON.parse(raw);
    } catch {
      throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT non è un JSON valido: incolla tutto il file, dalla { alla }.'), { code: 500 });
    }
    if (acc.private_key) acc.private_key = acc.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(acc) });
  }
  webpush.setVapidDetails('mailto:dimmispensa@example.com', VAPID_PUBLIC, priv.trim());
  return getFirestore();
}

// "oggi" in Italia, come AAAA-MM-GG
const romeISO = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

function list(names) {
  const n = [...new Set(names)];
  if (n.length <= 3) return n.join(', ');
  return `${n.slice(0, 3).join(', ')} e altri ${n.length - 3}`;
}

// Testo della notifica dai cibi della dispensa
export function buildMessage(items, days, today = romeISO()) {
  const by = { expired: [], 0: [], 1: [], later: [] };
  let freezable = 0;
  for (const it of items) {
    if (!it.expiry) continue;
    const n = daysBetween(today, it.expiry);
    if (n < -2 || n > days) continue;
    if (n < 0) by.expired.push(it.name);
    else if (n === 0) by[0].push(it.name);
    else if (n === 1) by[1].push(it.name);
    else by.later.push(it.name);
    if (n >= 0 && n <= 2 && it.loc !== 'freezer') freezable++;
  }
  const parts = [];
  if (by[0].length) parts.push(`Oggi: ${list(by[0])}`);
  if (by[1].length) parts.push(`Domani: ${list(by[1])}`);
  if (by.later.length) parts.push(`Entro ${days} giorni: ${list(by.later)}`);
  if (by.expired.length) parts.push(`Già scaduti: ${list(by.expired)}`);
  if (!parts.length) return null;
  const urgent = by[0].length + by[1].length;
  const title = urgent ? `${urgent === 1 ? '1 cibo scade' : urgent + ' cibi scadono'} a breve` : 'Scadenze in arrivo';
  let body = parts.join('\n');
  if (freezable) body += '\nSe non fai in tempo, puoi ancora congelare: apri Scadenze.';
  return { title, body, url: '/#scadenze', tag: 'scadenze-' + today };
}

async function sendTo(db, uid, user, payload) {
  const subs = Object.entries(user.push || {});
  let sent = 0;
  const gone = [];
  await Promise.all(
    subs.map(async ([id, s]) => {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'normal' });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) gone.push(id);
      }
    })
  );
  if (gone.length) {
    const { FieldPath, FieldValue } = await import('firebase-admin/firestore');
    const args = gone.flatMap((id) => [new FieldPath('push', id), FieldValue.delete()]);
    await db.doc(`users/${uid}`).update(...args).catch(() => {});
  }
  return { sent, gone: gone.length, devices: subs.length };
}

async function itemsOf(db, pantryId) {
  if (!pantryId) return [];
  const snap = await db.collection(`pantries/${pantryId}/items`).get();
  return snap.docs.map((d) => d.data());
}

export default async function handler(req, res) {
  try {
    const db = setup();

    // prova da parte di un utente
    if (req.query?.test) {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Entra con il tuo account.' });
      const { uid } = await getAuth().verifyIdToken(token);
      const snap = await db.doc(`users/${uid}`).get();
      const user = snap.data() || {};
      if (!Object.keys(user.push || {}).length) return res.status(400).json({ error: 'Le notifiche non sono attive su nessun dispositivo.' });
      const msg = buildMessage(await itemsOf(db, user.pantryId), user.notifyDays || 2) || { title: 'Dimmispensa', body: 'Le notifiche funzionano! Niente in scadenza per ora.', url: '/#scadenze' };
      const r = await sendTo(db, uid, user, { ...msg, title: '🔔 ' + msg.title, tag: 'prova' });
      return res.status(200).json(r);
    }

    // giro del mattino: solo Vercel Cron
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'non autorizzato' });
    const users = await db.collection('users').get();
    const cache = new Map();
    let sent = 0;
    let people = 0;
    for (const doc of users.docs) {
      const user = doc.data();
      if (!user.push || !Object.keys(user.push).length || !user.pantryId) continue;
      if (!cache.has(user.pantryId)) cache.set(user.pantryId, await itemsOf(db, user.pantryId));
      const msg = buildMessage(cache.get(user.pantryId), user.notifyDays || 2);
      if (!msg) continue;
      const r = await sendTo(db, doc.id, user, msg);
      sent += r.sent;
      people++;
    }
    return res.status(200).json({ people, sent });
  } catch (e) {
    const code = e.code === 500 ? 500 : /token|auth/i.test(e.code || e.message || '') ? 401 : 500;
    return res.status(code).json({ error: code === 401 ? 'Accesso non valido: esci e rientra nell\'app.' : e.message || 'Errore del server.' });
  }
}
