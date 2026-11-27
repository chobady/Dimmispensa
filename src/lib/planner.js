// Menu del giorno e spesa calcolati in locale, senza Gemini.
// Le regole vengono dai due libri caricati dall'utente:
//   MN = Manuale di nutrizione applicata (LARN, linee guida CREA 2018)
//   PN = Project Nutrition (Biasci)
// Dove i due libri danno numeri diversi si usa il valore che li rispetta entrambi;
// se non esiste, quello più prudente, e lo si dice nella spiegazione.
import { BY_KEY, PIECE_G, isCasa } from '../catalog.js';
import { CIQUAL } from '../ciqual-data.js';
import { itName } from './en2it.js';
import { daysLeft, todayISO } from './dates.js';

const MN = 'Manuale';
const PN = 'Project Nutrition';
export const MEALS = ['Colazione', 'Spuntino', 'Pranzo', 'Cena'];

// ---------------------------------------------------------------------------
// Alimenti che il programma sa proporre: valori per 100 g (crudo, parte edibile)
// kcal, p proteine, c carboidrati, f grassi, fib fibre. min/max/step = porzione in grammi.
// keys: chiavi del catalogo che corrispondono; words: parole nel nome del cibo in dispensa.
// ---------------------------------------------------------------------------
const F = (id, name, role, tag, n, por, match = {}, extra = {}) => ({ id, name, role, tag, kcal: n[0], p: n[1], c: n[2], f: n[3], fib: n[4] || 0, min: por[0], max: por[1], step: por[2] || 5, keys: match.keys || [], words: match.words || [], ...extra });

export const FOODS = [
  // proteine animali magre
  F('petto', 'Petto di pollo', 'prot', 'bianca', [110, 23.4, 0, 1.5], [100, 220, 10], { keys: ['petto'], words: ['petto di pollo', 'pollo petto', 'fesa di pollo', 'filetti di pollo'] }, { cook: 'alla piastra', buy: 'Petto di pollo' }),
  F('tacchino', 'Fesa di tacchino', 'prot', 'bianca', [108, 23.7, 0, 1.5], [100, 220, 10], { keys: ['tacchino'], words: ['tacchino'] }, { cook: 'alla piastra', buy: 'Fesa di tacchino' }),
  F('coniglio', 'Coniglio', 'prot', 'bianca', [118, 21, 0, 3.6], [120, 220, 10], { keys: ['coniglio'], words: ['coniglio'] }, { cook: 'al forno' }),
  F('vitello', 'Carne magra di manzo o vitello', 'prot', 'rossa', [107, 20.7, 0, 2.7], [100, 200, 10], { keys: ['bistecca'], words: ['fesa di vitello', 'vitello', 'magatello', 'girello', 'filetto di manzo', 'bresaola'] }, { cook: 'alla piastra', buy: 'Fettine di vitello magre' }),
  F('maiale', 'Lonza di maiale', 'prot', 'rossa', [146, 21.3, 0, 6.5], [100, 200, 10], { keys: ['maiale'], words: ['lonza', 'arista', 'filetto di maiale'] }, { cook: 'al forno' }),
  // pesce (PN: preferire sardine, sgombri, alici; MN: pesce 2-3 volte a settimana)
  F('merluzzo', 'Merluzzo', 'prot', 'pesce', [77, 18.1, 0, 0.6], [150, 300, 10], { keys: ['pesce'], words: ['merluzzo', 'nasello', 'baccala', 'platessa', 'sogliola', 'halibut'] }, { cook: 'al forno', buy: 'Filetti di merluzzo' }),
  F('orata', 'Orata o branzino', 'prot', 'pesce', [121, 19.8, 0, 4.6], [150, 300, 10], { words: ['orata', 'branzino', 'spigola', 'dentice', 'cernia', 'trota'] }, { cook: 'al forno' }),
  F('sgombro', 'Sgombro', 'prot', 'pesce', [168, 17, 0, 11.1], [130, 250, 10], { words: ['sgombro', 'sgombri'] }, { cook: 'al forno', buy: 'Sgombro fresco' }),
  F('sardine', 'Sardine o alici', 'prot', 'pesce', [129, 20.8, 1.5, 4.5], [150, 250, 10], { words: ['sardine', 'sarde', 'alici', 'acciughe fresche', 'aringhe'] }, { cook: 'al forno', buy: 'Alici o sardine fresche' }),
  F('salmone', 'Salmone', 'prot', 'pesce', [193, 20.5, 0, 12.4], [120, 220, 10], { keys: ['salmone'], words: ['salmone'] }, { cook: 'al forno' }),
  F('tonno', 'Tonno al naturale', 'prot', 'pesce', [103, 23.6, 0, 0.9], [80, 200, 10], { keys: ['tonno'], words: ['tonno'] }, { cook: '', buy: 'Tonno al naturale' }),
  F('gamberi', 'Gamberi', 'prot', 'pesce', [71, 13.6, 2.9, 0.6], [150, 300, 10], { keys: ['gamberi'], words: ['gamberi', 'gamberetti', 'mazzancolle', 'scampi'] }, { cook: 'in padella' }),
  F('calamari', 'Calamari o polpo', 'prot', 'pesce', [68, 12.6, 0.6, 1.7], [200, 350, 10], { keys: ['calamari', 'polpo'], words: ['calamari', 'seppie', 'polpo', 'totani'] }, { cook: 'in umido' }),
  F('cozze', 'Cozze o vongole', 'prot', 'pesce', [84, 11.7, 3.4, 2.7], [250, 400, 10], { keys: ['cozze'], words: ['cozze', 'vongole'] }, { cook: 'in padella' }),
  // uova e latticini
  F('uova', 'Uova', 'prot', 'uova', [128, 12.4, 0, 8.7], [55, 165, 55], { keys: ['uova'], words: ['uova', 'uovo'] }, { cook: 'in frittata al forno', piece: 55, buy: 'Uova' }),
  F('ricotta', 'Ricotta', 'prot', 'latticini', [146, 8.8, 3.5, 10.9], [100, 200, 10], { keys: ['ricotta'], words: ['ricotta', 'fiocchi di latte', 'quark', 'skyr'] }),
  F('fiocchi', 'Fiocchi di latte', 'prot', 'latticini', [98, 11.1, 3.4, 4.3], [100, 250, 10], { words: ['fiocchi di latte', 'cottage'] }, { buy: 'Fiocchi di latte' }),
  F('mozzarella', 'Mozzarella', 'prot', 'formaggio', [253, 18.7, 0.7, 19.5], [60, 125, 5], { keys: ['mozzarella'], words: ['mozzarella', 'burrata', 'stracciatella'] }),
  F('formaggio', 'Formaggio stagionato', 'prot', 'formaggio', [390, 30, 0, 29], [30, 60, 5], { keys: ['formaggio', 'parmigiano'], words: ['parmigiano', 'grana', 'pecorino', 'formaggio', 'emmental'] }),
  F('tofu', 'Tofu', 'prot', 'tofu', [147, 13.4, 2.9, 8.5], [100, 250, 10], { keys: ['tofu'], words: ['tofu', 'tempeh'] }, { cook: 'in padella' }),
  // legumi (MN: almeno 3 volte a settimana; PN: anche tutti i giorni)
  F('lenticchie', 'Lenticchie secche', 'prot', 'legumi', [316, 23, 51, 2.5, 13.7], [50, 100, 5], { words: ['lenticchie secche', 'lenticchie decorticate', 'lenticchie rosse'] }, { buy: 'Lenticchie secche' }),
  F('cecisecchi', 'Ceci secchi', 'prot', 'legumi', [334, 20.9, 46.9, 6.3, 13.6], [50, 100, 5], { words: ['ceci secchi'] }),
  F('fagiolisecchi', 'Fagioli secchi', 'prot', 'legumi', [291, 23, 47.5, 2, 17], [50, 100, 5], { words: ['fagioli secchi', 'borlotti secchi', 'cannellini secchi'] }),
  F('ceci', 'Ceci lessati', 'prot', 'legumi', [120, 7, 18, 2.4, 6], [150, 300, 10], { keys: ['ceci'], words: ['ceci'] }, { buy: 'Ceci lessati (in vetro o scatola)' }),
  F('fagioli', 'Fagioli lessati', 'prot', 'legumi', [91, 6.4, 13, 0.5, 6.5], [150, 300, 10], { keys: ['legumi'], words: ['fagioli', 'borlotti', 'cannellini', 'legumi', 'lenticchie'] }, { buy: 'Fagioli lessati' }),
  F('piselli', 'Piselli', 'prot', 'legumi', [78, 5.9, 9.5, 0.4, 6], [150, 300, 10], { keys: ['piselli', 'edamame'], words: ['piselli', 'edamame'] }),
  // carboidrati (MN: preferire integrali; PN: patate e tuberi i più naturali, cereali integrali)
  F('pastaint', 'Pasta integrale', 'carb', 'cereale', [324, 13.4, 62.5, 2.5, 9.5], [30, 130, 5], { words: ['pasta integrale', 'spaghetti integrali', 'penne integrali', 'fusilli integrali'] }, { whole: true, buy: 'Pasta integrale' }),
  F('pasta', 'Pasta', 'carb', 'cereale', [353, 12, 70, 1.4, 2.7], [30, 130, 5], { keys: ['pasta', 'spaghetti'], words: ['pasta', 'spaghetti', 'penne', 'fusilli', 'linguine', 'rigatoni', 'farfalle', 'mezze maniche'] }),
  F('risoint', 'Riso integrale', 'carb', 'cereale', [337, 7.5, 77.4, 1.9, 3.5], [30, 130, 5], { words: ['riso integrale', 'riso venere', 'riso rosso', 'riso nero'] }, { whole: true, buy: 'Riso integrale' }),
  F('riso', 'Riso', 'carb', 'cereale', [334, 7.4, 79, 0.6, 1], [30, 130, 5], { keys: ['riso'], words: ['riso', 'basmati', 'jasmine', 'carnaroli', 'arborio'] }),
  F('farro', 'Farro', 'carb', 'cereale', [335, 15.1, 67.1, 2.5, 6.8], [30, 120, 5], { words: ['farro'] }, { whole: true, buy: 'Farro' }),
  F('orzo', 'Orzo', 'carb', 'cereale', [319, 10.4, 70.5, 1.4, 9.2], [30, 120, 5], { words: ['orzo perlato', 'orzo decorticato'] }, { whole: true }),
  F('quinoa', 'Quinoa o grano saraceno', 'carb', 'cereale', [360, 13.7, 65, 4.5, 8], [30, 120, 5], { words: ['quinoa', 'grano saraceno', 'amaranto', 'miglio'] }, { whole: true }),
  F('patate', 'Patate', 'carb', 'tubero', [85, 2.1, 18, 0.1, 1.6], [150, 500, 25], { keys: ['patata'], words: ['patate'] }, { buy: 'Patate' }),
  F('patatedolci', 'Patate dolci', 'carb', 'tubero', [81, 1.6, 17.1, 0.1, 3], [150, 450, 25], { keys: ['patatadolce'], words: ['patate dolci', 'patata dolce', 'batata'] }),
  F('paneint', 'Pane integrale', 'carb', 'pane', [224, 7.5, 48.5, 1.3, 6.5], [30, 150, 10], { words: ['pane integrale', 'pane di segale', 'pane ai cereali', 'pane nero', 'pan bauletto integrale'] }, { whole: true, buy: 'Pane integrale' }),
  F('pane', 'Pane', 'carb', 'pane', [270, 8.6, 56, 1.3, 3], [30, 150, 10], { keys: ['pane', 'baguette', 'piadina'], words: ['pane', 'baguette', 'rosetta', 'ciabatta', 'pan carre', 'piadina'] }),
  // colazione
  F('avena', "Fiocchi d'avena", 'cereale', 'colazione', [372, 13.5, 58.7, 7, 10], [30, 90, 5], { words: ['avena', 'oats', 'porridge'] }, { whole: true, buy: "Fiocchi d'avena" }),
  F('fette', 'Fette biscottate integrali', 'cereale', 'colazione', [380, 11.3, 70, 6, 11], [20, 70, 5], { words: ['fette biscottate'] }, { whole: true, buy: 'Fette biscottate integrali' }),
  F('muesli', 'Muesli senza zuccheri aggiunti', 'cereale', 'colazione', [365, 10, 62, 6.5, 8], [30, 70, 5], { words: ['muesli'] }, { whole: true }),
  F('cornflakes', 'Cereali da colazione', 'cereale', 'colazione', [372, 6.9, 82.4, 0.7, 3], [30, 60, 5], { keys: ['cereali'], words: ['corn flakes', 'cornflakes', 'cereali', 'special k'] }),
  F('cracker', 'Cracker integrali', 'cereale', 'spuntino', [400, 10.5, 67, 9.5, 8], [25, 50, 5], { keys: ['cracker', 'gallette'], words: ['cracker', 'gallette'] }),
  F('latte', 'Latte parzialmente scremato', 'latte', 'colazione', [46, 3.5, 5, 1.6], [150, 300, 25], { keys: ['latte'], words: ['latte'] }, { buy: 'Latte parzialmente scremato', ml: true }),
  F('yogurt', 'Yogurt bianco', 'latte', 'colazione', [50, 3.8, 4.3, 1.7], [125, 250, 125], { keys: ['yogurt'], words: ['yogurt bianco', 'yogurt naturale', 'yogurt magro', 'yogurt'] }, { piece: 125, buy: 'Yogurt bianco senza zucchero' }),
  F('greco', 'Yogurt greco magro', 'latte', 'colazione', [57, 10, 4, 0.2], [100, 300, 25], { words: ['yogurt greco', 'greek', 'skyr', 'kefir'] }, { buy: 'Yogurt greco 0% bianco' }),
  // frutta secca (MN 20-30 g; PN quantità ragionevoli)
  F('noci', 'Noci', 'nuts', 'frutta secca', [689, 14.3, 5.1, 68.1, 6.2], [10, 30, 5], { keys: ['noci'], words: ['noci'] }, { buy: 'Noci' }),
  F('mandorle', 'Mandorle', 'nuts', 'frutta secca', [603, 22, 4.6, 55.3, 12.7], [10, 30, 5], { keys: ['mandorle'], words: ['mandorle', 'nocciole', 'pistacchi', 'anacardi'] }, { buy: 'Mandorle' }),
  // grassi
  F('olio', "Olio extravergine d'oliva", 'fat', 'olio', [899, 0, 0, 99.9], [5, 25, 5], { keys: ['olio'], words: ['extravergine', 'evo', "olio d'oliva", 'olio di oliva'] }, { buy: "Olio extravergine d'oliva", ml: true }),
];

