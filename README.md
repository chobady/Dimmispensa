# Dimmispensa

Il frigo e la dispensa sempre in tasca, in stile Game Boy Color.

- **Dispensa**: tutto il cibo che hai, diviso tra frigo, freezer e dispensa, con una barra "HP" che si accorcia man mano che si avvicina la scadenza.
- **Scadenze**: cosa è scaduto, cosa scade oggi, domani, in settimana. Il numerino rosso ti avvisa.
- **Aggiungi** (tasto rosso): quattro modi veloci
  - *Tocca*: un tocco su una delle icone e il cibo è dentro, con posto e scadenza stimati;
  - *Scrivi*: scrivi o detta "2 latte, pasta Barilla 500 g, yogurt scade il 20" (con Gemini capisce di più);
  - *Scontrino*: foto dello scontrino, Gemini estrae i prodotti;
  - *Barcode*: inquadri il codice a barre, nome e marca arrivano da Open Food Facts.
- **Pasti**: calendario settimanale con colazione, snack, pranzo e cena. Ci metti il cibo che hai (o un piatto scritto a mano), ti avvisa se qualcosa scade prima del giorno scelto o non è in nessun pasto, e quando segni "mangiato" lo toglie dalla dispensa. "Sorprendimi" riempie un pasto per te.
- **Sincronizzazione**: login Firebase e dispensa condivisa con un codice.

## Per farla funzionare

Leggi **[GUIDA.md](GUIDA.md)**: Vercel, Firebase e Gemini spiegati passo passo.

## Per chi tocca il codice

```bash
npm install
npm run dev      # sviluppo
npm run build    # produzione (cartella dist)
npm run icons    # rigenera src/icons-data.js dopo aver cambiato le icone
```

| Dove | Cosa |
|---|---|
| `src/firebase-config.js` | i sei valori di Firebase (vuoti = modalità locale) |
| `src/catalog.js` | elenco dei cibi: nome, icona, posto, durata tipica |
| `src/lib/store.js` | dati: localStorage oppure Firestore |
| `src/lib/gemini.js` | chiamate a Gemini (testo e scontrino) |
| `src/lib/parse.js` | lettore di liste che funziona anche senza Gemini |
| `src/screens/` | le cinque schermate |
| `tools/custom-icons.txt` | le icone 10×10 disegnate a mano (una griglia di lettere) |
| `firestore.rules` | regole di sicurezza da incollare in Firebase |

## Icone

272 icone pixel 10×10:

- 210 vengono dalle emoji di [SerenityOS](https://github.com/SerenityOS/serenity) (licenza BSD 2-Clause, testo in `assets/serenity-emoji/LICENSE`);
- 62 sono disegnate apposta per Dimmispensa (yogurt, mozzarella, tonno, passata, zucchine...) e stanno in `tools/custom-icons.txt`.

I dati dei codici a barre arrivano da [Open Food Facts](https://world.openfoodfacts.org) (licenza ODbL) e, per i prodotti americani, da [USDA FoodData Central](https://fdc.nal.usda.gov) (pubblico dominio).
I valori medi dei cibi sfusi vengono dalla tabella [Ciqual 2025](https://ciqual.anses.fr/) di ANSES (Licence Ouverte): "Anses. 2025. Ciqual French food composition table."
I font sono Press Start 2P e Pixelify Sans (licenza OFL).
