// Ponte verso USDA FoodData Central, nel caso il browser non possa chiamarlo direttamente.
// Vercel lo pubblica da solo come /api/usda (funzione gratuita). Non salva niente.
export default async function handler(req, res) {
  const { query = '', key = '', pageSize = '10' } = req.query || {};
  if (!query || String(query).length > 200) {
    res.status(400).json({ error: 'query mancante' });
    return;
  }
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key || 'DEMO_KEY')}&dataType=Branded&pageSize=${encodeURIComponent(Math.min(20, Number(pageSize) || 10))}&query=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url);
    const body = await r.text();
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(r.status).setHeader('Content-Type', 'application/json').send(body);
  } catch (e) {
    res.status(502).json({ error: 'USDA non raggiungibile' });
  }
}
