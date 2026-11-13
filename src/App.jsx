import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { actions, getState, subscribe } from './lib/store.js';
import { expiryStatus } from './lib/dates.js';
import { play } from './lib/sound.js';
import { AppCtx, Icon, Loading } from './components/ui.jsx';
import ItemSheet from './components/ItemSheet.jsx';
import Pantry from './screens/Pantry.jsx';
import Expiry from './screens/Expiry.jsx';
import Add from './screens/Add.jsx';
import Dinner from './screens/Dinner.jsx';
import Settings from './screens/Settings.jsx';
import { Login, PantryChoice } from './screens/Auth.jsx';

const TABS = [
  { id: 'dispensa', name: 'Dispensa', icon: '1f3e0' },
  { id: 'scadenze', name: 'Scadenze', icon: '23f0' },
  { id: 'aggiungi', name: 'Aggiungi' },
  { id: 'cena', name: 'Cena', icon: '1f37d' },
  { id: 'opzioni', name: 'Opzioni', icon: '2699' },
];
const tabFromHash = () => {
  const h = location.hash.replace('#', '');
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

  const ctx = useMemo(
    () => ({
      state,
      warnDays,
      setWarnDays,
      toast,
      go,
      goneIds,
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
  const Screen = { dispensa: Pantry, scadenze: Expiry, aggiungi: Add, cena: Dinner, opzioni: Settings }[tab];

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
        </header>

        <main className="screen" key={tab}>
          <Screen />
        </main>

        <nav className="nav" aria-label="Sezioni">
          {TABS.map((t) =>
            t.id === 'aggiungi' ? (
              <button key={t.id} type="button" className={'add ' + (tab === t.id ? 'on' : '')} aria-label="Aggiungi cibo" aria-current={tab === t.id ? 'page' : undefined} onClick={() => (play('open'), go(t.id))}>
                <span className="a-btn">+</span>
              </button>
            ) : (
              <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => (play('tap'), go(t.id))}>
                <span className="ico"><Icon id={t.icon} size={30} /></span>
                {t.name}
                {t.id === 'scadenze' && alerts > 0 && <b className="badge" aria-label={`${alerts} cibi da controllare`}>{alerts}</b>}
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
            onDelete={() => removeWithUndo(openItem, `${openItem.name}: buttato.`)}
          />
        )}
      </div>
    </AppCtx.Provider>
  );
}
