// Tutti i dati dell'app passano da qui.
// - Senza configurazione Firebase: i dati restano nel telefono (localStorage).
// - Con Firebase: login + dispensa condivisa in tempo reale su Firestore.
import { firebaseConfig } from '../firebase-config.js';

export const cloudEnabled = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

const LS_ITEMS = 'dm_items';
const LS_KEY = 'dm_gemini_key';
const LS_USDA = 'dm_usda_key';
const LS_MEALS = 'dm_meals';
const LS_SHOP = 'dm_shop';
const LS_FIN = 'dm_finished';
const MAX_FINISHED = 30; // ricordo gli ultimi 30 cibi finiti, per proporli nella spesa
// offerte scadute da più di un giorno: si cancellano da sole
const expiredOffers = (offers) => {
  const cut = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return Object.entries(offers || {}).filter(([, o]) => o && o.until && o.until < cut).map(([k]) => k);
};
const pruneOffers = (offers) => {
  const out = { ...offers };
  expiredOffers(out).forEach((k) => delete out[k]);
  return out;
};
const oldFinished = (fin) => Object.entries(fin || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(MAX_FINISHED).map(([k]) => k);
const KEEP_DAYS = 60; // il calendario tiene gli ultimi 60 giorni

const oldMealDays = (meals) => {
  const cut = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  return Object.keys(meals || {}).filter((d) => d < cut);
};

let state = {
  mode: cloudEnabled ? 'cloud' : 'local',
  phase: 'loading', // loading | login | nopantry | ready
  user: null, // { uid, email, name }
  pantry: null, // { id, name, members, memberNames, geminiKey }
  items: [],
  offers: {}, // offerte lette dai volantini: { id: { name, brand, price, oldPrice, size, until, store, food, icon } }
  flyerLinks: {}, // supermercati preferiti: { id: { name, url } }
  shopping: {}, // { id: { id, name, qty, unit, food, icon, cat, done, by, addedAt } }
  finished: {}, // { chiave: { name, food, icon, unit, cat, at } } ultimi cibi finiti
  meals: {}, // { 'AAAA-MM-GG': { colazione: [...], snack: [...], pranzo: [...], cena: [...] } }
  online: true,
  error: null,
};
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));
const set = (patch) => {
  state = { ...state, ...patch };
  emit();
};
export const getState = () => state;
export const finishedKey = (item) => (item.food && item.food !== 'altro' ? item.food : 'n_' + String(item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40));
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const lsGet = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export const localItemsCount = () => lsGet(LS_ITEMS, []).length;

