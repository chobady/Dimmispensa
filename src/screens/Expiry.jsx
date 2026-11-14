import { canFreeze, daysLeft } from '../lib/dates.js';
import { Btn, Icon, ItemCard, SectionTitle, Talk, useApp } from '../components/ui.jsx';
import { byExpiry } from './Pantry.jsx';

const GROUPS = [
  { id: 'scaduti', title: 'Scaduti', icon: '1f480', test: (n) => n < 0 },
  { id: 'oggi', title: 'Scadono oggi', icon: '26a0', test: (n) => n === 0 },
  { id: 'domani', title: 'Domani', icon: '23f0', test: (n) => n === 1 },
  { id: 'settimana', title: 'Entro 7 giorni', icon: '1f4c5', test: (n) => n >= 2 && n <= 7 },
  { id: 'mese', title: 'Entro un mese', icon: '231b', test: (n) => n >= 8 && n <= 30 },
];

export default function Expiry() {
  const { state, openItem, go, goneIds, freezeItem } = useApp();
  const dated = state.items.filter((i) => i.expiry).sort(byExpiry);
  const groups = GROUPS.map((g) => ({ ...g, items: dated.filter((i) => g.test(daysLeft(i.expiry))) })).filter((g) => g.items.length);
  const urgent = dated.filter((i) => daysLeft(i.expiry) <= 1).length;
  const later = dated.filter((i) => daysLeft(i.expiry) > 30).length;
  const none = state.items.length - dated.length;

  let text = 'Nessuna scadenza in vista per il prossimo mese. Rilassati!';
  let mood = 'happy';
  if (urgent) {
    text = `${urgent === 1 ? "C'è un cibo" : 'Ci sono ' + urgent + ' cibi'} da usare subito. Tocca un cibo quando lo finisci.`;
    mood = 'worry';
  } else if (groups.length) {
    text = 'Niente di urgente. Qui sotto vedi cosa scade prima.';
    mood = 'idle';
  } else if (!state.items.length) {
    text = 'Quando aggiungi del cibo, qui ti avviso prima che scada.';
    mood = 'idle';
  }

  return (
    <>
      <Talk text={text} mood={mood} />
      {groups.map((g) => (
        <section key={g.id}>
          <SectionTitle icon={g.icon}>{g.title}</SectionTitle>
          <div className="list">
            {g.items.map((it) => (
              canFreeze(it) ? (
                <div key={it.id} className="freeze-wrap">
                  <ItemCard item={it} onOpen={openItem} gone={goneIds.has(it.id)} />
                  <button type="button" className="freeze-btn" onClick={() => freezeItem(it)} aria-label={`Congela ${it.name}: dura altri 2 mesi`}>
                    <Icon id="2744" size={18} /> Congela (+2 mesi)
                  </button>
                </div>
              ) : (
                <ItemCard key={it.id} item={it} onOpen={openItem} gone={goneIds.has(it.id)} />
              )
            ))}
          </div>
        </section>
      ))}
      {state.items.length > 0 && (
        <p className="small muted center" style={{ marginTop: 20 }}>
          {later > 0 && `${later} ${later === 1 ? 'cibo scade' : 'cibi scadono'} più avanti. `}
          {none > 0 && `${none} senza scadenza.`}
        </p>
      )}
      {!state.items.length && (
        <div className="empty">
          <Icon id="1f4c5" size={60} />
          <p style={{ marginBottom: 12 }}>Ancora nessun cibo da tenere d'occhio.</p>
          <Btn color="green" icon="2795" onClick={() => go('aggiungi')}>Aggiungi cibo</Btn>
        </div>
      )}
    </>
  );
}
