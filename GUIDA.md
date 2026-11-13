# Guida passo passo (a prova di scemo)

Tutto quello che serve per avere Dimmispensa online, sincronizzata e con l'aiutante Gemini.
Si fa **una volta sola**. Tempo: circa 15 minuti. Costo: zero, e non serve nessuna carta di credito.

Riassunto di cosa fa cosa:

| Servizio | A cosa serve | Cosa devi fare tu |
|---|---|---|
| **GitHub** | Tiene il codice dell'app | Niente: ci pensa Claude |
| **Vercel** | Mette l'app su internet | Parte A (3 clic) |
| **Firebase** | Login e sincronizzazione tra dispositivi | Parte B (5 passi) |
| **Gemini** | Capisce le frasi dettate e legge gli scontrini | Parte C (1 chiave da incollare) |

---

## Parte A — Mettere l'app online con Vercel

1. Vai su **https://vercel.com** e premi **Log in** → **Continue with GitHub** (lo stesso account dove c'è il repo `Dimmispensa`).
2. Premi **Add New…** (in alto a destra) → **Project**.
3. Nella lista trovi `Dimmispensa`: premi **Import**. Non cambiare niente nella pagina che si apre (Vercel capisce da solo che è un progetto *Vite*) e premi **Deploy**.
4. Dopo un minuto ti dà un indirizzo tipo `dimmispensa.vercel.app`. Quello è il sito dell'app.

Da ora in poi **ogni modifica caricata su GitHub aggiorna il sito da sola** in circa un minuto.

> Se nella lista non vedi `Dimmispensa`: premi "Adjust GitHub App Permissions" e dai a Vercel l'accesso a quel repo.

A questo punto l'app funziona già, ma in **modalità solo questo dispositivo** (i dati restano nel browser). Per la sincronizzazione continua con la parte B.

---

## Parte B — Firebase (login + sincronizzazione)

### Passo 1 — Crea il progetto

1. Vai su **https://console.firebase.google.com** ed entra col tuo account Google.
2. Premi **Crea un progetto** (o "Aggiungi progetto").
3. Nome: `dimmispensa`. Avanti.
4. Se chiede di **Gemini in Firebase** o di **Google Analytics**: disattiva / "Non ora". Non servono.
5. Premi **Crea progetto** e aspetta che finisca, poi **Continua**.

Il piano si chiama **Spark** ed è gratuito: non chiede la carta.

### Passo 2 — Registra l'app e prendi la "config"

1. Nella pagina principale del progetto premi l'icona **`</>`** (Web). Se non la vedi: **+ Aggiungi app** → **Web**.
2. Nickname: `dimmispensa`. **Non** spuntare "Firebase Hosting". Premi **Registra app**.
3. Compare un blocco di codice che contiene una cosa così:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "dimmispensa-xxxx.firebaseapp.com",
     projectId: "dimmispensa-xxxx",
     storageBucket: "dimmispensa-xxxx.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```

4. **Copia quel blocco** e fai una di queste due cose:
   - **Modo facile:** incollalo a Claude in chat scrivendo "ecco la config di Dimmispensa". La carica lui.
   - **Modo fai-da-te:** su GitHub apri il file `src/firebase-config.js`, premi la matita ✏️, sostituisci i sei valori vuoti con i tuoi e premi **Commit changes**.

Questi valori **non sono segreti**: possono stare su GitHub. La sicurezza la fanno le regole del passo 5.

> Hai chiuso la pagina? Ingranaggio ⚙️ in alto a sinistra → **Impostazioni progetto** → scheda **Generali** → scorri fino a **Le tue app**: il blocco è lì.

### Passo 3 — Attiva il login con email e password

1. Nel menu a sinistra: **Build** (o "Creazione") → **Authentication**.
2. Premi **Inizia**.
3. Scheda **Metodo di accesso** (Sign-in method) → clicca **Email/Password**.
4. Attiva **solo il primo interruttore** ("Email/Password") → **Salva**.

### Passo 4 — Crea il database

1. Menu a sinistra: **Build** → **Firestore Database** → **Crea database**.
2. Se chiede l'edizione, scegli **Standard**.
3. Posizione: scegli **eur3 (Europe)** oppure una che inizia con `europe-west`. Avanti.
4. Scegli **Avvia in modalità di produzione** → **Crea**.