// ---------------------------------------------------------------- locale
const local = {
  start() {
    const meals = lsGet(LS_MEALS, {});
    oldMealDays(meals).forEach((d) => delete meals[d]);
    set({ phase: 'ready', pantry: { id: 'local', name: 'La mia dispensa', local: true, geminiKey: lsGet(LS_KEY, ''), usdaKey: lsGet(LS_USDA, '') }, items: lsGet(LS_ITEMS, []), meals, shopping: lsGet(LS_SHOP, {}), finished: lsGet(LS_FIN, {}), offers: pruneOffers(lsGet('dm_offers', {})), flyerLinks: lsGet('dm_links', {}) });
    window.addEventListener('storage', (e) => {
      if (e.key === LS_ITEMS) set({ items: lsGet(LS_ITEMS, []) });
      if (e.key === LS_MEALS) set({ meals: lsGet(LS_MEALS, {}) });
      if (e.key === LS_SHOP) set({ shopping: lsGet(LS_SHOP, {}) });
      if (e.key === 'dm_offers') set({ offers: lsGet('dm_offers', {}) });
      if (e.key === 'dm_links') set({ flyerLinks: lsGet('dm_links', {}) });
    });
  },
  save(items) {
    lsSet(LS_ITEMS, items);
    set({ items });
  },
  async addItems(drafts) {
    const now = Date.now();
    local.save([...state.items, ...drafts.map((d, i) => ({ ...d, addedAt: d.addedAt || now + i, by: d.by || '' }))]);
  },
  async updateItem(id, patch) {
    local.save(state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  },
  async removeItem(id) {
    local.save(state.items.filter((it) => it.id !== id));
  },
  async mapSet(field, id, value) {
    const map = { ...state[field] };
    if (value) map[id] = value;
    else delete map[id];
    lsSet(field === 'offers' ? 'dm_offers' : 'dm_links', map);
    set({ [field]: map });
  },
  async shopSet(id, value) {
    const shopping = { ...state.shopping };
    if (value) shopping[id] = value;
    else delete shopping[id];
    lsSet(LS_SHOP, shopping);
    set({ shopping });
  },
  async logFinished(key, value) {
    const finished = { ...state.finished, [key]: value };
    if (!value) delete finished[key];
    oldFinished(finished).forEach((k) => delete finished[k]);
    lsSet(LS_FIN, finished);
    set({ finished });
  },
  async setMealSlot(date, slot, list) {
    const meals = { ...state.meals, [date]: { ...(state.meals[date] || {}), [slot]: list } };
    if (!list.length) delete meals[date][slot];
    if (!Object.keys(meals[date]).length) delete meals[date];
    lsSet(LS_MEALS, meals);
    set({ meals });
  },
  async setGeminiKey(key) {
    lsSet(LS_KEY, key);
    set({ pantry: { ...state.pantry, geminiKey: key } });
  },
  async setUsdaKey(key) {
    lsSet(LS_USDA, key);
    set({ pantry: { ...state.pantry, usdaKey: key } });
  },
};

// ---------------------------------------------------------------- cloud (Firebase)
let fb = null; // moduli e istanze Firebase, caricati solo se servono
let unsubUser = null;
let unsubPantry = null;
let unsubItems = null;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const prettyCode = (id) => (id && id.length === 8 ? id.slice(0, 4) + '-' + id.slice(4) : id || '');
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function friendlyError(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'Email o password sbagliate.',
    'auth/wrong-password': 'Password sbagliata.',
    'auth/user-not-found': 'Non esiste un account con questa email. Crea un account.',
    'auth/email-already-in-use': 'Esiste già un account con questa email: usa "Entra".',
    'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'auth/invalid-email': "L'email non è scritta bene.",
    'auth/missing-password': 'Scrivi la password.',
    'auth/too-many-requests': 'Troppi tentativi. Aspetta qualche minuto e riprova.',
    'auth/network-request-failed': 'Niente connessione a internet.',
    'auth/operation-not-allowed': 'In Firebase non è attivo il login "Email/Password": vedi GUIDA.md, passo 3.',
    'auth/configuration-not-found': 'In Firebase non è ancora attiva l\'Authentication: vedi GUIDA.md, passo 3.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La configurazione Firebase incollata non è corretta: vedi GUIDA.md, passo 2.',
    'permission-denied': 'Firebase ha rifiutato l\'operazione: controlla di aver pubblicato le regole (GUIDA.md, passo 5) e che il codice sia giusto.',
    'not-found': 'Non trovo nessuna dispensa con questo codice.',
    unavailable: 'Niente connessione: riprova quando torni online.',
  };
  return map[code] || e?.message || 'Qualcosa è andato storto. Riprova.';
}

