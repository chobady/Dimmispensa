import { useEffect, useMemo, useRef, useState } from 'react';
import { isCasa, norm } from '../catalog.js';
import { actions, cloudEnabled } from '../lib/store.js';
import { addDays, expiryLabel, expiryStatus, fromISO } from '../lib/dates.js';
import { newId } from '../lib/items.js';
import { checkRecipe, cleanIngredient, melaLink, pantryIndex, readMelaFiles } from '../lib/mela.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, SectionTitle, Sheet, Talk, useApp } from '../components/ui.jsx';
import { SLOTS } from './Meals.jsx';

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

// ordinamenti della lista; le ricette con ingredienti non riconosciuti vanno sempre in fondo
const known = (x) => (x.c.need ? 0 : 1);
const byName = (a, b) => a.r.title.localeCompare(b.r.title, 'it');
const byHave = (a, b) => known(a) - known(b) || b.c.ratio - a.c.ratio || a.c.missing.length - b.c.missing.length;
const SORTS = {
  manca: { label: 'Prima quelle a cui manca meno', fn: (a, b) => byHave(a, b) || b.c.usesSoon.length - a.c.usesSoon.length || byName(a, b) },
  scadenza: { label: 'Prima quelle che usano cibi in scadenza', fn: (a, b) => b.c.usesSoon.length - a.c.usesSoon.length || byHave(a, b) || byName(a, b) },
  nome: { label: 'In ordine alfabetico', fn: byName },
};
const keyOf = (x) => (x.food && x.food !== 'altro' ? x.food : norm(x.name));