### Passo 5 — Incolla le regole di sicurezza

1. Sempre in **Firestore Database**, apri la scheda **Regole**.
2. **Cancella tutto** quello che c'è nel riquadro.
3. Apri il file `firestore.rules` di questo progetto (su GitHub), copia **tutto** il contenuto e incollalo nel riquadro.
4. Premi **Pubblica**.

Senza questo passo l'app ti dirà "Firebase ha rifiutato l'operazione".

### Passo 6 — Primo accesso

1. Apri il sito dell'app (quello di Vercel). Ora vedi la schermata **Entra / Crea account**.
2. **Crea account** con nome, email e password (almeno 6 caratteri).
3. Scegli **Ne creo una nuova** e dai un nome alla dispensa (es. "Casa"). Se avevi già inserito cibo in modalità locale, lascia la spunta per importarlo.
4. Sugli altri tuoi dispositivi: apri lo stesso sito ed **Entra** con la stessa email e password. Fine: è sincronizzato.

### Invitare famiglia o coinquilini

1. Nell'app: **Opzioni** → **Condividi il codice** (un codice tipo `ABCD-1234`).
2. L'altra persona apre il sito, fa **Crea account** con la *sua* email, poi sceglie **Entro con un codice** e lo scrive.
3. Da quel momento vedete e modificate lo stesso frigo, in tempo reale.

Tratta il codice come una chiave di casa: chi lo conosce (e ha un account) può entrare nella dispensa.

---

## Parte C — Gemini (l'aiutante)

Serve per il tasto **Scrivi** (frasi dettate, marche, scadenze) e per **Scontrino**. Senza chiave l'app funziona lo stesso: "Tocca", "Barcode" e le liste semplici non ne hanno bisogno.

1. Vai su **https://aistudio.google.com/apikey** ed entra col tuo account Google.
2. Premi **Create API key** (Crea chiave API). Se chiede un progetto, scegli quello proposto o `dimmispensa`.
3. **Copia** la chiave (se ne hai già una per Linguanki puoi usare la stessa).
4. Nell'app: **Opzioni** → **Gemini** → incolla → **Salva e prova**. Deve comparire "Gemini funziona!".

La chiave viene salvata dentro la tua dispensa su Firebase: la inserisci una volta e vale su tutti i dispositivi e per tutti i membri. Non finisce mai su GitHub.

---

## Parte D — Metterla sul telefono come un'app

**iPhone:** apri il sito con **Safari** → tasto **Condividi** (quadrato con la freccia) → **Aggiungi alla schermata Home**.

**Android:** apri il sito con **Chrome** → menu ⋮ → **Aggiungi a schermata Home** / **Installa app**.

---

## Se qualcosa non va

| Cosa vedi | Cosa è successo | Soluzione |
|---|---|---|
| L'app si apre senza chiedere il login e in Opzioni dice "solo questo dispositivo" | La config di Firebase non è ancora nel codice | Parte B, passo 2 |
| "In Firebase non è attivo il login Email/Password" | Manca l'interruttore | Parte B, passo 3 |
| "Firebase ha rifiutato l'operazione" | Regole non pubblicate (o database non creato) | Parte B, passi 4 e 5 |
| "Non trovo nessuna dispensa con questo codice" | Codice scritto male | Ricontrolla le 8 lettere/numeri in Opzioni |
| "La chiave Gemini non è valida" | Chiave incollata a metà o cancellata | Parte C: creane una nuova e reincollala |
| "Gemini ha finito le richieste gratuite" | Limite del piano gratuito | Aspetta un minuto; intanto usa "Tocca" |
| Il barcode non apre la fotocamera | Permesso negato | Impostazioni del browser → consenti la fotocamera per il sito; oppure scrivi il codice a mano |
| Ho caricato una modifica ma il sito è uguale | Vercel sta ancora pubblicando | Aspetta un minuto e ricarica la pagina |
| Il quadratino in alto a destra è giallo e lampeggia | Sei senza rete | Tranquillo: salva sul telefono e sincronizza appena torna la connessione |
