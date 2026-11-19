// Ricette dal web, come il Feed di Mela: incolli il link di una ricetta, oppure segui dei siti
// e scegli tra le loro ultime ricette. La ricetta viene salvata insieme a quelle di Mela.
import { useEffect, useMemo, useState } from 'react';
import { actions } from '../lib/store.js';
import { fromWeb, webId } from '../lib/mela.js';
import { recipeFromPage } from '../lib/gemini.js';
import { play } from '../lib/sound.js';
import { Btn, Icon, Sheet, useApp } from '../components/ui.jsx';

// siti con feed (blog WordPress): si aggiungono con un tocco
const SUGGESTED = [
  { name: 'Fatto in casa da Benedetta', url: 'https://www.fattoincasadabenedetta.it/' },
  { name: 'Misya', url: 'https://www.misya.info/' },
  { name: 'Just One Cookbook (Giappone)', url: 'https://www.justonecookbook.com/' },
  { name: 'The Woks of Life (Cina)', url: 'https://thewoksoflife.com/' },
  { name: 'Maangchi (Corea)', url: 'https://www.maangchi.com/' },
];

const api = async (params) => {
  const r = await fetch('/api/ricetta?' + new URLSearchParams(params));
  let j = null;
  try {
    j = await r.json();
  } catch {
    throw new Error(r.status === 404 ? 'Questa funzione va solo sull\'app pubblicata su Vercel.' : 'Risposta non valida dal server.');
  }
  if (!r.ok) throw new Error(j?.error || `Errore ${r.status}`);
  return j;
};
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const idOfSite = (u) => hostOf(u).replace(/[^a-z0-9]+/g, '-');
const fixUrl = (s) => {
  const t = String(s || '').trim().match(/https?:\/\/\S+/i)?.[0] || String(s || '').trim();
  return /^https?:\/\//i.test(t) ? t : t ? 'https://' + t : '';
};
const ago = (iso) => {
  if (!iso) return '';
  const d = Math.round((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? 'oggi' : d === 1 ? 'ieri' : d < 30 ? `${d} giorni fa` : new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

// legge la ricetta: dati della pagina, altrimenti Gemini sul testo della pagina
async function readRecipe(url, geminiKey) {
  const d = await api({ url });
  if (!d.noSchema) return d;
  if (!geminiKey) throw new Error('Questo sito non pubblica la ricetta in un formato che so leggere. Con la chiave di Gemini (Opzioni) posso estrarla dal testo della pagina.');
  const g = await recipeFromPage(geminiKey, d.pageText, d.link);
  if (!g) throw new Error('In questa pagina non trovo una ricetta.');
  let imageData = '';
  if (d.image) imageData = (await api({ img: d.image }).catch(() => ({}))).imageData || '';
  return { ...g, title: g.title || d.title, link: d.link, site: d.site, image: d.image, imageData };
}

export default function WebRecipes({ onClose, onSaved }) {
  const { state, toast } = useApp();
  const me = state.user?.name || '';
  const geminiKey = state.pantry?.geminiKey || '';
  const feeds = Object.entries(state.feeds || {}).filter(([, f]) => f);
  const [tab, setTab] = useState(feeds.length ? 'feed' : 'link');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [prev, setPrev] = useState(null); // ricetta letta, da salvare
  const have = useMemo(() => new Set((state.recipes || []).map((r) => r.id)), [state.recipes]);

  const read = async (link) => {
    const u = fixUrl(link);
    if (!u) return;
    setBusy('Leggo la ricetta...');
    setPrev(null);
    try {
      setPrev(await readRecipe(u, geminiKey));
    } catch (e) {
      play('error');
      toast(e.message || 'Non riesco a leggere la pagina.', { err: true });
    } finally {
      setBusy('');
    }
  };

  const save = async (d) => {
    setBusy('Salvo...');
    try {
      const r = await fromWeb(d, me);
      if (!r || !r.ingredients.length) throw new Error('La ricetta non ha ingredienti: non la salvo.');
      await actions.recipesPut([r]);
      play('add');
      toast(`${r.title}: salvata nelle ricette.`);
      setPrev(null);
      setUrl('');
      onSaved?.(r.id);
    } catch (e) {
      play('error');
      toast(e.message || 'Non riesco a salvarla.', { err: true });
    } finally {
      setBusy('');
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setUrl(t.trim());
        read(t);
      }
    } catch {
      toast('Non posso leggere gli appunti: incolla il link nella casella.', { err: true });
    }
  };

  return (
    <Sheet title="Ricette dal web" onClose={onClose}>
      <div className="seg" role="tablist" style={{ marginBottom: 10 }}>
        <button type="button" role="tab" aria-selected={tab === 'link'} className={tab === 'link' ? 'on' : ''} onClick={() => setTab('link')}>
          Da un link
        </button>
        <button type="button" role="tab" aria-selected={tab === 'feed'} className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>
          Feed {feeds.length ? `(${feeds.length})` : ''}
        </button>
      </div>

      {prev ? (
        <Preview d={prev} known={have.has(webId(prev.link))} busy={busy} onSave={() => save(prev)} onBack={() => setPrev(null)} />
      ) : tab === 'link' ? (
        <div className="stack">
          <p className="small">Incolla il link di una ricetta (GialloZafferano, un blog, un sito straniero...): leggo ingredienti, procedimento, porzioni, tempi e foto.</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              read(url);
            }}
          >
            <input className="input grow" type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link della ricetta" />
            <Btn sm color="yellow" type="submit" disabled={!url.trim() || !!busy}>Leggi</Btn>
          </form>
          {navigator.clipboard?.readText && (
            <Btn block onClick={paste} disabled={!!busy}>
              📋 Incolla il link copiato
            </Btn>
          )}
          {busy && <p className="small center blink">{busy}</p>}
          <p className="small muted">Dal telefono: nel browser tocca Condividi → Copia link, poi torna qui.</p>
        </div>
      ) : (
        <Feeds feeds={feeds} have={have} busy={busy} onOpen={read} onSaveLink={async (link) => {
          setBusy('Leggo la ricetta...');
          try {
            await save(await readRecipe(link, geminiKey));
          } catch (e) {
            play('error');
            toast(e.message || 'Non riesco a leggere la pagina.', { err: true });
            setBusy('');
          }
        }} />
      )}
    </Sheet>
  );
}

