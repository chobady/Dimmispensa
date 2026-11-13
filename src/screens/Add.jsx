import { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, CATEGORIES, LOCATIONS, PRESETS, norm } from '../catalog.js';
import { actions } from '../lib/store.js';
import { defaultQty, draftFromFood, makeDraft, qtyLabel } from '../lib/items.js';
import { expiryLabel } from '../lib/dates.js';
import QtyPicker, { unitFamily } from '../components/QtyPicker.jsx';
import { parseLocal } from '../lib/parse.js';
import { fileToJpegBase64, itemsFromReceipt, itemsFromText } from '../lib/gemini.js';
import { lookupBarcode } from '../lib/off.js';
import { play } from '../lib/sound.js';
import ItemSheet from '../components/ItemSheet.jsx';
import { Btn, Icon, ItemCard, Loading, SectionTitle, Sheet, Talk, useApp } from '../components/ui.jsx';

const MODES = [
  { id: 'rapido', name: 'Tocca', icon: '1f44d' },
  { id: 'scrivi', name: 'Scrivi', icon: '1f4dd' },
  { id: 'scontrino', name: 'Scontrino', icon: '1f9fe' },
  { id: 'barcode', name: 'Barcode', icon: '1f4f7' },
];

export default function Add() {
  const { state, toast, go } = useApp();
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('dm_addmode') || 'rapido';
    } catch {
      return 'rapido';
    }
  });
  const [drafts, setDrafts] = useState([]);
  const [editing, setEditing] = useState(null);
  const geminiKey = state.pantry?.geminiKey || '';

  const pick = (m) => {
    setMode(m);
    try {
      localStorage.setItem('dm_addmode', m);
    } catch {}
  };
  const addDrafts = (list) => setDrafts((d) => [...d, ...list]);

  const saveAll = () => {
    actions.addItems(drafts);
    play('add');
    toast(drafts.length === 1 ? `${drafts[0].name}: messo via!` : `${drafts.length} cibi messi via!`);
    setDrafts([]);
    go('dispensa');
  };

  return (
    <>
      <div className="modes" role="tablist" aria-label="Come vuoi aggiungere">
        {MODES.map((m) => (
          <Btn key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} icon={m.icon} iconSize={30} onClick={() => pick(m.id)}>
            {m.name}
          </Btn>
        ))}
      </div>

      {drafts.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionTitle icon="1f6d2">Da mettere via ({drafts.length})</SectionTitle>
          <p className="small muted" style={{ marginBottom: 10 }}>Tocca un cibo per correggerlo. Dove leggi "circa" o "verso il", la scadenza l'ho stimata io.</p>
          <div className="list">
            {drafts.map((d) => (
              <ItemCard key={d.id} item={d} onOpen={setEditing} />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn color="green" block icon="2705" sound={null} onClick={saveAll}>
              Metti via {drafts.length === 1 ? 'questo cibo' : `tutti e ${drafts.length}`}
            </Btn>
            <Btn block sm onClick={() => setDrafts([])}>Svuota la lista</Btn>
          </div>
        </section>
      )}

      {mode === 'rapido' && <Quick />}
      {mode === 'scrivi' && <Write geminiKey={geminiKey} onDrafts={addDrafts} />}
      {mode === 'scontrino' && <Receipt geminiKey={geminiKey} onDrafts={addDrafts} />}
      {mode === 'barcode' && <Barcode onDrafts={addDrafts} />}

      {editing && (
        <ItemSheet
          item={editing}
          isNew
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            setDrafts((list) => list.map((d) => (d.id === editing.id ? { ...d, ...patch } : d)));
            setEditing(null);
          }}
          onDelete={() => {
            setDrafts((list) => list.filter((d) => d.id !== editing.id));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ un tocco = un cibo
function Quick() {
  const { toast, openItemById } = useApp();
  const [cat, setCat] = useState('tutti');
  const [q, setQ] = useState('');
  const [counts, setCounts] = useState({});
  const [jump, setJump] = useState(null);
  const [ask, setAsk] = useState(null); // bozza in attesa di quantità

  const foods = useMemo(() => {
    const nq = norm(q);
    return CATALOG.filter((f) => (nq ? f.kws.some((k) => k.includes(nq)) : cat === 'tutti' || f.cat === cat));
  }, [cat, q]);

  const open = (food, nameOverride) => {
    play('open');
    setAsk({ food, draft: nameOverride ? makeDraft({ name: nameOverride }) : draftFromFood(food) });
  };
  const add = (food, draft) => {
    setAsk(null);
    actions.addItems([draft]);
    play('add');
    setCounts((c) => ({ ...c, [food?.key || '_']: (c[food?.key || '_'] || 0) + 1 }));
    setJump({ key: food?.key, t: Date.now() });
    toast(`${draft.name} (${qtyLabel(draft)}): aggiunto in ${draft.loc}`, { key: 'quick', action: { label: 'Modifica', fn: () => openItemById(draft.id) } });
  };

  return (
    <>
      <input className="input" type="search" placeholder="Cerca: latte, pollo, biscotti..." aria-label="Cerca nel catalogo" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && (
        <div className="hscroll" style={{ marginTop: 6 }}>
          <button type="button" className={'chip ' + (cat === 'tutti' ? 'on' : '')} onClick={() => setCat('tutti')}>Tutti</button>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={'chip ' + (cat === c.id ? 'on' : '')} onClick={() => setCat(c.id)}>{c.name}</button>
          ))}
        </div>
      )}
      <p className="small muted" style={{ margin: '6px 0 10px' }}>Tocca un cibo, scegli quanto e il gioco è fatto. Posto e scadenza li stimo io.</p>
      <div className="grid">
        {foods.map((f) => (
          <button key={f.key} type="button" className={'tile ' + (jump?.key === f.key ? 'jump' : '')} onClick={() => open(f)} onAnimationEnd={() => setJump(null)}>
            <Icon id={f.icon} size={40} />
            <span>{f.name}</span>
            {counts[f.key] > 0 && <b className="count">{counts[f.key]}</b>}
            {jump?.key === f.key && <b className="plus" key={jump.t}>+1</b>}
          </button>
        ))}
      </div>
      {ask && <QtySheet ask={ask} onClose={() => setAsk(null)} onAdd={(d) => add(ask.food, d)} />}
      {q && (
        <div style={{ marginTop: 14 }}>
          <Btn block icon="2795" sound={null} onClick={() => open(null, q.trim())}>Aggiungi "{q.trim()}" così com'è</Btn>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ scrivi o detta
function Write({ geminiKey, onDrafts }) {
  const { toast, go } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => recRef.current?.abort?.(), []);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'it-IT';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e) => {
        const said = Array.from(e.results).map((r) => r[0].transcript).join(' ');
        setText((t) => (t ? t.trim() + ', ' : '') + said);
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => {
        setListening(false);
        if (e.error === 'not-allowed') toast('Il microfono è bloccato: usa il microfono della tastiera.', { err: true });
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      toast('Qui il microfono non funziona: usa quello della tastiera.', { err: true });
    }
  };

  const read = async () => {
    if (!text.trim()) return;
    setBusy(true);
    let list = [];
    try {
      if (geminiKey) {
        try {
          list = await itemsFromText(geminiKey, text);
        } catch (e) {
          toast(e.message + ' Per ora leggo io la lista.', { err: true });
          list = parseLocal(text);
        }
      } else {
        list = parseLocal(text);
      }
    } finally {
      setBusy(false);
    }
    if (!list.length) {
      play('error');
      toast('Non ho trovato cibi in quello che hai scritto.', { err: true });
      return;
    }
    play('open');
    onDrafts(list);
    setText('');
  };

  if (busy) return <Loading text="Leggo la lista..." />;
  return (
    <div className="stack">
      <label className="field">
        <span>Scrivi o detta cosa hai comprato, separando con virgole</span>
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'2 latte, pasta Barilla 500 g, yogurt scade il 20, petto di pollo, 6 uova, gelato in freezer'}
        />
      </label>
      <div className="row">
        {SR && (
          <Btn color={listening ? 'red' : 'blue'} icon="1f3a4" onClick={toggleMic} aria-pressed={listening}>
            {listening ? 'Ti ascolto...' : 'Detta'}
          </Btn>
        )}
        <Btn color="green" className="grow" icon="2728" sound={null} disabled={!text.trim()} onClick={read}>Leggi la lista</Btn>
      </div>
      {!geminiKey && (
        <div className="win flat small">
          Senza Gemini capisco liste semplici (quantità, "scade il 20", "in freezer"). Con la chiave gratuita di Gemini capisco anche marche e frasi dette a voce.{' '}
          <a href="#opzioni" onClick={(e) => (e.preventDefault(), go('opzioni'))}>Aggiungi la chiave</a>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ foto dello scontrino
function Receipt({ geminiKey, onDrafts }) {
  const { toast, go } = useApp();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const camRef = useRef(null);
  const galRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const img = await fileToJpegBase64(file);
      setPreview(img.preview);
      const list = await itemsFromReceipt(geminiKey, img.base64, img.mime);
      if (!list.length) {
        play('error');
        toast('Non ho trovato cibi in questa foto. Prova con una foto più nitida.', { err: true });
      } else {
        play('open');
        onDrafts(list);
      }
    } catch (err) {
      play('error');
      toast(err.message || 'Non sono riuscito a leggere lo scontrino.', { err: true });
    } finally {
      setBusy(false);
      setPreview(null);
    }
  };

  if (!geminiKey) {
    return (
      <>
        <Talk text="Per leggere gli scontrini mi serve Gemini, l'aiutante di Google. La chiave è gratis e si mette una volta sola." />
        <Btn color="yellow" block icon="1f511" onClick={() => go('opzioni')}>Vai alle Opzioni per aggiungerla</Btn>
      </>
    );
  }
  if (busy) {
    return (
      <>
        {preview && <img className="preview-img" src={preview} alt="Foto dello scontrino" />}
        <Loading text="Leggo lo scontrino... ci vuole qualche secondo." />
      </>
    );
  }
  return (
    <div className="stack">
      <p>Fotografa lo scontrino tutto intero, ben illuminato. Poi controlli la lista prima di salvarla.</p>
      <input ref={camRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={onFile} />
      <input ref={galRef} className="hidden" type="file" accept="image/*" onChange={onFile} />
      <Btn color="green" block icon="1f4f7" iconSize={30} onClick={() => camRef.current.click()}>Scatta la foto</Btn>
      <Btn block icon="1f4be" onClick={() => galRef.current.click()}>Scegli dalla galleria</Btn>
      <p className="small muted">Sullo scontrino non ci sono le scadenze: le stimo io in base al prodotto, tu correggi quelle che contano.</p>
    </div>
  );
}

// ------------------------------------------------------------------ codice a barre
function Barcode({ onDrafts }) {
  const { toast } = useApp();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const lastRef = useRef({ code: '', t: 0 });
  const busyRef = useRef(false);
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState('');
  const [manual, setManual] = useState('');

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setOn(false);
  };
  useEffect(() => stop, []);

  const handle = async (code) => {
    const now = Date.now();
    if (busyRef.current || (code === lastRef.current.code && now - lastRef.current.t < 4000)) return;
    lastRef.current = { code, t: now };
    busyRef.current = true;
    setStatus(`Cerco ${code}...`);
    try {
      const draft = await lookupBarcode(code);
      if (draft) {
        play('add');
        onDrafts([draft]);
        setStatus(`Trovato: ${draft.name}${draft.brand ? ' (' + draft.brand + ')' : ''}. Inquadra il prossimo!`);
      } else {
        play('error');
        setStatus('');
        toast(`Non conosco il codice ${code}. Aggiungilo con "Tocca" o "Scrivi".`, { err: true });
      }
    } catch (e) {
      play('error');
      setStatus('');
      toast(e.message || 'Ricerca non riuscita. Controlla la connessione.', { err: true });
    } finally {
      busyRef.current = false;
    }
  };

  const start = async () => {
    setStatus('Accendo la fotocamera...');
    setOn(true);
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
      if (!videoRef.current) await new Promise((r) => requestAnimationFrame(r));
      controlsRef.current = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result) => {
        if (result) handle(result.getText());
      });
      setStatus('Inquadra il codice a barre sulla riga rossa.');
    } catch (e) {
      setOn(false);
      setStatus('');
      toast(
        e?.name === 'NotAllowedError'
          ? 'Fotocamera bloccata: consenti l\'accesso nelle impostazioni del browser, oppure scrivi il codice qui sotto.'
          : 'Non riesco ad aprire la fotocamera. Scrivi il codice qui sotto.',
        { err: true }
      );
    }
  };

  return (
    <div className="stack">
      {on ? (
        <>
          <div className="scanner">
            <video ref={videoRef} muted playsInline />
            <div className="aim" />
          </div>
          <p className="center" role="status">{status}</p>
          <Btn block onClick={stop}>Spegni la fotocamera</Btn>
        </>
      ) : (
        <>
          <p>Inquadra il codice a barre: nome e marca arrivano da soli. La scadenza la stimo io, la correggi dopo se serve.</p>
          <Btn color="green" block icon="1f4f7" iconSize={30} onClick={start}>Accendi la fotocamera</Btn>
        </>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.replace(/\D/g, '');
          if (code.length >= 8) {
            handle(code);
            setManual('');
          }
        }}
      >
        <input className="input grow" inputMode="numeric" placeholder="Oppure scrivi il codice" aria-label="Codice a barre" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Btn type="submit" icon="1f50d" disabled={manual.replace(/\D/g, '').length < 8}>Cerca</Btn>
      </form>
      {!on && status && <p className="center" role="status">{status}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ quanto ne hai comprato?
function QtySheet({ ask, onClose, onAdd }) {
  const [d, setD] = useState(ask.draft);
  const qtyNum = Number(String(d.qty).replace(',', '.')) || 0;
  const change = ({ qty, unit, unitChanged }) => setD((v) => ({ ...v, unit, qty: unitChanged ? defaultQty(unit) : qty }));
  const setLoc = (loc) => {
    // cambiando posto ricalcolo la scadenza stimata (in freezer dura di più)
    const fresh = makeDraft({ name: d.name, foodKey: d.food, loc, qty: d.qty, unit: d.unit });
    setD((v) => ({ ...v, loc, expiry: v.est ? fresh.expiry : v.expiry }));
  };
  return (
    <Sheet title="Quanto ne hai?" onClose={onClose}>
      <form className="stack" onSubmit={(e) => (e.preventDefault(), qtyNum > 0 && onAdd({ ...d, qty: qtyNum }))}>
        <div className="qty-head">
          <Icon id={d.icon} size={50} />
          <div>
            <p className="nm">{d.name}</p>
            <p className="small muted">{d.expiry ? `${expiryLabel(d.expiry, d.est)}${d.est ? ' (stimata)' : ''}` : 'non scade'}</p>
          </div>
        </div>
        <QtyPicker qty={d.qty} unit={d.unit} units={unitFamily(d.unit)} presets={PRESETS[d.unit] || PRESETS.pz} onChange={change} />
        <div className="seg">
          {LOCATIONS.map((l) => (
            <button key={l.id} type="button" className={d.loc === l.id ? 'on' : ''} aria-pressed={d.loc === l.id} onClick={() => setLoc(l.id)}>
              <Icon id={l.icon} size={20} /> {l.name}
            </button>
          ))}
        </div>
        <Btn type="submit" color="green" block icon="2795" sound={null} disabled={!(qtyNum > 0)}>
          Aggiungi {qtyNum > 0 ? qtyLabel({ qty: qtyNum, unit: d.unit }) : ''}
        </Btn>
      </form>
    </Sheet>
  );
}
