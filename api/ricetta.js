// Ricette dai siti, come il Feed di Mela (uso personale). Vercel lo pubblica come /api/ricetta.
//   /api/ricetta?url=https://sito/ricetta     → la ricetta letta dalla pagina (dati schema.org che quasi tutti i siti di cucina pubblicano)
//   /api/ricetta?feed=https://sito            → le ultime ricette pubblicate dal sito (RSS/Atom, trovato anche partendo dalla home)
// Non salva niente: la ricetta la salva l'app, nella tua dispensa.
export const config = { maxDuration: 20 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const MAX = 4 * 1024 * 1024;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', egrave: 'è', eacute: 'é', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—' };
const decode = (s) =>
  String(s || '').replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
const strip = (s) => decode(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();

// niente indirizzi interni: si leggono solo siti pubblici
function safeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.includes(':') || !h.includes('.')) return null;
  return u;
}

async function get(url, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept, 'accept-language': 'it-IT,it;q=0.9,en;q=0.7' }, redirect: 'follow', signal: ctl.signal });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX) throw new Error('Pagina troppo grande.');
    return { status: r.status, url: r.url || url, type: r.headers.get('content-type') || '', buf };
  } finally {
    clearTimeout(t);
  }
}
const text = (res) => {
  const cs = (res.type.match(/charset=([\w-]+)/i) || [])[1] || 'utf-8';
  try {
    return new TextDecoder(cs).decode(res.buf);
  } catch {
    return new TextDecoder('utf-8').decode(res.buf);
  }
};

// ---- ricetta schema.org dentro la pagina ----
const isRecipe = (o) => o && typeof o === 'object' && [].concat(o['@type'] || []).some((t) => /recipe$/i.test(String(t)));
function findRecipe(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (isRecipe(node)) return node;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipe(node[k], depth + 1);
    if (r) return r;
  }
  return null;
}
function jsonLd(html) {
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let raw = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' '));
      } catch {
        continue;
      }
    }
    const r = findRecipe(data);
    if (r) return r;
  }
  return null;
}

const str = (v) => (v == null ? '' : typeof v === 'string' || typeof v === 'number' ? String(v) : v.text || v.name || v['@value'] || '');
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
// "PT1H15M" → "1 ora e 15 minuti"
function dur(v) {
  const s = str(Array.isArray(v) ? v[0] : v).trim();
  const m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return s.slice(0, 40);
  const d = +(m[1] || 0);
  const h = +(m[2] || 0) + d * 24;
  const min = +(m[3] || 0);
  if (!h && !min) return '';
  const hh = h ? (h === 1 ? '1 ora' : `${h} ore`) : '';
  const mm = min ? `${min} minuti` : '';
  return [hh, mm].filter(Boolean).join(' e ');
}
// istruzioni: testo, passi (HowToStep) o sezioni (HowToSection, diventano "# Titolo")
function steps(v, out = []) {
  for (const s of list(v)) {
    if (!s) continue;
    if (typeof s === 'string') {
      strip(s)
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => out.push(x));
    } else if (/HowToSection/i.test(String(s['@type']))) {
      if (s.name) out.push('# ' + strip(s.name));
      steps(s.itemListElement || s.steps, out);
    } else if (s.itemListElement && !s.text) steps(s.itemListElement, out);
    else {
      const t = strip(s.text || s.name || s.description || '');
      if (t) out.push(t);
    }
  }
  return out;
}
const imgOf = (v) => {
  const first = list(v)[0];
  return typeof first === 'string' ? first : first?.url || first?.contentUrl || '';
};
const siteName = (html, u) => decode((html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name/i) || [])[1] || '') || u.hostname.replace(/^www\./, '');

function fromSchema(r, html, u) {
  const yieldV = list(r.recipeYield).map(str).find((x) => /\D/.test(x)) || list(r.recipeYield).map(str)[0] || '';
  const cats = [...list(r.recipeCategory), ...list(r.recipeCuisine)].map((c) => strip(str(c))).filter(Boolean);
  return {
    title: strip(str(r.name || r.headline)).slice(0, 150),
    text: strip(str(r.description)).slice(0, 2000),
    ingredients: list(r.recipeIngredient || r.ingredients).map((x) => strip(str(x))).filter(Boolean).slice(0, 80),
    instructions: steps(r.recipeInstructions).join('\n').slice(0, 15000),
    yield: /^\d+$/.test(String(yieldV).trim()) ? `${String(yieldV).trim()} persone` : strip(yieldV).slice(0, 60),
    prepTime: dur(r.prepTime),
    cookTime: dur(r.cookTime),
    totalTime: dur(r.totalTime),
    categories: [...new Set(cats)].slice(0, 6),
    image: imgOf(r.image) || (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1] || '',
    site: siteName(html, u),
  };
}

// foto piccola come data URI (l'app la riduce a miniatura; dal telefono non si può leggere per via del CORS)
async function imageData(src, base) {
  try {
    const u = safeUrl(new URL(decode(src), base).href);
    if (!u) return '';
    const res = await get(u.href, 'image/avif,image/webp,image/jpeg,image/png,*/*');
    if (res.status >= 400 || !/^image\//.test(res.type) || res.buf.byteLength > 3 * 1024 * 1024) return '';
    return `data:${res.type.split(';')[0]};base64,${Buffer.from(res.buf).toString('base64')}`;
  } catch {
    return '';
  }
}

// testo della pagina per Gemini, quando il sito non pubblica i dati della ricetta
const pageText = (html) =>
  strip(html.replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' '))
    .replace(/\n{2,}/g, '\n')
    .slice(0, 20000);

