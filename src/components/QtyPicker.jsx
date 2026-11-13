import { stepOf } from '../lib/items.js';
import { Btn } from './ui.jsx';

const fmt = (n, unit) => {
  const s = String(n).replace('.', ',');
  if (unit === 'g' && n >= 1000) return String(n / 1000).replace('.', ',') + ' kg';
  if (unit === 'ml' && n >= 1000) return String(n / 1000).replace('.', ',') + ' l';
  return unit === 'pz' ? s : `${s} ${unit}`;
};

// Scelta veloce di una quantità: tasti con i valori più comuni + "−/+" + campo libero
export default function QtyPicker({ qty, unit, units, presets, onChange, allLabel, all, onAll }) {
  const step = unit === 'g' || unit === 'ml' ? (Number(qty) >= 300 ? 50 : 10) : stepOf(unit) / (unit === 'kg' || unit === 'l' ? 5 : 1);
  const n = Number(String(qty).replace(',', '.')) || 0;
  const setN = (v) => onChange({ qty: Math.max(0, Math.round(v * 1000) / 1000), unit, all: false });
  return (
    <div className="stack" style={{ gap: 10 }}>
      {units && units.length > 1 && (
        <div className="seg">
          {units.map((u) => (
            <button key={u} type="button" className={u === unit ? 'on' : ''} aria-pressed={u === unit} onClick={() => onChange({ qty, unit: u, all: false, unitChanged: true })}>
              {u === 'pz' ? 'pezzi' : u === 'conf' ? 'confezioni' : u}
            </button>
          ))}
        </div>
      )}
      <div className="chips">
        {onAll && (
          <button type="button" className={'chip big ' + (all ? 'on' : '')} onClick={onAll}>
            {allLabel}
          </button>
        )}
        {presets.map((v) => (
          <button key={v} type="button" className={'chip big ' + (!all && n === v ? 'on' : '')} onClick={() => setN(v)}>
            {fmt(v, unit)}
          </button>
        ))}
      </div>
      <div className="stepper">
        <Btn sm aria-label="Meno" onClick={() => setN(Math.max(step, n - step))}>−</Btn>
        <input
          className={'val ' + (all ? 'muted' : '')}
          inputMode="decimal"
          aria-label="Quantità"
          value={all ? '' : qty}
          placeholder={all ? 'tutto' : ''}
          onChange={(e) => onChange({ qty: e.target.value.replace(/[^0-9.,]/g, ''), unit, all: false })}
        />
        <Btn sm aria-label="Più" onClick={() => setN(n + step)}>+</Btn>
        <span className="unit-lbl">{unit === 'pz' ? 'pezzi' : unit === 'conf' ? 'conf.' : unit}</span>
      </div>
    </div>
  );
}

export const unitFamily = (unit) => (['g', 'kg'].includes(unit) ? ['g', 'kg', 'pz'] : ['ml', 'l'].includes(unit) ? ['ml', 'l', 'pz'] : ['pz', 'conf', 'g']);
