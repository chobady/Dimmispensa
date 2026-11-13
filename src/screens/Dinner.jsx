import { useEffect, useRef, useState } from 'react';
import { roleOf } from '../catalog.js';
import { daysLeft, expiryLabel, expiryStatus } from '../lib/dates.js';
import { qtyLabel } from '../lib/items.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, ItemCard, SectionTitle, Talk, useApp } from '../components/ui.jsx';
import { byExpiry } from './Pantry.jsx';

const SLOTS = [
  { role: 'prot', label: 'PROTEINE', empty: '1f95a' },
  { role: 'veg', label: 'VERDURE', empty: '1f966' },
  { role: 'carb', label: 'CARBOIDRATI', empty: '1f35e' },
];
const SECTIONS = [
  { role: 'pronto', title: 'Già pronto', icon: 'avanzi' },
  { role: 'prot', title: 'Proteine', icon: '1f969' },
  { role: 'veg', title: 'Verdure', icon: '1f966' },
  { role: 'carb', title: 'Pane, pasta e simili', icon: '1f35d' },
  { role: 'frutta', title: 'Frutta', icon: '1f34e' },
  { role: 'extra', title: 'Latticini e sfizi', icon: '1f36a' },
];

function weightedPick(list, warnDays) {
  if (!list.length) return null;
  const w = list.map((i) => {
    const n = daysLeft(i.expiry);
    return n === null ? 1 : n <= warnDays ? 6 : n <= 7 ? 3 : 1;
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= w[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

function Mini({ item, onOpen, warnDays }) {
  const st = expiryStatus(item.expiry, warnDays);
  return (
    <button type="button" className={`win flat mini ${st === 'soon' || st === 'today' ? 'warn' : st === 'expired' ? 'bad' : ''}`} onClick={() => onOpen(item)} title={expiryLabel(item.expiry)}>
      <Icon id={item.icon} size={30} />
      <span className="grow">
        <span className="nm">{item.name}</span>
        <span className="q">{qtyLabel(item)}</span>
      </span>
    </button>
  );
}

export default function Dinner() {
  const { state, warnDays, openItem, go, goneIds } = useApp();
  const [picks, setPicks] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [flick, setFlick] = useState([null, null, null]);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);

  const edible = state.items.filter((i) => expiryStatus(i.expiry, warnDays) !== 'expired');
  const expired = state.items.filter((i) => expiryStatus(i.expiry, warnDays) === 'expired');
  const byRole = (role) => edible.filter((i) => roleOf(i) === role).sort(byExpiry);
  const urgent = edible.filter((i) => ['today', 'soon'].includes(expiryStatus(i.expiry, warnDays)) && !['bev', 'cond'].includes(roleOf(i))).sort(byExpiry);
  const other = edible.filter((i) => ['bev', 'cond'].includes(roleOf(i))).length;
  const pools = SLOTS.map((s) => (s.role === 'prot' ? [...byRole('prot'), ...byRole('pronto')] : byRole(s.role)));
  const canRoll = pools.some((p) => p.length);

  const roll = () => {
    if (rolling) return;
    play('roll');
    setRolling(true);
    let ticks = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      ticks++;
      setFlick(pools.map((p) => (p.length ? p[Math.floor(Math.random() * p.length)] : null)));
      if (ticks >= 9) {
        clearInterval(timer.current);
        setPicks(pools.map((p) => weightedPick(p, warnDays)));
        setRolling(false);
        play('add');
      }
    }, 90);
  };

  if (!state.items.length) {
    return (
      <>
        <Talk text="Stasera... non lo so! Non ho ancora niente dentro. Aggiungi il cibo che hai in casa." mood="worry" />
        <Btn color="green" block icon="2795" onClick={() => go('aggiungi')}>Aggiungi cibo</Btn>
      </>
    );
  }

  const text = urgent.length
    ? `Stasera parti da ${urgent.length === 1 ? 'questo, che scade' : 'questi ' + urgent.length + ', che scadono'} presto. Sotto trovi tutto quello che hai.`
    : 'Niente di urgente: stasera scegli quello che ti va. Ecco cosa hai in casa.';
  const shown = rolling ? flick : picks;

  return (
    <>
      <Talk text={text} mood={urgent.length ? 'worry' : 'happy'} />

      {urgent.length > 0 && (
        <section>
          <SectionTitle icon="23f0">Da finire prima</SectionTitle>
          <div className="list">
            {urgent.map((it) => (
              <ItemCard key={it.id} item={it} onOpen={openItem} gone={goneIds.has(it.id)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle icon="1f3b2">Non sai scegliere?</SectionTitle>
        <div className="slots">
          {SLOTS.map((s, i) => {
            const it = shown?.[i];
            return (
              <button
                key={s.role}
                type="button"
                className={`win slot ${rolling ? 'rolling' : it ? 'landed' : ''}`}
                style={{ border: 0, width: 'calc(100% - 8px)' }}
                disabled={!it || rolling}
                onClick={() => it && openItem(it)}
              >
                <span className="role">{s.label}</span>
                <Icon id={it ? it.icon : s.empty} size={50} className={it ? '' : 'ghost'} />
                <span className="nm">{it ? it.name : pools[i].length ? '?' : 'niente'}</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn color="purple" block icon="1f3b2" sound={null} disabled={!canRoll || rolling} onClick={roll}>
            {picks ? 'Tira di nuovo' : 'Tira il dado'}
          </Btn>
        </div>
        <p className="small muted center" style={{ marginTop: 6 }}>Pesca tre cose che hai già, dando la precedenza a quelle che scadono.</p>
      </section>

      {SECTIONS.map((s) => {
        const list = byRole(s.role);
        if (!list.length) return null;
        return (
          <section key={s.role}>
            <SectionTitle icon={s.icon}>{s.title}</SectionTitle>
            <div className="two">
              {list.map((it) => (
                <Mini key={it.id} item={it} onOpen={openItem} warnDays={warnDays} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="small muted center" style={{ marginTop: 20 }}>
        {other > 0 && `In più hai ${other} tra condimenti e bevande. `}
        {expired.length > 0 && `${expired.length === 1 ? 'Un cibo scaduto non è' : expired.length + ' cibi scaduti non sono'} in questa lista.`}
      </p>
    </>
  );
}