// verdure e frutta: valori dalla tabella Ciqual del sito, fibre medie
const VEG = {
  broccoli: ['Broccoli', 3], cavolfiore: ['Cavolfiore', 2.4], spinaci: ['Spinaci', 2.2], insalata: ['Insalata', 1.5], rucola: ['Rucola', 1.6], carota: ['Carote', 2.8],
  zucchina: ['Zucchine', 1.2], melanzana: ['Melanzane', 2.6], peperone: ['Peperoni', 1.9], pomodoro: ['Pomodori', 1.2], finocchio: ['Finocchi', 2.2], fagiolini: ['Fagiolini', 2.9],
  carciofo: ['Carciofi', 5.5], asparagi: ['Asparagi', 2.1], zucca: ['Zucca', 1], funghi: ['Funghi', 2.3], cetriolo: ['Cetrioli', 0.8], radicchio: ['Radicchio', 3], porro: ['Porri', 2.9],
  sedano: ['Sedano', 1.6], cipolla: ['Cipolle', 1], barbabietola: ['Barbabietole', 2.6], verduresurgelate: ['Verdure miste', 2.5], friarielli: ['Friarielli', 3], pakchoi: ['Pak choi', 1.5],
  germogli: ['Germogli', 1.8], kimchi: ['Kimchi', 2], topinambur: ['Topinambur', 2.1],
};
const FRUIT = {
  mela: ['Mela', 2], melaverde: ['Mela', 2], pera: ['Pera', 3.1], banana: ['Banana', 1.8], arancia: ['Arancia', 1.6], mandarino: ['Mandarini', 1.7], kiwi: ['Kiwi', 2.2], fragola: ['Fragole', 1.6],
  pesca: ['Pesca', 1.6], prugna: ['Prugne', 1.5], uva: ['Uva', 1.5], kaki: ['Cachi', 2.5], mirtilli: ['Mirtilli', 3.1], ananas: ['Ananas', 1], melone: ['Melone', 0.7], anguria: ['Anguria', 0.2],
  ciliegia: ['Ciliegie', 1.3], fico: ['Fichi', 2.5], melograno: ['Melograno', 2.2], mango: ['Mango', 1.6],
};
const veg100 = (k) => {
  const t = CIQUAL[k] || { kcal: 25, p: 1.5, c: 3.5, f: 0.3 };
  return { kcal: t.kcal ?? 25, p: t.p ?? 1.5, c: t.c ?? 3.5, f: t.f ?? 0.3 };
};
for (const [k, [name, fib]] of Object.entries(VEG)) FOODS.push({ id: 'v_' + k, name, role: 'veg', tag: 'verdura', ...veg100(k), fib, min: 100, max: 350, step: 50, keys: [k], words: [], vegKey: k, buy: name });
for (const [k, [name, fib]] of Object.entries(FRUIT)) FOODS.push({ id: 'f_' + k, name, role: 'fruit', tag: 'frutta', ...veg100(k), fib, min: 100, max: 250, step: 50, keys: [k], words: [], fruitKey: k, piece: PIECE_G[k] || 150, buy: name });
const BYID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

