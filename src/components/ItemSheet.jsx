import { useState } from 'react';
import { ICONS } from '../icons-data.js';
import { CATALOG, CATEGORIES, LOCATIONS, MACROS, UNITS, isCasa, macroOf, norm } from '../catalog.js';
import { addDays, expiryLabel } from '../lib/dates.js';
import { packKey, stepOf } from '../lib/items.js';
import { Btn, Icon, Sheet, useApp } from './ui.jsx';
import MacroPanel from './MacroPie.jsx';
import Pairings from './Pairings.jsx';
import { CIQUAL } from '../ciqual-data.js';
import { sumMacros } from '../lib/macros.js';
import { fillNutrition } from '../lib/nutrition.js';
import { actions } from '../lib/store.js';

// Icone "da cibo": prima quelle usate dal catalogo, poi tutte le altre del pack
const UI_ONLY = new Set(['1f4c5', '1f4f7', '1f3a4', '2699', '1f5d1', '2b50', '1f3b2', '1f50d', '270f', '2705', '274c', '2795', '26a0', '1f480', '1f525', '1f3e0', '23f0', '2764', '1f4a4', '1f511', '1f465', '1f50a', '1f507', '2728', '1f916', '1f6aa', '1f517', '1f4dd', '1f514', '1f4a1', '231b', '1f44d', '1f389', '1f47b', '2328', '1f319', '2600', '1f4f1', '1f4be', '1f504', '1f3ae', '1f579', '1f451', '1f4aa', '1f60b', '1f634', '1f6d2', '1f9fe', '1f37d', '1f374', '1f331', '1f332', '1f333', '1f334', '1f335', '1f337', '1f338', '1f339', '1f33a', '1f33b', '1f33c', '1f33e', '1f340', '1f341', '1f342', '1f343']);
const catalogIcons = [...new Set(CATALOG.map((f) => f.icon))];
const ALL_ICONS = [...catalogIcons, ...Object.keys(ICONS).filter((k) => !catalogIcons.includes(k) && !UI_ONLY.has(k))];

// Parole per cercare un'icona: nomi e parole chiave dei cibi del catalogo che la usano, più qualche nome per le altre
const EXTRA_NAMES = {
  '2615': 'caffè tè bevanda calda tazza', '2744': 'ghiaccio freddo surgelato neve', '2764': 'cuore', '1f32e': 'taco messicano', '1f32f': 'burrito piadina wrap',
  '1f344': 'fungo funghi', '1f358': 'cracker di riso gallette', '1f35a': 'riso ciotola bianco', '1f35b': 'curry riso', '1f366': 'gelato cono soft',
  '1f36d': 'lecca lecca caramella', '1f373': 'padella uovo fritto', '1f376': 'sakè sake vino di riso', '1f378': 'cocktail martini', '1f379': 'drink tropicale cocktail',
  '1f37b': 'birre boccali', '1f37c': 'biberon latte neonato', '1f958': 'padella paella teglia', '1f95b': 'bicchiere di latte', '1f960': 'biscotto della fortuna',
  '1f962': 'bacchette ciotola', '1f964': 'bibita cannuccia bicchiere', '1f968': 'pretzel brezel', '1f96f': 'bagel', '1f9c7': 'waffle cialda', '1f9c9': 'mate tisana',
  '1f9ca': 'ghiaccio cubetti', '1f9cb': 'bubble tea', '1fad4': 'tamale', '1fad5': 'fonduta pentola', '1fad6': 'teiera tè tisana', '1fad7': 'versare liquido',
  '1f404': 'mucca manzo', '1f986': 'anatra papera', '1f420': 'pesce tropicale', '1f382': 'torta di compleanno', '1f9fa': 'cesto cestino', '1f4e6': 'pacco scatola confezione',
  '1f4a7': 'goccia acqua', '2600': 'sole', '2728': 'brillantini', vaschetta: 'vaschetta contenitore', caffe: 'caffè', rotolo: 'rotolo carta',
};
const ICON_WORDS = (() => {
  const m = {};
  const add = (k, t) => (m[k] = (m[k] ? m[k] + ' ' : '') + norm(t));
  for (const f of CATALOG) add(f.icon, [f.name, f.key, f.cat, ...(f.kws || [])].join(' '));
  for (const [k, t] of Object.entries(EXTRA_NAMES)) add(k, t);
  for (const k of ALL_ICONS) if (/^[a-z]/.test(k)) add(k, k);
  return m;
})();
const iconMatch = (k, words) => words.every((w) => (' ' + (ICON_WORDS[k] || '')).includes(' ' + w) || (ICON_WORDS[k] || '').includes(w));

