// Accanto alla dispensa: cosa mangiare oggi (Gemini, molte proteine e verdure, pochi zuccheri e grassi)
// e cosa manca in casa (controllo fisso delle cose essenziali, senza Gemini).
import { useEffect, useMemo, useState } from "react";
import { BY_KEY, isCasa } from "../catalog.js";
import { actions } from "../lib/store.js";
import { daysLeft, todayISO } from "../lib/dates.js";
import { newId, qtyLabel } from "../lib/items.js";
import { dayPlan } from "../lib/gemini.js";
import { play } from "../lib/sound.js";
import { Btn, Icon, useApp } from "./ui.jsx";

// Cose che in una casa di solito non mancano. Ognuna è "presente" se c'è almeno un cibo con una di quelle chiavi
// (o di quella categoria). La chiave in "add" è quella che finisce nella lista della spesa.
const ESSENTIALS = [
  { name: "Sale", keys: ["sale"] },
  { name: "Olio", keys: ["olio"] },
  {
    name: "Pepe o spezie",
    keys: ["pepe", "spezie", "erbesecche"],
    add: "pepe",
  },
  { name: "Aceto", keys: ["aceto"] },
  { name: "Aglio", keys: ["aglio"] },
  { name: "Cipolle", keys: ["cipolla"], add: "cipolla" },
  { name: "Frutta", cats: ["frutta"], add: "mela" },
  { name: "Verdura", cats: ["verdura"], add: "insalata" },
  { name: "Uova", keys: ["uova"] },
  {
    name: "Latte o yogurt",
    keys: ["latte", "yogurt", "lattevegetale"],
    add: "latte",
  },
  { name: "Carne o pesce", cats: ["carne", "pesce"], add: "petto" },
  {
    name: "Legumi",
    keys: ["legumi", "ceci", "lenticchie", "fagioli", "piselli", "edamame"],
    add: "legumi",
  },
  { name: "Tonno in scatola", keys: ["tonno"] },
  { name: "Pasta", keys: ["pasta"] },
  { name: "Riso", keys: ["riso"] },
  {
    name: "Pane o cracker",
    keys: ["pane", "cracker", "gallette"],
    add: "pane",
  },
  { name: "Passata o pelati", keys: ["passata", "pelati"], add: "passata" },
  { name: "Farina", keys: ["farina"] },
  { name: "Zucchero", keys: ["zucchero"] },
  { name: "Caffè", keys: ["caffe"] },
  {
    name: "Detersivo piatti",
    keys: ["detersivopiatti", "pastiglielavastoviglie"],
    add: "detersivopiatti",
  },
  { name: "Carta igienica", keys: ["cartaigienica"] },
  { name: "Sapone", keys: ["sapone"] },
  { name: "Detersivo lavatrice", keys: ["detersivolavatrice"] },
];

const LS_PLAN = "dm_dayplan";
const LS_TARGET = "dm_targets";
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
  } catch {}
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
      const per =
        n && (n.p != null || n.c != null)
          ? ` · per 100 g: proteine ${n.p ?? "?"} g, carboidrati ${n.c ?? "?"} g, grassi ${n.f ?? "?"} g`
          : "";
      const when =
        d == null
          ? ""
          : d < 0
            ? " · scaduto"
            : d === 0
              ? " · scade oggi"
              : d <= 7
                ? ` · scade tra ${d} giorni`
                : "";
      return `- ${i.name}${i.brand ? " (" + i.brand + ")" : ""} · ${qtyLabel(i)} · ${i.loc}${when}${per}`;
    })
    .join("\n");
}
const sigOf = (items) =>
  items
    .filter((i) => !isCasa(i))
    .map((i) => i.id + ":" + i.qty)
    .sort()
    .join(",");