// stagionalità in Italia (MN e PN: frutta e verdura di stagione)
const SEASON_VEG = [
  ['broccoli', 'cavolfiore', 'finocchio', 'carciofo', 'carota', 'spinaci', 'radicchio', 'porro', 'zucca', 'topinambur', 'insalata'],
  ['broccoli', 'cavolfiore', 'finocchio', 'carciofo', 'carota', 'spinaci', 'radicchio', 'porro', 'topinambur', 'insalata'],
  ['carciofo', 'spinaci', 'finocchio', 'broccoli', 'carota', 'asparagi', 'topinambur', 'insalata', 'rucola'],
  ['asparagi', 'carciofo', 'spinaci', 'carota', 'zucchina', 'insalata', 'rucola'],
  ['asparagi', 'zucchina', 'fagiolini', 'carota', 'insalata', 'rucola', 'spinaci'],
  ['zucchina', 'fagiolini', 'pomodoro', 'peperone', 'melanzana', 'cetriolo', 'insalata'],
  ['zucchina', 'pomodoro', 'peperone', 'melanzana', 'fagiolini', 'cetriolo', 'insalata'],
  ['zucchina', 'pomodoro', 'peperone', 'melanzana', 'fagiolini', 'cetriolo', 'insalata'],
  ['zucchina', 'pomodoro', 'peperone', 'melanzana', 'fagiolini', 'zucca', 'insalata'],
  ['zucca', 'broccoli', 'cavolfiore', 'finocchio', 'spinaci', 'funghi', 'carota', 'topinambur', 'insalata'],
  ['broccoli', 'cavolfiore', 'finocchio', 'zucca', 'spinaci', 'radicchio', 'carciofo', 'carota', 'topinambur', 'insalata'],
  ['broccoli', 'cavolfiore', 'finocchio', 'carciofo', 'spinaci', 'radicchio', 'carota', 'porro', 'topinambur', 'insalata'],
];
const SEASON_FRUIT = [
  ['arancia', 'mandarino', 'kiwi', 'mela', 'pera'],
  ['arancia', 'mandarino', 'kiwi', 'mela', 'pera'],
  ['arancia', 'kiwi', 'mela', 'pera'],
  ['mela', 'kiwi', 'arancia', 'fragola'],
  ['fragola', 'ciliegia', 'mela'],
  ['ciliegia', 'pesca', 'fragola', 'melone'],
  ['pesca', 'prugna', 'melone', 'anguria'],
  ['pesca', 'prugna', 'fico', 'melone', 'anguria'],
  ['uva', 'fico', 'pera', 'mela', 'prugna'],
  ['uva', 'mela', 'pera', 'kaki', 'kiwi'],
  ['mela', 'pera', 'kaki', 'kiwi', 'mandarino', 'arancia'],
  ['arancia', 'mandarino', 'kiwi', 'mela', 'pera'],
];

// Cibi che i libri sconsigliano: non vengono proposti anche se sono in casa
const NO_KEYS = {
  alette: `ali di pollo: troppo grasse (${PN}), pollo con la pelle solo occasionalmente (${MN})`,
  cosce: `cosce di pollo con la pelle: troppo grasse (${PN}); togliere pelle e grasso visibile (${MN})`,
  pancetta: `pancetta: grasso animale e carne processata (${MN}, ${PN})`,
  salame: `salumi e insaccati da evitare (${PN}) o solo occasionalmente (${MN})`,
  wurstel: `wurstel: carne processata da evitare (${MN}, ${PN})`,
  zampone: `zampone e cotechino: insaccati grassi da evitare (${PN}) o solo occasionalmente (${MN})`,
  salsiccia: `salsiccia: insaccato e carne grassa (${MN}, ${PN})`,
  hamburger: `hamburger confezionati: carne processata (${MN}, ${PN})`,
  kebab: `kebab: carne grassa e processata (${MN}, ${PN})`,
  cotoletta: `cotolette impanate e fritte: limitare la frittura (${MN})`,
  pescefritto: `pesce fritto solo occasionalmente (${MN})`,
  bastoncini: `bastoncini di pesce: prodotto industriale impanato (${PN})`,
  granchio: `surimi: poco pesce e molti additivi (${PN})`,
  burro: `burro: grasso animale da limitare, meglio extravergine (${MN})`,
  panna: `panna: grasso animale da limitare (${MN})`,
  maionese: `maionese: condimento ricco di grassi e sale (${MN})`,
  oliosesamo: `olio di semi: meglio l'extravergine d'oliva (${PN}, ${MN})`,
  cremanocciola: `creme spalmabili con grassi vegetali: da evitare (${PN})`,
  merendine: `merendine: grassi idrogenati e zuccheri (${MN}, ${PN})`,
  biscotti: `biscotti e dolci confezionati fuori dal menu quotidiano (${PN})`,
  patatine: `patatine in busta: grassi e sale (${MN})`,
  patatinefritte: `patatine fritte: frittura (${MN})`,
  gnocchi: `gnocchi solo occasionalmente nelle diete per il peso (${MN})`,
};
const NO_WORDS = [
  [/olio\s+(di\s+)?(semi|girasole|mais|arachid|soia|colza|palma|sesamo)/, `olio di semi: meglio l'extravergine d'oliva (${PN}, ${MN})`],
  [/margarin/, `margarina: grassi idrogenati (${MN}, ${PN})`],
  [/\b(ali|alette|wings)\b/, `ali di pollo: troppo grasse (${PN})`],
  [/\b(cosce|coscia|sovracosce)\b/, `cosce di pollo con la pelle: troppo grasse (${PN})`],
  [/pollo\s+intero|pelle/, `pollo con la pelle solo occasionalmente (${MN})`],
  [/yogurt\s+(alla|ai|al)\s+\w+|yogurt\s+(frutta|fragola|pesca|vaniglia|cocco|cioccolato|caffe)/, `yogurt alla frutta: zuccheri aggiunti, meglio bianco con frutta fresca (${PN})`],
  [/surimi/, `surimi: poco pesce e molti additivi (${PN})`],
  [/impanat|panat/, `prodotti impanati e fritti: limitare (${MN})`],
];
// cibi del catalogo che non fanno parte di un pasto (bevande, condimenti, dolci)
const SKIP_CATS = new Set(['bevande', 'dolci', 'pronti', 'casa']);

// ---------------------------------------------------------------------------
// Fabbisogno e obiettivi della giornata
// ---------------------------------------------------------------------------
const LAF = { sedentario: 1.45, poco: 1.6, attivo: 1.75, molto: 2.1 };
const LAF60 = { sedentario: 1.4, poco: 1.5, attivo: 1.6, molto: 1.75 };
const MOV_TO_LAF = { poco: 'sedentario', normale: 'poco', tanto: 'attivo' };
// MN, tabella pratica (kcal per kg al giorno): le formule LARN sovrastimano per chi fa vita cittadina
const KCAL_KG = { sotto: { leggera: 30, moderata: 40, pesante: 47 }, normo: { leggera: 30, moderata: 35, pesante: 40 }, sovra: { leggera: 22, moderata: 30, pesante: 35 } };
const LAF_TO_ACT = { sedentario: 'leggera', poco: 'leggera', attivo: 'moderata', molto: 'pesante' };

// MET degli sport (tabella dell'attività fisica del Manuale)
function trainingMET(sport = '', intensita = 'media') {
  const s = sport.toLowerCase();
  const lvl = { leggera: 0, media: 1, intensa: 2 }[intensita] ?? 1;
  const T = [
    [/cors|run|jogging/, [7, 8.5, 10]],
    [/bici|cicl|spinning|cyclette/, [5, 7, 9]],
    [/nuot/, [6, 7, 9]],
    [/pesi|palestra|forza|bodybuilding|crossfit|funzional/, [3.5, 5, 6]],
    [/calc|tennis|basket|pallavolo|padel|rugby|boxe|arti marziali/, [6, 7, 8]],
    [/cammin|passeggi|trekking|escursion/, [3.5, 4.3, 5.5]],
    [/yoga|pilates|stretching/, [2.5, 3, 3.5]],
    [/ballo|danza|zumba|aerobica/, [5, 6, 7]],
    [/sci|pattin/, [6, 7, 8]],
  ];
  for (const [re, v] of T) if (re.test(s)) return v[lvl];
  return [4, 6, 8][lvl];
}

function schofield(sex, age, w) {
  if (sex === 'f') return age < 30 ? 14.82 * w + 486.6 : age < 60 ? 8.13 * w + 845.6 : 9.08 * w + 658.5;
  return age < 30 ? 15.06 * w + 692.2 : age < 60 ? 11.47 * w + 873.1 : 11.71 * w + 587.7;
}

