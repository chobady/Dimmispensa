// Sezione Menu: cosa mangiare oggi e cosa comprare, calcolati in locale con le regole
// del Manuale di nutrizione applicata e di Project Nutrition (lib/planner.js), e cosa manca in casa.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BY_KEY, isCasa, matchFood } from '../catalog.js';
import { actions } from '../lib/store.js';
import { daysLeft, todayISO } from '../lib/dates.js';
import { newId, qtyLabel } from '../lib/items.js';
import { lineText, logPlan, planDay, weeklyShopping } from '../lib/planner.js';
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
// com'è la giornata di oggi (allenamento, movimento): chiesto prima del menu
const LS_TODAY = 'dm_oggi';
const MEALS = ['Colazione', 'Spuntino', 'Pranzo', 'Cena'];
const WD = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
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

export default function DayAdvice({ compact = false, page = false }) {
  const { state, go, toast } = useApp();
  const items = state.items;
  const key = state.pantry?.geminiKey || '';
  const me = state.user?.name || '';
  const [saved, setSaved] = useState(() => lsGet(LS_PLAN, null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(false);
  const diet = null; // la vecchia "dieta" singola ora è uno dei libri
  const [guides, setGuides] = useState(() => {
    const g = lsGet(LS_GUIDES, []);
    const d = lsGet(LS_DIET, null);
    if (!d) return g;
    // sposta il file caricato come dieta tra i libri (una volta sola)
    const name = String(d.name || 'dieta').replace(/[_-]+/g, ' ');
    const next = g.some((x) => x.name === name || x.text === d.text) ? g : [...g, { name, text: d.text, size: d.size || String(d.text).length, importedAt: d.importedAt || Date.now() }];
    lsSet(LS_GUIDES, next);
    localStorage.removeItem(LS_DIET);
    return next;
  });
  const [person, setPerson] = useState(() => lsGet(LS_PERSON, {}));
  const hasPerson = !!(person.peso || person.altezza || person.eta);
  const setP = (k, v) => {
    const next = { ...person, [k]: v };
    setPerson(next);
    lsSet(LS_PERSON, next);
  };
  const [dayInfo, setDayInfo] = useState(() => {
    const d = lsGet(LS_TODAY, null);
    return d && d.date === todayISO() ? d : null;
  });
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState(null);
  const dietArg = { text: '', day: 0, guides: guides.map((g) => ({ name: g.name, text: g.text })), person: { ...person, oggi: dayInfo } };
  const hasRules = !!(diet || guides.length);
  const guideRef = useRef(null);
  const [shop, setShop] = useState(null); // { spesa, nota } della dieta
  const [shopBusy, setShopBusy] = useState(false);
  const [pick, setPick] = useState({});
  const [days, setDays] = useState(7);
  const today = todayISO();
  const plan = saved && saved.date === today ? saved.plan : null;
  const sigFor = (d) => baseSig + '|' + JSON.stringify(d);
  const baseSig = useMemo(() => sigOf(items) + '|' + (diet ? diet.importedAt + ':' + (diet.start || '') : '') + '|' + guides.map((g) => g.importedAt).join(',') + '|' + JSON.stringify(person), [items, diet, guides, person]);
  const sig = sigFor(dayInfo);
  const stale = plan && saved.sig !== sig;

  // prima del menu chiede com'è la giornata (precompilato con l'ultima risposta o con i giorni di allenamento)
  const ask = (meals = MEALS) => {
    const wd = new Date().getDay();
    const usual = (person.giorniAllenamento || []).includes(wd);
    setDraft({ ...(dayInfo || { allena: usual, sport: person.sport || '', durata: 60, intensita: 'media', quando: '', movimento: 'normale' }), meals });
    setAsking(true);
  };
  const confirmDay = () => {
    const { meals, ...rest } = draft;
    const d = { ...rest, date: today };
    lsSet(LS_TODAY, d);
    setDayInfo(d);
    setAsking(false);
    run({ ...person, oggi: d }, meals.length === MEALS.length ? null : meals);
  };
  // only: pasti da rifare (es. ['Cena']); gli altri restano quelli del menu già fatto
  // menu calcolato in locale con le regole dei due libri (planner.js): niente Gemini, conti esatti
  const [seeds, setSeeds] = useState({});
  const run = async (personNow, only = null, seedNow = seeds) => {
    if (busy) return;
    if (!dayInfo && !personNow) return ask(only || MEALS);
    setErr('');
    try {
      const who = personNow?.oggi ? personNow : { ...person, oggi: dayInfo };
      const p = planDay({ items, person: who, only, seed: seedNow, keep: only && plan?.local ? plan.raw : null, date: today });
      const T = p.targets;
      const sumK = (k) => p.pasti.reduce((t, m) => t + (m[k] || 0), 0);
      const shaped = {
        local: true,
        raw: p,
        pasti: p.pasti.map((m) => ({
          pasto: m.pasto,
          piatto: m.piatto,
          ingredienti: m.lines.map(lineText),
          proteine_g: m.p,
          verdure_g: m.lines.filter((l) => l.role === 'veg').reduce((g, l) => g + l.g, 0),
          kcal: m.kcal,
          carboidrati_g: m.c,
          grassi_g: m.f,
          why: m.why,
        })),
        proteine_tot: sumK('p'),
        verdure_tot: p.vegG,
        kcal_tot: sumK('kcal'),
        carboidrati_tot: sumK('c'),
        grassi_tot: sumK('f'),
        obiettivo: { kcal: T.kcal, p: T.protein, c: T.carbs, f: T.fat },
        fabbisogno: T.calc,
        regole: [...T.macroWhy, ...new Set(p.pasti.flatMap((m) => m.why))],
        checks: p.checks,
        note: [...T.notes, ...p.blocked.map((b) => `Non uso "${b.name}": ${b.why}.`)],
        da_comprare: p.buy,
      };
      logPlan(p, today);
      const next = { date: today, sig: sigFor(who.oggi || dayInfo), plan: shaped };
      lsSet(LS_PLAN, next);
      setSaved(next);
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Non riesco a preparare il menu.');
    }
  };
  const redo = (meal) => {
    const next = { ...seeds, [meal]: (seeds[meal] || 0) + 1 };
    setSeeds(next);
    run(null, [meal], next);
  };

  // una volta al giorno lo preparo da solo (se c'è la chiave e la dispensa non è vuota)
  useEffect(() => {
    if (!plan && !busy && !err && dayInfo && items.some((i) => !isCasa(i))) run();
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
  const runShop = async () => {
    if (shopBusy) return;
    setShopBusy(true);
    try {
      const r = { spesa: weeklyShopping({ items, person, days, date: today }), nota: 'Quantità per una persona, già tolto quello che hai in casa.' };
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

  // dal menu di Gemini ai Pasti di oggi: un piatto per pasto, con gli ingredienti come nota
  const SLOT = { Colazione: 'colazione', Spuntino: 'snack', Merenda: 'snack', Pranzo: 'pranzo', Cena: 'cena' };
  const inMeals = (m) => (state.meals?.[today]?.[SLOT[m.pasto] || 'snack'] || []).some((e) => e.name === m.piatto);
  const toMeals = (list) => {
    const bySlot = {};
    list.filter((m) => !inMeals(m)).forEach((m) => {
      const slot = SLOT[m.pasto] || 'snack';
      (bySlot[slot] ||= []).push({ id: newId(), item: null, name: m.piatto, icon: '1f37d', note: m.ingredienti.join(' · '), fromPlan: true });
    });
    Object.entries(bySlot).forEach(([slot, add]) => actions.setMealSlot(today, slot, [...(state.meals?.[today]?.[slot] || []), ...add]));
    const n = Object.values(bySlot).flat().length;
    play('add');
    toast(n > 1 ? `${n} piatti messi nei Pasti di oggi.` : 'Messo nei Pasti di oggi.', { action: { label: 'Vedi', fn: () => go('pasti') } });
  };

  return (
    <aside className={'day-advice' + (compact ? ' compact' : '') + (page ? ' page' : '')}>
      <Box compact={compact} icon="1f37d" title="Oggi da mangiare" hint={plan ? `${plan.pasti.length} pasti` : ''}>
        <div className="advice-tools">
          <button type="button" className="link-btn small" onClick={() => setEdit(!edit)}>
            {edit ? 'Fatto' : 'I tuoi dati'}
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
            <p className="small muted span2">Le regole dei due libri (Manuale di nutrizione applicata e Project Nutrition) sono già dentro il programma: non serve caricare file.</p>
          </div>
        ) : (
          <p className="small muted">
            Calcolato dal programma con le regole del Manuale di nutrizione applicata e di Project Nutrition, senza Gemini.
            {hasPerson ? ` Calcolato su: ${[person.sesso ? (person.sesso === 'f' ? 'donna' : 'uomo') : '', person.eta ? person.eta + ' anni' : '', person.peso ? person.peso + ' kg' : '', person.altezza ? person.altezza + ' cm' : ''].filter(Boolean).join(', ')}.` : ''}
          </p>
        )}
        {!edit && !hasPerson && (
          <Btn sm color="yellow" icon="270f" onClick={() => setEdit(true)}>
            Inserisci i tuoi dati (peso, altezza...)
          </Btn>
        )}

        {asking && draft ? (
          <div className="day-ask stack">
            <div className="field">
              <span>Cosa ti preparo?</span>
              <div className="chips">
                <button type="button" className={'chip' + (draft.meals.length === MEALS.length ? ' on' : '')} onClick={() => setDraft({ ...draft, meals: MEALS })}>
                  Tutta la giornata
                </button>
                {MEALS.map((m) => {
                  const on = draft.meals.length < MEALS.length && draft.meals.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={'chip' + (on ? ' on' : '')}
                      aria-pressed={on}
                      onClick={() => {
                        const cur = draft.meals.length === MEALS.length ? [] : draft.meals;
                        const next = on ? cur.filter((x) => x !== m) : [...cur, m];
                        setDraft({ ...draft, meals: next.length ? MEALS.filter((x) => next.includes(x)) : MEALS });
                      }}
                    >
                      Solo {m.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <b className="small">Com'è la tua giornata oggi?</b>
            <div className="field">
              <span>Oggi ti alleni?</span>
              <div className="seg-2">
                <button type="button" className={'chip' + (draft.allena ? ' on' : '')} aria-pressed={draft.allena} onClick={() => setDraft({ ...draft, allena: true })}>
                  Sì
                </button>
                <button type="button" className={'chip' + (!draft.allena ? ' on' : '')} aria-pressed={!draft.allena} onClick={() => setDraft({ ...draft, allena: false })}>
                  No, riposo
                </button>
              </div>
            </div>
            {draft.allena && (
              <div className="targets">
                <label className="field span2">
                  <span>Che allenamento</span>
                  <input className="input" placeholder="es. pesi gambe, corsa, calcetto" value={draft.sport} onChange={(e) => setDraft({ ...draft, sport: e.target.value })} />
                </label>
                <label className="field">
                  <span>Quanto dura</span>
                  <select className="input pick" value={draft.durata} onChange={(e) => setDraft({ ...draft, durata: Number(e.target.value) })}>
                    {[30, 45, 60, 75, 90, 120, 180].map((m) => (
                      <option key={m} value={m}>
                        {m} minuti
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Intensità</span>
                  <select className="input pick" value={draft.intensita} onChange={(e) => setDraft({ ...draft, intensita: e.target.value })}>
                    <option value="leggera">Leggera</option>
                    <option value="media">Media</option>
                    <option value="intensa">Intensa</option>
                  </select>
                </label>
                <label className="field span2">
                  <span>Quando</span>
                  <select className="input pick" value={draft.quando} onChange={(e) => setDraft({ ...draft, quando: e.target.value })}>
                    <option value="">Non so ancora</option>
                    <option value="la mattina, prima di colazione">Mattina, a digiuno</option>
                    <option value="la mattina">Mattina</option>
                    <option value="all'ora di pranzo">Ora di pranzo</option>
                    <option value="il pomeriggio">Pomeriggio</option>
                    <option value="la sera, prima di cena">Sera</option>
                  </select>
                </label>
              </div>
            )}
            <label className="field">
              <span>Quanto ti muovi oggi (a parte l'allenamento)?</span>
              <select className="input pick" value={draft.movimento} onChange={(e) => setDraft({ ...draft, movimento: e.target.value })}>
                <option value="poco">Poco: quasi sempre seduto</option>
                <option value="normale">Normale</option>
                <option value="tanto">Tanto: in piedi o a piedi gran parte del giorno</option>
              </select>
            </label>
            <div className="row">
              <Btn sm color="yellow" className="grow" onClick={confirmDay}>
                {draft.meals.length === MEALS.length ? 'Fai il menu del giorno' : `Prepara: ${draft.meals.join(', ').toLowerCase()}`}
              </Btn>
              <Btn sm onClick={() => setAsking(false)}>
                Annulla
              </Btn>
            </div>
          </div>
        ) : busy ? (
          <p className="small blink">Preparo il menu...</p>
        ) : err ? (
          <div className="stack">
            <p className="small late-txt">{err}</p>
            <Btn sm onClick={() => run()}>
              Riprova
            </Btn>
          </div>
        ) : plan ? (
          <>
            {dayInfo && (
              <p className="small muted">
                Oggi: {dayInfo.allena ? `ti alleni${dayInfo.sport ? ' (' + dayInfo.sport + ', ' + dayInfo.durata + ' min)' : ` (${dayInfo.durata} min)`}` : 'riposo'}, movimento {dayInfo.movimento}.{' '}
                <button type="button" className="link-btn small" onClick={() => ask()}>
                  Cambia
                </button>
              </p>
            )}
            <ol className="meals-plan">
              {plan.pasti.map((m, i) => (
                <li key={i}>
                  <span className="mp-when">{m.pasto}</span>
                  <span className="mp-dish">{m.piatto}</span>
                  <span className="mp-ingr">{m.ingredienti.join(' · ')}</span>
                  {plan.local && (
                    <span className="mp-ingr mp-macro">
                      {Math.round(m.kcal)} kcal · P {Math.round(m.proteine_g)} g · C {Math.round(m.carboidrati_g)} g · G {Math.round(m.grassi_g)} g
                    </span>
                  )}
                  <span className="mp-acts">
                    <button type="button" className={'chip' + (inMeals(m) ? ' on' : '')} disabled={inMeals(m)} onClick={() => toMeals([m])}>
                      {inMeals(m) ? 'In Pasti' : '+ Pasti'}
                    </button>
                    <button type="button" className="chip" onClick={() => (plan.local ? redo(m.pasto) : run(null, [m.pasto]))}>
                      Rifai {m.pasto.toLowerCase()}
                    </button>
                    {m.kcal && !plan.local ? <span className="small muted">{Math.round(m.kcal)} kcal</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            {plan.pasti.some((m) => !inMeals(m)) && (
              <Btn sm icon="1f4c5" onClick={() => toMeals(plan.pasti)}>
                Metti tutto il menu in Pasti (oggi)
              </Btn>
            )}
            {plan.local ? (
              (() => {
                // solo alcuni pasti: confronto con la loro parte della giornata, non con il totale
                const part = plan.raw.only ? plan.raw.pasti.filter((m) => plan.raw.only.includes(m.pasto)) : null;
                const tg = part
                  ? part.reduce((t, m) => ({ kcal: t.kcal + m.target.kcal, p: t.p + m.target.p, c: t.c + m.target.c, f: t.f + (m.target.f || 0), share: t.share + (m.target.share || 0) }), { kcal: 0, p: 0, c: 0, f: 0, share: 0 })
                  : { ...plan.obiettivo, share: 1 };
                return (
                  <>
                    <p className="small">
                      <b>{part ? `Valori ${part.length === 1 ? 'di questo pasto' : 'di questi pasti'} (${part.map((m) => m.pasto.toLowerCase()).join(', ')})` : 'Totale della giornata'}</b>
                      {part ? `: confrontati con ${part.length === 1 ? 'la sua' : 'la loro'} parte della giornata, il ${Math.round(tg.share * 100)}% di ${plan.obiettivo.kcal} kcal.` : `, confrontato con il tuo obiettivo di ${plan.obiettivo.kcal} kcal.`}
                    </p>
                    <div className="plan-tot">
                      <Meter label="Calorie" value={plan.kcal_tot} unit="kcal" target={tg.kcal} />
                      <Meter label="Proteine" value={plan.proteine_tot} target={tg.p} />
                      <Meter label="Carboidrati" value={plan.carboidrati_tot} target={tg.c} />
                      <Meter label="Grassi" value={plan.grassi_tot} target={tg.f || null} />
                      {!part || part.some((x) => x.pasto === 'Pranzo' || x.pasto === 'Cena') ? <Meter label="Verdure" value={plan.verdure_tot} target={part ? null : 400} /> : null}
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="plan-tot">
                <Meter label="Proteine" value={plan.proteine_tot} />
                <Meter label="Verdure" value={plan.verdure_tot} />
                {plan.kcal_tot ? <Meter label="Calorie" value={plan.kcal_tot} unit="kcal" /> : null}
              </div>
            )}
            {plan.checks?.length > 0 && (
              <ul className="plan-checks small">
                {plan.checks.map((c, i) => (
                  <li key={i} className={c.ok ? 'ok' : 'ko'}>
                    {c.ok ? '✓' : '!'} {c.txt}
                  </li>
                ))}
              </ul>
            )}
            {plan.note?.map((n, i) => (
              <p key={i} className="small">
                {n}
              </p>
            ))}
            {plan.fabbisogno && <p className="small muted">{plan.fabbisogno}</p>}
            {plan.consiglio && <p className="small">{plan.consiglio}</p>}
            {plan.regole?.length > 0 && (
              <details className="plan-rules">
                <summary className="small">Regole dei libri usate ({plan.regole.length})</summary>
                <ul className="small">
                  {plan.regole.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </details>
            )}
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
              <Btn sm onClick={() => (stale ? run() : ask())}>
                {stale ? 'Aggiorna' : 'Nuovo menu'}
              </Btn>
            </div>
          </>
        ) : (
          <Btn sm color="yellow" onClick={() => ask()}>
            Prepara il menu di oggi
          </Btn>
        )}
      </Box>

      {(
        <Box compact={compact} icon="1f9fe" title="Spesa secondo i libri">
          {!shop ? (
            <>
              <p className="small muted">Cosa comprare per mangiare come dicono il Manuale e Project Nutrition: verdura e frutta di stagione, pesce, legumi, cereali integrali... tolto quello che hai già.</p>
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
function Meter({ label, value, unit = 'g', target = null }) {
  const v = Math.round(Number(value) || 0);
  if (!target)
    return (
      <div className="meter">
        <span className="small">
          {label} <b>{v} {unit}</b>
        </span>
      </div>
    );
  const r = Math.min(1, v / target);
  const ok = Math.abs(v - target) / target <= 0.1;
  return (
    <div className="meter">
      <span className="small">
        {label} <b>{v}</b> <span className="muted">/ {Math.round(target)} {unit}</span>
      </span>
      <span className="have-bar" aria-hidden="true">
        <span style={{ width: Math.round(r * 100) + '%', background: ok ? 'var(--green)' : 'var(--yellow)' }} />
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
