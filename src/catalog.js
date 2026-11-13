// Catalogo dei cibi: serve per l'aggiunta rapida, per scegliere l'icona giusta
// e per stimare la scadenza quando non la scrivi.
// Riga: [chiave, nome, icona, categoria, posto (F frigo, Z freezer, D dispensa),
//        giorni di durata tipica, unità, parole chiave extra separate da |, ruolo a cena (opzionale)]

export const CATEGORIES = [
  { id: 'verdura', name: 'Verdura', icon: '1f966', role: 'veg' },
  { id: 'frutta', name: 'Frutta', icon: '1f34e', role: 'frutta' },
  { id: 'carne', name: 'Carne e salumi', icon: '1f969', role: 'prot' },
  { id: 'pesce', name: 'Pesce', icon: '1f41f', role: 'prot' },
  { id: 'latticini', name: 'Latte, uova e formaggi', icon: '1f9c0', role: 'extra' },
  { id: 'pane', name: 'Pane, pasta e cereali', icon: '1f35e', role: 'carb' },
  { id: 'dispensa', name: 'Scatolame e condimenti', icon: '1f96b', role: 'cond' },
  { id: 'dolci', name: 'Dolci e snack', icon: '1f36a', role: 'extra' },
  { id: 'bevande', name: 'Bevande', icon: 'acqua', role: 'bev' },
  { id: 'pronti', name: 'Piatti pronti e avanzi', icon: 'avanzi', role: 'pronto' },
];

export const LOCATIONS = [
  { id: 'frigo', name: 'Frigo', icon: '1f9ca', short: 'F' },
  { id: 'freezer', name: 'Freezer', icon: '2744', short: 'Z' },
  { id: 'dispensa', name: 'Dispensa', icon: '1f9fa', short: 'D' },
];

export const UNITS = ['pz', 'conf', 'g', 'kg', 'ml', 'l'];

