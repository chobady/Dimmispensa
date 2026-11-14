import { useMemo, useState } from 'react';
import { BY_KEY, CATEGORIES } from '../catalog.js';
import { actions, finishedKey } from '../lib/store.js';
import { makeDraft, newId, qtyLabel } from '../lib/items.js';
import { parseChunk, splitList } from '../lib/parse.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, SectionTitle, Talk, useApp } from '../components/ui.jsx';
import Flyers, { bestOfferFor, myStoreSlugs } from './Flyers.jsx';

const HAS_QTY = /\d|\b(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|mezzo)\b/i;

// Da testo libero ("2 latte, pane, 500 g macinato") a voci della lista
export function shopItemsFromText(text, by = '') {
  return splitList(text)
    .map((chunk) => {
      const d = parseChunk(chunk);
      if (!d) return null;
      const withQty = HAS_QTY.test(chunk);
      return { id: newId(), name: d.name, qty: withQty ? d.qty : null, unit: withQty ? d.unit : null, food: d.food, icon: d.icon, cat: d.cat, done: false, by, addedAt: Date.now() };
    })
    .filter(Boolean);
}

export const shopItemFrom = (src, by = '') => ({
  id: newId(),
  name: src.name,
  qty: null,
  unit: null,
  food: src.food || 'altro',
  icon: src.icon || '1f4e6',
  cat: src.cat || BY_KEY[src.food]?.cat || 'dispensa',
  done: false,
  by,
  addedAt: Date.now(),
});

// Un cibo "sta finendo" se ne resta poco
const runningLow = (i) => {
  const q = Number(i.qty) || 0;
  if (i.unit === 'g' || i.unit === 'ml') return q <= 150;
  if (i.unit === 'kg' || i.unit === 'l') return q <= 0.2;
  return q <= 1;
};

const shopLabel = (s) => (s.qty ? qtyLabel({ qty: s.qty, unit: s.unit }) : '');