function Preview({ d, known, busy, onSave, onBack }) {
  return (
    <div className="stack">
      {d.imageData ? <img src={d.imageData} alt="" className="recipe-hero" /> : null}
      <b>{d.title}</b>
      <p className="small muted">{[d.site, d.yield, d.prepTime && `prep. ${d.prepTime}`, d.cookTime && `cottura ${d.cookTime}`].filter(Boolean).join(' · ')}</p>
      <div className="win flat stack" style={{ padding: 10 }}>
        <b className="small">Ingredienti ({d.ingredients.length})</b>
        <ul className="small web-ing">
          {d.ingredients.slice(0, 40).map((l, i) => (/^#/.test(l) ? <li key={i} className="hdr">{l.replace(/^#+\s*/, '')}</li> : <li key={i}>{l}</li>))}
        </ul>
        {d.instructions && <p className="small muted">Procedimento: {d.instructions.split('\n').filter((x) => !/^#/.test(x)).length} passi</p>}
      </div>
      <Btn color="yellow" block icon="2b50" onClick={onSave} disabled={!!busy || !d.ingredients.length}>
        {busy || (known ? 'Aggiorna la ricetta salvata' : 'Salva nelle mie ricette')}
      </Btn>
      <Btn block onClick={onBack} disabled={!!busy}>Indietro</Btn>
    </div>
  );
}

function Feeds({ feeds, have, busy, onOpen, onSaveLink }) {
  const { toast } = useApp();
  const [site, setSite] = useState('');
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(!feeds.length);
  const [items, setItems] = useState(null); // [{ title, link, img, date, site, siteId }]
  const [errs, setErrs] = useState([]);
  const [only, setOnly] = useState('');
  const key = feeds.map(([id]) => id).join(',');

  const load = async () => {
    if (!feeds.length) return setItems([]);
    setItems(null);
    const res = await Promise.all(
      feeds.map(([id, f]) =>
        api({ feed: f.url })
          .then((j) => j.items.map((it) => ({ ...it, site: f.title, siteId: id })))
          .catch((e) => ({ err: `${f.title}: ${e.message}` }))
      )
    );
    setErrs(res.filter((r) => r.err).map((r) => r.err));
    setItems(res.filter((r) => Array.isArray(r)).flat().sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  };
  useEffect(() => {
    load();
  }, [key]);

  const add = async (raw) => {
    const u = fixUrl(raw);
    if (!u) return;
    setAdding(true);
    try {
      const j = await api({ feed: u });
      const id = idOfSite(j.feed) || idOfSite(u);
      await actions.feedSet(id, { url: j.feed, title: String(j.title || hostOf(u)).slice(0, 60), addedAt: Date.now() });
      play('add');
      toast(`${j.title}: aggiunto (${j.items.length} ricette recenti).`);
      setSite('');
      setManage(false);
    } catch (e) {
      play('error');
      toast(e.message || 'Non trovo il feed di questo sito.', { err: true });
    } finally {
      setAdding(false);
    }
  };

  const shown = (items || []).filter((it) => !only || it.siteId === only);
  const followed = new Set(feeds.map(([, f]) => hostOf(f.url)));

  return (
    <div className="stack">
      {feeds.length > 0 && (
        <div className="chips">
          <button type="button" className={'chip ' + (!only ? 'on' : '')} onClick={() => setOnly('')}>Tutti</button>
          {feeds.map(([id, f]) => (
            <button key={id} type="button" className={'chip ' + (only === id ? 'on' : '')} onClick={() => setOnly(only === id ? '' : id)}>
              {f.title}
            </button>
          ))}
          <button type="button" className={'chip ' + (manage ? 'on' : '')} onClick={() => setManage(!manage)}>⚙ Siti</button>
        </div>
      )}

      {manage && (
        <div className="win flat stack" style={{ padding: 10 }}>
          <b className="small">Segui un sito di ricette</b>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              add(site);
            }}
          >
            <input className="input grow" type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Indirizzo del sito o del feed" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Indirizzo del sito" />
            <Btn sm color="yellow" type="submit" disabled={!site.trim() || adding}>{adding ? '...' : 'Aggiungi'}</Btn>
          </form>
          <div className="chips">
            {SUGGESTED.filter((s) => !followed.has(hostOf(s.url))).map((s) => (
              <button key={s.url} type="button" className="chip" disabled={adding} onClick={() => add(s.url)}>
                + {s.name}
              </button>
            ))}
          </div>
          {feeds.map(([id, f]) => (
            <div key={id} className="row store-row">
              <span className="grow small">
                <b>{f.title}</b>
                <br />
                <span className="muted">{hostOf(f.url)}</span>
              </span>
              <Btn sm aria-label={`Smetti di seguire ${f.title}`} onClick={() => actions.feedSet(id, null)}>
                ✕
              </Btn>
            </div>
          ))}
          <p className="small muted">Funziona con i siti che hanno un feed (quasi tutti i blog). Se un sito non ce l'ha, usa “Da un link”.</p>
        </div>
      )}

      {feeds.length > 0 && items === null && <p className="small center blink">Carico le ultime ricette...</p>}
      {errs.map((e) => (
        <p key={e} className="small muted">⚠ {e}</p>
      ))}
      {busy && <p className="small center blink">{busy}</p>}
      {shown.length > 0 && (
        <div className="feed-list">
          {shown.slice(0, 60).map((it) => {
            const saved = have.has(webId(it.link));
            return (
              <div key={it.link} className="win flat feed-card">
                <button type="button" className="feed-open" onClick={() => onOpen(it.link)}>
                  {it.img ? <img src={it.img} alt="" loading="lazy" referrerPolicy="no-referrer" className="feed-img" /> : <span className="feed-img ph" aria-hidden="true" />}
                  <span className="grow">
                    <span className="nm">{it.title}</span>
                    <span className="q">{[it.site, ago(it.date)].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                {saved ? (
                  <span className="feed-saved" aria-label="Già salvata">✓</span>
                ) : (
                  <Btn sm aria-label={`Salva ${it.title}`} disabled={!!busy} onClick={() => onSaveLink(it.link)}>
                    <Icon id="2795" size={16} />
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      )}
      {feeds.length > 0 && items && !shown.length && !errs.length && <p className="small muted center">Nessuna ricetta recente.</p>}
      {feeds.length > 0 && items && <Btn block onClick={load}>Aggiorna</Btn>}
    </div>
  );
}
