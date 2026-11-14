import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { actions, getState, subscribe } from './lib/store.js';
import { FREEZE_MONTHS, addMonths, canFreeze, expiryStatus, shortDate, todayISO } from './lib/dates.js';
import { play } from './lib/sound.js';
import { AppCtx, Icon, Loading } from './components/ui.jsx';
import ItemSheet from './components/ItemSheet.jsx';
import Pantry from './screens/Pantry.jsx';
import Expiry from './screens/Expiry.jsx';
import Add from './screens/Add.jsx';
import Meals from './screens/Meals.jsx';
import Settings from './screens/Settings.jsx';
import Shopping, { shopItemFrom } from './screens/Shopping.jsx';
import { Login, PantryChoice } from './screens/Auth.jsx';

const TABS = [
  { id: 'dispensa', name: 'Dispensa', icon: '1f3e0' },
  { id: 'scadenze', name: 'Scadenze', icon: '23f0' },
  { id: 'aggiungi', name: 'Aggiungi' },
  { id: 'pasti', name: 'Pasti', icon: '1f4c5' },
  { id: 'spesa', name: 'Spesa', icon: '1f6d2' },
  { id: 'opzioni', name: 'Opzioni', icon: '2699', deskOnly: true },
];
const tabFromHash = () => {
  let h = location.hash.replace('#', '');
  if (h === 'cena') h = 'pasti';
  return TABS.some((t) => t.id === h) ? h : 'dispensa';
};