const cloud = {
  async start() {
    try {
      const [appMod, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      let db;
      try {
        db = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }) });
      } catch {
        db = fsMod.getFirestore(app);
      }
      fb = { auth, db, A: authMod, F: fsMod };
      authMod.onAuthStateChanged(auth, (user) => cloud.onUser(user));
    } catch (e) {
      console.error(e);
      set({ phase: 'login', error: friendlyError(e) });
    }
  },

  stopListening() {
    [unsubUser, unsubPantry, unsubItems].forEach((u) => u && u());
    unsubUser = unsubPantry = unsubItems = null;
  },

  onUser(user) {
    cloud.stopListening();
    if (!user) {
      set({ phase: 'login', user: null, pantry: null, items: [] });
      return;
    }
    const { db, F } = fb;
    set({ user: { uid: user.uid, email: user.email, name: user.displayName || (user.email || '').split('@')[0] } });
    let currentPantry = undefined;
    unsubUser = F.onSnapshot(
      F.doc(db, 'users', user.uid),
      (snap) => {
        const pid = snap.exists() ? snap.data().pantryId || null : null;
        if (pid === currentPantry) return;
        currentPantry = pid;
        if (unsubPantry) unsubPantry();
        if (unsubItems) unsubItems();
        unsubPantry = unsubItems = null;
        if (!pid) {
          set({ phase: 'nopantry', pantry: null, items: [] });
          return;
        }
        cloud.listenPantry(pid);
      },
      (e) => set({ phase: 'nopantry', error: friendlyError(e) })
    );
  },

  listenPantry(pid) {
    const { db, F } = fb;
    unsubPantry = F.onSnapshot(
      F.doc(db, 'pantries', pid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        set({ pantry: { id: pid, ...data }, meals: data.meals || {}, shopping: data.shopping || {}, finished: data.finished || {}, offers: data.offers || {}, flyerLinks: data.flyerLinks || {}, phase: 'ready' });
        // pulizia: i giorni più vecchi di 2 mesi vengono tolti (una volta per sessione)
        const old = oldMealDays(data.meals);
        const oldFin = oldFinished(data.finished);
        const oldOff = expiredOffers(data.offers);
        if ((old.length || oldFin.length || oldOff.length) && !cloud.pruned) {
          cloud.pruned = true;
          const args = [...old.map((d) => new F.FieldPath('meals', d)), ...oldFin.map((k) => new F.FieldPath('finished', k)), ...oldOff.map((k) => new F.FieldPath('offers', k))].flatMap((fp) => [fp, F.deleteField()]);
          F.updateDoc(F.doc(db, 'pantries', pid), ...args).catch((e) => console.error(e));
        }
      },
      (e) => {
        // non sono più tra i membri (o regole non pubblicate): torno alla scelta della dispensa
        console.error(e);
        set({ phase: 'nopantry', pantry: null, items: [], error: friendlyError(e) });
      }
    );
    unsubItems = F.onSnapshot(
      F.collection(db, 'pantries', pid, 'items'),
      { includeMetadataChanges: true },
      (snap) => {
        set({ items: snap.docs.map((d) => ({ ...d.data(), id: d.id })), online: !snap.metadata.fromCache });
      },
      (e) => console.error(e)
    );
  },

  async signUp(name, email, password) {
    const { auth, A } = fb;
    const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), password);
    await A.updateProfile(cred.user, { displayName: name.trim() });
    set({ user: { uid: cred.user.uid, email: cred.user.email, name: name.trim() } });
  },
  async signIn(email, password) {
    await fb.A.signInWithEmailAndPassword(fb.auth, email.trim(), password);
  },
  async resetPassword(email) {
    await fb.A.sendPasswordResetEmail(fb.auth, email.trim());
  },
  async signOut() {
    await fb.A.signOut(fb.auth);
  },

  async createPantry(name, importLocal) {
    const { db, F } = fb;
    const { uid, name: userName } = state.user;
    const id = newCode();
    await F.setDoc(F.doc(db, 'pantries', id), {
      name: name.trim() || 'La nostra dispensa',
      members: [uid],
      memberNames: { [uid]: userName },
      geminiKey: lsGet(LS_KEY, ''),
      createdAt: Date.now(),
    });
    await F.setDoc(F.doc(db, 'users', uid), { pantryId: id, name: userName }, { merge: true });
    if (importLocal) {
      const old = lsGet(LS_ITEMS, []);
      if (old.length) {
        const batch = F.writeBatch(db);
        old.slice(0, 450).forEach((it) => batch.set(F.doc(db, 'pantries', id, 'items', it.id), { ...it, by: userName }));
        await batch.commit();
        lsSet(LS_ITEMS, []);
      }
    }
  },

  async joinPantry(codeRaw) {
    const { db, F } = fb;
    const { uid, name } = state.user;
    const id = cleanCode(codeRaw);
    if (id.length !== 8) throw { code: 'not-found' };
    try {
      await F.updateDoc(F.doc(db, 'pantries', id), { members: F.arrayUnion(uid), [`memberNames.${uid}`]: name });
    } catch (e) {
      if (e?.code === 'permission-denied') throw { code: 'not-found' };
      throw e;
    }
    await F.setDoc(F.doc(db, 'users', uid), { pantryId: id, name }, { merge: true });
  },

  async leavePantry() {
    const { db, F } = fb;
    const { uid } = state.user;
    const pid = state.pantry?.id;
    await F.setDoc(F.doc(db, 'users', uid), { pantryId: null }, { merge: true });
    if (pid) {
      try {
        await F.updateDoc(F.doc(db, 'pantries', pid), { members: F.arrayRemove(uid), [`memberNames.${uid}`]: F.deleteField() });
      } catch (e) {
        console.error(e);
      }
    }
  },

  async renamePantry(name) {
    await fb.F.updateDoc(fb.F.doc(fb.db, 'pantries', state.pantry.id), { name: name.trim() });
  },

  itemRef(id) {
    return fb.F.doc(fb.db, 'pantries', state.pantry.id, 'items', id);
  },
  // Niente "await" sulle scritture: Firestore le mostra subito e le spedisce appena c'è rete.
  async addItems(drafts) {
    const { db, F } = fb;
    const batch = F.writeBatch(db);
    const now = Date.now();
    drafts.forEach((d, i) => batch.set(cloud.itemRef(d.id), { ...d, addedAt: d.addedAt || now + i, by: d.by || state.user.name }));
    batch.commit().catch(reportWriteError);
  },
  async updateItem(id, patch) {
    fb.F.updateDoc(cloud.itemRef(id), patch).catch(reportWriteError);
  },
  async removeItem(id) {
    fb.F.deleteDoc(cloud.itemRef(id)).catch(reportWriteError);
  },
  async mapSet(field, id, value) {
    const { db, F } = fb;
    const map = { ...state[field] };
    if (value) map[id] = value;
    else delete map[id];
    set({ [field]: map });
    F.updateDoc(F.doc(db, 'pantries', state.pantry.id), new F.FieldPath(field, id), value || F.deleteField()).catch(reportWriteError);
  },
  // un campo per voce: due persone possono spuntare cose diverse insieme senza sovrascriversi
  async shopSet(id, value) {
    const { db, F } = fb;
    const shopping = { ...state.shopping };
    if (value) shopping[id] = value;
    else delete shopping[id];
    set({ shopping });
    F.updateDoc(F.doc(db, 'pantries', state.pantry.id), new F.FieldPath('shopping', id), value || F.deleteField()).catch(reportWriteError);
  },
  async logFinished(key, value) {
    const { db, F } = fb;
    const finished = { ...state.finished, [key]: value };
    if (!value) delete finished[key];
    set({ finished });
    F.updateDoc(F.doc(db, 'pantries', state.pantry.id), new F.FieldPath('finished', key), value || F.deleteField()).catch((e) => console.error(e));
  },
  async setMealSlot(date, slot, list) {
    const { db, F } = fb;
    const ref = F.doc(db, 'pantries', state.pantry.id);
    const value = list.length ? list : F.deleteField();
    // aggiorno subito lo schermo, Firestore conferma dopo
    const meals = { ...state.meals, [date]: { ...(state.meals[date] || {}), [slot]: list } };
    if (!list.length) delete meals[date][slot];
    set({ meals });
    F.updateDoc(ref, new F.FieldPath('meals', date, slot), value).catch(reportWriteError);
  },
  async setUsdaKey(key) {
    await fb.F.updateDoc(fb.F.doc(fb.db, 'pantries', state.pantry.id), { usdaKey: key });
  },
  async setGeminiKey(key) {
    await fb.F.updateDoc(fb.F.doc(fb.db, 'pantries', state.pantry.id), { geminiKey: key });
  },
};

