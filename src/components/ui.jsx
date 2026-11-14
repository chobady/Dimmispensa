import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICONS, MASCOT } from '../icons-data.js';
import { expiryLabel, expiryStatus, lifeRatio } from '../lib/dates.js';
import { qtyLabel } from '../lib/items.js';
import { BY_KEY, MACROS, macroOf } from '../catalog.js';
import { play } from '../lib/sound.js';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Icon({ id, size = 40, className = '', alt = '' }) {
  return <img className={'px ' + className} src={ICONS[id] || ICONS['1f4e6']} width={size} height={size} alt={alt} draggable={false} />;
}

export function Btn({ color = '', sm, block, icon, iconSize = 20, sound = 'tap', className = '', onClick, children, ...rest }) {
  return (
    <button
      type="button"
      className={['btn', color, sm ? 'sm' : '', block ? 'block' : '', className].join(' ')}
      onClick={(e) => {
        if (sound) play(sound);
        onClick && onClick(e);
      }}
      {...rest}
    >
      {icon && <Icon id={icon} size={iconSize} />}
      {children}
    </button>
  );
}

export function Mascot({ mood = 'idle', size = 56 }) {
  const h = Math.round((size * 16) / 14);
  return (
    <div className="mascot" style={{ width: size, height: h }} aria-hidden="true">
      <img className="px" src={MASCOT[mood] || MASCOT.idle} style={{ width: size, height: h }} alt="" />
      {mood === 'idle' && <img className="px blink" src={MASCOT.blink} style={{ width: size, height: h }} alt="" />}
    </div>
  );
}

// Fumetto con testo che compare lettera per lettera, come nei giochi
export function Talk({ text, mood = 'idle' }) {
  const [n, setN] = useState(0);
  const reduce = useRef(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (reduce.current) {
      setN(text.length);
      return;
    }
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(t), v) : v + 2)), 24);
    return () => clearInterval(t);
  }, [text]);
  return (
    <div className="talk">
      <Mascot mood={mood} />
      <div className="win bubble" aria-live="polite" aria-label={text}>
        <span aria-hidden="true">{text.slice(0, n)}</span>
        {n < text.length && <span className="caret" />}
      </div>
    </div>
  );
}

export function HpBar({ item }) {
  const { warnDays } = useApp();
  const r = lifeRatio(item, warnDays, BY_KEY[item.food]?.days || 0);
  if (r === null) return null;
  const cls = r > 0.5 ? '' : r > 0.2 ? 'mid' : 'low';
  return (
    <div className="hp" aria-hidden="true">
      <span className="lbl">HP</span>
      <div className="bar">
        <div style={{ width: Math.round(r * 100) + '%', height: '100%' }}>
          <div className={'fill ' + cls} />
        </div>
      </div>
    </div>
  );
}

export function ItemCard({ item, onOpen, gone }) {
  const { warnDays } = useApp();
  const st = expiryStatus(item.expiry, warnDays);
  return (
    <button type="button" className={`win card ${st} ${gone ? 'gone' : ''}`} onClick={() => onOpen(item)}>
      <Icon id={item.icon} size={40} />
      <div className="grow">
        <div className="name">{item.name}</div>
        <div className="sub">
          <span className={'loc ' + item.loc}>{item.loc === 'frigo' ? 'FRIGO' : item.loc === 'freezer' ? 'FREEZER' : 'DISP.'}</span>
          <MacroBadge item={item} />
          {qtyLabel(item)}
          {item.brand ? ' · ' + item.brand : ''}
        </div>
      </div>
      <div className="right">
        <div className="when">
          {expiryLabel(item.expiry, item.est)}
        </div>
        <HpBar item={item} />
      </div>
    </button>
  );
}

export function SectionTitle({ children, icon }) {
  return (
    <div className="section-title">
      {icon && <Icon id={icon} size={20} />}
      <h2 className="title">{children}</h2>
      <div className="line" />
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);
  // portal: la finestra va sopra a tutto, anche alla barra in basso
  return createPortal(
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2 className="title">{title}</h2>
          <Btn sm onClick={onClose} aria-label="Chiudi">
            <Icon id="274c" size={20} />
          </Btn>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Loading({ text }) {
  return (
    <div className="loading" role="status">
      <Mascot mood="happy" />
      <div className="dots" aria-hidden="true"><span /><span /><span /></div>
      <p className="center">{text}</p>
    </div>
  );
}

export function MacroBadge({ item, id }) {
  const m = id !== undefined ? id : macroOf(item);
  const info = MACROS.find((x) => x.id === m);
  if (!info) return null;
  return (
    <span className={'macro m-' + info.id} title={info.name} aria-label={info.name}>
      {info.short}
    </span>
  );
}
