import { useMemo, useState } from 'react';
import { norm, roleOf, PORTIONS } from '../catalog.js';
import { actions } from '../lib/store.js';
import { addDays, daysLeft, expiryLabel, expiryStatus, fromISO, todayISO, toISO } from '../lib/dates.js';
import { defaultPortion, newId, portionLabel, qtyLabel } from '../lib/items.js';
import QtyPicker from '../components/QtyPicker.jsx';
import { play } from '../lib/sound.js';
import { Btn, Icon, Sheet, Talk, useApp } from '../components/ui.jsx';
import { byExpiry } from './Pantry.jsx';

export const SLOTS = [
  { id: 'colazione', name: 'Colazione', icon: '2615' },
  { id: 'snack', name: 'Snack', icon: '1f36a' },
  { id: 'pranzo', name: 'Pranzo', icon: '1f35d' },
  { id: 'cena', name: 'Cena', icon: '1f37d' },
];
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const mondayOf = (iso) => {
  const d = fromISO(iso);
  const shift = (d.getDay() + 6) % 7;
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift));
};
const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(i, fromISO(monday)));
const dayTitle = (iso) => {
  const d = fromISO(iso);
  const t = todayISO();
  const rel = iso === t ? 'Oggi, ' : iso === addDays(1) ? 'Domani, ' : iso === addDays(-1) ? 'Ieri, ' : '';
  const t2 = `${rel}${GIORNI_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  return t2.charAt(0).toUpperCase() + t2.slice(1);
};
const monthLabel = (days) => {
  const a = fromISO(days[0]);
  const b = fromISO(days[6]);
  const m = (d) => MESI[d.getMonth()];
  if (a.getMonth() === b.getMonth()) return `${m(a)} ${a.getFullYear()}`;
  return `${m(a)} – ${m(b)} ${b.getFullYear()}`;
};

// Quali cibi stanno bene in quale pasto (solo per ordinare e per "Sorprendimi")
const fitsSlot = (item, slot) => {
  const r = roleOf(item);
  if (slot === 'colazione') return ['latticini', 'dolci', 'frutta', 'bevande'].includes(item.cat) || ['cereali', 'pane', 'croissant', 'cracker', 'gallette', 'pancake', 'marmellata', 'miele', 'cremanocciola', 'uova', 'caffe', 'te'].includes(item.food);
  if (slot === 'snack') return ['frutta', 'dolci'].includes(item.cat) || ['yogurt', 'cracker', 'gallette', 'grissini', 'noci', 'mandorle', 'arachidi', 'olive'].includes(item.food) || r === 'frutta';
  return ['prot', 'veg', 'carb', 'pronto'].includes(r);
};

function weightedPick(list, warnDays, exclude = new Set()) {
  const pool = list.filter((i) => !exclude.has(i.id));
  if (!pool.length) return null;
  const w = pool.map((i) => {
    const n = daysLeft(i.expiry);
    return n === null ? 1 : n <= warnDays ? 6 : n <= 7 ? 3 : 1;
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// portion: { qty, unit, all }
const entryFrom = (item, portion) => {
  const p = portion || { qty: defaultPortion(item, roleOf(item)), unit: item.unit };
  const all = p.all || Number(p.qty) >= Number(item.qty);
  return { id: newId(), item: item.id, name: item.name, icon: item.icon, unit: item.unit, qty: all ? Number(item.qty) : Number(p.qty), all };
};

// Quanto ne resta in dispensa togliendo le porzioni già programmate (dal giorno indicato in poi)
const reservedFor = (meals, itemId, fromDate, skipEntryId) => {
  let r = 0;
  for (const [d, slots] of Object.entries(meals)) {
    if (d < fromDate) continue;
    for (const list of Object.values(slots || {})) for (const e of list || []) if (e.item === itemId && !e.done && e.id !== skipEntryId) r += e.all ? Infinity : Number(e.qty) || 0;
  }
  return r;
};

export default function Meals() {
  const { state, warnDays } = useApp();
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [monday, setMonday] = useState(mondayOf(today));
  const [picker, setPicker] = useState(null); // { date, slot }
  const [entryOpen, setEntryOpen] = useState(null); // { date, slot, entry }
  const days = weekDays(monday);
  const meals = state.meals || {};
  const itemsById = useMemo(() => Object.fromEntries(state.items.map((i) => [i.id, i])), [state.items]);

  const plannedIds = useMemo(() => {
    const s = new Set();
    Object.entries(meals).forEach(([d, slots]) => {
      if (d < today) return;
      Object.values(slots || {}).forEach((list) => (list || []).forEach((e) => !e.done && e.item && s.add(e.item)));
    });
    return s;
  }, [meals, today]);

  const urgentUnplanned = state.items
    .filter((i) => ['today', 'soon'].includes(expiryStatus(i.expiry, warnDays)) && !['bev', 'cond'].includes(roleOf(i)) && !plannedIds.has(i.id))
    .sort(byExpiry);

  const go = (deltaWeeks) => {
    play('tap');
    const m = addDays(7 * deltaWeeks, fromISO(monday));
    setMonday(m);
    setDay(deltaWeeks === 0 ? today : m);
  };
  const goToday = () => {
    play('tap');
    setMonday(mondayOf(today));
    setDay(today);
  };

  const todayMeals = meals[today] || {};
  const nextSlot = SLOTS.find((s) => (todayMeals[s.id] || []).length);
  let text;
  let mood = 'idle';
  if (urgentUnplanned.length) {
    const names = urgentUnplanned.slice(0, 2).map((i) => i.name.toLowerCase()).join(' e ');
    text = `Occhio: ${names}${urgentUnplanned.length > 2 ? ` e altri ${urgentUnplanned.length - 2}` : ''} ${urgentUnplanned.length === 1 ? 'scade' : 'scadono'} presto e non ${urgentUnplanned.length === 1 ? 'è' : 'sono'} in nessun pasto.`;
    mood = 'worry';
  } else if (nextSlot) {
    const c = todayMeals.cena?.length ? `Stasera: ${todayMeals.cena.map((e) => e.name.toLowerCase()).join(', ')}.` : 'Oggi hai già qualcosa in programma.';
    text = c;
    mood = 'happy';
  } else {
    text = 'Tocca un pasto per metterci dentro quello che hai in casa.';
  }

  const removeEntry = (date, slot, entryId) => {
    const list = (meals[date]?.[slot] || []).filter((e) => e.id !== entryId);
    actions.setMealSlot(date, slot, list);
  };

  return (
    <>
      <Talk text={text} mood={mood} />

      <div className="cal-head">
        <Btn sm aria-label="Settimana prima" onClick={() => go(-1)}>‹</Btn>
        <h2 className="title cal-month">{monthLabel(days)}</h2>
        <Btn sm aria-label="Settimana dopo" onClick={() => go(1)}>›</Btn>
        {!days.includes(today) || day !== today ? <Btn sm color="yellow" onClick={goToday}>Oggi</Btn> : null}
      </div>

      <div className="week" role="tablist" aria-label="Giorni della settimana">
        {days.map((d) => {
          const dt = fromISO(d);
          const count = SLOTS.reduce((n, s) => n + (meals[d]?.[s.id]?.length || 0), 0);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              className={['day', d === day ? 'on' : '', d === today ? 'today' : '', d < today ? 'past' : ''].join(' ')}
              onClick={() => (play('tap'), setDay(d))}
            >
              <span className="wd">{GIORNI[dt.getDay()]}</span>
              <span className="dn">{dt.getDate()}</span>
              <span className="pips" aria-label={`${count} cibi in programma`}>
                {SLOTS.map((s) => (
                  <i key={s.id} className={meals[d]?.[s.id]?.length ? 'full' : ''} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Telefono: un giorno alla volta. Computer: tutta la settimana (vedi CSS). */}
      <div className="week-board">
        {days.map((d) => (
          <section key={d} className={'board-day ' + (d === day ? 'sel' : '') + (d === today ? ' today' : '') + (d < today ? ' past' : '')}>
            <h3 className="board-title">
              <span className="long">{dayTitle(d)}</span>
              <span className="short">{d === today ? 'Oggi' : GIORNI[fromISO(d).getDay()]} {fromISO(d).getDate()}</span>
            </h3>
            {SLOTS.map((s) => (
              <MealSlot
                key={s.id}
                date={d}
                slot={s}
                entries={meals[d]?.[s.id] || []}
                itemsById={itemsById}
                onAdd={() => (play('open'), setPicker({ date: d, slot: s.id }))}
                onEntry={(entry) => (play('open'), setEntryOpen({ date: d, slot: s.id, entry }))}
              />
            ))}
          </section>
        ))}
      </div>

      {picker && (
        <Picker
          date={picker.date}
          slot={picker.slot}
          entries={meals[picker.date]?.[picker.slot] || []}
          plannedIds={plannedIds}
          onClose={() => setPicker(null)}
          onRemove={(id) => removeEntry(picker.date, picker.slot, id)}
        />
      )}
      {entryOpen && (
        <EntrySheet
          {...entryOpen}
          item={itemsById[entryOpen.entry.item]}
          onClose={() => setEntryOpen(null)}
          onRemove={() => {
            removeEntry(entryOpen.date, entryOpen.slot, entryOpen.entry.id);
            setEntryOpen(null);
          }}
        />
      )}
    </>
  );
}

function MealSlot({ date, slot, entries, itemsById, onAdd, onEntry }) {
  return (
    <div className="win flat meal">
      <div className="meal-head">
        <Icon id={slot.icon} size={20} />
        <span className="meal-name">{slot.name}</span>
        <button type="button" className="meal-add" onClick={onAdd} aria-label={`Aggiungi a ${slot.name}`}>+</button>
      </div>
      {entries.length > 0 && (
        <div className="meal-list">
          {entries.map((e) => {
            const it = e.item ? itemsById[e.item] : null;
            const late = it && it.expiry && it.expiry < date && !e.done;
            const gone = e.item && !it && !e.done;
            return (
              <button key={e.id} type="button" className={'entry ' + (e.done ? 'done' : '') + (late ? ' late' : '')} onClick={() => onEntry(e)}>
                <Icon id={e.icon} size={20} />
                <span className="en">{e.name}</span>
                {e.item && <span className="pq">{portionLabel(e)}</span>}
                {e.done && <Icon id="2705" size={14} />}
                {late && <span className="flag">scade prima</span>}
                {gone && <span className="flag muted">finito</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Picker({ date, slot, entries, plannedIds, onClose, onRemove }) {
  const { state, warnDays, toast } = useApp();
  const [q, setQ] = useState('');
  const [portionFor, setPortionFor] = useState(null);
  const slotInfo = SLOTS.find((s) => s.id === slot);
  const inSlot = new Set(entries.map((e) => e.item).filter(Boolean));
  const edible = state.items.filter((i) => expiryStatus(i.expiry, warnDays) !== 'expired' && roleOf(i) !== 'cond').sort(byExpiry);
  const nq = norm(q);
  const shown = edible.filter((i) => !nq || norm(i.name + ' ' + (i.brand || '')).includes(nq));
  const urgent = shown.filter((i) => ['today', 'soon'].includes(expiryStatus(i.expiry, warnDays)));
  const fit = shown.filter((i) => !urgent.includes(i) && fitsSlot(i, slot));
  const rest = shown.filter((i) => !urgent.includes(i) && !fit.includes(i));

  const add = (list) => {
    actions.setMealSlot(date, slot, [...entries, ...list]);
    play('add');
  };
  const addItem = (item) => {
    if (inSlot.has(item.id)) return;
    play('open');
    setPortionFor(item);
  };
  const addFree = () => {
    const name = q.trim();
    if (!name) return;
    add([{ id: newId(), item: null, name: name.charAt(0).toUpperCase() + name.slice(1), icon: '1f37d' }]);
    setQ('');
  };
  const surprise = () => {
    const exclude = new Set([...inSlot, ...plannedIds]);
    const pick = (filter) => {
      const it = weightedPick(edible.filter(filter), warnDays, exclude);
      if (it) exclude.add(it.id);
      return it;
    };
    let picks;
    if (slot === 'pranzo' || slot === 'cena') {
      picks = [pick((i) => ['prot', 'pronto'].includes(roleOf(i))), pick((i) => roleOf(i) === 'veg'), pick((i) => roleOf(i) === 'carb')];
    } else if (slot === 'colazione') {
      picks = [pick((i) => fitsSlot(i, 'colazione')), pick((i) => fitsSlot(i, 'colazione'))];
    } else {
      picks = [pick((i) => fitsSlot(i, 'snack'))];
    }
    picks = picks.filter(Boolean);
    if (!picks.length) {
      play('error');
      toast('Non trovo niente di adatto in dispensa per questo pasto.', { err: true });
      return;
    }
    play('roll');
    add(picks.map((i) => entryFrom(i)));
  };

  const Row = ({ item }) => {
    const st = expiryStatus(item.expiry, warnDays);
    const late = item.expiry && item.expiry < date;
    const taken = inSlot.has(item.id);
    return (
      <button type="button" className={`win flat mini ${st === 'soon' || st === 'today' ? 'warn' : ''} ${taken ? 'taken' : ''}`} onClick={() => addItem(item)} disabled={taken}>
        <Icon id={item.icon} size={30} />
        <span className="grow">
          <span className="nm">{item.name}</span>
          <span className="q">
            {qtyLabel(item)} · {late ? <b className="late-txt">scade prima!</b> : expiryLabel(item.expiry, item.est)}
            {!taken && plannedIds.has(item.id) ? ' · già in programma' : ''}
          </span>
        </span>
        {taken ? <Icon id="2705" size={20} /> : <span className="plus-sign">+</span>}
      </button>
    );
  };
  const Group = ({ title, list }) =>
    list.length ? (
      <>
        <h3 className="label" style={{ margin: '14px 0 8px' }}>{title}</h3>
        <div className="two">
          {list.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </div>
      </>
    ) : null;

  if (portionFor) {
    return (
      <PortionSheet
        item={portionFor}
        title={`${slotInfo.name} · ${dayTitle(date)}`}
        reserved={reservedFor(state.meals || {}, portionFor.id, todayISO())}
        onBack={() => setPortionFor(null)}
        onAdd={(portion) => {
          add([entryFrom(portionFor, portion)]);
          setPortionFor(null);
        }}
      />
    );
  }

  return (
    <Sheet title={`${slotInfo.name} · ${dayTitle(date)}`} onClose={onClose}>
      {entries.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {entries.map((e) => (
            <button key={e.id} type="button" className="chip on chip-x" onClick={() => onRemove(e.id)} aria-label={`Togli ${e.name}`}>
              <Icon id={e.icon} size={16} className="inline" /> {e.name}{e.item ? ' · ' + portionLabel(e) : ''} ✕
            </button>
          ))}
        </div>
      )}
      <form className="row" onSubmit={(e) => (e.preventDefault(), addFree())}>
        <input className="input grow" type="search" placeholder="Cerca in dispensa o scrivi un piatto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca o scrivi" />
      </form>
      <div className="two" style={{ marginTop: 8 }}>
        <Btn color="purple" icon="1f3b2" sound={null} onClick={surprise}>Sorprendimi</Btn>
        <Btn color="green" icon="2705" onClick={onClose}>Fatto</Btn>
      </div>
      {q.trim() && (
        <Btn block sm icon="2795" sound={null} onClick={addFree}>Aggiungi "{q.trim()}" (non dalla dispensa)</Btn>
      )}
      <Group title="Scadono presto" list={urgent} />
      <Group title={`Adatti a ${slotInfo.name.toLowerCase()}`} list={fit} />
      <Group title="Tutto il resto" list={rest} />
      {!edible.length && <p className="muted center" style={{ marginTop: 16 }}>La dispensa è vuota: puoi comunque scrivere un piatto qui sopra.</p>}
    </Sheet>
  );
}

function PortionSheet({ item, title, reserved, onBack, onAdd, initial }) {
  const total = Number(item.qty) || 0;
  const free = Math.max(0, total - (reserved === Infinity ? total : reserved));
  const [p, setP] = useState(initial || { qty: defaultPortion(item, roleOf(item)), unit: item.unit, all: false });
  const n = Number(String(p.qty).replace(',', '.')) || 0;
  const presets = (PORTIONS[item.unit] || PORTIONS.pz).filter((v) => v < total);
  const ok = p.all || n > 0;
  return (
    <Sheet title={title} onClose={onBack}>
      <form className="stack" onSubmit={(e) => (e.preventDefault(), ok && onAdd({ ...p, qty: p.all ? total : n }))}>
        <div className="qty-head">
          <Icon id={item.icon} size={50} />
          <div>
            <p className="nm">{item.name}</p>
            <p className="small muted">
              In dispensa: {qtyLabel(item)}
              {reserved > 0 && reserved !== Infinity ? ` · libero: ${qtyLabel({ qty: Math.round(free * 1000) / 1000, unit: item.unit })}` : ''}
              {reserved === Infinity ? ' · già messo tutto in un altro pasto' : ''}
            </p>
          </div>
        </div>
        <h3 className="label">Quanto ne usi per questo pasto?</h3>
        <QtyPicker
          qty={p.qty}
          unit={item.unit}
          presets={presets}
          all={p.all}
          allLabel={`Tutto (${qtyLabel(item)})`}
          onAll={() => setP({ ...p, all: true })}
          onChange={({ qty }) => setP({ qty, unit: item.unit, all: false })}
        />
        {!p.all && n > free && free < total && <p className="small late-txt">Attenzione: con gli altri pasti già programmati non ne hai abbastanza.</p>}
        {!p.all && n > total && <p className="small late-txt">In dispensa ne hai solo {qtyLabel(item)}.</p>}
        <div className="two">
          <Btn onClick={onBack}>Indietro</Btn>
          <Btn type="submit" color="green" icon="2795" sound={null} disabled={!ok}>Aggiungi</Btn>
        </div>
      </form>
    </Sheet>
  );
}

function EntrySheet({ date, slot, entry, item, onClose, onRemove }) {
  const { state, toast } = useApp();
  const [editing, setEditing] = useState(false);
  const slotInfo = SLOTS.find((s) => s.id === slot);
  const list = state.meals[date]?.[slot] || [];
  const patchEntry = (patch) => actions.setMealSlot(date, slot, list.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)));
  const setDone = (done) => patchEntry({ done });
  // porzione: vecchie voci senza quantità valgono "tutto"
  const portion = entry.qty ? Number(entry.qty) : null;
  const usesAll = item && (entry.all || !portion || portion >= Number(item.qty));

  const eat = () => {
    play('eat');
    setDone(true);
    onClose();
    if (!item) {
      toast(`${entry.name}: mangiato!`, { action: { label: 'Annulla', fn: () => setDone(false) } });
      return;
    }
    const snapshot = { ...item };
    if (usesAll) {
      actions.removeItem(item.id);
      toast(`${entry.name}: mangiato e finito.`, { action: { label: 'Annulla', fn: () => (actions.addItems([snapshot]), setDone(false)) } });
    } else {
      const left = Math.round((Number(item.qty) - portion) * 1000) / 1000;
      actions.updateItem(item.id, { qty: left });
      toast(`${entry.name}: mangiato, ne restano ${qtyLabel({ qty: left, unit: item.unit })}.`, {
        action: { label: 'Annulla', fn: () => (actions.updateItem(item.id, { qty: snapshot.qty }), setDone(false)) },
      });
    }
  };

  if (editing && item) {
    return (
      <PortionSheet
        item={item}
        title={`${slotInfo.name} · ${dayTitle(date)}`}
        reserved={reservedFor(state.meals || {}, item.id, todayISO(), entry.id)}
        initial={{ qty: portion || defaultPortion(item, roleOf(item)), unit: item.unit, all: !!entry.all }}
        onBack={() => setEditing(false)}
        onAdd={(p) => {
          const all = p.all || Number(p.qty) >= Number(item.qty);
          patchEntry({ qty: all ? Number(item.qty) : Number(p.qty), unit: item.unit, all });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Sheet title={`${slotInfo.name} · ${dayTitle(date)}`} onClose={onClose}>
      <div className="stack">
        <div className="qty-head">
          <Icon id={entry.icon} size={50} />
          <div className="grow">
            <p className="nm">{entry.name}{entry.item && (entry.qty || entry.all) ? ` · ${portionLabel(entry)}` : ''}</p>
            <p className="small muted">
              {item ? `In dispensa: ${qtyLabel(item)} · ${expiryLabel(item.expiry, item.est)}` : entry.item ? 'Non è più in dispensa.' : 'Piatto scritto a mano, non dalla dispensa.'}
            </p>
          </div>
        </div>
        {entry.done ? (
          <>
            <p className="win flat small" style={{ background: '#d8f5c8' }}>Segnato come mangiato.</p>
            <Btn block onClick={() => (setDone(false), onClose())}>Non l'ho ancora mangiato</Btn>
          </>
        ) : (
          <>
            <Btn color="yellow" block icon="1f60b" sound={null} onClick={eat}>
              {item ? (usesAll ? 'Mangiato: lo tolgo dalla dispensa' : `Mangiato: tolgo ${portionLabel({ qty: portion, unit: item.unit })} dalla dispensa`) : 'Mangiato'}
            </Btn>
            {item && <Btn block icon="270f" onClick={() => setEditing(true)}>Cambia la quantità</Btn>}
          </>
        )}
        <Btn color="red" block icon="274c" onClick={onRemove}>Togli da questo pasto</Btn>
      </div>
    </Sheet>
  );
}