function reportWriteError(e) {
  console.error(e);
  set({ error: friendlyError(e) });
}

const impl = cloudEnabled ? cloud : local;

export const actions = {
  start: () => impl.start(),
  addItems: (drafts) => impl.addItems(drafts),
  updateItem: (id, patch) => impl.updateItem(id, patch),
  removeItem: (id) => impl.removeItem(id),
  setGeminiKey: (key) => impl.setGeminiKey(key),
  setUsdaKey: (key) => impl.setUsdaKey(key),
  setMealSlot: (date, slot, list) => impl.setMealSlot(date, slot, list),
  shopSet: (id, value) => impl.shopSet(id, value),
  offerSet: (id, value) => impl.mapSet('offers', id, value),
  offerSetMany: (pairs) => pairs.forEach(([id, v]) => impl.mapSet('offers', id, v)),
  linkSet: (id, value) => impl.mapSet('flyerLinks', id, value),
  // più voci insieme (es. "Metti in dispensa" o "Togli spuntati")
  shopSetMany: (pairs) => pairs.forEach(([id, v]) => impl.shopSet(id, v)),
  logFinished: (item) => {
    const key = finishedKey(item);
    return impl.logFinished(key, { name: item.name, food: item.food || 'altro', icon: item.icon, unit: item.unit, cat: item.cat, at: Date.now() });
  },
  forgetFinished: (key) => impl.logFinished(key, null),
  clearError: () => set({ error: null }),
  // solo cloud
  signUp: cloud.signUp,
  signIn: cloud.signIn,
  signOut: cloud.signOut,
  resetPassword: cloud.resetPassword,
  createPantry: cloud.createPantry,
  joinPantry: cloud.joinPantry,
  leavePantry: cloud.leavePantry,
  renamePantry: cloud.renamePantry,
};