// person: { sesso, eta, peso, altezza, grasso, attivita, allenamenti, obiettivo, oggi: { allena, sport, durata, intensita, quando, movimento } }
export function dailyTargets(person = {}) {
  const notes = [];
  const sex = person.sesso === 'f' ? 'f' : 'm';
  const age = Number(person.eta) || 35;
  const w = Number(person.peso) || (sex === 'f' ? 60 : 75);
  const hM = (Number(person.altezza) || (sex === 'f' ? 163 : 176)) / 100;
  const bmi = w / (hM * hM);
  const missing = ['peso', 'altezza', 'eta'].filter((k) => !person[k]);
  if (missing.length) notes.push(`Mancano alcuni tuoi dati (${missing.join(', ')}): uso valori medi. Inseriscili per un calcolo preciso.`);
  // MN: per chi deve perdere o prendere peso si usa il peso desiderabile (IMC 25), oltre IMC 30 anche per le proteine
  const wDes = 25 * hM * hM;
  const wCalc = bmi > 30 ? wDes : w;
  const oggi = person.oggi || {};
  const lafKey = oggi.movimento ? MOV_TO_LAF[oggi.movimento] : person.attivita || 'poco';
  const laf = (age >= 60 ? LAF60 : LAF)[lafKey] || 1.6;
  const mb = schofield(sex, age, wCalc);
  const trains = !!oggi.allena;
  const met = trains ? trainingMET(oggi.sport, oggi.intensita) : 0;
  const hours = trains ? (Number(oggi.durata) || 60) / 60 : 0;
  const sport = Math.round((met - 1) * w * hours);
  const larn = mb * laf;
  const band = bmi < 18.5 ? 'sotto' : bmi >= 25 ? 'sovra' : 'normo';
  const act = LAF_TO_ACT[lafKey] || 'leggera';
  const perKg = KCAL_KG[band][act];
  const base = perKg * (bmi >= 25 ? wDes : w);
  const tdee = base + sport;
  // obiettivo: PN taglia del 10-20% (in media 15%), surplus del 10-15% per la massa; MN calo graduale
  let goal = person.obiettivo || 'mantenere';
  if (goal === 'dimagrire' && bmi < 20) {
    notes.push('Con il tuo IMC non conviene un deficit: uso il mantenimento (entrambi i libri sconsigliano di scendere troppo).');
    goal = 'mantenere';
  }
  const goalPct = goal === 'dimagrire' ? -0.15 : goal === 'massa' ? 0.1 : 0;
  // controllo con Project Nutrition (kcal/kg di base, +400-600 nei giorni di allenamento): si resta nel suo intervallo
  const pnLow = (sex === 'f' ? 28 : 31) * w;
  const pnHigh = (sex === 'f' ? 31 : 34) * w + (trains ? 500 : 0);
  const maint = bmi < 25 ? Math.min(pnHigh, Math.max(pnLow, tdee)) : tdee;
  let kcal = Math.round((maint * (1 + goalPct)) / 10) * 10;
  // in sovrappeso e per dimagrire: formula dimagrante di PN (altezza² × 570-620 uomo, 520-570 donna, attività moderata),
  // valore basso; il MN ricorda che di solito lo specialista prescrive 1000-1300 kcal
  let slim = null;
  if (goal === 'dimagrire' && bmi >= 25) {
    const coef = (sex === 'f' ? 520 : 570) + (trains ? 50 : 0);
    slim = Math.round((hM * hM * coef) / 10) * 10;
    kcal = slim;
    notes.push(`Per dimagrire in sovrappeso il ${MN} consiglia di farsi seguire da uno specialista (di solito 1000-1300 kcal); qui uso la formula di ${PN}.`);
  }

  // proteine g/kg: intersezione dei due libri, altrimenti il più prudente
  const sporty = trains || Number(person.allenamenti) >= 3;
  let pk;
  let pWhy;
  if (goal === 'dimagrire' && sporty) {
    pk = 1.6;
    pWhy = `1,6 g/kg: limite per gli sportivi del ${MN} (1,2-1,6); ${PN} in definizione arriverebbe a 1,7-2,5`;
  } else if (goal === 'massa') {
    pk = 1.5;
    pWhy = `1,5 g/kg: dentro ${PN} per la massa (1,2-1,8) e ${MN} per gli sportivi (1,2-1,6)`;
  } else if (sporty) {
    pk = 1.5;
    pWhy = `1,5 g/kg: dentro ${PN} per il mantenimento (1,4-2) e ${MN} per gli sportivi (1,2-1,6)`;
  } else {
    pk = 1.0;
    pWhy = `1 g/kg: ${PN} per i sedentari (0,9-1) e ${MN} (almeno 0,9)`;
  }
  if (age >= 60 && pk < 1.1) {
    pk = 1.1;
    pWhy = `1,1 g/kg: dai 60 anni (${MN})`;
  }
  const protein = Math.round(pk * wCalc);
  // grassi: PN parte da 0,7-0,8 g/kg; MN 20-35% delle calorie, PN in dieta max 30%
  const fatMax = Math.round((kcal * (goal === 'dimagrire' ? 0.3 : 0.3)) / 9);
  const fatMin = Math.round((kcal * 0.25) / 9);
  const fat = Math.max(fatMin, Math.min(fatMax, Math.round(0.8 * w)));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const ck = carbs / wCalc;
  if (ck < 2) notes.push(`Carboidrati sotto 2 g/kg, il minimo del ${MN}: aumenta le calorie o parla con un professionista.`);
  if (trains && ck < 4) notes.push(`Oggi ti alleni: ${PN} consiglia almeno 4 g/kg di carboidrati come base (qui ${ck.toFixed(1)} g/kg); il menu mette più carboidrati nel pasto dopo l'allenamento.`);
  return {
    kcal,
    protein,
    fat,
    carbs,
    veg: 400,
    fruit: 2,
    fiber: 25,
    w,
    wCalc,
    sporty,
    pMax: Math.round((sporty ? 2 : 1.8) * wCalc),
    bmi,
    trains,
    goal,
    calc: slim
      ? `Per dimagrire: altezza² × ${(sex === 'f' ? 520 : 570) + (trains ? 50 : 0)} (${PN}) = ${slim} kcal. Controllo ${MN}: mantenimento ${perKg} kcal/kg sul peso desiderabile ${Math.round(wDes)} kg = ${Math.round(base)} kcal${sport ? ` + allenamento ${sport} kcal` : ''}.`
      : `${perKg} kcal/kg (${MN}, attività ${act}, ${band === 'normo' ? 'normopeso' : band === 'sovra' ? 'peso desiderabile ' + Math.round(wDes) + ' kg' : 'sottopeso'}) = ${Math.round(base)} kcal${sport ? ` + allenamento ${sport} kcal (${met} MET × ${w} kg × ${hours.toFixed(1)} h) = ${Math.round(tdee)} kcal` : ''}${maint !== tdee ? `, portate a ${Math.round(maint / 10) * 10} per restare nell'intervallo di ${PN}` : ''}${goalPct ? `, ${goalPct > 0 ? '+' : '−'}${Math.abs(goalPct * 100)}% per ${goal === 'massa' ? 'la massa' : 'perdere grasso'} (${PN})` : ''}${goalPct || Math.round(maint / 10) * 10 !== kcal ? ` → ${kcal} kcal` : ''}. Controlli: ${PN} ${Math.round(pnLow)}-${Math.round(pnHigh)} kcal; formula LARN ${Math.round(larn + sport)} kcal (il ${MN} avverte che sovrastima).`,
    macroWhy: [`Proteine ${protein} g: ${pWhy}.`, `Grassi ${fat} g: 0,8 g/kg (${PN}) entro il 25-30% delle calorie (${MN}).`, `Carboidrati ${carbs} g (${ck.toFixed(1)} g/kg): il resto delle calorie, almeno 2 g/kg (${MN}).`],
    notes,
  };
}

