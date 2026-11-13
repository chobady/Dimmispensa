// Lettura dei codici a barre (EAN-13, EAN-8, UPC) dalla fotocamera o da una foto.
// Usa il lettore del browser quando c'è (Android/Chrome), altrimenti ZXing (iPhone).

const checksumOk = (code) => {
  const d = code.split('').map(Number);
  const check = d.pop();
  let sum = 0;
  d.reverse().forEach((n, i) => (sum += n * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
};

// UPC-E (8 cifre, prodotti USA piccoli: lattine, snack) -> UPC-A (12 cifre)
export function upcEtoA(code) {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [ns, d1, d2, d3, d4, d5, d6, check] = code.split('');
  let body;
  if ('012'.includes(d6)) body = d1 + d2 + d6 + '0000' + d3 + d4 + d5;
  else if (d6 === '3') body = d1 + d2 + d3 + '00000' + d4 + d5;
  else if (d6 === '4') body = d1 + d2 + d3 + d4 + '00000' + d5;
  else body = d1 + d2 + d3 + d4 + d5 + '0000' + d6;
  return ns + body + check;
}

// Controlla la cifra di controllo: scarta le letture sbagliate
export function validCode(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  if (code.length === 8) {
    const a = upcEtoA(code);
    return checksumOk(code) || (!!a && checksumOk(a));
  }
  return checksumOk(code);
}

// Tutte le forme sotto cui lo stesso codice può essere archiviato (EAN-13 con lo 0 davanti, UPC-A, UPC-E espanso)
export function codeVariants(raw) {
  const code = String(raw).replace(/\D/g, '');
  const out = [code];
  if (code.length === 8) {
    const a = upcEtoA(code);
    if (a) out.push(a, '0' + a);
  }
  if (code.length === 12) out.push('0' + code);
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  if (code.length === 11) out.push('0' + code, '00' + code); // UPC scritto senza lo 0 iniziale
  return [...new Set(out)];
}

let decoderPromise = null;
// Restituisce una funzione decode(canvas) -> codice o null.
// 1) lettore del browser (Android/Chrome), 2) zxing-cpp in WebAssembly (iPhone e il resto), 3) ZXing JS di riserva.
export function getDecoder() {
  if (decoderPromise) return decoderPromise;
  decoderPromise = (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => formats.includes(f));
        if (want.length === 4) {
          const det = new window.BarcodeDetector({ formats: want });
          return async (canvas) => {
            const res = await det.detect(canvas);
            return res.map((r) => r.rawValue).find(validCode) || null;
          };
        }
      } catch {}
    }
    try {
      const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([
        import('zxing-wasm/reader'),
        import('zxing-wasm/reader/zxing_reader.wasm?url'),
      ]);
      // il file .wasm lo serviamo noi (niente CDN esterni)
      await prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) }, fireImmediately: true });
      const opts = { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1 };
      return async (canvas) => {
        const g = canvas.getContext('2d', { willReadFrequently: true });
        const res = await readBarcodes(g.getImageData(0, 0, canvas.width, canvas.height), opts);
        return res.map((r) => r.text).find(validCode) || null;
      };
    } catch (e) {
      console.warn('zxing-wasm non disponibile, uso ZXing JS', e);
    }
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
    const hints = new Map([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    return async (canvas) => {
      try {
        const code = reader.decodeFromCanvas(canvas).getText();
        return validCode(code) ? code : null;
      } catch {
        return null;
      }
    };
  })();
  return decoderPromise;
}

// Copia in un canvas un pezzo dell'immagine/video (eventualmente ruotato di 90°)
export function crop(source, sw, sh, { x = 0, y = 0, w = 1, h = 1, maxW = 1280, rotate = false } = {}) {
  const cw = Math.round(sw * w);
  const ch = Math.round(sh * h);
  const k = Math.min(1, maxW / Math.max(cw, ch));
  const outW = Math.max(1, Math.round(cw * k));
  const outH = Math.max(1, Math.round(ch * k));
  const c = document.createElement('canvas');
  c.width = rotate ? outH : outW;
  c.height = rotate ? outW : outH;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (rotate) {
    g.translate(c.width / 2, c.height / 2);
    g.rotate(Math.PI / 2);
    g.drawImage(source, Math.round(sw * x), Math.round(sh * y), cw, ch, -outW / 2, -outH / 2, outW, outH);
  } else {
    g.drawImage(source, Math.round(sw * x), Math.round(sh * y), cw, ch, 0, 0, outW, outH);
  }
  return c;
}

// Prova tante varianti di una foto: intera, fasce centrali, ruotata, più piccola
export async function decodeImageFile(file) {
  const decode = await getDecoder();
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Non riesco a leggere questa foto.'));
      i.src = url;
    });
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const tries = [
      { maxW: 1600 },
      { maxW: 1000 },
      { x: 0.05, y: 0.25, w: 0.9, h: 0.5, maxW: 1400 },
      { x: 0.1, y: 0.35, w: 0.8, h: 0.3, maxW: 1200 },
      { rotate: true, maxW: 1600 },
      { x: 0.25, y: 0.05, w: 0.5, h: 0.9, rotate: true, maxW: 1400 },
      { maxW: 640 },
      { maxW: 2400 },
    ];
    for (const t of tries) {
      const code = await decode(crop(img, W, H, t));
      if (code) return { code, image: img };
    }
    return { code: null, image: img };
  } finally {
    URL.revokeObjectURL(url);
  }
}
