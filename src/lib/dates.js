// Date sempre come stringa locale "AAAA-MM-GG"
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (n, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
  return toISO(d);
};
// "AAAA-MM-GG" + n mesi (il 31 gennaio + 1 mese diventa il 28/29 febbraio)
export const addMonths = (iso, n) => {
  const d = fromISO(iso);
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
};
// si può congelare: non è già in freezer e scade oggi, domani o dopodomani
export const canFreeze = (item) => {
  if (!item || item.loc === 'freezer' || !item.expiry) return false;
  const n = daysLeft(item.expiry);
  return n !== null && n >= 0 && n <= 2;
};
export const FREEZE_MONTHS = 2;
export const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(fromISO(s));

export function daysLeft(expiry) {
  if (!expiry) return null;
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((fromISO(expiry) - a) / 86400000);
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export function shortDate(expiry) {
  const d = fromISO(expiry);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MESI[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

export function expiryLabel(expiry, est = false) {
  const n = daysLeft(expiry);
  if (n === null) return 'senza scadenza';
  if (n < -1) return `scaduto da ${-n} giorni`;
  if (n === -1) return 'scaduto ieri';
  if (n === 0) return 'scade oggi';
  if (n === 1) return 'scade domani';
  if (n <= 14) return est ? `circa ${n} giorni` : `tra ${n} giorni`;
  return (est ? 'verso il ' : 'entro il ') + shortDate(expiry);
}

// stato: 'expired' | 'today' | 'soon' | 'ok' | 'none'
export function expiryStatus(expiry, warnDays = 3) {
  const n = daysLeft(expiry);
  if (n === null) return 'none';
  if (n < 0) return 'expired';
  if (n === 0) return 'today';
  if (n <= warnDays) return 'soon';
  return 'ok';
}

// Quanta "vita" resta, da 0 a 1 (per la barra in stile HP).
// Parte dalla durata intera del cibo, ma vicino alla scadenza la barra si accorcia comunque.
export function lifeRatio(item, warnDays = 3, typicalDays = 0) {
  const n = daysLeft(item.expiry);
  if (n === null) return null;
  if (n <= 0) return 0;
  const added = item.addedAt ? new Date(item.addedAt) : new Date();
  const start = new Date(added.getFullYear(), added.getMonth(), added.getDate());
  const total = Math.max(1, typicalDays, Math.round((fromISO(item.expiry) - start) / 86400000));
  let r = Math.min(1, n / total);
  if (n <= 1) r = Math.min(r, 0.15);
  else if (n <= warnDays) r = Math.min(r, 0.2 + 0.25 * (n / warnDays));
  return Math.max(0.06, r);
}