// ---------------------------------------------------------------------------
// Dispensa: cosa c'è, quanto, e se i libri lo permettono
// ---------------------------------------------------------------------------
const norm = (s) => itName(String(s || '')).toLowerCase();
function gramsOf(item, food) {
  const q = Number(item.qty) || 0;
  if (!q) return 0;
  if (item.unit === 'g' || item.unit === 'ml') return q;
  if (item.unit === 'kg' || item.unit === 'l') return q * 1000;
  const piece = food?.piece || PIECE_G[item.food] || (item.unit === 'conf' ? 400 : 100);
  return q * piece;
}
export function blockedReason(item) {
  const name = norm(item.name);
  for (const [re, why] of NO_WORDS) if (re.test(name)) return why;
  if (NO_KEYS[item.food]) return NO_KEYS[item.food];
  if (item.food === 'olio' && !/extravergine|evo|oliva/.test(name)) return `olio diverso dall'extravergine d'oliva: ${PN} e ${MN} consigliano l'extravergine`;
  return null;
}
// salse, condimenti e prodotti che contengono un cibo ma non lo sono (es. "salsa di pesce" non è pesce)
const NOT_FOOD = /\b(salsa|salse|sugo|sughi|dado|dadi|brodo|estratto|aroma|aromi|condimento|pate|crema|creme|ragu|pesto|maionese|ketchup|senape|glassa|marinata|insaporitore|polvere|whey|integratore|barrett|snack|chips|biscott|essenza|ossa|ossi|osso|midollo|carcass\w*|odori)\b|pasta d['i ]\s*(acciughe|olive|sesamo|arachidi)|latte di (cocco|mandorl|soia|avena|riso)|bevanda (di|alla|vegetale)/;
function matchPlanner(item) {
  const name = norm(item.name);
  if (NOT_FOOD.test(name) || BY_KEY[item.food]?.role === 'cond') return null;
  // prima le parole (più precise: "pasta integrale" prima di "pasta"), poi la chiave del catalogo
  let best = null;
  let bestLen = 0;
  for (const f of FOODS) for (const wd of f.words) if (wd.length > bestLen && name.includes(wd)) (best = f), (bestLen = wd.length);
  if (best) return best;
  return FOODS.find((f) => f.keys.includes(item.food)) || null;
}
export function readPantry(items) {
  const have = {}; // id -> { g, soon, items: [...] }
  const blocked = [];
  for (const it of items || []) {
    if (isCasa(it) || SKIP_CATS.has(BY_KEY[it.food]?.cat)) continue;
    const f = matchPlanner(it);
    if (!f) continue;
    const why = blockedReason(it);
    if (why) {
      blocked.push({ name: it.name, why });
      continue;
    }
    const d = daysLeft(it.expiry);
    const h = (have[f.id] ||= { g: 0, soon: 999, names: [], nutr: null });
    h.g += gramsOf(it, f);
    h.soon = Math.min(h.soon, d === null || d === undefined ? 999 : d);
    h.names.push(it.name + (it.brand ? ` (${it.brand})` : ''));
    // valori dell'etichetta se ci sono (più precisi della tabella)
    if (it.nutr && it.nutrSrc === 'etichetta' && it.nutr.p != null && it.nutr.c != null && it.nutr.f != null) h.nutr = it.nutr;
  }
  return { have, blocked };
}

// ---------------------------------------------------------------------------
// Frequenze della settimana (MN; PN dove diverso): dai menu salvati negli ultimi giorni
// ---------------------------------------------------------------------------
const LS_LOG = 'dm_planlog';
const lsGet = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
export function weekCounts(today = todayISO()) {
  const log = lsGet(LS_LOG, {});
  const c = { pesce: 0, legumi: 0, uova: 0, formaggio: 0, rossa: 0, bianca: 0, latticini: 0, tofu: 0 };
  const t0 = Date.parse(today);
  for (const [d, tags] of Object.entries(log)) {
    const ago = (t0 - Date.parse(d)) / 86400000;
    if (ago >= 1 && ago <= 6) for (const t of tags) if (t in c) c[t]++;
  }
  return c;
}
export function logPlan(plan, date = todayISO()) {
  const log = lsGet(LS_LOG, {});
  log[date] = plan.pasti.flatMap((m) => m.tags || []);
  const t0 = Date.parse(date);
  for (const d of Object.keys(log)) if ((t0 - Date.parse(d)) / 86400000 > 14) delete log[d];
  try {
    localStorage.setItem(LS_LOG, JSON.stringify(log));
  } catch {}
}
// limiti a settimana: [minimo consigliato, massimo]
const WEEK = {
  pesce: [3, 4, `pesce almeno 2-3 volte a settimana (${MN}, ${PN})`],
  legumi: [4, 14, `legumi almeno 3 volte a settimana (${MN}), anche tutti i giorni (${PN})`],
  uova: [0, 2, `uova non più di 4 a settimana (${MN})`], // 2 porzioni da 2 uova
  formaggio: [0, 2, `formaggi non più di 2 volte a settimana (${MN})`],
  rossa: [0, 1, `carne rossa magra al massimo una volta a settimana; limitare la carne rossa (${MN}, WCRF in ${PN})`],
  bianca: [0, 4, `carne da limitare, sostituendola con legumi e pesce (${MN})`],
  latticini: [0, 3, `latticini freschi in piccole quantità (${MN})`],
  tofu: [0, 3, ''],
};

// ---------------------------------------------------------------------------
// Costruzione dei pasti
// ---------------------------------------------------------------------------
const MEAL_SHARE = { Colazione: 0.2, Spuntino: 0.1, Pranzo: 0.35, Cena: 0.35 }; // MN: 20/10/30/10/30 con 5 pasti
const round = (x, step) => Math.max(0, Math.round(x / step) * step);
const n100 = (f, have) => (have?.[f.id]?.nutr ? { ...f, ...have[f.id].nutr, kcal: have[f.id].nutr.kcal ?? have[f.id].nutr.p * 4 + have[f.id].nutr.c * 4 + have[f.id].nutr.f * 9 } : f);
function line(f, g, have, used) {
  const v = n100(f, have);
  const k = g / 100;
  const avail = (have[f.id]?.g || 0) - (used[f.id] || 0);
  const fromHome = avail >= g * 0.6; // basta quasi tutta la porzione
  if (fromHome) used[f.id] = (used[f.id] || 0) + g;
  return { id: f.id, name: f.name, home: fromHome ? have[f.id].names[0] : null, g, kcal: v.kcal * k, p: v.p * k, c: v.c * k, f: v.f * k, fib: (f.fib || 0) * k, buy: fromHome ? null : f.buy || f.name, role: f.role, tag: f.tag, ml: f.ml };
}
const sum = (lines) => lines.reduce((t, l) => ({ kcal: t.kcal + l.kcal, p: t.p + l.p, c: t.c + l.c, f: t.f + l.f, fib: t.fib + l.fib }), { kcal: 0, p: 0, c: 0, f: 0, fib: 0 });

// punteggio di un alimento: in casa (soprattutto se scade), integrale, stagione, rotazione
function scoreFood(f, have, extra = 0) {
  const h = have[f.id];
  let s = extra;
  if (h && h.g > 0) s += 4 + (h.soon <= 2 ? 4 : h.soon <= 5 ? 2 : 0);
  if (f.whole) s += 2;
  return s;
}
function pick(list, have, seed, extra = () => 0) {
  const ranked = list.map((f) => ({ f, s: scoreFood(f, have, extra(f)) })).sort((a, b) => b.s - a.s);
  if (!ranked.length) return null;
  // seed > 0 = "Rifai": prende un'alternativa tra le migliori
  const top = ranked.filter((r) => r.s >= ranked[0].s - 3);
  return top[seed % top.length].f;
}

function seasonal(month) {
  return { veg: SEASON_VEG[month], fruit: SEASON_FRUIT[month] };
}

function chooseVeg(have, month, seed, avoid = []) {
  const sv = seasonal(month).veg;
  const list = FOODS.filter((f) => f.role === 'veg' && !avoid.includes(f.id) && (have[f.id]?.g > 0 || sv.includes(f.vegKey)));
  return pick(list, have, seed, (f) => (sv.includes(f.vegKey) ? 1 : 0) + (f.vegKey === 'insalata' ? -1 : 0));
}
function chooseFruit(have, month, seed, avoid = []) {
  const sf = seasonal(month).fruit;
  const list = FOODS.filter((f) => f.role === 'fruit' && !avoid.includes(f.id) && (have[f.id]?.g > 0 || sf.includes(f.fruitKey)));
  return pick(list, have, seed, (f) => (sf.includes(f.fruitKey) ? 1 : 0));
}

// fonte proteica di pranzo/cena secondo le frequenze della settimana
function chooseProtein(have, week, seed, avoidTags = []) {
  const need = (t) => {
    const [min, max] = WEEK[t] || [0, 99];
    if ((week[t] || 0) >= max) return -100;
    return (week[t] || 0) < min ? 3 : 0;
  };
  const base = { legumi: 3, pesce: 3, bianca: 1.5, uova: 1, latticini: 0.5, tofu: 0.5, formaggio: -1, rossa: -1 };
  const dried = ['lenticchie', 'cecisecchi', 'fagiolisecchi'];
  const list = FOODS.filter((f) => f.role === 'prot' && !avoidTags.includes(f.tag) && (!dried.includes(f.id) || have[f.id]?.g > 0));
  return pick(list, have, seed, (f) => (base[f.tag] || 0) + need(f.tag) + (have[f.id]?.g > 0 ? 0 : f.buy ? 0 : -3));
}
function chooseCarb(have, seed, prot, avoid = []) {
  const list = FOODS.filter((f) => f.role === 'carb' && !avoid.includes(f.id));
  return pick(list, have, seed, (f) => (f.buy ? 0 : have[f.id]?.g > 0 ? 0 : -3) + (prot?.tag === 'legumi' && f.tag === 'cereale' ? 1 : 0) + (f.tag === 'tubero' ? 0.5 : 0) + (f.tag === 'pane' ? -1.5 : 0));
}

// porzioni: proteine all'obiettivo, verdure fisse, carboidrati e olio per chiudere le calorie
function sizeMain(t, prot, carb, vegs, have, used, opts) {
  const vegG = opts.vegG;
  const oil = BYID.olio;
  const vg = vegs.map((v) => line(v, round(vegG / vegs.length, 50), have, {}));
  const vegT = sum(vg);
  const pv = prot ? n100(prot, have) : null;
  const cv = n100(carb, have);
  // proteine e carboidrati dipendono l'una dall'altro (anche i cereali hanno proteine): tre giri per stabilizzare
  let pG = prot ? prot.min : 0;
  let cG = carb.min;
  let oilG = 10;
  for (let k = 0; k < 3; k++) {
    if (prot) {
      pG = ((t.p - vegT.p - (cG / 100) * cv.p) / pv.p) * 100;
      const pMin = prot.piece ? prot.min : round(prot.min * 0.7, 10);
      pG = Math.min(prot.max, Math.max(pMin, pG));
      pG = prot.piece ? Math.max(prot.min, Math.round(pG / prot.piece) * prot.piece) : round(pG, prot.step || 10);
    }
    const pK = prot ? (pG / 100) * pv.kcal : 0;
    // olio per arrivare ai grassi del pasto (MN: 1 porzione = 10 g; PN: senza abusarne), poi i carboidrati chiudono le calorie
    if (t.f) {
      const fOther = vegT.f + (prot ? (pG / 100) * pv.f : 0) + (cG / 100) * cv.f;
      oilG = Math.min(opts.oilMax, Math.max(5, Math.round(t.f - fOther)));
    }
    cG = ((t.kcal - vegT.kcal - pK - oilG * 9) / cv.kcal) * 100;
    cG = Math.min(carb.max, Math.max(carb.min, round(cG, carb.step)));
  }
  if (!t.f) {
    const pK = prot ? (pG / 100) * pv.kcal : 0;
    const restK = t.kcal - vegT.kcal - pK - (cG / 100) * cv.kcal;
    oilG = Math.min(opts.oilMax, Math.max(5, round(restK / 9, 5)));
  }
  const lines = [];
  if (prot) lines.push(line(prot, pG, have, used));
  lines.push(line(carb, cG, have, used));
  lines.push(...vegs.map((v) => line(v, round(vegG / vegs.length, 50), have, used)));
  lines.push(line(oil, oilG, have, used));
  // se mancano ancora calorie, pane integrale (MN negli schemi) fino a 150 g
  const s = sum(lines);
  if (t.kcal - s.kcal > 120 && carb.tag !== 'pane') {
    const bread = BYID.paneint;
    const g = Math.min(150, round(((t.kcal - s.kcal) / bread.kcal) * 100, 10));
    if (g >= 30) lines.push(line(bread, g, have, used));
  }
  return lines;
}

function dishName(meal, lines) {
  const by = (r) => lines.filter((l) => l.role === r);
  const prot = by('prot')[0];
  const carb = by('carb').find((l) => l.id !== 'paneint' || by('carb').length === 1);
  // per le verdure di casa il nome vero (es. "bietole erbette" invece di "insalata"), senza marca
  const vegs = by('veg').map((l) => (l.home ? l.home.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\b(a rosette|in foglia|surgelat\w*|fresc\w*|bio)\b/gi, '').replace(/\s+/g, ' ').trim() : l.name).toLowerCase());
  const pf = prot ? BYID[prot.id] : null;
  const vegTxt = vegs.length ? ` con ${vegs.join(' e ')}` : '';
  if (meal === 'Colazione') {
    const has = (id) => lines.some((l) => l.id === id);
    const fr = by('fruit').map((l) => l.name.toLowerCase());
    const nu = by('nuts').map((l) => l.name.toLowerCase());
    const extra = [...(has('avena') && has('fette') ? ['fette biscottate integrali'] : []), ...fr, ...nu].join(', ').replace(/, ([^,]*)$/, ' e $1');
    if (has('avena') && has('latte')) return `Porridge d'avena con latte${extra ? ', ' + extra : ''}`;
    if (has('avena')) return `${has('greco') ? 'Yogurt greco' : 'Yogurt'} con avena${extra ? ', ' + extra : ''}`;
  }
  if (meal === 'Colazione' || meal === 'Spuntino') {
    const names = lines.filter((l) => l.role !== 'fat').map((l) => l.name.toLowerCase());
    return names.length ? names[0].charAt(0).toUpperCase() + names[0].slice(1) + (names.length > 1 ? ' con ' + names.slice(1).join(', ') : '') : meal;
  }
  if (pf?.tag === 'legumi' && carb && ['cereale'].includes(BYID[carb.id].tag)) return `${carb.name} e ${pf.name.toLowerCase().replace(/ (secchi|secche|lessati)$/, '')}${vegTxt}`;
  const p = pf ? `${pf.name}${pf.cook ? ' ' + pf.cook : ''}` : '';
  const c = carb ? carb.name.toLowerCase() : '';
  if (carb && BYID[carb.id].tag === 'cereale') return `${carb.name} ${vegs[0] ? 'con ' + vegs[0] : 'al pomodoro'}, poi ${p.toLowerCase()}${vegs[1] ? ' e ' + vegs[1] : ''}`;
  return `${p}${c ? ` con ${c}` : ''}${vegs.length ? ` e ${vegs.join(' e ')}` : ''}`;
}

