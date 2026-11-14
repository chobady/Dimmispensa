// Offerte dei volantini copiate da PromoQui (solo per uso personale).
// Vercel lo pubblica da solo come /api/offerte. Non salva niente.
//   /api/offerte?c=latte-parzialmente-scremato|latte        → prova le pagine in ordine, si ferma alla prima con offerte
//   /api/offerte?c=latte&debug=1                             → mostra cosa ha visto, utile se un giorno smette di funzionare
const BASE = 'https://www.promoqui.it';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', egrave: 'è', eacute: 'é', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì' };
const decode = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toNum = (s) => {
  const t = String(s).replace(/\s/g, '');
  // "1.234,56" / "1,78" / "1.78"
  const v = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const pretty = (slug) => slug.split('-').map((w) => (w.length > 2 || w === 'md' ? w[0].toUpperCase() + w.slice(1) : w)).join(' ').replace(/^Md$/, 'MD');

// Ogni offerta è un link a /volantino/{negozio}/{id}?flyerPage=..., con dentro nome, negozio e prezzi.
export function parseOffers(html) {
  const byHref = new Map();
  const re = /<a\b([^>]*?)href="([^"]*\/volantino\/([a-z0-9-]+)\/(\d+)\?[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = decode(m[2]);
    const key = `${m[3]}/${m[4]}/${(href.match(/flyerGibId=([^&]+)/) || [])[1] || href}`;
    const inner = m[6];
    const prev = byHref.get(key) || { href, store: m[3], flyer: m[4], segs: [], img: '', attrs: '' };
    prev.attrs += ' ' + m[1] + ' ' + m[5];
    const segs = inner
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .split(/<[^>]+>/)
      .map((t) => decode(t).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    prev.segs.push(...segs);
    if (!prev.img) {
      const im = inner.match(/<img\b[^>]*?(?:data-src|src)="([^"]+)"/i);
      if (im && !/^data:/.test(im[1])) prev.img = decode(im[1]);
    }
    const alt = inner.match(/<img\b[^>]*?alt="([^"]+)"/i);
    if (alt) prev.segs.push(decode(alt[1]).trim());
    const title = (m[1] + m[5]).match(/(?:title|aria-label)="([^"]+)"/i);
    if (title) prev.segs.push(decode(title[1]).trim());
    byHref.set(key, prev);
  }

  const out = [];
  for (const o of byHref.values()) {
    const joined = o.segs.join(' ');
    const prices = [...joined.matchAll(/€\s*(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}[.,]\d{2})\s*€/g)].map((x) => toNum(x[1] || x[2])).filter((n) => n != null && n > 0);
    const uniq = [...new Set(prices)];
    if (!uniq.length) continue;
    const price = uniq[0];
    const other = uniq.find((p) => p > price);
    const storeSlug = o.store;
    const storeSeg = o.segs.find((s) => slugify(s) === storeSlug);
    const store = storeSeg || pretty(storeSlug);
    const disc = (joined.match(/-\s?(\d{1,2})\s?%/) || [])[1];
    const storeRe = new RegExp('\\b' + storeSlug.split('-').join('[\\s\'’-]+') + '\\b', 'gi');
    const cand = o.segs
      .map((s) =>
        s
          .replace(/€\s*\d{1,4}(?:[.,]\d{1,2})?|\d{1,4}[.,]\d{2}\s*€/g, ' ')
          .replace(/vedi offerta/gi, ' ')
          .replace(/-\s?\d{1,2}\s?%/g, ' ')
          .replace(storeRe, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter((s) => s.length > 2 && slugify(s) !== storeSlug);
    // il titolo più completo: di solito "Marca - Nome"
    const full = cand.find((s) => s.includes(' - ')) || cand.sort((a, b) => b.length - a.length)[0] || '';
    let brand = '';
    let name = full;
    const parts = full.split(' - ');
    if (parts.length >= 2) {
      brand = parts[0].trim();
      name = parts.slice(1).join(' - ').trim();
      const dup = name.split(' - ');
      if (dup.length > 1 && dup.every((d) => d === dup[0])) name = dup[0];
    }
    if (!name) continue;
    out.push({
      name: name.slice(0, 80),
      brand: brand.slice(0, 40),
      store: store.slice(0, 30),
      storeSlug,
      flyer: o.flyer,
      price,
      oldPrice: other || null,
      discount: disc ? Number(disc) : null,
      url: o.href.startsWith('http') ? o.href : BASE + o.href,
      img: o.img ? (o.img.startsWith('http') ? o.img : BASE + o.img) : '',
    });
  }
  // stesso prodotto nello stesso negozio allo stesso prezzo: ne basta uno
  const seen = new Set();
  return out.filter((o) => {
    const k = `${slugify(o.brand + o.name)}|${o.storeSlug}|${o.price}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchHtml(path) {
  const r = await fetch(BASE + path, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'it-IT,it;q=0.9' },
    redirect: 'follow',
  });
  const html = r.ok ? await r.text() : '';
  return { status: r.status, html, finalUrl: r.url };
}
const getPage = (slug) => fetchHtml(`/offerte/${slug}`);

// ---- volantino intero -------------------------------------------------------
// Oltre ai link, molte pagine hanno i dati dentro <script> in JSON: cerco gli oggetti con un nome e un prezzo.
const NAME_KEYS = ['title', 'name', 'productName', 'product_name', 'description', 'label', 'nome'];
const PRICE_KEYS = ['price', 'finalPrice', 'final_price', 'discountedPrice', 'discounted_price', 'salePrice', 'prezzo', 'priceValue', 'currentPrice', 'offerPrice'];
const OLD_KEYS = ['fullPrice', 'full_price', 'originalPrice', 'original_price', 'oldPrice', 'old_price', 'listPrice', 'regularPrice', 'startPrice', 'initialPrice', 'priceOff', 'previousPrice'];
const BRAND_KEYS = ['brand', 'brandName', 'brand_name', 'marca'];
const asNum = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v > 0 && v < 10000 ? Math.round(v * 100) / 100 : null;
  if (typeof v === 'string') return toNum(v.replace(/[€\s]/g, ''));
  if (typeof v === 'object') return asNum(v.value ?? v.amount ?? v.price);
  return null;
};
const pick = (o, keys) => {
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k];
  return null;
};
function walk(node, out, depth = 0) {
  if (!node || depth > 40) return;
  if (Array.isArray(node)) {
    for (const x of node) walk(x, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  const nm = pick(node, NAME_KEYS);
  const pr = asNum(pick(node, PRICE_KEYS));
  if (typeof nm === 'string' && nm.trim().length > 2 && nm.length < 160 && pr) {
    const old = asNum(pick(node, OLD_KEYS));
    const br = pick(node, BRAND_KEYS);
    out.push({ name: nm.trim(), brand: typeof br === 'string' ? br : br && typeof br === 'object' ? String(br.name || '') : '', price: pr, oldPrice: old && old > pr ? old : null, discount: asNum(node.discount ?? node.discountPercentage ?? node.percentage) });
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, depth + 1);
}
function tryJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
// estrae l'oggetto {...} che contiene la posizione i (bilanciando le graffe)
function objectAround(src, i) {
  let depth = 0;
  let start = -1;
  for (let k = i; k >= 0 && i - k < 20000; k--) {
    const c = src[k];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) {
        start = k;
        break;
      }
      depth--;
    }
  }
  if (start < 0) return null;
  depth = 0;
  let inStr = false;
  for (let k = start; k < src.length && k - start < 20000; k++) {
    const c = src[k];
    if (inStr) {
      if (c === '\\') k++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, k + 1);
    }
  }
  return null;
}
export function jsonOffers(html) {
  const out = [];
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((t) => t.length > 50);
  for (let t of scripts) {
    const whole = tryJson(t.trim());
    if (whole) {
      walk(whole, out);
      continue;
    }
    // JSON dentro stringhe (es. self.__next_f.push): tolgo gli escape
    if (/\\"/.test(t)) t = t.replace(/\\\\/g, '\u0000').replace(/\\"/g, '"').replace(/\u0000/g, '\\');
    const keyRe = new RegExp(`"(${PRICE_KEYS.join('|')})"\\s*:`, 'g');
    let m;
    const seen = new Set();
    while ((m = keyRe.exec(t))) {
      const obj = objectAround(t, m.index);
      if (!obj || seen.has(obj)) continue;
      seen.add(obj);
      const parsed = tryJson(obj);
      if (parsed) walk(parsed, out);
    }
  }
  return out;
}

const ddmmyy = (d, m, y) => `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
function flyerDates(html) {
  const t = html.replace(/<[^>]+>/g, ' ');
  const a = t.match(/dal\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+al\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (a) return { from: ddmmyy(a[1], a[2], a[3]), until: ddmmyy(a[4], a[5], a[6]) };
  const b = t.match(/(\d{4}-\d{2}-\d{2})T[\d:.]+Z\s*-\s*(\d{4}-\d{2}-\d{2})T/);
  if (b) return { from: b[1], until: b[2] };
  return {};
}
const titleOf = (html) => decode((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim();

async function flyerHandler(q, res, debug) {
  let store = slugify(q.store || '');
  let id = String(q.flyer || '').replace(/\D/g, '');
  const info = { store, id };
  if (!store) {
    res.status(400).json({ error: 'manca il supermercato' });
    return;
  }
  let dates = {};
  let flyerTitle = '';
  let chainHtml = '';
  if (!id) {
    // pagina della catena: prendo il volantino più recente
    const sp = await fetchHtml(`/volantino/${store}`);
    info.storeStatus = sp.status;
    if (!sp.html) {
      res.status(sp.status === 404 ? 404 : 502).json({ error: sp.status === 404 ? 'Supermercato non trovato su PromoQui' : 'PromoQui non risponde', ...(debug ? { info } : {}) });
      return;
    }
    const ids = [...sp.html.matchAll(new RegExp(`/volantino/${store}/(\\d+)`, 'g'))].map((m) => m[1]);
    info.ids = [...new Set(ids)].slice(0, 6);
    id = ids[0] || '';
    dates = flyerDates(sp.html);
    chainHtml = sp.html;
    if (!id) {
      res.status(200).json({ store, offers: [], error: 'Nessun volantino attivo', ...(debug ? { info, sample: sp.html.slice(0, 4000) } : {}) });
      return;
    }
  }
  const fp = await fetchHtml(`/volantino/${store}/${id}`);
  info.flyerStatus = fp.status;
  info.size = fp.html.length;
  if (!fp.html) {
    res.status(502).json({ error: 'Volantino non raggiungibile', ...(debug ? { info } : {}) });
    return;
  }
  flyerTitle = titleOf(fp.html);
  const d2 = flyerDates(fp.html);
  if (d2.until) dates = d2;
  const fromLinks = parseOffers(fp.html).filter((o) => o.storeSlug === store);
  const fromJson = jsonOffers(fp.html);
  // se il volantino non mostra niente, almeno le offerte in evidenza della pagina della catena
  if (!fromLinks.length && !fromJson.length && chainHtml) fromLinks.push(...parseOffers(chainHtml).filter((o) => o.storeSlug === store));
  info.links = fromLinks.length;
  info.json = fromJson.length;
  const seen = new Set();
  const offers = [];
  for (const o of [...fromLinks, ...fromJson]) {
    const k = `${slugify(o.name)}|${o.price}`;
    if (seen.has(k)) continue;
    seen.add(k);
    offers.push({
      name: String(o.name).slice(0, 80),
      brand: String(o.brand || '').slice(0, 40),
      price: o.price,
      oldPrice: o.oldPrice || null,
      discount: o.discount || (o.oldPrice ? Math.round((1 - o.price / o.oldPrice) * 100) : null),
      url: o.url || `${BASE}/volantino/${store}/${id}`,
    });
  }
  const storeName = (flyerTitle.match(/volantino\s+([^|–-]+?)(?:\s+(?:a|dal|valido|\||–|-)|$)/i) || [])[1] || '';
  res.setHeader('Cache-Control', offers.length ? 's-maxage=21600, stale-while-revalidate=86400' : 's-maxage=600');
  res.status(200).json({
    store,
    storeName: storeName.trim(),
    flyer: id,
    title: flyerTitle,
    from: dates.from || '',
    until: dates.until || '',
    url: `${BASE}/volantino/${store}/${id}`,
    offers: offers.slice(0, 300),
    ...(debug ? { info, sample: fp.html.slice(0, 5000), scripts: [...fp.html.matchAll(/<script\b([^>]*)>([\s\S]{0,300})/gi)].map((m) => (m[1] + ' ' + m[2]).slice(0, 300)).slice(0, 40) } : {}),
  });
}

export default async function handler(req, res) {
  const q = req.query || {};
  const raw = String(q.c || q.q || '').slice(0, 300);
  const cands = [...new Set(raw.split('|').map(slugify).filter((s) => s && s.length <= 60))].slice(0, 4);
  if (!cands.length && !q.store) {
    res.status(400).json({ error: 'manca il prodotto' });
    return;
  }
  const debug = q.debug === '1';
  const tried = [];
  try {
    if (q.store) return await flyerHandler(q, res, debug);
    for (const slug of cands) {
      const page = await getPage(slug);
      const offers = page.html ? parseOffers(page.html) : [];
      tried.push({ slug, status: page.status, size: page.html.length, links: (page.html.match(/\/volantino\/[a-z0-9-]+\/\d+\?/g) || []).length, found: offers.length });
      // se PromoQui ci rimanda a una pagina diversa (es. la home), non è il prodotto giusto
      if (offers.length && /\/offerte\//.test(page.finalUrl || '/offerte/')) {
        res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
        res.status(200).json({ slug, source: 'PromoQui', page: `${BASE}/offerte/${slug}`, offers, ...(debug ? { tried, sample: page.html.slice(0, 3000) } : {}) });
        return;
      }
      if (debug && cands.length === 1) {
        res.status(200).json({ slug, offers: [], tried, sample: page.html.slice(0, 6000) });
        return;
      }
    }
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(200).json({ slug: cands[0], offers: [], ...(debug ? { tried } : {}), blocked: tried.every((t) => t.status === 403 || t.status === 429) });
  } catch (e) {
    res.status(502).json({ error: 'PromoQui non raggiungibile', tried });
  }
}
