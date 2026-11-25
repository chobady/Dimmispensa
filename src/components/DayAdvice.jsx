// Accanto alla dispensa: cosa mangiare oggi (Gemini, molte proteine e verdure, pochi zuccheri e grassi)
// e cosa manca in casa (controllo fisso delle cose essenziali, senza Gemini).
import { useEffect, useMemo, useRef, useState } from 'react';
import { BY_KEY, isCasa, matchFood } from '../catalog.js';
import { actions } from '../lib/store.js';
import { daysLeft, todayISO } from '../lib/dates.js';
import { newId, qtyLabel } from '../lib/items.js';
import { dayPlan, dietShopping } from '../lib/gemini.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, useApp } from './ui.jsx';

// Cose che in una casa di solito non mancano. Ognuna è "presente" se c'è almeno un cibo con una di quelle chiavi
// (o di quella categoria). La chiave in "add" è quella che finisce nella lista della spesa.
const ESSENTIALS = [
  { name: 'Sale', keys: ['sale'] },
  { name: 'Olio', keys: ['olio'] },
  {
    name: 'Pepe o spezie',
    keys: ['pepe', 'spezie', 'erbesecche'],
    add: 'pepe',
  },
  { name: 'Aceto', keys: ['aceto'] },
  { name: 'Aglio', keys: ['aglio'] },
  { name: 'Cipolle', keys: ['cipolla'], add: 'cipolla' },
  { name: 'Frutta', cats: ['frutta'], add: 'mela' },
  { name: 'Verdura', cats: ['verdura'], add: 'insalata' },
  { name: 'Uova', keys: ['uova'] },
  {
    name: 'Latte o yogurt',
    keys: ['latte', 'yogurt', 'lattevegetale'],
    add: 'latte',
  },
  { name: 'Carne o pesce', cats: ['carne', 'pesce'], add: 'petto' },
  {
    name: 'Legumi',
    keys: ['legumi', 'ceci', 'lenticchie', 'fagioli', 'piselli', 'edamame'],
    add: 'legumi',
  },
  { name: 'Tonno in scatola', keys: ['tonno'] },
  { name: 'Pasta', keys: ['pasta'] },
  { name: 'Riso', keys: ['riso'] },
  {
    name: 'Pane o cracker',
    keys: ['pane', 'cracker', 'gallette'],
    add: 'pane',
  },
  { name: 'Passata o pelati', keys: ['passata', 'pelati'], add: 'passata' },
  { name: 'Farina', keys: ['farina'] },
  { name: 'Zucchero', keys: ['zucchero'] },
  { name: 'Caffè', keys: ['caffe'] },
  {
    name: 'Detersivo piatti',
    keys: ['detersivopiatti', 'pastiglielavastoviglie'],
    add: 'detersivopiatti',
  },
  { name: 'Carta igienica', keys: ['cartaigienica'] },
  { name: 'Sapone', keys: ['sapone'] },
  { name: 'Detersivo lavatrice', keys: ['detersivolavatrice'] },
];

const LS_PLAN = 'dm_dayplan';
// la dieta resta SOLO su questo dispositivo (come i libri degli abbinamenti): non va su Firebase
const LS_DIET = 'dm_diet';
// libri di principi (linee guida generali): più d'uno, anche insieme alla dieta, sempre solo sul dispositivo
const LS_GUIDES = 'dm_guides';
// dati della persona (peso, altezza...): solo su questo dispositivo
const LS_PERSON = 'dm_person';
const WD = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const dayOfDiet = (diet) => {
  if (!diet?.start) return 0;
  const d = Math.floor((Date.parse(todayISO()) - Date.parse(diet.start)) / 86400000) + 1;
  return d > 0 ? d : 0;
};
const lsGet = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