export default function App() {
  const [state, setState] = useState(getState());
  const [tab, setTab] = useState(tabFromHash);
  const [toasts, setToasts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [goneIds, setGoneIds] = useState(() => new Set());
  const [warnDays, setWarn] = useState(() => {
    try {
      return Number(localStorage.getItem('dm_warn')) || 3;
    } catch {
      return 3;
    }
  });
  const toastId = useRef(0);

  useEffect(() => {
    const un = subscribe(setState);
    actions.start();
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      un();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const toast = useCallback((text, opts = {}) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.filter((t) => !(opts.key && t.key === opts.key)).slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), opts.err ? 6000 : 3500);
  }, []);

  useEffect(() => {
    if (state.error && state.phase === 'ready') {
      toast(state.error, { err: true });
      actions.clearError();
    }
  }, [state.error, state.phase]);

  const go = useCallback((id) => {
    if (location.hash !== '#' + id) location.hash = id;
    setTab(id);
    window.scrollTo(0, 0);
  }, []);

  const setWarnDays = (n) => {
    setWarn(n);
    try {
      localStorage.setItem('dm_warn', String(n));
    } catch {}
  };

  const removeWithUndo = (item, text) => {
    setOpenId(null);
    actions.logFinished(item);
    setGoneIds((s) => new Set(s).add(item.id));
    setTimeout(() => {
      actions.removeItem(item.id);
      setGoneIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }, 480);
    toast(text, { action: { label: 'Annulla', fn: () => actions.addItems([item]) } });
  };

  // Congela: va in freezer e la scadenza si sposta di 2 mesi
  const freezeItem = (item) => {
    setOpenId(null);
    const before = { loc: item.loc, expiry: item.expiry, est: !!item.est };
    const expiry = addMonths(item.expiry || todayISO(), FREEZE_MONTHS);
    actions.updateItem(item.id, { loc: 'freezer', expiry, est: false, frozenAt: Date.now() });
    play('add');
    toast(`${item.name}: in freezer, ora scade il ${shortDate(expiry)}.`, { action: { label: 'Annulla', fn: () => actions.updateItem(item.id, { ...before, frozenAt: null }) } });
  };

  const ctx = useMemo(
    () => ({
      state,
      warnDays,
      setWarnDays,
      toast,
      go,
      goneIds,
      freezeItem,
      openItem: (item) => {
        play('open');
        setOpenId(item.id);
      },
      openItemById: (id) => setOpenId(id),
    }),
    [state, warnDays, goneIds]
  );

  if (state.phase === 'loading') {
    return (
      <div className="app">
        <div className="splash"><Loading text="Apro il frigo..." /></div>
      </div>
    );
  }
  if (state.phase === 'login') return <div className="app"><Login error={state.error} /></div>;
  if (state.phase === 'nopantry') return <div className="app"><PantryChoice user={state.user} error={state.error} /></div>;

  const alerts = state.items.filter((i) => ['expired', 'today', 'soon'].includes(expiryStatus(i.expiry, warnDays))).length;
  const openItem = openId ? state.items.find((i) => i.id === openId) : null;
  const toBuy = Object.values(state.shopping || {}).filter((s) => !s.done).length;
  const Screen = { dispensa: Pantry, scadenze: Expiry, aggiungi: Add, pasti: Meals, spesa: Shopping, opzioni: Settings }[tab];

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <header className="topbar">
          <Icon id="1f9ca" size={20} />
          <span className="logo">DIMMISPENSA</span>
          <span className="where" title={state.online ? 'Sincronizzato' : 'Non in linea: salvo appena torna la rete'}>
            <span>{state.pantry?.name}</span>
            <i className={'led ' + (state.online ? '' : 'off')} />
          </span>
          <button type="button" className={'gear mob-only ' + (tab === 'opzioni' ? 'on' : '')} aria-label="Opzioni" onClick={() => (play('tap'), go('opzioni'))}>
            <Icon id="2699" size={24} />
          </button>
        </header>

        <main className="screen" key={tab}>
          <Screen />
        </main>

        <nav className="nav" aria-label="Sezioni">
          {TABS.map((t) =>
            t.id === 'aggiungi' ? (
              <button key={t.id} type="button" className={'add ' + (tab === t.id ? 'on' : '')} aria-label="Aggiungi cibo" aria-current={tab === t.id ? 'page' : undefined} onClick={() => (play('open'), go(t.id))}>
                <span className="a-btn">+</span>
                <span className="add-lbl">Aggiungi cibo</span>
              </button>
            ) : (
              <button key={t.id} type="button" className={(tab === t.id ? 'on ' : '') + (t.deskOnly ? 'desk-only' : '')} aria-current={tab === t.id ? 'page' : undefined} onClick={() => (play('tap'), go(t.id))}>
                <span className="ico"><Icon id={t.icon} size={30} /></span>
                <span className="nav-lbl">{t.name}</span>
                {t.id === 'scadenze' && alerts > 0 && <b className="badge" aria-label={`${alerts} cibi da controllare`}>{alerts}</b>}
                {t.id === 'spesa' && toBuy > 0 && <b className="badge calm" aria-label={`${toBuy} cose da comprare`}>{toBuy}</b>}
              </button>
            )
          )}
        </nav>

        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={'toast ' + (t.err ? 'err' : '')}>
              <span>{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.fn();
                    setToasts((list) => list.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>

        {openItem && (
          <ItemSheet
            key={openItem.id}
            item={openItem}
            onClose={() => setOpenId(null)}
            onSave={(patch) => {
              actions.updateItem(openItem.id, patch);
              setOpenId(null);
              toast('Salvato.');
            }}
            onEaten={() => removeWithUndo(openItem, `${openItem.name}: finito!`)}
            onFreeze={canFreeze(openItem) ? () => freezeItem(openItem) : null}
            onDelete={() => removeWithUndo(openItem, `${openItem.name}: buttato.`)}
            onShop={() => {
              const key = (x) => (x.food && x.food !== 'altro' ? x.food : x.name.toLowerCase());
              if (Object.values(state.shopping || {}).some((s) => !s.done && key(s) === key(openItem))) return toast('È già nella lista della spesa.');
              const s = shopItemFrom(openItem, state.user?.name || '');
              actions.shopSet(s.id, s);
              play('add');
              toast(`${openItem.name}: aggiunto alla spesa.`);
            }}
          />
        )}
      </div>
    </AppCtx.Provider>
  );
}