// ---- feed RSS / Atom ----
function parseFeed(xml, base) {
  const items = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const tag = (b, t) => {
    const m = b.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'));
    return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
  };
  for (const b of blocks.slice(0, 40)) {
    const title = strip(tag(b, 'title'));
    let link = strip(tag(b, 'link'));
    if (!link) link = (b.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i) || b.match(/<link\b[^>]*href=["']([^"']+)/i) || [])[1] || '';
    if (!title || !link) continue;
    const img =
      (b.match(/<media:(?:content|thumbnail)\b[^>]*url=["']([^"']+)/i) || [])[1] ||
      (b.match(/<enclosure\b[^>]*url=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)/i) || [])[1] ||
      (decode(tag(b, 'content:encoded') || tag(b, 'description') || tag(b, 'content')).match(/<img[^>]+src=["']([^"']+)/i) || [])[1] ||
      '';
    const date = strip(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    let href = decode(link);
    try {
      href = new URL(href, base).href;
    } catch {}
    items.push({ title: title.slice(0, 150), link: href, img: img ? decode(img) : '', date: Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : '' });
  }
  return items;
}
const feedTitle = (xml) => strip((xml.match(/<channel\b[\s\S]*?<title\b[^>]*>([\s\S]*?)<\/title>/i) || xml.match(/<feed\b[\s\S]*?<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') || '');
const isFeed = (res, body) => /xml|rss|atom/i.test(res.type) || /^\s*(<\?xml|<rss|<feed)/i.test(body.slice(0, 500));

async function feedHandler(u) {
  let res = await get(u.href, 'application/rss+xml,application/atom+xml,application/xml,text/xml,text/html;q=0.8');
  let body = text(res);
  const tried = [res.url];
  if (!isFeed(res, body)) {
    // pagina normale: cerco il feed annunciato, poi gli indirizzi più comuni (WordPress e simili)
    const base = res.url;
    const site = new URL(base);
    const cands = [];
    for (const m of body.matchAll(/<link\b[^>]*type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)) {
      const href = (m[0].match(/href=["']([^"']+)/i) || [])[1];
      if (href && !/comments/i.test(href)) cands.push(new URL(decode(href), base).href);
    }
    cands.push(new URL('/feed/', site).href, new URL('/rss', site).href, new URL('/feed.xml', site).href, new URL('/rss.xml', site).href, new URL('/index.xml', site).href);
    let ok = false;
    for (const c of [...new Set(cands)].slice(0, 6)) {
      const cu = safeUrl(c);
      if (!cu) continue;
      try {
        const r = await get(cu.href, 'application/rss+xml,application/atom+xml,application/xml,text/xml');
        const b = text(r);
        tried.push(r.url);
        if (r.status < 400 && isFeed(r, b) && /<(item|entry)\b/i.test(b)) {
          res = r;
          body = b;
          ok = true;
          break;
        }
      } catch {}
    }
    if (!ok) return { status: 404, body: { error: 'Su questo sito non trovo un feed. Prova a incollare il link di una ricetta, oppure l\'indirizzo del feed (spesso finisce con /feed).', tried } };
  }
  const items = parseFeed(body, res.url);
  if (!items.length) return { status: 404, body: { error: 'Il feed è vuoto o non lo capisco.', tried } };
  return { status: 200, body: { feed: res.url, title: feedTitle(body) || new URL(res.url).hostname.replace(/^www\./, ''), items } };
}

async function recipeHandler(u, withImage) {
  const res = await get(u.href);
  if (res.status >= 400) return { status: 502, body: { error: `Il sito risponde con errore ${res.status}.` } };
  const html = text(res);
  const page = new URL(res.url);
  const r = jsonLd(html);
  if (!r) {
    const t = pageText(html);
    return {
      status: 200,
      body: { noSchema: true, link: res.url, site: siteName(html, page), title: strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 150), image: (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1] || '', pageText: t },
    };
  }
  const out = fromSchema(r, html, page);
  out.link = res.url;
  if (withImage && out.image) out.imageData = await imageData(out.image, res.url);
  return { status: 200, body: out };
}

export default async function handler(req, res) {
  const q = req.query || {};
  res.setHeader('cache-control', 'no-store');
  try {
    if (q.img) {
      const u = safeUrl(q.img);
      if (!u) return res.status(400).json({ error: 'Indirizzo non valido.' });
      return res.status(200).json({ imageData: await imageData(u.href, u.href) });
    }
    const u = safeUrl(q.feed || q.url);
    if (!u) return res.status(400).json({ error: 'Indirizzo non valido: incolla un link che comincia con https://' });
    const out = q.feed ? await feedHandler(u) : await recipeHandler(u, q.img !== '0');
    return res.status(out.status).json(out.body);
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Il sito non risponde (troppo lento).' : e?.message || 'Errore.';
    return res.status(502).json({ error: msg });
  }
}