const ROWS = [
  // --- Verdura ---
  ['pomodoro', 'Pomodori', '1f345', 'verdura', 'F', 7, 'pz', 'pomodorini|ciliegini|datterini|pachino'],
  ['insalata', 'Insalata', '1f96c', 'verdura', 'F', 5, 'conf', 'lattuga|iceberg|valeriana|songino|misticanza|cavolo|verza|bietole|cicoria'],
  ['spinaci', 'Spinaci', '1f96c', 'verdura', 'F', 4, 'conf', 'spinacino'],
  ['rucola', 'Rucola', '1f33f', 'verdura', 'F', 4, 'conf', 'rughetta'],
  ['carota', 'Carote', '1f955', 'verdura', 'F', 21, 'pz', ''],
  ['patata', 'Patate', '1f954', 'verdura', 'D', 30, 'kg', '', 'carb'],
  ['patatadolce', 'Patate dolci', '1f360', 'verdura', 'D', 21, 'pz', 'patata dolce|patate americane|batata', 'carb'],
  ['cipolla', 'Cipolle', '1f9c5', 'verdura', 'D', 30, 'pz', 'cipollotto|scalogno'],
  ['aglio', 'Aglio', '1f9c4', 'verdura', 'D', 60, 'pz', '', 'cond'],
  ['zucchina', 'Zucchine', 'zucchina', 'verdura', 'F', 7, 'pz', 'zucchini'],
  ['melanzana', 'Melanzane', '1f346', 'verdura', 'F', 7, 'pz', ''],
  ['peperone', 'Peperoni', '1fad1', 'verdura', 'F', 8, 'pz', ''],
  ['peperoncino', 'Peperoncino', '1f336', 'verdura', 'F', 14, 'pz', '', 'cond'],
  ['cetriolo', 'Cetrioli', '1f952', 'verdura', 'F', 7, 'pz', 'cetriolini'],
  ['broccoli', 'Broccoli', '1f966', 'verdura', 'F', 5, 'pz', 'broccolo|broccoletti|cime di rapa'],
  ['cavolfiore', 'Cavolfiore', 'cavolfiore', 'verdura', 'F', 7, 'pz', 'cavolfiori'],
  ['finocchio', 'Finocchi', 'finocchio', 'verdura', 'F', 7, 'pz', ''],
  ['funghi', 'Funghi', '1f344-200d-1f7eb', 'verdura', 'F', 5, 'conf', 'fungo|champignon|porcini'],
  ['mais', 'Mais', '1f33d', 'verdura', 'D', 365, 'conf', 'pannocchia|pannocchie'],
  ['avocado', 'Avocado', '1f951', 'verdura', 'F', 5, 'pz', ''],
  ['sedano', 'Sedano', 'sedano', 'verdura', 'F', 10, 'pz', ''],
  ['porro', 'Porri', 'porro', 'verdura', 'F', 10, 'pz', ''],
  ['asparagi', 'Asparagi', 'asparagi', 'verdura', 'F', 4, 'conf', 'asparago'],
  ['carciofo', 'Carciofi', 'carciofo', 'verdura', 'F', 6, 'pz', ''],
  ['radicchio', 'Radicchio', 'radicchio', 'verdura', 'F', 7, 'pz', 'cavolo rosso|cavolo viola'],
  ['fagiolini', 'Fagiolini', 'fagiolini', 'verdura', 'F', 5, 'conf', 'fagiolino|taccole'],
  ['piselli', 'Piselli', '1fadb', 'verdura', 'Z', 180, 'conf', 'pisello|pisellini'],
  ['zucca', 'Zucca', '1f383', 'verdura', 'D', 30, 'pz', ''],
  ['barbabietola', 'Barbabietole', '1fadc', 'verdura', 'F', 10, 'conf', 'rapa|rape|ravanelli|ravanello'],
  ['zenzero', 'Zenzero', '1fada', 'verdura', 'F', 21, 'pz', '', 'cond'],
  ['erbe', 'Erbe aromatiche', '1f33f', 'verdura', 'F', 7, 'conf', 'basilico|prezzemolo|rosmarino|salvia|menta|erba cipollina|timo', 'cond'],
  ['olive', 'Olive', '1fad2', 'verdura', 'F', 30, 'conf', 'oliva', 'extra'],
  ['verduresurgelate', 'Verdure surgelate', 'surgelati', 'verdura', 'Z', 365, 'conf', 'surgelato|surgelati|surgelate|contorno surgelato'],
  // --- Frutta ---
  ['mela', 'Mele', '1f34e', 'frutta', 'F', 21, 'pz', 'mele'],
  ['melaverde', 'Mele verdi', '1f34f', 'frutta', 'F', 21, 'pz', 'mela verde|granny'],
  ['pera', 'Pere', '1f350', 'frutta', 'F', 10, 'pz', 'pere'],
  ['banana', 'Banane', '1f34c', 'frutta', 'D', 5, 'pz', 'banane'],
  ['arancia', 'Arance', '1f34a', 'frutta', 'F', 14, 'pz', 'arance|mandarino|mandarini|clementine|clementina|mandaranci'],
  ['limone', 'Limoni', '1f34b', 'frutta', 'F', 21, 'pz', 'lime'],
  ['fragola', 'Fragole', '1f353', 'frutta', 'F', 3, 'conf', 'fragole|lamponi|lampone'],
  ['ciliegia', 'Ciliegie', '1f352', 'frutta', 'F', 5, 'conf', 'ciliegie|amarene'],
  ['uva', 'Uva', '1f347', 'frutta', 'F', 7, 'conf', ''],
  ['pesca', 'Pesche', '1f351', 'frutta', 'F', 5, 'pz', 'pesche|albicocca|albicocche|nettarina|nettarine|percoche'],
  ['prugna', 'Prugne', 'prugna', 'frutta', 'F', 7, 'pz', 'prugne|susina|susine'],
  ['fico', 'Fichi', 'fico', 'frutta', 'F', 3, 'pz', 'fichi'],
  ['kiwi', 'Kiwi', '1f95d', 'frutta', 'F', 14, 'pz', ''],
  ['ananas', 'Ananas', '1f34d', 'frutta', 'F', 5, 'pz', ''],
  ['mango', 'Mango', '1f96d', 'frutta', 'F', 5, 'pz', 'papaya'],
  ['melone', 'Melone', '1f348', 'frutta', 'F', 5, 'pz', 'meloni'],
  ['anguria', 'Anguria', '1f349', 'frutta', 'F', 5, 'pz', 'cocomero'],
  ['mirtilli', 'Mirtilli', '1fad0', 'frutta', 'F', 5, 'conf', 'mirtillo|more|frutti di bosco'],
  ['cocco', 'Cocco', '1f965', 'frutta', 'D', 14, 'pz', ''],
  ['noci', 'Noci', 'noce', 'frutta', 'D', 180, 'conf', 'noce|nocciole|nocciola|frutta secca|pistacchi|anacardi', 'extra'],
  ['mandorle', 'Mandorle', 'mandorla', 'frutta', 'D', 180, 'conf', 'mandorla|pinoli', 'extra'],
  ['arachidi', 'Arachidi', '1f95c', 'frutta', 'D', 180, 'conf', 'noccioline|burro di arachidi', 'extra'],
  ['castagne', 'Castagne', '1f330', 'frutta', 'D', 14, 'conf', 'castagna|marroni', 'extra'],
  // --- Carne e salumi ---
  ['petto', 'Petto di pollo', 'petto', 'carne', 'F', 2, 'conf', 'pollo|fesa|fettine di pollo|straccetti'],
  ['cosce', 'Cosce di pollo', '1f357', 'carne', 'F', 2, 'conf', 'coscia|cosce|fusi|sovracosce|alette|ali di pollo'],
  ['pollointero', 'Pollo intero', '1f414', 'carne', 'F', 2, 'pz', 'pollo arrosto|galletto|gallina'],
  ['bistecca', 'Bistecca', '1f969', 'carne', 'F', 3, 'pz', 'manzo|vitello|fettine|scaloppine|tagliata|filetto|carne|arrosto|spezzatino|roast beef'],
  ['macinato', 'Macinato', 'macinato', 'carne', 'F', 2, 'conf', 'carne macinata|trita|tritata|polpette|ragu fresco'],
  ['hamburger', 'Hamburger', '1f354', 'carne', 'F', 2, 'pz', 'burger|svizzere|svizzera'],
  ['salsiccia', 'Salsiccia', '1f32d', 'carne', 'F', 3, 'conf', 'salsicce|salamella|luganega|hot dog'],
  ['wurstel', 'Wurstel', 'wurstel', 'carne', 'F', 30, 'conf', 'wuerstel|wrustel|wüstel'],
  ['pancetta', 'Pancetta', '1f953', 'carne', 'F', 14, 'conf', 'bacon|guanciale|speck|lardo'],
  ['prosciutto', 'Prosciutto', 'prosciutto', 'carne', 'F', 5, 'conf', 'prosciutto cotto|prosciutto crudo|affettato|affettati|mortadella|bresaola|fesa di tacchino|coppa'],
  ['salame', 'Salame', 'salame', 'carne', 'F', 30, 'pz', 'salami|salamino|soppressata|nduja|cacciatorino'],
  ['maiale', 'Maiale', '1f416', 'carne', 'F', 3, 'conf', 'lonza|braciole|braciola|arista|costine|puntine|suino'],
  ['tacchino', 'Tacchino', '1f983', 'carne', 'F', 2, 'conf', ''],
  ['cotoletta', 'Cotolette', 'cotoletta', 'carne', 'F', 3, 'conf', 'cotoletta|cordon bleu|impanato|nuggets|crocchette di pollo'],
  ['costata', 'Carne con osso', '1f356', 'carne', 'F', 3, 'pz', 'costata|fiorentina|stinco|ossobuco'],
  ['agnello', 'Agnello', '1f411', 'carne', 'F', 3, 'conf', 'abbacchio|pecora'],
  ['coniglio', 'Coniglio', '1f407', 'carne', 'F', 2, 'conf', ''],
  ['spiedini', 'Spiedini', '1f362', 'carne', 'F', 2, 'conf', 'spiedino|arrosticini'],
  ['kebab', 'Kebab', '1f959', 'carne', 'F', 2, 'pz', 'gyros'],
  // --- Pesce ---
  ['pesce', 'Pesce', '1f41f', 'pesce', 'F', 2, 'pz', 'pesci|orata|branzino|spigola|merluzzo|nasello|platessa|sogliola|trota|pesce spada|filetti di pesce|sgombro fresco'],
  ['salmone', 'Salmone', 'salmone', 'pesce', 'F', 2, 'conf', 'salmone affumicato|trancio'],
  ['tonno', 'Tonno in scatola', 'tonno', 'pesce', 'D', 730, 'conf', 'tonno|scatolette di tonno|sgombro|sardine|acciughe|alici'],
  ['gamberi', 'Gamberi', '1f990', 'pesce', 'F', 2, 'conf', 'gambero|gamberetti|mazzancolle|scampi'],
  ['calamari', 'Calamari', '1f991', 'pesce', 'F', 2, 'conf', 'calamaro|seppie|seppia|totani'],
  ['polpo', 'Polpo', '1f419', 'pesce', 'F', 2, 'pz', 'polipo|moscardini'],
  ['cozze', 'Cozze e vongole', 'cozze', 'pesce', 'F', 1, 'conf', 'cozza|vongole|vongola|frutti di mare'],
  ['granchio', 'Granchio e surimi', '1f980', 'pesce', 'F', 3, 'conf', 'surimi|polpa di granchio'],
  ['bastoncini', 'Bastoncini di pesce', 'bastoncini', 'pesce', 'Z', 180, 'conf', 'bastoncini|findus|pesce impanato'],
  ['sushi', 'Sushi', '1f363', 'pesce', 'F', 1, 'conf', 'sashimi|poke'],
  ['pescefritto', 'Frittura di pesce', '1f364', 'pesce', 'Z', 120, 'conf', 'frittura|tempura|gamberi fritti'],
  ['aragosta', 'Aragosta', '1f99e', 'pesce', 'F', 1, 'pz', 'astice'],
  ['ostriche', 'Ostriche', '1f9aa', 'pesce', 'F', 1, 'pz', 'ostrica|capesante'],
  // --- Latte, uova e formaggi ---
  ['latte', 'Latte', 'latte', 'latticini', 'F', 6, 'l', 'latte fresco|latte intero|latte parzialmente scremato|latte uht'],
  ['lattevegetale', 'Latte vegetale', 'lattevegetale', 'latticini', 'D', 180, 'l', 'latte di soia|latte di avena|latte di mandorla|latte di riso|bevanda vegetale'],
  ['yogurt', 'Yogurt', 'yogurt', 'latticini', 'F', 14, 'pz', 'yoghurt|kefir|skyr|yogurt greco'],
  ['uova', 'Uova', '1f95a', 'latticini', 'F', 21, 'pz', 'uovo', 'prot'],
  ['formaggio', 'Formaggio', '1f9c0', 'latticini', 'F', 21, 'pz', 'formaggi|emmental|fontina|asiago|provola|scamorza|pecorino|gorgonzola|brie|sottilette|feta|caciotta|taleggio', 'prot'],
  ['parmigiano', 'Parmigiano', '1f9c0', 'latticini', 'F', 60, 'pz', 'grana|grana padano|parmigiano reggiano|grattugiato', 'cond'],
  ['mozzarella', 'Mozzarella', 'mozzarella', 'latticini', 'F', 5, 'pz', 'mozzarelle|burrata|bufala|fiordilatte|bocconcini', 'prot'],
  ['ricotta', 'Ricotta e formaggi freschi', 'ricotta', 'latticini', 'F', 5, 'conf', 'ricotta|stracchino|crescenza|robiola|philadelphia|formaggio spalmabile|mascarpone|fiocchi di latte', 'prot'],
  ['burro', 'Burro', '1f9c8', 'latticini', 'F', 45, 'pz', 'margarina', 'cond'],
  ['panna', 'Panna', 'panna', 'latticini', 'F', 14, 'conf', 'panna da cucina|panna fresca|besciamella', 'cond'],
  ['tofu', 'Tofu', 'tofu', 'latticini', 'F', 7, 'conf', 'tempeh|seitan', 'prot'],
  ['budino', 'Budino', '1f36e', 'dolci', 'F', 14, 'pz', 'budini|panna cotta|creme caramel|dessert'],
  // --- Pane, pasta e cereali ---
  ['pasta', 'Pasta', 'pasta', 'pane', 'D', 730, 'conf', 'penne|fusilli|rigatoni|farfalle|maccheroni|orecchiette|paccheri|mezze maniche|pastina|ditalini'],
  ['spaghetti', 'Spaghetti', '1f35d', 'pane', 'D', 730, 'conf', 'linguine|bucatini|tagliatelle|fettuccine|pasta lunga|vermicelli'],
  ['riso', 'Riso', 'riso', 'pane', 'D', 730, 'conf', 'risotto|basmati|carnaroli|arborio|farro|orzo|quinoa|couscous|cous cous|bulgur'],
  ['pane', 'Pane', '1f35e', 'pane', 'D', 3, 'pz', 'pagnotta|panini|panino|pancarre|pan carre|pane in cassetta|pan bauletto|rosette'],
  ['baguette', 'Baguette', '1f956', 'pane', 'D', 2, 'pz', 'filone|ciabatta|sfilatino'],
  ['piadina', 'Piadine', '1fad3', 'pane', 'F', 30, 'conf', 'piadina|tortillas|tortilla|wrap|pita|pane arabo|focaccia'],
  ['gnocchi', 'Gnocchi', 'gnocchi', 'pane', 'F', 20, 'conf', 'gnocco|chicche'],
  ['ravioli', 'Pasta ripiena', 'ravioli', 'pane', 'F', 15, 'conf', 'ravioli|tortellini|tortelloni|cappelletti|agnolotti|pasta fresca|lasagne sfoglia'],
  ['pizza', 'Pizza', '1f355', 'pronti', 'F', 2, 'pz', 'pizze|pizzetta|margherita'],
  ['cracker', 'Cracker', 'cracker', 'pane', 'D', 180, 'conf', 'crackers|fette biscottate|taralli|schiacciatine|pangrattato'],
  ['grissini', 'Grissini', 'grissini', 'pane', 'D', 120, 'conf', 'grissino'],
  ['gallette', 'Gallette', 'gallette', 'pane', 'D', 180, 'conf', 'galletta|gallette di riso|gallette di mais'],
  ['farina', 'Farina', 'farina', 'dispensa', 'D', 365, 'kg', 'semola|amido|maizena|fecola|polenta'],
  ['cereali', 'Cereali', 'cereali', 'pane', 'D', 180, 'conf', 'corn flakes|muesli|granola|fiocchi d avena|avena|porridge', 'extra'],
  ['noodles', 'Noodles', '1f35c', 'pane', 'D', 365, 'conf', 'ramen|noodle|udon|soba|spaghetti di riso'],
  ['croissant', 'Cornetti', '1f950', 'dolci', 'D', 4, 'pz', 'cornetto|brioche|croissants|saccottino'],
  ['sandwich', 'Tramezzini', '1f96a', 'pronti', 'F', 2, 'pz', 'tramezzino|sandwich|toast|panino imbottito'],
  ['pancake', 'Pancake', '1f95e', 'dolci', 'F', 3, 'conf', 'pancakes|crepes|crepe|waffle'],
  // --- Scatolame e condimenti ---
  ['passata', 'Passata di pomodoro', 'passata', 'dispensa', 'D', 365, 'pz', 'passata|polpa di pomodoro|salsa di pomodoro|concentrato'],
  ['pelati', 'Pelati e scatolame', '1f96b', 'dispensa', 'D', 730, 'conf', 'pelati|scatoletta|scatolette|lattina di|in scatola'],
  ['legumi', 'Legumi', '1fad8', 'dispensa', 'D', 730, 'conf', 'fagioli|ceci|lenticchie|borlotti|cannellini|fave|edamame', 'prot'],
  ['olio', 'Olio', 'olio', 'dispensa', 'D', 540, 'l', 'olio evo|olio extravergine|olio di oliva|olio di semi'],
  ['aceto', 'Aceto', 'aceto', 'dispensa', 'D', 730, 'pz', 'aceto balsamico|glassa'],
  ['sale', 'Sale', '1f9c2', 'dispensa', 'D', 3650, 'conf', 'sale grosso|sale fino'],
  ['pepe', 'Pepe', 'pepe', 'dispensa', 'D', 730, 'pz', ''],
  ['zucchero', 'Zucchero', 'zucchero', 'dispensa', 'D', 1095, 'kg', 'zucchero di canna|dolcificante'],
  ['spezie', 'Spezie', 'spezie', 'dispensa', 'D', 365, 'pz', 'origano|paprika|curry|curcuma|cannella|noce moscata|cumino'],
  ['dado', 'Dado e lievito', 'dado', 'dispensa', 'D', 365, 'conf', 'dado|dadi|lievito|bicarbonato'],
  ['brodo', 'Brodo pronto', 'brodo', 'dispensa', 'D', 365, 'l', 'brodo'],
  ['pesto', 'Pesto', 'pesto', 'dispensa', 'F', 30, 'pz', 'pesto alla genovese'],
  ['sugo', 'Sugo pronto', '1fad9', 'dispensa', 'D', 365, 'pz', 'sugo|sughi|ragu|sottoli|sottaceti|giardiniera|carciofini|capperi'],
  ['maionese', 'Maionese', 'maionese', 'dispensa', 'F', 90, 'pz', 'mayo|salsa tonnata|salsa yogurt'],
  ['ketchup', 'Ketchup', 'ketchup', 'dispensa', 'F', 180, 'pz', 'salsa barbecue|bbq|salsa piccante|tabasco'],
  ['senape', 'Senape', 'senape', 'dispensa', 'F', 180, 'pz', ''],
  ['soia', 'Salsa di soia', 'soia', 'dispensa', 'D', 730, 'pz', 'salsa di soia|teriyaki|worcester'],
  ['miele', 'Miele', '1f36f', 'dispensa', 'D', 730, 'pz', 'sciroppo d acero'],
  ['marmellata', 'Marmellata', 'marmellata', 'dispensa', 'D', 365, 'pz', 'confettura|composta'],
  ['cremanocciola', 'Crema spalmabile', 'cremanocciola', 'dolci', 'D', 180, 'pz', 'nutella|crema di nocciole|crema al cioccolato|crema pistacchio'],
  ['caffe', 'Caffè', 'caffe', 'bevande', 'D', 365, 'conf', 'caffe macinato|capsule|cialde|orzo solubile'],
  ['te', 'Tè e tisane', '1f375', 'bevande', 'D', 730, 'conf', 'the|tè|tisana|tisane|camomilla|infuso'],
  // --- Dolci e snack ---
  ['biscotti', 'Biscotti', '1f36a', 'dolci', 'D', 120, 'conf', 'biscotto|frollini|cookies|wafer|savoiardi'],
  ['cioccolato', 'Cioccolato', '1f36b', 'dolci', 'D', 180, 'pz', 'cioccolata|tavoletta|cioccolatini|barretta|barrette|cacao'],
  ['merendine', 'Merendine', 'merendina', 'dolci', 'D', 60, 'conf', 'merendina|kinder|plumcake|snack dolce'],
  ['patatine', 'Patatine', 'chips', 'dolci', 'D', 90, 'conf', 'chips|patatine in busta|nachos|salatini|snack salato'],
  ['patatinefritte', 'Patatine fritte', '1f35f', 'verdura', 'Z', 365, 'conf', 'patate fritte|patatine surgelate|crocchette di patate', 'carb'],
  ['popcorn', 'Popcorn', '1f37f', 'dolci', 'D', 180, 'conf', 'pop corn'],
  ['gelato', 'Gelato', '1f368', 'dolci', 'Z', 365, 'conf', 'gelati|vaschetta di gelato|sorbetto'],
  ['ghiaccioli', 'Ghiaccioli', '1f367', 'dolci', 'Z', 365, 'conf', 'ghiacciolo|granita|coni gelato|cono'],
  ['torta', 'Torta', '1f370', 'dolci', 'F', 4, 'pz', 'torte|tiramisu|cheesecake|dolce'],
  ['crostata', 'Crostata', '1f967', 'dolci', 'D', 7, 'pz', 'crostatine|ciambellone'],
  ['ciambella', 'Ciambelle', '1f369', 'dolci', 'D', 3, 'pz', 'donut|bomboloni|krapfen'],
  ['muffin', 'Muffin', '1f9c1', 'dolci', 'D', 5, 'pz', 'cupcake|tortine'],
  ['caramelle', 'Caramelle', '1f36c', 'dolci', 'D', 365, 'conf', 'caramella|gomme|liquirizia|gommose'],
  // --- Bevande ---
  ['acqua', 'Acqua', 'acqua', 'bevande', 'D', 365, 'pz', 'acqua frizzante|acqua naturale'],
  ['succo', 'Succo di frutta', '1f9c3', 'bevande', 'D', 180, 'pz', 'succo|succhi|spremuta|estathe|te freddo'],
  ['bibita', 'Bibite', 'lattina', 'bevande', 'D', 270, 'pz', 'coca cola|cocacola|coca|fanta|sprite|aranciata|gassosa|chinotto|energy drink|lattina|lattine'],
  ['birra', 'Birra', '1f37a', 'bevande', 'F', 180, 'pz', 'birre'],
  ['vino', 'Vino', '1f377', 'bevande', 'D', 730, 'pz', 'vino rosso|vino bianco|rosato'],
  ['spumante', 'Spumante', '1f37e', 'bevande', 'D', 730, 'pz', 'prosecco|champagne|bollicine'],
  ['liquore', 'Liquori', '1f943', 'bevande', 'D', 3650, 'pz', 'amaro|grappa|whisky|rum|gin|vodka|limoncello|aperol|campari'],
  // --- Piatti pronti e avanzi ---
  ['avanzi', 'Avanzi', 'avanzi', 'pronti', 'F', 3, 'pz', 'avanzo|avanzato|contenitore|schiscetta'],
  ['zuppa', 'Zuppa', '1f372', 'pronti', 'F', 3, 'conf', 'minestrone|vellutata|minestra|passato di verdure|stufato'],
  ['insalatapronta', 'Insalata pronta', '1f957', 'pronti', 'F', 3, 'conf', 'insalatona|insalata di riso|insalata di pollo|poke bowl'],
  ['piattopronto', 'Piatto pronto', '1f371', 'pronti', 'F', 3, 'pz', 'piatti pronti|pronto da scaldare|gastronomia|lasagne|cannelloni|parmigiana'],
  ['asporto', "Cibo d'asporto", '1f961', 'pronti', 'F', 2, 'pz', 'asporto|take away|takeaway|cinese'],
  ['hummus', 'Hummus e salse', '1f963', 'pronti', 'F', 7, 'conf', 'hummus|guacamole|tzatziki'],
  ['falafel', 'Falafel e burger veg', '1f9c6', 'pronti', 'F', 5, 'conf', 'falafel|burger vegetale|polpette veg'],
  ['pizzasurgelata', 'Pizza surgelata', '1f355', 'pronti', 'Z', 180, 'pz', 'pizza surgelata'],
];