// la dispensa in righe per Gemini (solo cibo), prima quello che scade
function pantryText(items) {
  return items
    .filter((i) => !isCasa(i))
    .map((i) => ({ i, d: daysLeft(i.expiry) }))
    .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999))
    .slice(0, 120)
    .map(({ i, d }) => {
      const n = i.nutr;
      const per = n && (n.p != null || n.c != null) ? ` · per 100 g: proteine ${n.p ?? '?'} g, carboidrati ${n.c ?? '?'} g, grassi ${n.f ?? '?'} g` : '';
      const when = d == null ? '' : d < 0 ? ' · scaduto' : d === 0 ? ' · scade oggi' : d <= 7 ? ` · scade tra ${d} giorni` : '';
      return `- ${i.name}${i.brand ? ' (' + i.brand + ')' : ''} · ${qtyLabel(i)} · ${i.loc}${when}${per}`;
    })
    .join('\n');
}
const sigOf = (items) =>
  items
    .filter((i) => !isCasa(i))
    .map((i) => i.id + ':' + i.qty)
    .sort()
    .join(',');

export default function DayAdvice({ compact = false }) {
  const { state, go, toast } = useApp();
  const items = state.items;
  const key = state.pantry?.geminiKey || '';
  const me = state.user?.name || '';
  const [saved, setSaved] = useState(() => lsGet(LS_PLAN, null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(false);
  const [diet, setDiet] = useState(() => lsGet(LS_DIET, null));
  const [guides, setGuides] = useState(() => lsGet(LS_GUIDES, []));
  const [person, setPerson] = useState(() => lsGet(LS_PERSON, {}));
  const hasPerson = !!(person.peso || person.altezza || person.eta);
  const setP = (k, v) => {
    const next = { ...person, [k]: v };
    setPerson(next);
    lsSet(LS_PERSON, next);
  };
  const dietArg = diet || guides.length || hasPerson ? { text: diet?.text || '', day: diet ? dayOfDiet(diet) : 0, guides: guides.map((g) => ({ name: g.name, text: g.text })), person } : null;
  const hasRules = !!(diet || guides.length);
  const fileRef = useRef(null);
  const guideRef = useRef(null);
  const [shop, setShop] = useState(null); // { spesa, nota } della dieta
  const [shopBusy, setShopBusy] = useState(false);
  const [pick, setPick] = useState({});
  const [days, setDays] = useState(7);
  const today = todayISO();
  const plan = saved && saved.date === today ? saved.plan : null;
  const sig = useMemo(() => sigOf(items) + '|' + (diet ? diet.importedAt + ':' + (diet.start || '') : '') + '|' + guides.map((g) => g.importedAt).join(',') + '|' + JSON.stringify(person), [items, diet, guides, person]);
  const stale = plan && saved.sig !== sig;

  const run = async () => {
    if (!key || busy) return;
    setBusy(true);
    setErr('');
    try {
      const p = await dayPlan(key, pantryText(items), dietArg);
      const next = { date: today, sig, plan: p };
      lsSet(LS_PLAN, next);
      setSaved(next);
    } catch (e) {
      setErr(e.message || 'Gemini non risponde.');
    } finally {
      setBusy(false);
    }
  };
  // una volta al giorno lo preparo da solo (se c'è la chiave e la dispensa non è vuota)
  useEffect(() => {
    if (key && !plan && !busy && !err && items.some((i) => !isCasa(i))) run();
  }, [key, today]);

  // cosa manca: per chiave del catalogo o per categoria
  const have = useMemo(() => {
    const keys = new Set();
    const cats = new Set();
    items.forEach((i) => {
      if (Number(i.qty) === 0) return;
      keys.add(i.food);
      const f = BY_KEY[i.food];
      if (f) cats.add(f.cat + (['aglio', 'cipolla'].includes(f.key) ? '-base' : ''));
    });
    return { keys, cats };
  }, [items]);
  const inList = (name, food) => Object.values(state.shopping || {}).some((s) => !s.done && ((food && s.food === food) || s.name.toLowerCase() === name.toLowerCase()));
  const missing = ESSENTIALS.filter((e) => !(e.keys || []).some((k) => have.keys.has(k)) && !(e.cats || []).some((c) => have.cats.has(c)));

  const addShop = (name, foodKey) => {
    const f = foodKey ? BY_KEY[foodKey] : null;
    if (inList(name, f?.key)) return toast('È già nella lista della spesa.');
    const id = newId();
    actions.shopSet(id, {
      id,
      name: f && !/ o /.test(name) ? f.name : name,
      qty: null,
      unit: null,
      food: f ? f.key : 'altro',
      icon: f ? f.icon : '1f4e6',
      cat: f ? f.cat : 'dispensa',
      done: false,
      by: me,
      addedAt: Date.now(),
    });
    play('add');
    toast(`${name}: aggiunto alla spesa.`);
  };

  const readBook = async (file) => {
    let text = await file.text();
    try {
      text = JSON.stringify(JSON.parse(text)); // JSON compatto: meno spazio e meno quota di Gemini
    } catch {
      /* non è JSON: va bene anche il testo */
    }
    return text;
  };
  // si possono scegliere più file insieme
  const importGuides = async (files) => {
    const list = [...(files || [])];
    if (!list.length) return;
    let next = guides;
    let added = 0;
    for (const [n, file] of list.entries()) {
      try {
        const text = await readBook(file);
        if (text.length > 400000) throw new Error(`${file.name}: troppo grande (oltre 400 KB).`);
        const g = { name: file.name.replace(/\.(json|txt)$/i, '').replace(/[_-]+/g, ' '), text, size: text.length, importedAt: Date.now() + n };
        next = [...next.filter((x) => x.name !== g.name), g];
        if (text.length > 70000) toast(`${g.name}: è lungo, a Gemini mando solo i primi 70.000 caratteri.`, { err: true });
        added++;
      } catch (e) {
        toast(e.message || `Non riesco a leggere ${file.name}.`, { err: true });
      }
    }
    if (!added) return;
    if (!lsSet(LS_GUIDES, next)) return toast('Spazio finito sul dispositivo.', { err: true });
    setGuides(next);
    setShop(null);
    play('add');
    toast(added > 1 ? `${added} libri aggiunti: menu e spesa li seguiranno.` : 'Libro aggiunto: menu e spesa lo seguiranno.');
  };
  const dropGuide = (at) => {
    const next = guides.filter((g) => g.importedAt !== at);
    lsSet(LS_GUIDES, next);
    setGuides(next);
    setShop(null);
  };
  const importDiet = async (file) => {
    if (!file) return;
    try {
      const text = await readBook(file);
      if (text.length > 400000) throw new Error('Il file è troppo grande (oltre 400 KB): tieni solo la parte della dieta che segui.');
      const d = { name: file.name.replace(/\.(json|txt)$/i, ''), text, size: text.length, importedAt: Date.now(), start: todayISO() };
      if (!lsSet(LS_DIET, d)) throw new Error('Spazio finito sul dispositivo.');
      setDiet(d);
      setShop(null);
      play('add');
      toast(`Dieta "${d.name}" caricata: da ora il menu la segue.`);
      if (text.length > 60000) toast('Il file è lungo: a Gemini mando solo i primi 60.000 caratteri.', { err: true });
    } catch (e) {
      toast(e.message || 'Non riesco a leggere il file.', { err: true });
    }
  };
  const setDiet2 = (d) => {
    if (d) lsSet(LS_DIET, d);
    else localStorage.removeItem(LS_DIET);
    setDiet(d);
  };
  const runShop = async () => {
    if (!key || !hasRules || shopBusy) return;
    setShopBusy(true);
    try {
      const r = await dietShopping(key, pantryText(items), dietArg, days);
      setShop(r);
      setPick(Object.fromEntries(r.spesa.map((x, i) => [i, true])));
    } catch (e) {
      toast(e.message || 'Gemini non risponde.', { err: true });
    } finally {
      setShopBusy(false);
    }
  };
  const addShopList = () => {
    const now = Date.now();
    let n = 0;
    shop.spesa.forEach((x, i) => {
      if (!pick[i] || inList(x.nome, null)) return;
      const f = matchFood(x.nome);
      const id = newId();
      actions.shopSet(id, {
        id,
        name: x.nome,
        qty: Number(x.quantita) || null,
        unit: Number(x.quantita) ? x.unita : null,
        food: f && f.cat !== 'casa' ? f.key : 'altro',
        icon: f ? f.icon : '1f4e6',
        cat: f ? f.cat : 'dispensa',
        done: false,
        by: me,
        addedAt: now + i,
        note: 'Dieta',
      });
      n++;
    });
    play('add');
    toast(n ? `${n} cose aggiunte alla spesa.` : 'Erano già tutte nella lista.');
    setShop(null);
  };

  return (
    <aside className={'day-advice' + (compact ? ' compact' : '')}>
      <Box compact={compact} icon="1f37d" title="Oggi da mangiare" hint={plan ? `${plan.pasti.length} pasti` : ''}>
        <div className="advice-tools">
          <button type="button" className="link-btn small" onClick={() => setEdit(!edit)}>
            {edit ? 'Fatto' : 'I tuoi dati e libri'}
          </button>
        </div>
        {edit ? (
          <div className="targets">
            <b className="small span2">I tuoi dati</b>
            <p className="small muted span2">Servono ai libri per calcolare calorie e grammi. Restano su questo dispositivo.</p>
            <label className="field">
              <span>Sesso</span>
              <select className="input pick" value={person.sesso || ''} onChange={(e) => setP('sesso', e.target.value)}>
                <option value="">—</option>
                <option value="m">Uomo</option>
                <option value="f">Donna</option>
              </select>
            </label>
            <label className="field">
              <span>Età</span>
              <input className="input" type="number" inputMode="decimal" placeholder="anni" value={person.eta ?? ''} onChange={(e) => setP('eta', e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Peso (kg)</span>
              <input className="input" type="number" inputMode="decimal" placeholder="kg" value={person.peso ?? ''} onChange={(e) => setP('peso', e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Altezza (cm)</span>
              <input className="input" type="number" inputMode="decimal" placeholder="cm" value={person.altezza ?? ''} onChange={(e) => setP('altezza', e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Massa grassa % (se la sai)</span>
              <input className="input" type="number" inputMode="decimal" placeholder="facoltativo" value={person.grasso ?? ''} onChange={(e) => setP('grasso', e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Passi al giorno</span>
              <input className="input" type="number" inputMode="decimal" placeholder="circa" value={person.passi ?? ''} onChange={(e) => setP('passi', e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Movimento nella giornata</span>
              <select className="input pick" value={person.attivita || ''} onChange={(e) => setP('attivita', e.target.value)}>
                <option value="">—</option>
                <option value="sedentario">Sedentario</option>
                <option value="poco">Poco attivo</option>
                <option value="attivo">Attivo</option>
                <option value="molto">Molto attivo</option>
              </select>
            </label>
            <label className="field">
              <span>Obiettivo</span>
              <select className="input pick" value={person.obiettivo || ''} onChange={(e) => setP('obiettivo', e.target.value)}>
                <option value="">—</option>
                <option value="dimagrire">Perdere grasso</option>
                <option value="mantenere">Mantenere il peso</option>
                <option value="massa">Aumentare massa</option>
                <option value="salute">Stare in salute</option>
              </select>
            </label>
            <label className="field">
              <span>Allenamenti a settimana</span>
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={person.allenamenti ?? ''} onChange={(e) => setP('allenamenti', e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Che sport</span>
              <input className="input" placeholder="es. pesi, corsa" value={person.sport || ''} onChange={(e) => setP('sport', e.target.value)} />
            </label>
            <div className="field span2">
              <span>Giorni in cui ti alleni</span>
              <div className="chips">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = (person.giorniAllenamento || []).includes(d);
                  return (
                    <button key={d} type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setP('giorniAllenamento', on ? person.giorniAllenamento.filter((x) => x !== d) : [...(person.giorniAllenamento || []), d])}>
                      {WD[d]}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field span2">
              <span>Altro da sapere (facoltativo)</span>
              <input className="input" placeholder="es. vegetariano, niente lattosio" value={person.note || ''} onChange={(e) => setP('note', e.target.value)} />
            </label>
            <div className="diet-ctl">
              <b className="small">Dieta da un libro</b>
              {diet ? (
                <>
                  <p className="small">
                    {diet.name} <span className="muted">· {Math.round(diet.size / 1000)} KB, solo su questo dispositivo</span>
                  </p>
                  <label className="field">
                    <span>Ho iniziato il (per contare i giorni della dieta)</span>
                    <input className="input" type="date" value={diet.start || ''} onChange={(e) => setDiet2({ ...diet, start: e.target.value })} />
                  </label>
                  <div className="row">
                    <Btn sm onClick={() => fileRef.current?.click()}>
                      Sostituisci
                    </Btn>
                    <Btn sm color="red" onClick={() => setDiet2(null)}>
                      Togli la dieta
                    </Btn>
                  </div>
                </>
              ) : (
                <>
                  <p className="small muted">Carica il file JSON (o di testo) con la dieta: il menu del giorno e la spesa la seguiranno. Il file resta su questo dispositivo.</p>
                  <Btn sm icon="1f4e6" onClick={() => fileRef.current?.click()}>
                    Carica il file della dieta
                  </Btn>
                </>
              )}
              <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(e) => (importDiet(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
            <div className="diet-ctl">
              <b className="small">I tuoi libri</b>
              <p className="small muted">Il menu e la spesa seguono questi libri. Puoi sceglierne più di uno alla volta. Restano su questo dispositivo.</p>
              {guides.map((g) => (
                <div className="row guide-row" key={g.importedAt}>
                  <span className="small grow">
                    {g.name} <span className="muted">· {Math.round(g.size / 1000)} KB</span>
                  </span>
                  <Btn sm color="red" onClick={() => dropGuide(g.importedAt)}>
                    Togli
                  </Btn>
                </div>
              ))}
              <Btn sm icon="1f4dd" onClick={() => guideRef.current?.click()}>
                Aggiungi file JSON (anche più di uno)
              </Btn>
              <input ref={guideRef} type="file" accept=".json,.txt,application/json,text/plain" hidden multiple onChange={(e) => (importGuides(e.target.files), (e.target.value = ''))} />
            </div>
          </div>
        ) : (
          <p className="small muted">
            {diet ? (
              <>
                Segue la dieta <b>{diet.name}</b>
                {dayOfDiet(diet) ? `, giorno ${dayOfDiet(diet)}` : ''}.
              </>
            ) : (
              <>
                {guides.length ? '' : 'Nessun libro caricato: uso le linee guida italiane. Caricali da "I tuoi dati e libri".'}
              </>
            )}
            {guides.length ? `Segue i tuoi libri: ${guides.map((g) => g.name).join(', ')}.` : ''}
            {hasPerson ? ` Calcolato su: ${[person.sesso ? (person.sesso === 'f' ? 'donna' : 'uomo') : '', person.eta ? person.eta + ' anni' : '', person.peso ? person.peso + ' kg' : '', person.altezza ? person.altezza + ' cm' : ''].filter(Boolean).join(', ')}.` : ' Aggiungi i tuoi dati (peso, altezza...) per avere quantità su misura.'}
          </p>
        )}

        {!key ? (
          <p className="small">
            Per il menu del giorno serve Gemini.{' '}
            <a href="#opzioni" onClick={(e) => (e.preventDefault(), go('opzioni'))}>
              Aggiungi la chiave
            </a>
          </p>
        ) : busy ? (
          <p className="small blink">Gemini sta pensando al menu di oggi...</p>
        ) : err ? (
          <div className="stack">
            <p className="small late-txt">{err}</p>
            <Btn sm onClick={run}>
              Riprova
            </Btn>
          </div>
        ) : plan ? (
          <>
            <ol className="meals-plan">
              {plan.pasti.map((m, i) => (
                <li key={i}>
                  <span className="mp-when">{m.pasto}</span>
                  <span className="mp-dish">{m.piatto}</span>
                  <span className="mp-ingr">{m.ingredienti.join(' · ')}</span>
                </li>
              ))}
            </ol>
            <div className="plan-tot">
              <Meter label="Proteine" value={plan.proteine_tot} />
              <Meter label="Verdure" value={plan.verdure_tot} />
              {plan.kcal_tot ? <Meter label="Calorie" value={plan.kcal_tot} unit="kcal" /> : null}
            </div>
            {plan.fabbisogno && <p className="small muted">{plan.fabbisogno}</p>}
            {plan.consiglio && <p className="small">{plan.consiglio}</p>}
            {plan.da_comprare?.length > 0 && (
              <div className="chips">
                {plan.da_comprare.map((n) => (
                  <button key={n} type="button" className="chip" onClick={() => addShop(n, null)}>
                    + {n}
                  </button>
                ))}
              </div>
            )}
            <div className="row plan-foot">
              <span className="small muted grow">{stale ? 'La dispensa o la dieta sono cambiate: aggiorna il menu.' : 'Preparato oggi con quello che hai.'}</span>
              <Btn sm onClick={run}>
                {stale ? 'Aggiorna' : 'Un altro menu'}
              </Btn>
            </div>
          </>
        ) : (
          <Btn sm onClick={run}>
            Proponi il menu di oggi
          </Btn>
        )}
      </Box>

      {hasRules && key && (
        <Box compact={compact} icon="1f9fe" title={diet ? 'Spesa della dieta' : 'Spesa secondo i libri'}>
          {!shop ? (
            <>
              <p className="small muted">Cosa comprare per seguire {[diet?.name, ...guides.map((g) => g.name)].filter(Boolean).join(' e ')}, tolto quello che hai già.</p>
              <div className="row">
                <select className="input pick grow" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Per quanti giorni">
                  <option value={3}>Per 3 giorni</option>
                  <option value={7}>Per 7 giorni</option>
                  <option value={14}>Per 14 giorni</option>
                </select>
                <Btn sm color="yellow" onClick={runShop} disabled={shopBusy}>
                  {shopBusy ? 'Preparo...' : 'Prepara la lista'}
                </Btn>
              </div>
            </>
          ) : (
            <>
              {shop.nota && <p className="small">{shop.nota}</p>}
              <ul className="diet-shop">
                {shop.spesa.map((x, i) => (
                  <li key={i}>
                    <label className="opt-check">
                      <input type="checkbox" checked={!!pick[i]} onChange={(e) => setPick({ ...pick, [i]: e.target.checked })} />
                      <span className="grow">
                        {x.nome} <span className="muted">{x.quantita ? qtyLabel({ qty: x.quantita, unit: x.unita }) : ''}</span>
                        {x.perche && <span className="why">{x.perche}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="row">
                <Btn sm color="yellow" onClick={addShopList} disabled={!Object.values(pick).some(Boolean)}>
                  Aggiungi alla spesa ({Object.values(pick).filter(Boolean).length})
                </Btn>
                <Btn sm onClick={() => setShop(null)}>
                  Annulla
                </Btn>
              </div>
            </>
          )}
        </Box>
      )}

      <Box compact={compact} icon="1f6d2" title="Manca in casa" hint={missing.length ? `${missing.length}` : ''}>
        {missing.length ? (
          <>
            <p className="small muted">Le cose di base che non vedo in dispensa. Tocca per metterle nella spesa.</p>
            <div className="chips">
              {missing.map((e) => {
                const f = BY_KEY[e.add || e.keys?.[0]];
                const listed = inList(e.name, f?.key);
                return (
                  <button key={e.name} type="button" className={'chip ' + (listed ? 'listed' : '')} disabled={listed} onClick={() => addShop(e.name, f?.key)}>
                    {f && <Icon id={f.icon} size={16} />}
                    {e.name}
                    {listed && <span className="n">in lista</span>}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="small">Hai tutte le cose di base.</p>
        )}
      </Box>
    </aside>
  );
}

// stima della giornata (gli obiettivi ora vengono dai libri)
function Meter({ label, value, unit = 'g' }) {
  return (
    <div className="meter">
      <span className="small">
        {label} <b>{Math.round(Number(value) || 0)} {unit}</b> <span className="muted">{unit === 'kcal' ? 'stimate' : 'stimati'}</span>
      </span>
    </div>
  );
}

// riquadro: sul telefono si apre e chiude toccando il titolo (la dispensa resta in primo piano)
function Box({ compact, icon, title, hint, children }) {
  const k = 'dm_box_' + icon;
  const [open, setOpen] = useState(() => lsGet(k, false));
  const head = (
    <>
      <Icon id={icon} size={20} />
      <h2 className="title grow">{title}</h2>
      {compact && hint ? <span className="small muted box-hint">{hint}</span> : null}
    </>
  );
  if (!compact)
    return (
      <section className="win advice-box">
        <div className="advice-head">{head}</div>
        {children}
      </section>
    );
  return (
    <details
      className="win advice-box"
      open={open}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        lsSet(k, e.currentTarget.open);
      }}
    >
      <summary className="advice-head">{head}</summary>
      {children}
    </details>
  );
}