const QUICK_DATES = [
  ['+3 g', 3],
  ['+1 sett', 7],
  ['+2 sett', 14],
  ['+1 mese', 30],
  ['+3 mesi', 90],
];

export default function ItemSheet({ item, isNew, onSave, onDelete, onEaten, onShop, onFreeze, onClose }) {
  const [d, setD] = useState({ ...item, macro: macroOf(item) });
  const casa = isCasa(d);
  const [picking, setPicking] = useState(false);
  const [iq, setIq] = useState('');
  const { state, toast } = useApp();
  // altre confezioni uguali in dispensa
  const twins = isNew ? [] : state.items.filter((t) => t.id !== item.id && packKey(t) === packKey(item));
  const [finding, setFinding] = useState(false);
  const findValues = async () => {
    setFinding(true);
    try {
      const base = { ...item, ...d };
      // se ora c'è una stima di Gemini, la metto da parte: prima cerco etichetta e tabella
      const hadGuess = base.nutr && base.nutrSrc !== 'etichetta' && base.nutrSrc !== 'tabella';
      const probe = hadGuess ? { ...base, nutr: undefined, nutrSrc: undefined } : base;
      let { list } = await fillNutrition([probe], hadGuess ? '' : state.pantry?.geminiKey, { usdaKey: state.pantry?.usdaKey });
      if (hadGuess && !list[0].nutr) {
        toast('Nessuna etichetta né tabella per questo cibo: restano i valori stimati.');
        list = [base];
      }
      const x = list[0];
      if (x.nutr) {
        setD((v) => ({ ...v, nutr: x.nutr, nutrSrc: x.nutrSrc, macro: x.macro ?? v.macro }));
        if (!isNew) actions.updateItem(item.id, { nutr: x.nutr, nutrSrc: x.nutrSrc, macro: x.macro ?? null });
      } else toast(state.pantry?.geminiKey ? 'Non ho trovato valori per questo cibo.' : 'Etichetta non trovata. Con la chiave Gemini posso stimare i valori.', { err: true });
    } catch (e) {
      toast(e.message || 'Ricerca non riuscita.', { err: true });
    } finally {
      setFinding(false);
    }
  };
  const up = (patch) => setD((v) => ({ ...v, ...patch }));
  const step = stepOf(d.unit);

  const save = () => {
    const qty = Number(String(d.qty).replace(',', '.'));
    onSave({
      name: (d.name || '').trim() || 'Senza nome',
      brand: (d.brand || '').trim(),
      qty: qty > 0 ? Math.round(qty * 100) / 100 : 1,
      unit: d.unit,
      icon: d.icon,
      cat: d.cat,
      loc: d.loc,
      expiry: d.expiry || null,
      est: d.expiry ? !!d.est : false,
      macro: d.macro || null,
    });
  };

  if (picking) {
    const words = norm(iq).split(' ').filter(Boolean);
    // senza ricerca: prima le icone che corrispondono al nome del cibo
    const sugg = !words.length ? ALL_ICONS.filter((k) => norm(d.name || '').split(' ').filter((w) => w.length > 2).some((w) => (ICON_WORDS[k] || '').includes(w))).slice(0, 12) : [];
    const list = words.length ? ALL_ICONS.filter((k) => iconMatch(k, words)) : [...sugg, ...ALL_ICONS.filter((k) => !sugg.includes(k))];
    const close = () => {
      setPicking(false);
      setIq('');
    };
    return (
      <Sheet title="Scegli l'icona" onClose={close}>
        <input className="input icon-search" type="search" autoFocus placeholder="Cerca: mela, pesce, detersivo..." aria-label="Cerca un'icona" value={iq} onChange={(e) => setIq(e.target.value)} />
        {!words.length && sugg.length > 0 && <p className="small muted">Suggerite per “{d.name}”, poi tutte le altre.</p>}
        {words.length > 0 && !list.length && <p className="small muted center">Nessuna icona per “{iq}”. Prova con un'altra parola (anche in inglese).</p>}
        <div className="icon-grid">
          {list.map((k) => (
            <button
              key={k}
              type="button"
              className={k === d.icon ? 'on' : ''}
              aria-label={'Icona ' + ((ICON_WORDS[k] || k).split(' ')[0])}
              onClick={() => {
                up({ icon: k });
                close();
              }}
            >
              <Icon id={k} size={40} />
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={isNew ? 'Controlla e salva' : 'Modifica cibo'} onClose={onClose}>
      <div className="stack">
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => setPicking(true)} aria-label="Cambia icona">
            <Icon id={d.icon} size={50} />
            <span className="edit"><Icon id="270f" size={14} /></span>
          </button>
          <label className="field grow">
            <span>Nome</span>
            <input className="input" value={d.name} onChange={(e) => up({ name: e.target.value })} maxLength={60} />
          </label>
        </div>

        {!isNew && onFreeze && (
          <div className="freeze-box">
            <p className="small">Sta per scadere: se lo congeli dura altri 2 mesi.</p>
            <Btn color="blue" block icon="2744" sound={null} onClick={onFreeze}>Congela</Btn>
          </div>
        )}
        {!isNew && twins.length > 0 && (
          <p className="small twins">
            {twins.length === 1 ? "Hai un'altra confezione uguale" : `Hai altre ${twins.length} confezioni uguali`} ({twins.map((t) => expiryLabel(t.expiry, t.est)).join(', ')}). Finito e Buttato valgono solo per questa.
          </p>
        )}
        {!isNew && (
          <div className="two">
            <Btn color="yellow" icon="1f60b" sound="eat" onClick={onEaten}>Finito!</Btn>
            <Btn color="red" icon="1f5d1" sound="eat" onClick={onDelete}>Buttato</Btn>
          </div>
        )}
        {!isNew && onShop && <Btn block sm icon="1f6d2" sound={null} onClick={onShop}>Aggiungi alla lista della spesa</Btn>}
        {!isNew && !casa && <Pairings item={d} />}
        <label className="field">
          <span>Marca (facoltativa)</span>
          <input className="input" value={d.brand || ''} onChange={(e) => up({ brand: e.target.value })} maxLength={40} placeholder="es. Barilla" />
        </label>

        <div className="field">
          <span>Quantità</span>
          <div className="row">
            <div className="stepper">
              <Btn sm aria-label="Meno" onClick={() => up({ qty: Math.max(step, Math.round((Number(d.qty) - step) * 100) / 100) })}>−</Btn>
              <input
                className="val"
                inputMode="decimal"
                aria-label="Quantità"
                value={d.qty}
                onChange={(e) => up({ qty: e.target.value.replace(/[^0-9.,]/g, '') })}
              />
              <Btn sm aria-label="Più" onClick={() => up({ qty: Math.round(((Number(d.qty) || 0) + step) * 100) / 100 })}>+</Btn>
            </div>
            <select className="input" style={{ width: 96 }} aria-label="Unità" value={d.unit} onChange={(e) => up({ unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <span>Dove lo tieni</span>
          <div className="seg locs">
            {LOCATIONS.map((l) => (
              <button key={l.id} type="button" className={d.loc === l.id ? 'on' : ''} aria-pressed={d.loc === l.id} onClick={() => up({ loc: l.id })}>
                <Icon id={l.icon} size={20} /> {l.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>
            Scadenza{d.expiry ? `: ${expiryLabel(d.expiry)}${d.est ? ' (stimata da me)' : ''}` : ''}
          </span>
          <input className="input" type="date" value={d.expiry || ''} onChange={(e) => up({ expiry: e.target.value || null, est: false })} />
          <div className="chips">
            {QUICK_DATES.map(([label, n]) => (
              <button key={label} type="button" className="chip" onClick={() => up({ expiry: addDays(n), est: false })}>{label}</button>
            ))}
            <button type="button" className={'chip ' + (!d.expiry ? 'on' : '')} onClick={() => up({ expiry: null, est: false })}>non scade</button>
          </div>
        </div>

        {!casa && (
        <div className="field">
          <span>Macronutriente principale</span>
          <div className="seg macro-seg">
            {MACROS.map((m) => (
              <button key={m.id} type="button" className={d.macro === m.id ? 'on' : ''} aria-pressed={d.macro === m.id} onClick={() => up({ macro: d.macro === m.id ? null : m.id })}>
                <span className={'macro m-' + m.id}>{m.short}</span> {m.name}
              </button>
            ))}
          </div>
          {d.nutr ? (
            <div className="win flat" style={{ marginTop: 8 }}>
              {(d.nutrSrc === 'gemini' || d.nutrSrc === 'misto' || !d.nutrSrc) && (
                <div className={'src-warn ' + (d.nutrSrc ? '' : 'unknown')} role="note">
                  <Icon id="26a0" size={24} />
                  <div className="grow">
                    <b>{d.nutrSrc === 'gemini' ? 'Valori stimati da Gemini' : d.nutrSrc === 'misto' ? 'Valori in parte stimati da Gemini' : 'Fonte dei valori sconosciuta'}</b>
                    <p className="small">
                      {d.nutrSrc === 'gemini'
                        ? 'Non vengono da un’etichetta né da una tabella ufficiale: sono valori tipici, possono essere diversi dalla tua confezione.'
                        : d.nutrSrc === 'misto'
                        ? 'L’etichetta aveva solo alcuni valori: quelli mancanti li ha stimati Gemini.'
                        : 'Questo cibo è stato aggiunto prima che l’app registrasse la fonte: potrebbe essere una stima di Gemini.'}
                    </p>
                    <Btn sm icon="1f50d" disabled={finding} onClick={findValues}>{finding ? 'Cerco...' : 'Cerca etichetta o tabella'}</Btn>
                  </div>
                </div>
              )}
              <MacroPanel totals={sumMacros([{ name: d.name, nutr: d.nutr, grams: 100 }])} perLabel={`per 100 ${d.unit === 'ml' || d.unit === 'l' ? 'ml' : 'g'}`} />
              <p className="small muted" style={{ marginTop: 6 }}>
                {d.nutrSrc === 'tabella' ? `Valori medi dalla tabella ufficiale Ciqual (ANSES): ${CIQUAL[d.food]?.n || 'alimento generico'}.` : d.nutrSrc === 'etichetta' ? 'Dati dell’etichetta (Open Food Facts o USDA).' : ''}
              </p>
            </div>
          ) : (
            <div className="row" style={{ marginTop: 4 }}>
              <p className="small muted grow">Mancano i valori nutrizionali, quindi niente grafico.</p>
              <Btn sm icon="1f50d" disabled={finding} onClick={findValues}>{finding ? 'Cerco...' : 'Trova i valori'}</Btn>
            </div>
          )}
        </div>
        )}

        <label className="field">
          <span>Categoria</span>
          <select className="input" value={d.cat} onChange={(e) => up({ cat: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <Btn color="green" block icon="2705" sound="add" onClick={save}>
          {isNew ? 'Va bene così' : 'Salva modifiche'}
        </Btn>
        {isNew && onDelete && (
          <Btn color="red" block icon="1f5d1" onClick={onDelete}>Togli dalla lista</Btn>
        )}
        {!isNew && d.by && <p className="small muted center">Aggiunto da {d.by}</p>}
      </div>
    </Sheet>
  );
}