export default function Recipes() {
  const { state, toast, warnDays } = useApp();
  const me = state.user?.name || '';
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [photos, setPhotos] = useState(true);
  const [onlyNew, setOnlyNew] = useState(true);
  const [sort, setSort] = useState(() => {
    try {
      return SORTS[localStorage.getItem('dm_rsort')] ? localStorage.getItem('dm_rsort') : 'manca';
    } catch {
      return 'manca';
    }
  });
  const pickSort = (v) => {
    setSort(v);
    try {
      localStorage.setItem('dm_rsort', v);
    } catch {}
  };
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('tutte'); // tutte | ora | scadenza
  const [cat, setCat] = useState('');
  const [openId, setOpenId] = useState(null);
  const recipes = state.recipes || [];

  const soonIds = useMemo(() => new Set(state.items.filter((i) => ['today', 'soon'].includes(expiryStatus(i.expiry, warnDays))).map((i) => i.id)), [state.items, warnDays]);
  const checked = useMemo(() => {
    const idx = pantryIndex(state.items.filter((i) => !isCasa(i)), soonIds);
    return recipes.map((r) => ({ r, c: checkRecipe(r, idx), t: norm(`${r.title} ${(r.ingredients || []).join(' ')} ${(r.categories || []).join(' ')}`) }));
  }, [recipes, state.items, soonIds]);
  // libri/categorie di Mela, dal più grande
  const cats = useMemo(() => {
    const n = new Map();
    recipes.forEach((r) => (r.categories || []).forEach((c) => n.set(c, (n.get(c) || 0) + 1)));
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0], 'it'));
  }, [recipes]);
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [q, filter, cat, sort]);

  // ogni parola cercata deve esserci, in qualunque ordine ("porri patat" trova "crema di patate e porri")
  const qWords = norm(q).split(' ').filter(Boolean);
  const shown = checked
    .filter(({ t }) => qWords.every((w) => t.includes(w)))
    .filter(({ r }) => !cat || (r.categories || []).includes(cat))
    .filter(({ c }) => filter !== 'ora' || (c.need > 0 && c.missing.length === 0))
    .filter(({ c }) => filter !== 'scadenza' || c.usesSoon.length > 0)
    .filter(({ r }) => filter !== 'salvate' || r.saved)
    .sort(SORTS[sort].fn);
  const nNow = checked.filter(({ c }) => c.need > 0 && !c.missing.length).length;
  const nSoon = checked.filter(({ c }) => c.usesSoon.length).length;
  const nSaved = recipes.filter((r) => r.saved).length;

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy('Apro il file...');
    const known = new Set(recipes.map((r) => r.id));
    let added = 0;
    let saved = 0;
    // tengo lo schermo acceso: se il telefono si blocca, la lettura si ferma
    let lock = null;
    try {
      lock = await navigator.wakeLock?.request('screen');
    } catch {}
    try {
      const { total, skipped, seen } = await readMelaFiles(files, me, {
        photos,
        skip: onlyNew ? known : null,
        onStep: (n, sk) => setBusy(`Leggo le ricette... ${n}${sk ? ` (${sk} già presenti)` : ''}`),
        onBatch: async (list) => {
          added += list.filter((r) => !known.has(r.id)).length;
          await actions.recipesPut(list);
          saved += list.length;
        },
      });
      if (!seen) throw new Error('Non trovo ricette in questo file. Serve il file esportato da Mela (.melarecipe o .melarecipes).');
      play('add');
      toast(!total ? `Nessuna ricetta nuova: le ${skipped} del file ci sono già.` : skipped ? `${total} ricette nuove importate (${skipped} c'erano già).` : added === total ? `${total} ricette importate!` : `${added} ricette nuove, ${total - added} aggiornate.`);
    } catch (err) {
      play('error');
      const msg = err?.code === 'permission-denied' ? 'Firebase non mi fa salvare le ricette: aggiorna le regole (vedi sotto).' : err.message || 'Importazione non riuscita.';
      toast(saved ? `${msg} (${saved} ricette erano già state salvate.)` : msg, { err: true });
    } finally {
      setBusy('');
      lock?.release?.().catch?.(() => {});
    }
  };

  const open = checked.find(({ r }) => r.id === openId);
  const talk = !recipes.length
    ? 'Porta qui le tue ricette di Mela: ti dico quali puoi fare con quello che hai.'
    : nSoon
      ? `${nSoon === 1 ? '1 ricetta usa' : nSoon + ' ricette usano'} cibi che stanno per scadere.`
      : nNow
        ? `Puoi fare ${nNow === 1 ? '1 ricetta' : nNow + ' ricette'} con quello che hai in casa.`
        : 'Ti manca sempre qualcosa: guarda le ricette e aggiungi i mancanti alla spesa.';

  return (
    <>
      <Talk text={talk} mood={nSoon ? 'worry' : nNow ? 'happy' : 'idle'} />
      <input ref={fileRef} type="file" multiple hidden onChange={onFiles} aria-hidden="true" />

      {state.recipesError === 'rules' && (
        <div className="win src-warn stack" role="alert">
          <b>Firebase non mi fa leggere le ricette.</b>
          <p className="small">Serve aggiornare le regole una volta: apri la console di Firebase → Firestore Database → Regole, incolla quelle nuove del file firestore.rules (sono anche nella GUIDA, Parte B passo 5) e premi Pubblica.</p>
        </div>
      )}

      {!recipes.length ? (
        <div className="win stack">
          <b>Come portare le ricette da Mela</b>
          <ol className="small steps">
            <li>Apri Mela e seleziona le ricette (o tutte: in un libro, tocca Seleziona → Seleziona tutto).</li>
            <li>Tocca Condividi → <b>Esporta</b>, poi salva il file in File (o su iCloud Drive).</li>
            <li>Torna qui e tocca il bottone sotto: scegli il file <b>.melarecipes</b>.</li>
          </ol>
          <label className="opt-check small">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} /> Con le foto (solo una miniatura per ricetta)
          </label>
          <Btn color="yellow" block icon="1f4e6" onClick={() => fileRef.current?.click()} disabled={!!busy}>{busy || 'Importa da Mela'}</Btn>
          <p className="small muted">{cloudEnabled ? 'Le ricette restano condivise con chi usa la tua dispensa.' : 'Senza Firebase le ricette restano solo su questo dispositivo.'} Le foto grandi restano in Mela: qui salvo solo il testo e una miniatura (pochi KB a ricetta), quindi anche centinaia di ricette occupano pochissimo.</p>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <input className="input grow" type="search" placeholder="Cerca: pollo, torta, pasta..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca tra le ricette" />
            <Btn sm icon="1f4e6" onClick={() => fileRef.current?.click()} disabled={!!busy} aria-label="Importa altre ricette da Mela">Importa</Btn>
          </div>
          <label className="opt-check small" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Importa solo le ricette nuove (più veloce)
          </label>
          {busy && <p className="small center blink">{busy}</p>}
          <div className="chips" style={{ marginBottom: 8 }}>
            <button type="button" className={'chip ' + (filter === 'tutte' ? 'on' : '')} onClick={() => setFilter('tutte')}>Tutte ({recipes.length})</button>
            <button type="button" className={'chip ' + (filter === 'ora' ? 'on' : '')} onClick={() => setFilter('ora')}>Posso farle ora ({nNow})</button>
            <button type="button" className={'chip ' + (filter === 'scadenza' ? 'on' : '')} onClick={() => setFilter('scadenza')}>Usano cibi in scadenza ({nSoon})</button>
            <button type="button" className={'chip ' + (filter === 'salvate' ? 'on' : '')} onClick={() => setFilter('salvate')}>★ Salvate ({nSaved})</button>
          </div>
          {cats.length > 1 && (
            <label className="pick-wrap">
              <span className="sr-only">Libro o categoria</span>
              <select className={'input pick ' + (cat ? 'on' : '')} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Tutti i libri e le categorie ({cats.length})</option>
                {cats.map(([c, n]) => (
                  <option key={c} value={c}>
                    {c} ({n})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="pick-wrap">
            <span className="sr-only">Ordina le ricette</span>
            <select className="input pick" value={sort} onChange={(e) => pickSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          {shown.length > 0 && <p className="small muted" style={{ margin: '0 0 8px' }}>{shown.length === recipes.length ? `${shown.length} ricette` : `${shown.length} ricette su ${recipes.length}`}</p>}
          <div className="recipe-list">
            {shown.slice(0, limit).map(({ r, c }) => (
              <button key={r.id} type="button" className="win flat recipe-card" onClick={() => setOpenId(r.id)}>
                {r.img ? <img src={r.img} alt="" className="recipe-img" loading="lazy" decoding="async" /> : <span className="recipe-img ph"><Icon id="1f372" size={34} /></span>}
                <span className="grow">
                  <span className="nm">
                    {r.saved && <span className="saved-star" aria-label="Salvata">★ </span>}
                    {r.title}
                  </span>
                  <span className="have-bar" aria-hidden="true">
                    <span style={{ width: `${Math.round(c.ratio * 100)}%` }} />
                  </span>
                  <span className="q">
                    {c.need ? (c.missing.length ? `Hai ${c.have} di ${c.need} · mancano ${c.missing.length}` : `Hai tutto! (${c.need} ingredienti)`) : 'Ingredienti non riconosciuti'}
                  </span>
                  {c.usesSoon.length > 0 && (
                    <span className="soon-tag">Usa {[...new Set(c.usesSoon.map((it) => it.name))].slice(0, 2).join(', ')} in scadenza</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {shown.length > limit && (
            <Btn block style={{ marginTop: 12 }} onClick={() => setLimit(limit + 40)}>Mostra altre ({shown.length - limit})</Btn>
          )}
          {!shown.length && <p className="muted center" style={{ marginTop: 14 }}>{filter === 'salvate' && !nSaved ? 'Nessuna ricetta salvata: aprine una e tocca ☆ Salva per dopo.' : 'Nessuna ricetta corrisponde.'}</p>}
        </>
      )}

      {open && <RecipeSheet r={open.r} c={open.c} onClose={() => setOpenId(null)} />}
    </>
  );
}

function RecipeSheet({ r, c, onClose }) {
  const { state, toast } = useApp();
  const me = state.user?.name || '';
  const [plan, setPlan] = useState(false);
  const [day, setDay] = useState(addDays(0));
  const [sure, setSure] = useState(false);
  const mela = melaLink(r);
  const times = [r.prepTime && `prep. ${r.prepTime}`, r.cookTime && `cottura ${r.cookTime}`, !r.prepTime && !r.cookTime && r.totalTime && r.totalTime, r.yield].filter(Boolean);

  const listKeys = new Set(Object.values(state.shopping || {}).filter((s) => !s.done).map(keyOf));
  const buyKey = (m) => (m.food ? m.food.key : norm(cleanIngredient(m.line)));
  const toBuy = c.missing.filter((m) => !listKeys.has(buyKey(m)));
  const addMissing = () => {
    const now = Date.now();
    const seen = new Set();
    const pairs = [];
    toBuy.forEach((m, i) => {
      const k = buyKey(m);
      if (seen.has(k)) return;
      seen.add(k);
      const id = newId();
      const name = m.food ? m.food.name : cleanIngredient(m.line).replace(/^\w/, (ch) => ch.toUpperCase());
      pairs.push([id, { id, name, qty: null, unit: null, food: m.food ? m.food.key : 'altro', icon: m.food ? m.food.icon : '1f4e6', cat: m.food ? m.food.cat : 'dispensa', done: false, by: me, addedAt: now + i, note: r.title.slice(0, 60) }]);
    });
    actions.shopSetMany(pairs);
    play('add');
    toast(`${pairs.length === 1 ? '1 cosa aggiunta' : pairs.length + ' cose aggiunte'} alla lista della spesa.`);
  };

  const putInCalendar = (slot) => {
    const list = state.meals?.[day]?.[slot] || [];
    actions.setMealSlot(day, slot, [...list, { id: newId(), name: r.title.slice(0, 80), icon: '1f372', recipe: r.id, melaId: r.melaId || '' }]);
    play('add');
    const d = fromISO(day);
    toast(`${r.title}: messa a ${SLOTS.find((s) => s.id === slot).name.toLowerCase()} di ${GIORNI[d.getDay()]} ${d.getDate()}.`);
    setPlan(false);
  };

  const remove = async () => {
    try {
      await actions.recipeRemove(r.id);
      toast(`${r.title}: tolta (in Mela resta).`);
      onClose();
    } catch (e) {
      toast(e.message || 'Non riesco a toglierla.', { err: true });
    }
  };

  return (
    <Sheet title={r.title} onClose={onClose}>
      <div className="stack">
        {r.img && <img src={r.img} alt="" className="recipe-hero" />}
        {times.length > 0 && <p className="small muted">{times.join(' · ')}</p>}
        <Btn
          block
          color={r.saved ? 'yellow' : undefined}
          aria-pressed={!!r.saved}
          onClick={() => {
            actions.recipeUpdate(r.id, { saved: !r.saved, savedAt: r.saved ? null : Date.now() }).catch((e) => toast(e.message || 'Non riesco a salvarla.', { err: true }));
            play(r.saved ? 'tap' : 'add');
            toast(r.saved ? `${r.title}: tolta dalle salvate.` : `${r.title}: salvata per dopo. La trovi in ★ Salvate.`);
          }}
        >
          {r.saved ? '★ Salvata (tocca per togliere)' : '☆ Salva per dopo'}
        </Btn>
        <div className="two">
          {mela ? (
            <a className="btn sm" href={mela}>
              <Icon id="1f372" size={18} /> Apri in Mela
            </a>
          ) : r.link ? (
            <a className="btn sm" href={r.link} target="_blank" rel="noreferrer">↗ Fonte</a>
          ) : (
            <span />
          )}
          <Btn sm color="yellow" icon="1f4c5" onClick={() => setPlan(!plan)} aria-expanded={plan}>Nel calendario</Btn>
        </div>
        {plan && (
          <div className="win flat stack">
            <div className="chips">
              {Array.from({ length: 7 }, (_, i) => addDays(i)).map((d) => (
                <button key={d} type="button" className={'chip ' + (d === day ? 'on' : '')} onClick={() => setDay(d)}>
                  {d === addDays(0) ? 'Oggi' : d === addDays(1) ? 'Domani' : `${GIORNI[fromISO(d).getDay()]} ${fromISO(d).getDate()}`}
                </button>
              ))}
            </div>
            <div className="chips">
              {SLOTS.map((s) => (
                <button key={s.id} type="button" className="chip" onClick={() => putInCalendar(s.id)}>
                  <Icon id={s.icon} size={16} className="inline" /> {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <SectionTitle icon="1f6d2">Ingredienti</SectionTitle>
        <ul className="ingr-list">
          {c.rows.map((row, i) =>
            row.header ? (
              <li key={i} className="ingr-h">{row.line}</li>
            ) : (
              <li key={i} className={row.junk || row.skip ? 'unk' : row.have ? 'ok' : row.basic ? 'basic' : 'no'}>
                <span className="mark" aria-hidden="true">{row.junk || row.skip ? '' : row.have ? '✓' : row.basic ? '·' : '✗'}</span>
                {row.food && <Icon id={row.food.icon} size={18} className="inline" />}
                <span className="grow">
                  {row.line}
                  {row.have && row.items[0]?.expiry && ['today', 'soon', 'expired'].includes(expiryStatus(row.items[0].expiry)) && <span className="small soon-inline"> · {expiryLabel(row.items[0].expiry, row.items[0].est)}</span>}
                </span>
              </li>
            )
          )}
        </ul>
        <p className="small muted">✓ ce l'hai · ✗ manca · · di solito ce l'hai (sale, olio, pepe...)</p>
        {toBuy.length > 0 ? (
          <Btn block icon="1f6d2" onClick={addMissing}>Aggiungi i mancanti alla spesa ({toBuy.length})</Btn>
        ) : c.missing.length > 0 ? (
          <p className="small center">I mancanti sono già nella lista della spesa.</p>
        ) : null}

        {r.instructions && (
          <>
            <SectionTitle icon="1f373">Preparazione</SectionTitle>
            <div className="recipe-text">
              {r.instructions.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => (/^#/.test(l) ? <h4 key={i}>{l.replace(/^#+\s*/, '')}</h4> : <p key={i}>{l}</p>))}
            </div>
          </>
        )}
        {r.notes && (
          <>
            <SectionTitle icon="1f4dd">Note</SectionTitle>
            <div className="recipe-text">
              {r.notes.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => <p key={i}>{l}</p>)}
            </div>
          </>
        )}
        {sure ? (
          <div className="two">
            <Btn sm onClick={() => setSure(false)}>No</Btn>
            <Btn sm color="red" onClick={remove}>Sì, togli</Btn>
          </div>
        ) : (
          <Btn sm block onClick={() => setSure(true)}>Togli da Dimmispensa</Btn>
        )}
      </div>
    </Sheet>
  );
}
