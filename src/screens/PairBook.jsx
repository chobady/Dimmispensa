import { useMemo, useRef, useState } from 'react';
import { matchFood, norm } from '../catalog.js';
import { getBook, importBook, removeBook, removeSource, searchBook } from '../lib/pairbook.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, useApp } from '../components/ui.jsx';

// cosa hai in dispensa, per segnare ✓ negli abbinamenti del libro
export function useHaveFn(items) {
  return useMemo(() => {
    const foods = new Set(items.filter((i) => i.food && i.food !== 'altro').map((i) => i.food));
    const names = items.map((i) => norm(i.name));
    return (label) => {
      const clean = norm(label).replace(/\([^)]*\)/g, '').trim();
      if (names.some((n) => n === clean || (clean.length > 3 && n.includes(clean)))) return true;
      const f = matchFood(clean);
      if (!f || !foods.has(f.key)) return false;
      // tipo preciso (es. "timo"): serve anche il nome
      return names.some((n) => clean.split(' ').some((w) => w.length > 3 && n.includes(w)));
    };
  }, [items]);
}

const short = (n) => String(n || '').split(/[:(–-]/)[0].trim();

export function BookTable({ t, has, open = true, sources }) {
  const srcNames = sources ? (t.src || []).map((i) => short(sources[i]?.name)).filter(Boolean) : [];
  const multi = sources && sources.length > 1;
  return (
    <div className="pb-table">
      <div className="pb-head">
        <b>{t.it}</b>
        {t.it !== t.en && <span className="small muted"> · {t.en}</span>}
        {t.p != null && <span className="small muted"> · pag. {t.p}</span>}
        {srcNames.length > 0 && multi && <div className="small muted">{srcNames.join(' + ')}</div>}
      </div>
      {open && (
        <div className="pair-chips">
          {t.a.map((a, i) => {
            const f = matchFood(a.it);
            const ok = has(a.it);
            return (
              <span key={i} className={'pair ' + (ok ? 'have' : '') + (multi && a.src?.length > 1 ? ' multi' : '')} title={[a.en, sources && a.src ? a.src.map((j) => short(sources[j]?.name)).join(', ') : ''].filter(Boolean).join(' · ')}>
                {f && <Icon id={f.icon} size={18} className="inline" />} {a.it}
                {multi && a.src?.length > 1 && <span aria-label="in più libri"> ★</span>}
                {ok && <span className="ok" aria-label="ce l'hai"> ✓</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Pasti → Abbinamenti: consultare il libro importato
export default function PairBook() {
  const { state, toast } = useApp();
  const fileRef = useRef(null);
  const [book, setBook] = useState(getBook);
  const [q, setQ] = useState('');
  const [openI, setOpenI] = useState(null);
  const [sure, setSure] = useState(false);
  const has = useHaveFn(state.items);
  const results = useMemo(() => (book ? searchBook(q, 60) : []), [book, q]);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const { book: b, added } = await importBook(f);
      setBook(b);
      play('add');
      toast(`Aggiunto: ${added.map((x) => short(x.name)).join(', ')}. Ora ${b.tables.length} ingredienti (doppioni uniti), su questo dispositivo.`);
    } catch (err) {
      play('error');
      toast(err.message, { err: true });
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} aria-hidden="true" />
      {!book ? (
        <div className="win stack">
          <b>Il tuo libro degli abbinamenti</b>
          <p className="small">Importa il file JSON con gli abbinamenti (ingrediente → cosa ci sta bene). Lo consulti qui e compare anche nella scheda di ogni cibo, con ✓ su quello che hai in casa.</p>
          <p className="small muted">Il file resta solo su questo dispositivo: non va su Firebase e non viene condiviso con la dispensa. Sugli altri telefoni va importato di nuovo.</p>
          <Btn color="yellow" block icon="1f4e6" onClick={() => fileRef.current?.click()}>Importa il file</Btn>
        </div>
      ) : (
        <>
          <input className="input" type="search" placeholder="Cerca un ingrediente: mela, cannella, apple..." value={q} onChange={(e) => (setQ(e.target.value), setOpenI(null))} aria-label="Cerca un ingrediente nel libro" />
          <p className="small muted" style={{ margin: '6px 0 10px' }}>
            {book.tables.length} ingredienti da {book.sources.length === 1 ? short(book.sources[0].name) : `${book.sources.length} libri`}
            {book.sources.length > 1 ? ' · ★ = consigliato da più libri' : ''}
          </p>
          <div className="stack">
            {results.map((t, i) => (
              <button key={i} type="button" className="win flat pb-row" onClick={() => setOpenI(openI === i ? null : i)} aria-expanded={openI === i || results.length === 1}>
                <BookTable t={t} has={has} sources={book.sources} open={openI === i || results.length === 1 || norm(q) === norm(t.it)} />
              </button>
            ))}
            {!results.length && <p className="muted center">Nessun ingrediente trovato.</p>}
          </div>
          <div style={{ marginTop: 16 }}>
            {sure ? (
              <div className="two">
                <Btn sm onClick={() => setSure(false)}>No</Btn>
                <Btn sm color="red" onClick={() => (removeBook(), setBook(null), setSure(false), toast('File tolto da questo dispositivo.'))}>Sì, togli</Btn>
              </div>
            ) : (
              <div className="stack">
                <Btn sm block icon="1f4e6" onClick={() => fileRef.current?.click()}>Aggiungi un altro file</Btn>
                {book.sources.map((s) => (
                  <div key={s.name} className="row pb-src">
                    <span className="grow small">{s.name} ({s.tables.length})</span>
                    <button type="button" className="shop-x" onClick={() => setBook(removeSource(s.name))} aria-label={`Togli ${s.name}`}>✕</button>
                  </div>
                ))}
                <Btn sm block onClick={() => setSure(true)}>Togli tutti i file</Btn>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
