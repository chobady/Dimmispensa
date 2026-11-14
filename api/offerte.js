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
    const prev = byHref.get(key) || { href, store: m[3], segs: [], img: '', attrs: '' };
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

async function getPage(slug) {
  const r = await fetch(`${BASE}/offerte/${slug}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'it-IT,it;q=0.9' },
    redirect: 'follow',
  });
  const html = r.ok ? await r.text() : '';
  return { status: r.status, html, finalUrl: r.url };
}

export default async function handler(req, res) {
  const q = req.query || {};
  const raw = String(q.c || q.q || '').slice(0, 300);
  const cands = [...new Set(raw.split('|').map(slugify).filter((s) => s && s.length <= 60))].slice(0, 4);
  if (!cands.length) {
    res.status(400).json({ error: 'manca il prodotto' });
    return;
  }
  const debug = q.debug === '1';
  const tried = [];
  try {
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
