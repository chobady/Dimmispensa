import { useMemo, useState } from 'react';
import { MACRO_NAMES, slices } from '../lib/macros.js';

const fmt = (n) => (n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)).replace('.', ',');

// Torta a pixel: disegnata pixel per pixel su una griglia piccola e ingrandita, come nei giochi
export function PixelPie({ parts, size = 96, res = 24, empty = false }) {
  const src = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = res;
    c.height = res;
    const g = c.getContext('2d');
    const r = res / 2 - 0.5;
    const cx = (res - 1) / 2;
    const tot = parts.reduce((a, b) => a + b.value, 0);
    const bounds = [];
    let acc = 0;
    for (const p of parts) {
      acc += tot ? p.value / tot : 0;
      bounds.push([acc, p.color]);
    }
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const dx = x - cx;
        const dy = y - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 0.35) continue;
        if (d > r - 1.1) {
          g.fillStyle = '#2b2140'; // contorno
        } else if (!tot || empty) {
          g.fillStyle = (x + y) % 2 ? '#dce8b0' : '#eef5d0';
        } else {
          let a = Math.atan2(dx, -dy) / (2 * Math.PI); // da mezzogiorno, in senso orario
          if (a < 0) a += 1;
          g.fillStyle = (bounds.find(([b]) => a <= b + 1e-9) || bounds[bounds.length - 1])[1];
        }
        g.fillRect(x, y, 1, 1);
      }
    }
    return c.toDataURL();
  }, [JSON.stringify(parts), res, empty]);
  return <img className="px pie" src={src} width={size} height={size} alt="" />;
}

// Torta con legenda e interruttore grammi / calorie
export default function MacroPanel({ totals, title, perLabel, compact = false }) {
  const [mode, setMode] = useState('g');
  const parts = slices(totals, mode);
  const has = totals.counted > 0 && parts.some((p) => p.value > 0);
  const label = has ? parts.map((p) => `${MACRO_NAMES[p.key]} ${p.pct}%`).join(', ') : 'nessun dato';
  return (
    <div className={'macro-panel ' + (compact ? 'compact' : '')} role="group" aria-label={`${title || 'Macronutrienti'}: ${label}`}>
      {title && <h3 className="label">{title}</h3>}
      <div className="mp-body">
        <PixelPie parts={parts} size={compact ? 56 : 104} res={compact ? 16 : 24} empty={!has} />
        <div className="mp-legend">
          {parts.map((p) => (
            <div key={p.key} className="mp-row">
              <i style={{ background: p.color }} />
              <span className="mp-name">{MACRO_NAMES[p.key]}</span>
              <b>{has ? `${p.pct}%` : '–'}</b>
              {!compact && <span className="muted">{has ? `${fmt(p.grams)} g` : ''}</span>}
            </div>
          ))}
          <div className="mp-kcal">
            {has ? `${fmt(totals.kcal)} kcal` : ''}
            {perLabel ? <span className="muted"> {perLabel}</span> : null}
          </div>
        </div>
      </div>
      {!compact && has && (
        <div className="seg mp-mode">
          <button type="button" className={mode === 'g' ? 'on' : ''} aria-pressed={mode === 'g'} onClick={() => setMode('g')}>% sul peso</button>
          <button type="button" className={mode === 'kcal' ? 'on' : ''} aria-pressed={mode === 'kcal'} onClick={() => setMode('kcal')}>% sulle calorie</button>
        </div>
      )}
      {totals.missing && totals.missing.length > 0 && (
        <p className="small muted mp-missing">
          Non contati (mancano valori o peso): {totals.missing.join(', ')}.
        </p>
      )}
    </div>
  );
}