// MN: frutta secca 20-30 g al giorno in tutto (colazione + spuntino)
const NUTS_DAY = 30;
function breakfast(t, have, used, month, seed, opts) {
  const lines = [];
  const dairy = pick(FOODS.filter((f) => f.role === 'latte'), have, seed, (f) => (f.id === 'greco' ? 1.5 : f.id === 'latte' ? 0.5 : 0) + (opts.lactose && f.id === 'latte' ? -1 : 0));
  const cer = pick(FOODS.filter((f) => f.role === 'cereale' && f.tag === 'colazione'), have, seed, (f) => (f.id === 'avena' ? 1 : 0) + (f.id === 'cornflakes' ? -2 : 0));
  const fr = chooseFruit(have, month, seed, opts.avoidFruit);
  const dG = dairy.piece ? dairy.piece * (t.p > 25 ? 2 : 1) : round(Math.min(dairy.max, Math.max(dairy.min, ((t.p * 0.6) / dairy.p) * 100)), dairy.step);
  lines.push(line(dairy, dG, have, used));
  lines.push(line(fr, 150, have, used)); // MN: una porzione di frutta = 150 g
  let s = sum(lines);
  const nuts = pick(FOODS.filter((f) => f.role === 'nuts'), have, seed);
  const cv = n100(cer, have);
  const cG = round(Math.min(cer.max, Math.max(cer.min, ((t.kcal - s.kcal - 15 * 6.5) / cv.kcal) * 100)), cer.step);
  lines.splice(1, 0, line(cer, cG, have, used));
  s = sum(lines);
  // frutta secca al massimo 20 g a colazione, così ne resta per lo spuntino
  const nG = Math.min(20, Math.max(0, round(((t.kcal - s.kcal) / nuts.kcal) * 100, 5)));
  if (nG >= 5) lines.push(line(nuts, Math.max(10, nG), have, used));
  // se mancano ancora calorie: fette biscottate integrali (MN, colazione)
  s = sum(lines);
  if (t.kcal - s.kcal > 70 && cer.id !== 'fette') {
    const fe = BYID.fette;
    lines.splice(2, 0, line(fe, Math.min(fe.max, Math.max(fe.min, round(((t.kcal - s.kcal) / fe.kcal) * 100, 5))), have, used));
  }
  return lines;
}
function snack(t, have, used, month, seed, opts) {
  const fr = chooseFruit(have, month, seed + 1, opts.avoidFruit);
  const lines = [line(fr, 150, have, used)];
  const nutsLeft = NUTS_DAY - (opts.nutsG || 0);
  const rest = t.kcal - sum(lines).kcal;
  if (rest > 35) {
    // MN: frutta secca come spuntino (20-30 g al giorno in tutto); yogurt greco se servono proteine; cracker integrali
    const needP = opts.pk >= 1.4 && t.p >= 10;
    const cand = FOODS.filter((f) => (f.role === 'nuts' && nutsLeft >= 10) || (f.role === 'latte' && f.id !== 'latte' && !(f.id === 'greco' && !needP && opts.dairy?.includes('greco'))) || f.id === 'cracker');
    const opt = pick(cand, have, seed, (f) => (f.role === 'nuts' ? (nutsLeft * 6 >= rest * 0.7 ? 0.5 : -0.8) : 0) + (f.id === 'greco' ? (needP ? 1 : -1) : 0) + (f.id === 'cracker' ? (nutsLeft >= 20 ? -1 : 0.3) : 0));
    const max = opt.role === 'nuts' ? Math.min(opt.max, nutsLeft) : opt.role === 'latte' ? 170 : opt.max;
    const g = opt.piece ? opt.piece : round(Math.min(max, Math.max(opt.min, (rest / n100(opt, have).kcal) * 100)), opt.step);
    lines.push(line(opt, g, have, used));
    const rest2 = t.kcal - sum(lines).kcal;
    if (rest2 > 40 && opt.role !== 'nuts' && nutsLeft >= 10) {
      const nuts = pick(FOODS.filter((f) => f.role === 'nuts'), have, seed);
      lines.push(line(nuts, Math.min(nutsLeft, Math.max(10, round((rest2 / nuts.kcal) * 100, 5))), have, used));
    }
    const rest3 = t.kcal - sum(lines).kcal;
    if (rest3 > 80 && !lines.some((l) => l.id === 'cracker')) {
      const cr = BYID.cracker;
      lines.push(line(cr, Math.min(cr.max, Math.max(cr.min, round((rest3 / cr.kcal) * 100, 5))), have, used));
    }
  }
  return lines;
}