export default function Shopping() {
  const { state, toast } = useApp();
  const [text, setText] = useState('');
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('dm_shoptab') || 'lista';
    } catch {
      return 'lista';
    }
  });
  const pickTab = (t) => {
    play('tap');
    setTab(t);
    try {
      localStorage.setItem('dm_shoptab', t);
    } catch {}
  };
  const nOffers = Object.values(state.offers || {}).filter((o) => !o.until || o.until >= new Date().toISOString().slice(0, 10)).length;
  const me = state.user?.name || '';
  const list = useMemo(() => Object.values(state.shopping || {}).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)), [state.shopping]);
  const todo = list.filter((s) => !s.done);
  const done = list.filter((s) => s.done);

  const inListKeys = new Set(list.filter((s) => !s.done).map((s) => (s.food !== 'altro' ? s.food : s.name.toLowerCase())));
  const inPantry = new Set(state.items.map((i) => i.food).filter((f) => f && f !== 'altro'));
  const inPantryNames = new Set(state.items.map((i) => i.name.toLowerCase()));
  const keyOf = (x) => (x.food && x.food !== 'altro' ? x.food : x.name.toLowerCase());

  // Proposte: cibi finiti di recente che non hai più, e cibi che stanno finendo
  const finished = Object.entries(state.finished || {})
    .map(([k, v]) => ({ ...v, key: k }))
    .filter((f) => f.name && !inListKeys.has(keyOf(f)) && !(f.food !== 'altro' ? inPantry.has(f.food) : inPantryNames.has(f.name.toLowerCase())))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 12);
  const low = state.items.filter((i) => runningLow(i) && !inListKeys.has(keyOf(i))).slice(0, 12);

  const add = (items) => {
    const fresh = items.filter((it) => !inListKeys.has(keyOf(it)));
    if (!fresh.length) {
      play('error');
      toast('È già nella lista.');
      return;
    }
    actions.shopSetMany(fresh.map((it) => [it.id, it]));
    play('add');
  };

  const submit = (e) => {
    e.preventDefault();
    const items = shopItemsFromText(text, me);
    if (!items.length) return;
    add(items);
    setText('');
  };

  const toggle = (s) => {
    play(s.done ? 'tap' : 'eat');
    actions.shopSet(s.id, { ...s, done: !s.done });
  };
  const remove = (s) => {
    actions.shopSet(s.id, null);
    toast(`${s.name}: tolto dalla lista.`, { action: { label: 'Annulla', fn: () => actions.shopSet(s.id, s) } });
  };

  const toPantry = () => {
    const drafts = done.map((s) => makeDraft({ name: s.name, foodKey: s.food, qty: s.qty || undefined, unit: s.unit || undefined }));
    actions.addItems(drafts);
    actions.shopSetMany(done.map((s) => [s.id, null]));
    done.forEach((s) => state.finished?.[finishedKey(s)] && actions.forgetFinished(finishedKey(s)));
    play('add');
    toast(`${drafts.length === 1 ? drafts[0].name + ' è' : drafts.length + ' cibi sono'} in dispensa. Scadenze stimate: correggile se serve.`, {
      action: {
        label: 'Annulla',
        fn: () => {
          drafts.forEach((d) => actions.removeItem(d.id));
          actions.shopSetMany(done.map((s) => [s.id, s]));
        },
      },
    });
  };

  const clearDone = () => {
    const old = done;
    actions.shopSetMany(old.map((s) => [s.id, null]));
    toast('Spuntati tolti dalla lista.', { action: { label: 'Annulla', fn: () => actions.shopSetMany(old.map((s) => [s.id, s])) } });
  };

  const share = async () => {
    const lines = todo.map((s) => `- ${s.name}${s.qty ? ' (' + shopLabel(s) + ')' : ''}`).join('\n');
    const msg = `Lista della spesa:\n${lines}`;
    try {
      if (navigator.share) await navigator.share({ text: msg });
      else {
        await navigator.clipboard.writeText(msg);
        toast('Lista copiata: incollala dove vuoi.');
      }
    } catch {}
  };

  // Lista raggruppata per reparto, nell'ordine in cui si gira il supermercato
  const groups = CATEGORIES.map((c) => ({ ...c, items: todo.filter((s) => (s.cat || 'dispensa') === c.id) })).filter((g) => g.items.length);

  let say;
  let mood = 'idle';
  if (!list.length) say = finished.length || low.length ? 'Lista vuota. Qui sotto ti propongo quello che è finito o sta finendo.' : 'Lista vuota. Scrivi cosa ti serve, anche più cose separate da virgole.';
  else if (!todo.length) {
    say = 'Hai preso tutto! Premi "Metti in dispensa" e il cibo spuntato entra in casa da solo.';
    mood = 'happy';
  } else say = `Ti ${todo.length === 1 ? 'manca 1 cosa' : 'mancano ' + todo.length + ' cose'}. Tocca una voce quando la metti nel carrello.`;

  const mySlugs = myStoreSlugs(state.flyerLinks);
  const Row = ({ s }) => {
    const deal = !s.done ? bestOfferFor(s, state.offers, mySlugs) : null;
    return (
    <div className={'win flat shop-row ' + (s.done ? 'done' : '')}>
      <button type="button" className="shop-main" onClick={() => toggle(s)} aria-pressed={s.done} aria-label={`${s.name}${s.done ? ', preso' : ''}`}>
        <span className={'check ' + (s.done ? 'on' : '')} aria-hidden="true">{s.done ? '✓' : ''}</span>
        <Icon id={s.icon} size={30} />
        <span className="grow">
          <span className="nm">{s.name}</span>
          {(s.qty || (s.by && s.by !== me)) && (
            <span className="q">
              {shopLabel(s)}
              {s.qty && s.by && s.by !== me ? ' · ' : ''}
              {s.by && s.by !== me ? `da ${s.by}` : ''}
            </span>
          )}
          {deal && (
            <span className="deal">
              In offerta da {deal.store}: {deal.price.toFixed(2).replace('.', ',')} €{deal.brand ? ` (${deal.brand})` : ''}
            </span>
          )}
        </span>
      </button>
      <button type="button" className="shop-x" onClick={() => remove(s)} aria-label={`Togli ${s.name}`}>✕</button>
    </div>
    );
  };

  return (
    <div className="shop-wrap">
      <div className="seg" role="tablist" aria-label="Spesa" style={{ marginBottom: 14 }}>
        <button type="button" role="tab" aria-selected={tab === 'lista'} className={tab === 'lista' ? 'on' : ''} onClick={() => pickTab('lista')}>
          <Icon id="1f4dd" size={20} /> Lista {todo.length ? `(${todo.length})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'volantini'} className={tab === 'volantini' ? 'on' : ''} onClick={() => pickTab('volantini')}>
          <Icon id="1f525" size={20} /> Volantini {nOffers ? `(${nOffers})` : ''}
        </button>
      </div>
      {tab === 'volantini' ? (
        <Flyers shopList={list} />
      ) : (
      <>
      <Talk text={say} mood={mood} />

      <form className="row" onSubmit={submit}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="es. 2 latte, pane, 500 g macinato" aria-label="Cosa ti serve" enterKeyHint="done" />
        <Btn type="submit" color="green" icon="2795" sound={null} disabled={!text.trim()}>Aggiungi</Btn>
      </form>

      {groups.map((g) => (
        <section key={g.id}>
          <SectionTitle icon={g.icon}>{g.name}</SectionTitle>
          <div className="shop-list">
            {g.items.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </div>
        </section>
      ))}

      {done.length > 0 && (
        <section>
          <SectionTitle icon="1f6d2">Nel carrello ({done.length})</SectionTitle>
          <div className="shop-list">
            {done.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn color="green" block icon="1f9fa" sound={null} onClick={toPantry}>Metti in dispensa ({done.length})</Btn>
            <Btn block sm onClick={clearDone}>Togli gli spuntati senza metterli in dispensa</Btn>
          </div>
        </section>
      )}

      {todo.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Btn block icon="1f517" onClick={share}>Condividi la lista</Btn>
        </div>
      )}

      {finished.length > 0 && (
        <section>
          <SectionTitle icon="1f504">Finiti di recente</SectionTitle>
          <div className="chips">
            {finished.map((f) => (
              <button key={f.key} type="button" className="chip big sugg" onClick={() => add([shopItemFrom(f, me)])}>
                <Icon id={f.icon} size={20} className="inline" /> {f.name} +
              </button>
            ))}
          </div>
        </section>
      )}
      {low.length > 0 && (
        <section>
          <SectionTitle icon="231b">Stanno finendo</SectionTitle>
          <div className="chips">
            {low.map((i) => (
              <button key={i.id} type="button" className="chip big sugg" onClick={() => add([shopItemFrom(i, me)])}>
                <Icon id={i.icon} size={20} className="inline" /> {i.name} <span className="muted">({qtyLabel(i)})</span> +
              </button>
            ))}
          </div>
        </section>
      )}
      </>
      )}
    </div>
  );
}