const LOC = { F: 'frigo', Z: 'freezer', D: 'dispensa' };
const CAT_ROLE = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.role]));

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const CATALOG = ROWS.map(([key, name, icon, cat, loc, days, unit, kw, role]) => ({
  key,
  name,
  icon,
  cat,
  loc: LOC[loc],
  days,
  unit,
  role: role || CAT_ROLE[cat],
  kws: [norm(name), key, ...String(kw || '').split('|').map(norm).filter(Boolean)],
}));

export const BY_KEY = Object.fromEntries(CATALOG.map((f) => [f.key, f]));
export const OTHER = { key: 'altro', name: 'Altro', icon: '1f4e6', cat: 'dispensa', loc: 'dispensa', days: 0, unit: 'pz', role: 'extra', kws: [] };

const stem = (w) => (w.length > 4 ? w.replace(/[aeio]$/, '') : w);

// Trova il cibo del catalogo che assomiglia di più a un testo libero ("mele golden", "Penne rigate Barilla"...)
export function matchFood(text) {
  const t = ' ' + norm(text) + ' ';
  if (t.trim() === '') return null;
  let best = null;
  let bestScore = 0;
  for (const f of CATALOG) {
    for (const kw of f.kws) {
      let score = 0;
      if (t.includes(' ' + kw + ' ')) score = kw.length * 2 + 3;
      else if (kw.length >= 4 && t.includes(' ' + stem(kw))) score = stem(kw).length * 2;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
  }
  return best;
}

export const roleOf = (item) => {
  const f = BY_KEY[item.food];
  if (f) return f.role;
  return CAT_ROLE[item.cat] || 'extra';
};