// pasto dopo l'allenamento (PN: più carboidrati entro ~2 ore dopo)
function postTrainingMeal(quando = '') {
  if (/digiuno|mattina/.test(quando)) return 'Colazione';
  if (/pranzo/.test(quando)) return 'Pranzo';
  if (/pomeriggio|sera/.test(quando)) return 'Cena';
  return 'Cena';
}

// ---------------------------------------------------------------------------
// Menu
// opts: { only: ['Cena'], seed: {Cena: 1}, keep: plan già fatto }
// ---------------------------------------------------------------------------
export function planDay({ items, person = {}, only = null, seed = {}, keep = null, date = todayISO() }) {
  const T = dailyTargets(person);
  const month = new Date(date).getMonth();
  const { have, blocked } = readPantry(items);
  const week = weekCounts(date);
  const meals = only?.length ? only : MEALS;
  const note = (person.note || '').toLowerCase();
  const opts = { lactose: /lattosio/.test(note), vegetarian: /vegetarian|vegan/.test(note) };
  const used = {};
  // quote: MN; PN: più carboidrati dopo l'allenamento
  const share = { ...MEAL_SHARE };
  const post = T.trains ? postTrainingMeal(person.oggi?.quando) : null;
  if (post) {
    share[post] += 0.05;
    const others = MEALS.filter((m) => m !== post && m !== 'Spuntino');
    others.forEach((m) => (share[m] -= 0.05 / others.length));
  }
  const kept = keep ? keep.pasti.filter((m) => !meals.includes(m.pasto)) : [];
  const keptTags = kept.flatMap((m) => m.tags || []);
  const pasti = [];
  const usedProt = [...keptTags];
  const usedFruit = kept.flatMap((m) => m.lines.filter((l) => l.role === 'fruit').map((l) => l.id));
  const usedVeg = kept.flatMap((m) => m.lines.filter((l) => l.role === 'veg').map((l) => l.id));
  const usedCarb = kept.flatMap((m) => m.lines.filter((l) => l.role === 'carb').map((l) => l.id));
  for (const meal of MEALS) {
    if (!meals.includes(meal)) continue;
    const s = seed[meal] || 0;
    const t = { kcal: T.kcal * share[meal], p: T.protein * share[meal], c: T.carbs * share[meal], f: T.fat * share[meal], share: share[meal] };
    let lines;
    // proteine date in più (o in meno) dai pasti precedenti: si compensano nei principali rimasti
    let tSize = t;
    if (meal === 'Pranzo' || meal === 'Cena') {
      const done = [...kept, ...pasti].filter((m) => MEALS.indexOf(m.pasto) < MEALS.indexOf(meal));
      const extra = done.reduce((x, m) => x + (m.p - T.protein * share[m.pasto]), 0);
      const left = meals.filter((m) => (m === 'Pranzo' || m === 'Cena') && MEALS.indexOf(m) >= MEALS.indexOf(meal)).length || 1;
      tSize = { ...t, p: Math.min(t.p * 1.5, Math.max(t.p * 0.6, t.p - extra / left)) };
    }
    const why = [];
    if (meal === 'Colazione') {
      lines = breakfast(t, have, used, month, s, { ...opts, avoidFruit: usedFruit });
      why.push(`Colazione circa ${Math.round(share[meal] * 100)}% delle calorie (${MN}); frutta anche a colazione (${MN}); latte o yogurt bianco senza zuccheri aggiunti (${PN}).`);
    } else if (meal === 'Spuntino') {
      lines = snack(t, have, used, month, s, { pk: T.protein / T.wCalc, avoidFruit: usedFruit, dairy: [...kept, ...pasti].flatMap((m) => m.lines.filter((l) => l.role === 'latte').map((l) => l.id)), nutsG: [...kept, ...pasti].flatMap((m) => m.lines).filter((l) => l.role === 'nuts').reduce((g, l) => g + l.g, 0) });
      why.push(`Spuntino con frutta (${MN}: un frutto è un ottimo spuntino); frutta secca 20-30 g (${MN}).`);
    } else {
      const avoidTags = [...usedProt]; // varietà: fonti proteiche diverse a pranzo e a cena
      if (opts.vegetarian) avoidTags.push('bianca', 'rossa', 'pesce');
      const prot = chooseProtein(have, { ...week, ...Object.fromEntries(keptTags.map((x) => [x, (week[x] || 0) + 1])) }, s, avoidTags);
      const carb = chooseCarb(have, s, prot, usedCarb); // varietà: carboidrati diversi a pranzo e a cena
      usedCarb.push(carb.id);
      const v1 = chooseVeg(have, month, s, usedVeg);
      const v2 = chooseVeg(have, month, s + 1, [...usedVeg, v1?.id]);
      const vegs = [v1, v2].filter(Boolean);
      lines = sizeMain(tSize, prot, carb, vegs, have, used, { vegG: 250, oilMax: 20 });
      usedProt.push(prot.tag);
      usedVeg.push(...vegs.map((v) => v.id));
      if (meal === post) why.push(`Dopo l'allenamento più carboidrati (${PN}).`);
      why.push(`Verdura a ogni pasto principale, porzione 200-250 g (${MN}, ${PN}).`);
      const w = WEEK[prot.tag]?.[2];
      if (w) why.push(w[0].toUpperCase() + w.slice(1) + `: in questa settimana ${week[prot.tag] || 0} volte prima di oggi.`);
      if (BYID[carb.id]?.whole) why.push(`Cereali integrali (${MN}, ${PN}).`);
      if (carb.tag === 'tubero') why.push(`Patate: il carboidrato più naturale e saziante (${PN}).`);
      why.push(`Olio extravergine d'oliva, a crudo quando si può (${PN}, ${MN}).`);
    }
    usedFruit.push(...lines.filter((l) => l.role === 'fruit').map((l) => l.id));
    const tot = sum(lines);
    pasti.push({ pasto: meal, piatto: dishName(meal, lines), lines, ...tot, target: t, why, tags: lines.filter((l) => l.role === 'prot').map((l) => l.tag) });
  }
  // con tutta la giornata senza spuntino o con poca frutta: aggiungi la frutta ai pasti (MN 2-3 porzioni, PN 2 frutti)
  const all = [...kept, ...pasti].sort((a, b) => MEALS.indexOf(a.pasto) - MEALS.indexOf(b.pasto));
  const fruitN = all.reduce((n, m) => n + m.lines.filter((l) => l.role === 'fruit').length, 0);
  if (!only && fruitN < 2) {
    const m = pasti.find((x) => x.pasto === 'Pranzo') || pasti[pasti.length - 1];
    const fr = chooseFruit(have, month, (seed[m.pasto] || 0) + 2, usedFruit);
    m.lines.push(line(fr, 150, have, used));
    Object.assign(m, sum(m.lines));
  }
  // bilanciamento finale della giornata: carboidrati dei pasti principali per le calorie, olio per i grassi (min 20%, MN)
  const complete = !only || MEALS.every((m) => all.some((x) => x.pasto === m));
  if (complete) {
    // si ritoccano solo i pasti appena fatti (quelli tenuti restano com'erano)
    const mains = pasti.filter((m) => m.pasto === 'Pranzo' || m.pasto === 'Cena');
    const resize = (m, l, g) => {
      const f = BYID[l.id];
      const v = n100(f, have);
      const k = g / 100;
      Object.assign(l, { g, kcal: v.kcal * k, p: v.p * k, c: v.c * k, f: v.f * k, fib: (f.fib || 0) * k });
      Object.assign(m, sum(m.lines));
    };
    for (let k = 0; k < 8; k++) {
      const d = sum(all.flatMap((m) => m.lines));
      const fp = (d.f * 9) / d.kcal;
      if (fp < 0.2 || (fp > 0.3 && d.f > T.fat * 1.1)) {
        let moved = false;
        for (const m of mains) {
          const oil = m.lines.find((l) => l.id === 'olio');
          if (oil && fp < 0.2 && oil.g < 20) resize(m, oil, oil.g + 5), (moved = true);
          if (oil && fp > 0.3 && oil.g > 5) resize(m, oil, Math.max(5, oil.g - 5)), (moved = true);
        }
        if (moved) continue;
      }
      // proteine fuori dai limiti: si ritocca la porzione proteica dei pasti principali (poi i carboidrati chiudono le calorie)
      const pHi = d.p > T.pMax * 0.97;
      const pLo = d.p < 0.92 * T.protein;
      if (pHi || pLo) {
        let moved = false;
        for (const m of mains) {
          const l = m.lines.find((x) => x.role === 'prot');
          const f = l && BYID[l.id];
          if (!f) continue;
          const st = f.piece || f.step || 10;
          const lo = f.piece ? f.min : round(f.min * 0.7, 10);
          const ng = pHi ? Math.max(lo, l.g - st) : Math.min(f.max, l.g + st);
          if (ng !== l.g) resize(m, l, ng), (moved = true);
        }
        if (moved) continue;
      }
      const gap = T.kcal - d.kcal;
      if (Math.abs(gap) / T.kcal <= 0.04) break;
      for (const m of mains) {
        // calorie in più: prima si toglie il pane aggiunto
        const extraBread = m.lines.find((x) => x.id === 'paneint' && m.lines.some((y) => y.role === 'carb' && y.id !== 'paneint'));
        if (gap < 0 && extraBread) {
          const ng = round(extraBread.g + ((gap / mains.length) / BYID.paneint.kcal) * 100, 10);
          if (ng < 30) m.lines.splice(m.lines.indexOf(extraBread), 1), Object.assign(m, sum(m.lines));
          else resize(m, extraBread, ng);
          continue;
        }
        const l = m.lines.find((x) => x.role === 'carb' && x.id !== 'paneint') || m.lines.find((x) => x.role === 'carb');
        if (!l) continue;
        const f = BYID[l.id];
        const ng = Math.min(f.max, Math.max(f.min, round(l.g + ((gap / mains.length) / n100(f, have).kcal) * 100, f.step)));
        if (ng !== l.g) resize(m, l, ng);
        else if (gap > 0 && ng === f.max) {
          // carboidrato già alla porzione massima: pane integrale (MN) fino a 150 g
          let b = m.lines.find((x) => x.id === 'paneint');
          if (!b && l.id !== 'paneint' && BYID[l.id].tag !== 'pane') m.lines.splice(m.lines.indexOf(l) + 1, 0, (b = line(BYID.paneint, 30, have, used)));
          if (b && b.g < 150) resize(m, b, Math.min(150, Math.max(30, round(b.g + ((gap / mains.length) / BYID.paneint.kcal) * 100, 10))));
        }
      }
    }
  }
  const day = sum(all.flatMap((m) => m.lines));
  const vegG = all.flatMap((m) => m.lines).filter((l) => l.role === 'veg').reduce((g, l) => g + l.g, 0);
  const fruits = all.flatMap((m) => m.lines).filter((l) => l.role === 'fruit').length;
  const buy = [...new Set(all.flatMap((m) => m.lines.filter((l) => l.buy).map((l) => l.buy)))];
  // controlli finali con i libri (anche dopo aver rifatto un pasto, se la giornata è completa)
  const fullDay = complete;
  const checks = [];
  if (fullDay) {
    const diff = (day.kcal - T.kcal) / T.kcal;
    checks.push({ ok: Math.abs(diff) <= 0.1, txt: `Calorie ${Math.round(day.kcal)} su ${T.kcal} (${diff >= 0 ? '+' : ''}${Math.round(diff * 100)}%)` });
    const pMax = T.pMax;
    checks.push({ ok: day.p >= T.protein * 0.9 && day.p <= pMax, txt: `Proteine ${Math.round(day.p)} g (obiettivo ${T.protein} g, massimo prudente ${pMax} g: ${T.sporty ? `2 g/kg, il tetto di ${PN} per chi si allena` : `il doppio del raccomandato, ${MN}`})` });
    checks.push({ ok: (day.f * 9) / day.kcal <= 0.35 && (day.f * 9) / day.kcal >= 0.195, txt: `Grassi ${Math.round(day.f)} g, ${Math.round(((day.f * 9) / day.kcal) * 100)}% delle calorie (${MN}: 20-35%)` });
    checks.push({ ok: day.c / T.wCalc >= 1.95, txt: `Carboidrati ${Math.round(day.c)} g, ${(day.c / T.wCalc).toFixed(1)} g/kg${T.wCalc !== T.w ? ` del peso desiderabile (${MN})` : ''} (${MN}: almeno 2)` });
    checks.push({ ok: vegG >= 400, txt: `Verdure ${vegG} g (almeno 400)` });
    checks.push({ ok: fruits >= 2, txt: `Frutta ${fruits} porzioni (${MN} 2-3, ${PN} 2)` });
    checks.push({ ok: day.fib >= 25, txt: `Fibre circa ${Math.round(day.fib)} g (${MN}: almeno 25)` });
  }
  return { date, targets: T, pasti: all, day, vegG, fruits, buy, blocked, checks, only: fullDay ? null : all.map((m) => m.pasto) };
}

