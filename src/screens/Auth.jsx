import { useState } from 'react';
import { actions, friendlyError, localItemsCount } from '../lib/store.js';
import { play } from '../lib/sound.js';
import { Btn, Mascot } from '../components/ui.jsx';

export function Login({ error }) {
  const [mode, setMode] = useState('entra');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(error ? { err: true, text: error } : null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'crea') {
        if (!name.trim()) throw { message: 'Scrivi il tuo nome.' };
        await actions.signUp(name, email, pw);
      } else {
        await actions.signIn(email, pw);
      }
      play('add');
    } catch (err) {
      play('error');
      setMsg({ err: true, text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMsg({ err: true, text: 'Scrivi la tua email qui sopra, poi premi di nuovo.' });
    try {
      await actions.resetPassword(email);
      setMsg({ text: 'Ti ho mandato una email per scegliere una nuova password.' });
    } catch (err) {
      setMsg({ err: true, text: friendlyError(err) });
    }
  };

  return (
    <div className="splash">
      <Mascot mood="happy" size={84} />
      <h1 className="big">DIMMI<br />SPENSA</h1>
      <p className="center">Il tuo frigo e la tua dispensa, sempre in tasca.</p>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'entra'} className={mode === 'entra' ? 'on' : ''} onClick={() => setMode('entra')}>Entra</button>
        <button type="button" role="tab" aria-selected={mode === 'crea'} className={mode === 'crea' ? 'on' : ''} onClick={() => setMode('crea')}>Crea account</button>
      </div>
      <form className="stack" onSubmit={submit}>
        {mode === 'crea' && (
          <label className="field">
            <span>Il tuo nome</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={24} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password{mode === 'crea' ? ' (almeno 6 caratteri)' : ''}</span>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'crea' ? 'new-password' : 'current-password'} required minLength={6} />
        </label>
        {msg && <p className="win flat small" role="alert" style={{ background: msg.err ? '#ffd9d4' : '#d8f5c8' }}>{msg.text}</p>}
        <Btn type="submit" color="green" block sound={null} disabled={busy}>{busy ? 'Un attimo...' : mode === 'crea' ? 'Crea account' : 'Entra'}</Btn>
        {mode === 'entra' && <Btn sm block onClick={reset}>Ho dimenticato la password</Btn>}
      </form>
    </div>
  );
}

export function PantryChoice({ user, error }) {
  const [name, setName] = useState('Casa');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(error || '');
  const nLocal = localItemsCount();
  const [importLocal, setImportLocal] = useState(nLocal > 0);

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      play('add');
    } catch (err) {
      play('error');
      setMsg(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="splash">
      <Mascot mood="idle" size={70} />
      <h1 className="title center">Ciao {user?.name}! Quale dispensa usiamo?</h1>
      {msg && <p className="win flat small" role="alert" style={{ background: '#ffd9d4' }}>{msg}</p>}

      <form className="win stack" onSubmit={(e) => (e.preventDefault(), run(() => actions.createPantry(name, importLocal)))}>
        <h2 className="title">Ne creo una nuova</h2>
        <label className="field">
          <span>Come la chiamiamo?</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        </label>
        {nLocal > 0 && (
          <label className="row small">
            <input type="checkbox" checked={importLocal} onChange={(e) => setImportLocal(e.target.checked)} style={{ width: 22, height: 22 }} />
            Porta dentro i {nLocal} cibi già salvati su questo dispositivo
          </label>
        )}
        <Btn type="submit" color="green" block sound={null} disabled={busy}>Crea la dispensa</Btn>
      </form>

      <form className="win stack" onSubmit={(e) => (e.preventDefault(), run(() => actions.joinPantry(code)))}>
        <h2 className="title">Entro con un codice</h2>
        <label className="field">
          <span>Codice ricevuto da chi ha già la dispensa</span>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-1234" autoCapitalize="characters" autoComplete="off" maxLength={12} required />
        </label>
        <Btn type="submit" color="yellow" block sound={null} disabled={busy}>Entra nella dispensa</Btn>
      </form>

      <Btn sm block onClick={() => actions.signOut()}>Esci dall'account</Btn>
    </div>
  );
}
