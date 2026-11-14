import { useState } from 'react';
import { actions, cloudEnabled, friendlyError, prettyCode } from '../lib/store.js';
import { forgetModel, GeminiError, testKey } from '../lib/gemini.js';
import { fillNutrition } from '../lib/nutrition.js';
import { CIQUAL } from '../ciqual-data.js';
import { play, setSound, soundOn } from '../lib/sound.js';
import { Btn, Icon, SectionTitle, useApp } from '../components/ui.jsx';

export default function Settings() {
  const { state, toast, warnDays, setWarnDays } = useApp();
  const pantry = state.pantry || {};
  const [key, setKey] = useState(pantry.geminiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sound, setSnd] = useState(soundOn());
  const [pname, setPname] = useState(pantry.name || '');
  const [sureLeave, setSureLeave] = useState(false);
  const [classifying, setClassifying] = useState(false);
  // senza valori, oppure con una stima di Gemini ma con codice/marca per cercare l'etichetta vera
  const missing = state.items.filter((i) => !i.nutr || (i.nutrSrc !== 'etichetta' && i.nutrSrc !== 'tabella' && CIQUAL[i.food]) || (i.nutrSrc !== 'etichetta' && (i.code || i.brand) && !i.labelTried));
  const [step, setStep] = useState('');
  const [usda, setUsda] = useState(pantry.usdaKey || '');

  const classify = async () => {
    setClassifying(true);
    try {
      const { list, stats } = await fillNutrition(missing, pantry.geminiKey, { onStep: setStep, maxName: 25, usdaKey: pantry.usdaKey });
      list.forEach((x, k) => {
        const before = missing[k];
        const patch = { labelTried: true };
        if (x.nutr && (x.nutrSrc !== before.nutrSrc || JSON.stringify(x.nutr) !== JSON.stringify(before.nutr))) Object.assign(patch, { nutr: x.nutr, nutrSrc: x.nutrSrc });
        if (x.macro !== undefined && x.macro !== before.macro) patch.macro = x.macro ?? null;
        actions.updateItem(x.id, patch);
      });
      play('add');
      toast(`Fatto: ${stats.etichetta} dall'etichetta, ${stats.tabella} dalla tabella ufficiale, ${stats.gemini} stimati da Gemini.`);
    } catch (e) {
      play('error');
      toast(e instanceof GeminiError ? e.message : friendlyError(e), { err: true });
    } finally {
      setClassifying(false);
      setStep('');
    }
  };

  const code = prettyCode(pantry.id);
  const members = Object.values(pantry.memberNames || {});

  const saveKey = async (andTest) => {
    const k = key.trim();
    try {
      await actions.setGeminiKey(k);
      forgetModel();
      if (!k) return toast('Chiave Gemini tolta.');
      if (!andTest) return toast('Chiave Gemini salvata.');
      setTesting(true);
      const model = await testKey(k);
      play('add');
      toast(`Gemini funziona! (modello: ${model})`);
    } catch (e) {
      play('error');
      toast(e instanceof GeminiError ? e.message : friendlyError(e), { err: true });
    } finally {
      setTesting(false);
    }
  };

  const share = async () => {
    const text = `Entra nella nostra dispensa su Dimmispensa: apri ${location.origin}, crea il tuo account e inserisci il codice ${code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(code);
        toast('Codice copiato!');
      }
    } catch {}
  };

  return (
    <>
      <SectionTitle icon="1f3e0">Dispensa</SectionTitle>
      {cloudEnabled ? (
        <div className="win stack">
          <label className="field">
            <span>Nome della dispensa</span>
            <div className="row">
              <input className="input grow" value={pname} onChange={(e) => setPname(e.target.value)} maxLength={30} />
              <Btn sm disabled={!pname.trim() || pname.trim() === pantry.name} onClick={() => actions.renamePantry(pname).then(() => toast('Nome cambiato.')).catch((e) => toast(friendlyError(e), { err: true }))}>Salva</Btn>
            </div>
          </label>
          <div className="field">
            <span>Codice per invitare famiglia o coinquilini</span>
            <div className="code">{code}</div>
            <Btn color="yellow" block icon="1f517" onClick={share}>Condividi il codice</Btn>
            <p className="small muted">Chi lo riceve crea il suo account e sceglie "Entra con un codice". Vedrete e modificherete lo stesso cibo.</p>
          </div>
          <p>
            <Icon id="1f465" size={20} className="inline" /> In questa dispensa: <b>{members.join(', ') || 'solo tu'}</b>
          </p>
        </div>
      ) : (
        <div className="win stack">
          <p><b>Modalità solo questo dispositivo.</b> Il cibo è salvato in questo browser e non si sincronizza.</p>
          <p className="small">Per averlo su tutti i dispositivi e condividerlo, collega Firebase: i passi sono nel file <b>GUIDA.md</b> del progetto (10 minuti, gratis). Il cibo già inserito qui potrai importarlo.</p>
        </div>
      )}

      <SectionTitle icon="2728">Gemini (aiutante)</SectionTitle>
      <div className="win stack">
        <p className="small">Serve per capire le frasi dettate e leggere gli scontrini. La chiave è gratuita: creala su{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>, copiala e incollala qui.
          {cloudEnabled ? ' Vale per tutta la dispensa, su ogni dispositivo.' : ''}
        </p>
        <label className="field">
          <span>Chiave Gemini</span>
          <div className="row">
            <input className="input grow" type={showKey ? 'text' : 'password'} autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Incolla qui la chiave" />
            <Btn sm onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Nascondi la chiave' : 'Mostra la chiave'}>{showKey ? 'Nascondi' : 'Mostra'}</Btn>
          </div>
        </label>
        <div className="two">
          <Btn color="green" disabled={testing || key.trim() === (pantry.geminiKey || '')} onClick={() => saveKey(false)}>Salva</Btn>
          <Btn color="blue" disabled={testing || !key.trim()} onClick={() => saveKey(true)}>{testing ? 'Provo...' : 'Salva e prova'}</Btn>
        </div>
        {pantry.geminiKey && (
          <div className="stack" style={{ gap: 6 }}>
            <p className="small">
              <b>Valori nutrizionali.</b> Prima l'etichetta vera (Open Food Facts, dando la precedenza ai prodotti venduti in Italia; USDA solo per i prodotti americani), poi i valori medi della tabella ufficiale Ciqual per i cibi sfusi; solo se manca tutto chiedo una stima a Gemini. Da controllare: {missing.length}.
            </p>
            <Btn block icon="2728" disabled={classifying || !missing.length} onClick={classify}>
              {classifying ? step || 'Cerco...' : missing.length ? `Completa i valori di ${missing.length} ${missing.length === 1 ? 'cibo' : 'cibi'}` : 'Tutti i cibi hanno i valori'}
            </Btn>
          </div>
        )}
      </div>

      <SectionTitle icon="1f50d">Etichette (USDA)</SectionTitle>
      <div className="win stack">
        <p className="small">
          Solo per i prodotti americani (codici a barre USA/Canada) cerco anche nella banca dati ufficiale USDA. Funziona già senza chiave, ma con poche ricerche l'ora: con una chiave gratuita arrivi a 1000 l'ora. Creala su{' '}
          <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">fdc.nal.usda.gov/api-key-signup</a> (ti arriva per email) e incollala qui.
        </p>
        <div className="row">
          <input className="input grow" type="password" autoComplete="off" value={usda} onChange={(e) => setUsda(e.target.value)} placeholder="Chiave USDA (facoltativa)" aria-label="Chiave USDA" />
          <Btn sm color="green" disabled={usda.trim() === (pantry.usdaKey || '')} onClick={() => actions.setUsdaKey(usda.trim()).then(() => toast(usda.trim() ? 'Chiave USDA salvata.' : 'Chiave USDA tolta.')).catch((e) => toast(friendlyError(e), { err: true }))}>Salva</Btn>
        </div>
      </div>

      <SectionTitle icon="23f0">Avvisi</SectionTitle>
      <div className="win stack">
        <div className="field">
          <span>Avvisami quando mancano</span>
          <div className="row">
            <div className="stepper">
              <Btn sm aria-label="Meno giorni" onClick={() => setWarnDays(Math.max(1, warnDays - 1))}>−</Btn>
              <span className="val">{warnDays} {warnDays === 1 ? 'giorno' : 'giorni'}</span>
              <Btn sm aria-label="Più giorni" onClick={() => setWarnDays(Math.min(14, warnDays + 1))}>+</Btn>
            </div>
          </div>
          <p className="small muted">I cibi entro questo limite diventano gialli e compaiono nel numerino rosso in basso.</p>
        </div>
        <Btn
          block
          icon={sound ? '1f50a' : '1f507'}
          sound={null}
          aria-pressed={sound}
          onClick={() => {
            setSound(!sound);
            setSnd(!sound);
            if (!sound) play('add');
          }}
        >
          Suoni: {sound ? 'accesi' : 'spenti'}
        </Btn>
      </div>

      {cloudEnabled && state.user && (
        <>
          <SectionTitle icon="1f511">Account</SectionTitle>
          <div className="win stack">
            <p>
              <b>{state.user.name}</b>
              <br />
              <span className="small muted">{state.user.email}</span>
            </p>
            <Btn block icon="1f6aa" onClick={() => actions.signOut()}>Esci dall'account</Btn>
            {sureLeave ? (
              <div className="two">
                <Btn color="red" onClick={() => actions.leavePantry().catch((e) => toast(friendlyError(e), { err: true }))}>Sì, esco</Btn>
                <Btn onClick={() => setSureLeave(false)}>Annulla</Btn>
              </div>
            ) : (
              <Btn block sm onClick={() => setSureLeave(true)}>Lascia questa dispensa (per entrare in un'altra)</Btn>
            )}
          </div>
        </>
      )}

      <p className="small muted center" style={{ marginTop: 22 }}>
        Dimmispensa {__APP_VERSION__}
        <br />
        Icone pixel: emoji di SerenityOS (licenza BSD 2-Clause) più altre disegnate per quest'app.
        <br />
        Codici a barre: Open Food Facts.
      </p>
    </>
  );
}