export default function DayAdvice() {
  const { state, go, toast } = useApp();
  const items = state.items;
  const key = state.pantry?.geminiKey || "";
  const me = state.user?.name || "";
  const [targets, setTargets] = useState(() =>
    lsGet(LS_TARGET, { protein: 200, veg: 400 }),
  );
  const [saved, setSaved] = useState(() => lsGet(LS_PLAN, null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(false);
  const today = todayISO();
  const plan = saved && saved.date === today ? saved.plan : null;
  const sig = useMemo(() => sigOf(items), [items]);
  const stale = plan && saved.sig !== sig;

  const run = async () => {
    if (!key || busy) return;
    setBusy(true);
    setErr("");
    try {
      const p = await dayPlan(key, pantryText(items), targets);
      const next = { date: today, sig, targets, plan: p };
      lsSet(LS_PLAN, next);
      setSaved(next);
    } catch (e) {
      setErr(e.message || "Gemini non risponde.");
    } finally {
      setBusy(false);
    }
  };
  // una volta al giorno lo preparo da solo (se c'è la chiave e la dispensa non è vuota)
  useEffect(() => {
    if (key && !plan && !busy && !err && items.some((i) => !isCasa(i))) run();
  }, [key, today]);

  // cosa manca: per chiave del catalogo o per categoria
  const have = useMemo(() => {
    const keys = new Set();
    const cats = new Set();
    items.forEach((i) => {
      if (Number(i.qty) === 0) return;
      keys.add(i.food);
      const f = BY_KEY[i.food];
      if (f)
        cats.add(f.cat + (["aglio", "cipolla"].includes(f.key) ? "-base" : ""));
    });
    return { keys, cats };
  }, [items]);
  const inList = (name, food) =>
    Object.values(state.shopping || {}).some(
      (s) =>
        !s.done &&
        ((food && s.food === food) ||
          s.name.toLowerCase() === name.toLowerCase()),
    );
  const missing = ESSENTIALS.filter(
    (e) =>
      !(e.keys || []).some((k) => have.keys.has(k)) &&
      !(e.cats || []).some((c) => have.cats.has(c)),
  );

  const addShop = (name, foodKey) => {
    const f = foodKey ? BY_KEY[foodKey] : null;
    if (inList(name, f?.key)) return toast("È già nella lista della spesa.");
    const id = newId();
    actions.shopSet(id, {
      id,
      name: f && !/ o /.test(name) ? f.name : name,
      qty: null,
      unit: null,
      food: f ? f.key : "altro",
      icon: f ? f.icon : "1f4e6",
      cat: f ? f.cat : "dispensa",
      done: false,
      by: me,
      addedAt: Date.now(),
    });
    play("add");
    toast(`${name}: aggiunto alla spesa.`);
  };

  const setT = (k, v) => {
    const next = {
      ...targets,
      [k]: Math.max(0, Math.min(1000, Number(v) || 0)),
    };
    setTargets(next);
    lsSet(LS_TARGET, next);
  };

  return (
    <aside className="day-advice">
      <section className="win advice-box">
        <div className="advice-head">
          <Icon id="1f37d" size={20} />
          <h2 className="title grow">Oggi da mangiare</h2>
          <button
            type="button"
            className="link-btn small"
            onClick={() => setEdit(!edit)}
          >
            {edit ? "Fatto" : "Obiettivi"}
          </button>
        </div>
        {edit ? (
          <div className="targets">
            <label className="field">
              <span>Proteine (g al giorno)</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={targets.protein}
                onChange={(e) => setT("protein", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Verdure (g al giorno)</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={targets.veg}
                onChange={(e) => setT("veg", e.target.value)}
              />
            </label>
          </div>
        ) : (
          <p className="small muted">
            Obiettivo: {targets.protein} g di proteine e {targets.veg} g di
            verdure, pochi zuccheri e grassi.
          </p>
        )}

        {!key ? (
          <p className="small">
            Per il menu del giorno serve Gemini.{" "}
            <a
              href="#opzioni"
              onClick={(e) => (e.preventDefault(), go("opzioni"))}
            >
              Aggiungi la chiave
            </a>
          </p>
        ) : busy ? (
          <p className="small blink">Gemini sta pensando al menu di oggi...</p>
        ) : err ? (
          <div className="stack">
            <p className="small late-txt">{err}</p>
            <Btn sm onClick={run}>
              Riprova
            </Btn>
          </div>
        ) : plan ? (
          <>
            <ol className="meals-plan">
              {plan.pasti.map((m, i) => (
                <li key={i}>
                  <span className="mp-when">{m.pasto}</span>
                  <span className="mp-dish">{m.piatto}</span>
                  <span className="mp-ingr">{m.ingredienti.join(" · ")}</span>
                </li>
              ))}
            </ol>
            <div className="plan-tot">
              <Meter
                label="Proteine"
                value={plan.proteine_tot}
                target={targets.protein}
              />
              <Meter
                label="Verdure"
                value={plan.verdure_tot}
                target={targets.veg}
              />
            </div>
            {plan.consiglio && <p className="small">{plan.consiglio}</p>}
            {plan.da_comprare?.length > 0 && (
              <div className="chips">
                {plan.da_comprare.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    onClick={() => addShop(n, null)}
                  >
                    + {n}
                  </button>
                ))}
              </div>
            )}
            <div className="row plan-foot">
              <span className="small muted grow">
                {stale
                  ? "La dispensa è cambiata da stamattina."
                  : "Preparato oggi con quello che hai."}
              </span>
              <Btn sm onClick={run}>
                {stale ? "Aggiorna" : "Un altro menu"}
              </Btn>
            </div>
          </>
        ) : (
          <Btn sm onClick={run}>
            Proponi il menu di oggi
          </Btn>
        )}
      </section>

      <section className="win advice-box">
        <div className="advice-head">
          <Icon id="1f6d2" size={20} />
          <h2 className="title grow">Manca in casa</h2>
        </div>
        {missing.length ? (
          <>
            <p className="small muted">
              Le cose di base che non vedo in dispensa. Tocca per metterle nella
              spesa.
            </p>
            <div className="chips">
              {missing.map((e) => {
                const f = BY_KEY[e.add || e.keys?.[0]];
                const listed = inList(e.name, f?.key);
                return (
                  <button
                    key={e.name}
                    type="button"
                    className={"chip " + (listed ? "listed" : "")}
                    disabled={listed}
                    onClick={() => addShop(e.name, f?.key)}
                  >
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
      </section>
    </aside>
  );
}

function Meter({ label, value, target }) {
  const v = Math.round(Number(value) || 0);
  const r = target ? Math.min(1, v / target) : 0;
  return (
    <div className="meter">
      <span className="small">
        {label} <b>{v} g</b> <span className="muted">/ {target}</span>
      </span>
      <span className="have-bar" aria-hidden="true">
        <span
          style={{
            width: Math.round(r * 100) + "%",
            background: r >= 0.9 ? "var(--green)" : "var(--yellow)",
          }}
        />
      </span>
    </div>
  );
}