// ---------------------------------------------------------------------------
// Spesa della settimana secondo i libri, tolto quello che c'è
// ---------------------------------------------------------------------------
export function weeklyShopping({ items, person = {}, days = 7, date = todayISO() }) {
  const T = dailyTargets({ ...person, oggi: null });
  const month = new Date(date).getMonth();
  const { have } = readPantry(items);
  const k = days / 7;
  const sv = SEASON_VEG[month];
  const sf = SEASON_FRUIT[month];
  // porzioni settimanali dai libri
  const out = [];
  const add = (id, g, perche) => {
    const f = BYID[id];
    const need = Math.max(0, g - (have[id]?.g || 0));
    if (need < (f.min || 50) * 0.8) return;
    out.push({ id, nome: f.buy || f.name, g: need, perche, piece: f.piece, ml: f.ml });
  };
  const wk = (x) => Math.round(x * k);
  // verdure: 400-500 g al giorno, di stagione, 4 varietà
  const vegs = sv.filter((v) => BYID['v_' + v]).slice(0, 4);
  vegs.forEach((v) => add('v_' + v, wk((450 * 7) / vegs.length), `verdura di stagione, ${MN} e ${PN}`));
  // frutta: 2-3 porzioni da 150 g al giorno
  const frs = sf.filter((v) => BYID['f_' + v]).slice(0, 3);
  frs.forEach((v) => add('f_' + v, wk((2.5 * 150 * 7) / frs.length), `frutta di stagione, 2-3 al giorno (${MN})`));
  // proteine: pesce 3, legumi 4, carne bianca 2-3, uova 4, latticini freschi 1
  add('merluzzo', wk(200 * 2), `pesce almeno 2-3 volte a settimana (${MN})`);
  add('sgombro', wk(180), `pesce azzurro: omega-3 e poco mercurio (${PN})`);
  add('ceci', wk(250 * 2), `legumi almeno 3 volte a settimana (${MN})`);
  add('lenticchie', wk(80 * 2), 'legumi secchi, più economici');
  add('petto', wk(160 * 3), `carne bianca magra (${PN}: petto di pollo e tacchino prime scelte)`);
  add('uova', wk(55 * 4), `uova, non più di 4 a settimana (${MN})`);
  add('fiocchi', wk(200), 'latticino fresco e proteico');
  // colazione e spuntini
  add('greco', wk(170 * 4), `yogurt bianco senza zucchero (${PN})`);
  add('latte', wk(200 * 3), `latte parzialmente scremato (${MN})`);
  add('avena', wk(50 * 7), `avena: cereale integrale poco lavorato (${PN})`);
  add('noci', wk(20 * 7), `frutta secca 20-30 g (${MN})`);
  // carboidrati: circa metà del fabbisogno di carboidrati da cereali e patate
  const cerG = Math.round((T.carbs * 0.45 * 7) / 0.65); // grammi crudi di cereali (circa 65% carboidrati)
  add('pastaint', wk(cerG * 0.35), `cereali integrali (${MN}, ${PN})`);
  add('risoint', wk(cerG * 0.25), `cereali integrali (${MN}, ${PN})`);
  add('farro', wk(cerG * 0.15), 'cereale integrale in chicco');
  add('patate', wk(250 * 3), `patate: carboidrato naturale e saziante (${PN})`);
  add('paneint', wk(60 * 7), `pane integrale o di segale (${PN})`);
  add('olio', wk(25 * 7), `olio extravergine d'oliva, anche a crudo (${PN}, ${MN})`);
  // in confezioni da supermercato
  return out.map((x) => {
    let quantita;
    let unita;
    if (x.piece && x.id === 'uova') (quantita = Math.ceil(x.g / 55 / 2) * 2), (unita = 'pz');
    else if (x.piece && x.id.startsWith('f_')) (quantita = Math.max(1, Math.round(x.g / x.piece))), (unita = 'pz');
    else if (x.piece) (quantita = Math.max(1, Math.ceil(x.g / x.piece))), (unita = 'pz');
    else if (x.ml) (quantita = x.g >= 900 ? Math.ceil(x.g / 1000) : 0.5), (unita = 'l');
    else if (x.g >= 900) (quantita = Math.round(x.g / 500) / 2), (unita = 'kg');
    else (quantita = Math.max(100, Math.ceil(x.g / 50) * 50)), (unita = 'g');
    return { nome: x.nome, quantita, unita, perche: x.perche };
  });
}

// testo di una riga per la spesa e i pasti
export const lineText = (l) => {
  const f = BYID[l.id];
  if (f?.piece === 55) {
    const n = Math.round(l.g / 55);
    return `${n} ${n === 1 ? 'uovo' : 'uova'}${l.home && !/^uov/i.test(l.home) ? ` (${l.home})` : ''}${l.buy ? ' (da comprare)' : ''}`;
  }
  return `${l.home || l.name} ${Math.round(l.g)} ${l.ml ? 'ml' : 'g'}${l.buy ? ' (da comprare)' : ''}`;
};
