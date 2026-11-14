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
  ['spinaci', 'Spinaci', '1f96c', 'verdura', 'F', 4, 'g', 'spinacino'],
  ['rucola', 'Rucola', '1f33f', 'verdura', 'F', 4, 'g', 'rughetta'],
  ['carota', 'Carote', '1f955', 'verdura', 'F', 21, 'pz', ''],
  ['patata', 'Patate', '1f954', 'verdura', 'D', 30, 'g', '', 'carb'],
  ['patatadolce', 'Patate dolci', '1f360', 'verdura', 'D', 21, 'pz', 'patata dolce|patate americane|batata', 'carb'],
  ['cipolla', 'Cipolle', '1f9c5', 'verdura', 'D', 30, 'pz', 'cipollotto|scalogno'],
  ['aglio', 'Aglio', '1f9c4', 'verdura', 'D', 60, 'pz', '', 'cond'],
  ['zucchina', 'Zucchine', 'zucchina', 'verdura', 'F', 7, 'pz', 'zucchini'],
  ['melanzana', 'Melanzane', '1f346', 'verdura', 'F', 7, 'pz', ''],
  ['peperone', 'Peperoni', '1fad1', 'verdura', 'F', 8, 'pz', ''],
  ['peperoncino', 'Peperoncino', '1f336', 'verdura', 'F', 14, 'pz', '', 'cond'],
  ['cetriolo', 'Cetrioli', '1f952', 'verdura', 'F', 7, 'pz', 'cetriolini'],
  ['broccoli', 'Broccoli', '1f966', 'verdura', 'F', 5, 'pz', 'broccolo|broccoletti'],
  ['friarielli', 'Friarielli', 'friarielli', 'verdura', 'F', 4, 'g', 'cime di rapa|broccoli di rapa|rapini'],
  ['cavolfiore', 'Cavolfiore', 'cavolfiore', 'verdura', 'F', 7, 'pz', 'cavolfiori'],
  ['finocchio', 'Finocchi', 'finocchio', 'verdura', 'F', 7, 'pz', ''],
  ['funghi', 'Funghi', '1f344-200d-1f7eb', 'verdura', 'F', 5, 'g', 'fungo|champignon|porcini'],
  ['mais', 'Mais', '1f33d', 'verdura', 'D', 365, 'conf', 'pannocchia|pannocchie'],
  ['avocado', 'Avocado', '1f951', 'verdura', 'F', 5, 'pz', ''],
  ['sedano', 'Sedano', 'sedano', 'verdura', 'F', 10, 'pz', ''],
  ['porro', 'Porri', 'porro', 'verdura', 'F', 10, 'pz', ''],
  ['asparagi', 'Asparagi', 'asparagi', 'verdura', 'F', 4, 'conf', 'asparago'],
  ['carciofo', 'Carciofi', 'carciofo', 'verdura', 'F', 6, 'pz', ''],
  ['radicchio', 'Radicchio', 'radicchio', 'verdura', 'F', 7, 'pz', 'cavolo rosso|cavolo viola'],
  ['fagiolini', 'Fagiolini', 'fagiolini', 'verdura', 'F', 5, 'g', 'fagiolino|taccole'],
  ['piselli', 'Piselli', '1fadb', 'verdura', 'Z', 180, 'conf', 'pisello|pisellini'],
  ['zucca', 'Zucca', '1f383', 'verdura', 'D', 30, 'pz', ''],
  ['barbabietola', 'Barbabietole', '1fadc', 'verdura', 'F', 10, 'conf', 'rapa|rape|ravanelli|ravanello'],
  ['zenzero', 'Zenzero', '1fada', 'verdura', 'F', 21, 'pz', '', 'cond'],
  ['erbe', 'Erbe aromatiche', '1f33f', 'verdura', 'F', 7, 'conf', 'basilico|prezzemolo|rosmarino|salvia|menta|erba cipollina|timo', 'cond'],
  ['olive', 'Olive', '1fad2', 'verdura', 'F', 30, 'g', 'oliva', 'extra'],
  ['verduresurgelate', 'Verdure surgelate', 'surgelati', 'verdura', 'Z', 365, 'conf', 'surgelato|surgelati|surgelate|contorno surgelato'],
  // --- Frutta ---
  ['mela', 'Mele', '1f34e', 'frutta', 'F', 21, 'pz', 'mele'],
  ['melaverde', 'Mele verdi', '1f34f', 'frutta', 'F', 21, 'pz', 'mela verde|granny'],
  ['pera', 'Pere', '1f350', 'frutta', 'F', 10, 'pz', 'pere'],
  ['banana', 'Banane', '1f34c', 'frutta', 'D', 5, 'pz', 'banane'],
  ['arancia', 'Arance', '1f34a', 'frutta', 'F', 14, 'pz', 'arance|mandarino|mandarini|clementine|clementina|mandaranci'],
  ['limone', 'Limoni', '1f34b', 'frutta', 'F', 21, 'pz', 'lime'],
  ['fragola', 'Fragole', '1f353', 'frutta', 'F', 3, 'g', 'fragole|lamponi|lampone'],
  ['ciliegia', 'Ciliegie', '1f352', 'frutta', 'F', 5, 'g', 'ciliegie|amarene'],
  ['uva', 'Uva', '1f347', 'frutta', 'F', 7, 'g', ''],
  ['pesca', 'Pesche', '1f351', 'frutta', 'F', 5, 'pz', 'pesche|albicocca|albicocche|nettarina|nettarine|percoche'],
  ['prugna', 'Prugne', 'prugna', 'frutta', 'F', 7, 'pz', 'prugne|susina|susine'],
  ['fico', 'Fichi', 'fico', 'frutta', 'F', 3, 'pz', 'fichi'],
  ['kiwi', 'Kiwi', '1f95d', 'frutta', 'F', 14, 'pz', ''],
  ['ananas', 'Ananas', '1f34d', 'frutta', 'F', 5, 'pz', ''],
  ['mango', 'Mango', '1f96d', 'frutta', 'F', 5, 'pz', 'papaya'],
  ['melone', 'Melone', '1f348', 'frutta', 'F', 5, 'pz', 'meloni'],
  ['anguria', 'Anguria', '1f349', 'frutta', 'F', 5, 'pz', 'cocomero'],
  ['mirtilli', 'Mirtilli', '1fad0', 'frutta', 'F', 5, 'g', 'mirtillo|more|frutti di bosco'],
  ['cocco', 'Cocco', '1f965', 'frutta', 'D', 14, 'pz', ''],
  ['noci', 'Noci', 'noce', 'frutta', 'D', 180, 'g', 'noce|nocciole|nocciola|frutta secca|pistacchi|anacardi', 'extra'],
  ['mandorle', 'Mandorle', 'mandorla', 'frutta', 'D', 180, 'g', 'mandorla|pinoli', 'extra'],
  ['arachidi', 'Arachidi', '1f95c', 'frutta', 'D', 180, 'g', 'noccioline|burro di arachidi', 'extra'],
  ['castagne', 'Castagne', '1f330', 'frutta', 'D', 14, 'g', 'castagna|marroni', 'extra'],
  // --- Carne e salumi ---
  ['petto', 'Petto di pollo', 'petto', 'carne', 'F', 2, 'g', 'pollo|fesa|fettine di pollo|straccetti'],
  ['cosce', 'Cosce di pollo', '1f357', 'carne', 'F', 2, 'g', 'coscia|cosce|fusi|sovracosce'],
  ['alette', 'Alette di pollo', 'alette', 'carne', 'F', 2, 'g', 'ali di pollo|alette|ali'],
  ['pollointero', 'Pollo intero', '1f414', 'carne', 'F', 2, 'pz', 'pollo arrosto|galletto|gallina'],
  ['bistecca', 'Bistecca', '1f969', 'carne', 'F', 3, 'g', 'manzo|vitello|fettine|scaloppine|tagliata|filetto|carne|arrosto|spezzatino|roast beef'],
  ['macinato', 'Macinato', 'macinato', 'carne', 'F', 2, 'g', 'carne macinata|trita|tritata|polpette|ragu fresco'],
  ['hamburger', 'Hamburger', '1f354', 'carne', 'F', 2, 'pz', 'burger|svizzere|svizzera'],
  ['salsiccia', 'Salsiccia', '1f32d', 'carne', 'F', 3, 'g', 'salsicce|salamella|luganega|hot dog'],
  ['wurstel', 'Wurstel', 'wurstel', 'carne', 'F', 30, 'conf', 'wuerstel|wrustel|wüstel'],
  ['pancetta', 'Pancetta', '1f953', 'carne', 'F', 14, 'g', 'bacon|guanciale|speck|lardo'],
  ['prosciutto', 'Prosciutto', 'prosciutto', 'carne', 'F', 5, 'g', 'prosciutto cotto|prosciutto crudo|affettato|affettati|mortadella|bresaola|fesa di tacchino|coppa'],
  ['salame', 'Salame', 'salame', 'carne', 'F', 30, 'pz', 'salami|salamino|soppressata|nduja|cacciatorino'],
  ['maiale', 'Maiale', '1f416', 'carne', 'F', 3, 'g', 'lonza|braciole|braciola|arista|costine|puntine|suino'],
  ['tacchino', 'Tacchino', '1f983', 'carne', 'F', 2, 'g', ''],
  ['cotoletta', 'Cotolette', 'cotoletta', 'carne', 'F', 3, 'conf', 'cotoletta|cordon bleu|impanato|nuggets|crocchette di pollo'],
  ['costata', 'Carne con osso', '1f356', 'carne', 'F', 3, 'pz', 'costata|fiorentina|stinco|ossobuco'],
  ['agnello', 'Agnello', '1f411', 'carne', 'F', 3, 'g', 'abbacchio|pecora'],
  ['coniglio', 'Coniglio', '1f407', 'carne', 'F', 2, 'g', ''],
  ['spiedini', 'Spiedini', '1f362', 'carne', 'F', 2, 'conf', 'spiedino|arrosticini'],
  ['kebab', 'Kebab', '1f959', 'carne', 'F', 2, 'pz', 'gyros'],
  // --- Pesce ---
  ['pesce', 'Pesce', '1f41f', 'pesce', 'F', 2, 'g', 'pesci|orata|branzino|spigola|merluzzo|nasello|platessa|sogliola|trota|pesce spada|filetti di pesce|sgombro fresco'],
  ['salmone', 'Salmone', 'salmone', 'pesce', 'F', 2, 'g', 'salmone affumicato|trancio'],
  ['tonno', 'Tonno in scatola', 'tonno', 'pesce', 'D', 730, 'conf', 'tonno|scatolette di tonno|sgombro|sardine|acciughe|alici'],
  ['gamberi', 'Gamberi', '1f990', 'pesce', 'F', 2, 'g', 'gambero|gamberetti|mazzancolle|scampi'],
  ['calamari', 'Calamari', '1f991', 'pesce', 'F', 2, 'g', 'calamaro|seppie|seppia|totani'],
  ['polpo', 'Polpo', '1f419', 'pesce', 'F', 2, 'g', 'polipo|moscardini'],
  ['cozze', 'Cozze e vongole', 'cozze', 'pesce', 'F', 1, 'g', 'cozza|vongole|vongola|frutti di mare'],
  ['granchio', 'Granchio e surimi', '1f980', 'pesce', 'F', 3, 'g', 'surimi|polpa di granchio'],
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
  ['formaggio', 'Formaggio', '1f9c0', 'latticini', 'F', 21, 'g', 'formaggi|emmental|fontina|asiago|provola|scamorza|pecorino|gorgonzola|brie|sottilette|feta|caciotta|taleggio', 'prot'],
  ['parmigiano', 'Parmigiano', '1f9c0', 'latticini', 'F', 60, 'g', 'grana|grana padano|parmigiano reggiano|grattugiato', 'cond'],
  ['mozzarella', 'Mozzarella', 'mozzarella', 'latticini', 'F', 5, 'pz', 'mozzarelle|burrata|bufala|fiordilatte|bocconcini', 'prot'],
  ['ricotta', 'Ricotta e formaggi freschi', 'ricotta', 'latticini', 'F', 5, 'g', 'ricotta|stracchino|crescenza|robiola|philadelphia|formaggio spalmabile|mascarpone|fiocchi di latte', 'prot'],
  ['burro', 'Burro', '1f9c8', 'latticini', 'F', 45, 'pz', 'margarina', 'cond'],
  ['panna', 'Panna', 'panna', 'latticini', 'F', 14, 'conf', 'panna da cucina|panna fresca|besciamella', 'cond'],
  ['tofu', 'Tofu', 'tofu', 'latticini', 'F', 7, 'conf', 'tempeh|seitan', 'prot'],
  ['budino', 'Budino', '1f36e', 'dolci', 'F', 14, 'pz', 'budini|panna cotta|creme caramel|dessert'],
  // --- Pane, pasta e cereali ---
  ['pasta', 'Pasta', 'pasta', 'pane', 'D', 730, 'g', 'penne|fusilli|rigatoni|farfalle|maccheroni|orecchiette|paccheri|mezze maniche|pastina|ditalini'],
  ['spaghetti', 'Spaghetti', '1f35d', 'pane', 'D', 730, 'g', 'linguine|bucatini|tagliatelle|fettuccine|pasta lunga|vermicelli'],
  ['riso', 'Riso', 'riso', 'pane', 'D', 730, 'g', 'risotto|basmati|carnaroli|arborio|farro|orzo|quinoa|couscous|cous cous|bulgur'],
  ['pane', 'Pane', '1f35e', 'pane', 'D', 3, 'pz', 'pagnotta|panini|panino|pancarre|pan carre|pane in cassetta|pan bauletto|rosette'],
  ['baguette', 'Baguette', '1f956', 'pane', 'D', 2, 'pz', 'filone|ciabatta|sfilatino'],
  ['piadina', 'Piadine', '1fad3', 'pane', 'F', 30, 'conf', 'piadina|tortillas|tortilla|wrap|pita|pane arabo|focaccia'],
  ['gnocchi', 'Gnocchi', 'gnocchi', 'pane', 'F', 20, 'g', 'gnocco|chicche'],
  ['ravioli', 'Pasta ripiena', 'ravioli', 'pane', 'F', 15, 'g', 'ravioli|tortellini|tortelloni|cappelletti|agnolotti|pasta fresca|lasagne sfoglia'],
  ['pizza', 'Pizza', '1f355', 'pronti', 'F', 2, 'pz', 'pizze|pizzetta|margherita'],
  ['cracker', 'Cracker', 'cracker', 'pane', 'D', 180, 'conf', 'crackers|fette biscottate|taralli|schiacciatine|pangrattato'],
  ['grissini', 'Grissini', 'grissini', 'pane', 'D', 120, 'conf', 'grissino'],
  ['gallette', 'Gallette', 'gallette', 'pane', 'D', 180, 'conf', 'galletta|gallette di riso|gallette di mais'],
  ['farina', 'Farina', 'farina', 'dispensa', 'D', 365, 'g', 'semola|amido|maizena|fecola|polenta'],
  ['cereali', 'Cereali', 'cereali', 'pane', 'D', 180, 'g', 'corn flakes|muesli|granola|fiocchi d avena|avena|porridge', 'extra'],
  ['noodles', 'Noodles', '1f35c', 'pane', 'D', 365, 'conf', 'ramen|noodle|udon|soba|spaghetti di riso'],
  ['croissant', 'Cornetti', '1f950', 'dolci', 'D', 4, 'pz', 'cornetto|brioche|croissants|saccottino'],
  ['sandwich', 'Tramezzini', '1f96a', 'pronti', 'F', 2, 'pz', 'tramezzino|sandwich|toast|panino imbottito'],
  ['pancake', 'Pancake', '1f95e', 'dolci', 'F', 3, 'conf', 'pancakes|crepes|crepe|waffle'],
  // --- Scatolame e condimenti ---
  ['passata', 'Passata di pomodoro', 'passata', 'dispensa', 'D', 365, 'pz', 'passata|polpa di pomodoro|salsa di pomodoro|concentrato'],
  ['pelati', 'Pelati e scatolame', '1f96b', 'dispensa', 'D', 730, 'conf', 'pelati|scatoletta|scatolette|lattina di|in scatola'],
  ['legumi', 'Legumi', '1fad8', 'dispensa', 'D', 730, 'g', 'fagioli|lenticchie|borlotti|cannellini|fave|edamame', 'prot'],
  ['ceci', 'Ceci', 'ceci', 'dispensa', 'D', 730, 'g', 'cece|ceci secchi|ceci lessati'],
  ['olio', 'Olio', 'olio', 'dispensa', 'D', 540, 'l', 'olio evo|olio extravergine|olio di oliva|olio di semi'],
  ['aceto', 'Aceto', 'aceto', 'dispensa', 'D', 730, 'pz', 'aceto balsamico|glassa'],
  ['sale', 'Sale', '1f9c2', 'dispensa', 'D', 3650, 'conf', 'sale grosso|sale fino'],
  ['pepe', 'Pepe', 'pepe', 'dispensa', 'D', 730, 'pz', ''],
  ['zucchero', 'Zucchero', 'zucchero', 'dispensa', 'D', 1095, 'g', 'zucchero di canna|dolcificante'],
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
  ['caffe', 'Caffè', 'moka', 'bevande', 'D', 365, 'g', 'caffe macinato|capsule|cialde|orzo solubile'],
  ['te', 'Tè e tisane', '1f375', 'bevande', 'D', 730, 'conf', 'the|tè|tisana|tisane|camomilla|infuso'],
  // --- Dolci e snack ---
  ['biscotti', 'Biscotti', '1f36a', 'dolci', 'D', 120, 'g', 'biscotto|frollini|cookies|wafer|savoiardi'],
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

// Quantità proposte con un tocco, per unità
export const PRESETS = {
  g: [100, 150, 200, 250, 300, 500, 750, 1000],
  kg: [0.5, 1, 1.5, 2, 3, 5],
  ml: [200, 250, 330, 500, 750, 1000],
  l: [0.5, 1, 1.5, 2, 6],
  pz: [1, 2, 3, 4, 6, 12],
  conf: [1, 2, 3, 4, 6],
};
// Porzioni proposte quando metti un cibo in un pasto
export const PORTIONS = {
  g: [50, 80, 100, 150, 200, 250, 300],
  kg: [0.1, 0.2, 0.3, 0.5],
  ml: [100, 150, 200, 250, 330],
  l: [0.1, 0.2, 0.25, 0.5],
  pz: [1, 2, 3, 4],
  conf: [1, 2],
};

// Nomi inglesi (prodotti americani, scontrini, etichette): servono per riconoscere il cibo
const EN_KW = {
  pomodoro: 'tomato|tomatoes|cherry tomatoes',
  insalata: 'lettuce|salad|iceberg|romaine|mixed greens|cabbage|kale',
  spinaci: 'spinach|baby spinach',
  rucola: 'arugula|rocket',
  carota: 'carrot|carrots|baby carrots',
  patata: 'potato|potatoes',
  patatadolce: 'sweet potato|sweet potatoes|yam|yams',
  cipolla: 'onion|onions|shallot|shallots|scallions|green onions',
  aglio: 'garlic',
  zucchina: 'zucchini|courgette',
  melanzana: 'eggplant|aubergine',
  peperone: 'bell pepper|bell peppers|peppers|capsicum',
  peperoncino: 'chili|chilli|chilies|jalapeno|hot pepper',
  cetriolo: 'cucumber|cucumbers|pickles',
  broccoli: 'broccoli',
  friarielli: 'broccoli rabe|rapini',
  cavolfiore: 'cauliflower',
  finocchio: 'fennel',
  funghi: 'mushroom|mushrooms',
  mais: 'corn|sweet corn',
  avocado: 'avocado|avocados',
  sedano: 'celery',
  porro: 'leek|leeks',
  asparagi: 'asparagus',
  carciofo: 'artichoke|artichokes',
  radicchio: 'radicchio|red cabbage',
  fagiolini: 'green beans|string beans',
  piselli: 'peas|green peas',
  zucca: 'pumpkin|squash|butternut squash',
  barbabietola: 'beet|beets|beetroot|radish|radishes',
  zenzero: 'ginger',
  erbe: 'basil|parsley|rosemary|sage|mint|herbs|thyme|cilantro|coriander|dill',
  olive: 'olives',
  verduresurgelate: 'frozen vegetables|frozen veggies',
  mela: 'apple|apples',
  melaverde: 'green apple|green apples|granny smith',
  pera: 'pear|pears',
  banana: 'banana|bananas',
  arancia: 'orange|oranges|mandarin|tangerine|clementine|clementines',
  limone: 'lemon|lemons|lime|limes',
  fragola: 'strawberry|strawberries|raspberries',
  ciliegia: 'cherry|cherries',
  uva: 'grapes',
  pesca: 'peach|peaches|apricot|apricots|nectarine|nectarines',
  prugna: 'plum|plums|prunes',
  fico: 'fig|figs',
  kiwi: 'kiwi|kiwis',
  ananas: 'pineapple',
  mango: 'mango|mangos|papaya',
  melone: 'melon|cantaloupe|honeydew',
  anguria: 'watermelon',
  mirtilli: 'blueberries|blackberries|berries',
  cocco: 'coconut',
  noci: 'walnuts|nuts|hazelnuts|pistachios|cashews|pecans|mixed nuts',
  mandorle: 'almonds|pine nuts',
  arachidi: 'peanuts|peanut butter',
  castagne: 'chestnuts',
  petto: 'chicken breast|chicken breasts|chicken|chicken tenders',
  cosce: 'chicken thighs|drumsticks|chicken legs',
  alette: 'chicken wings|wings|buffalo wings',
  pollointero: 'whole chicken|rotisserie chicken',
  bistecca: 'steak|beef|veal|sirloin|ribeye|tenderloin|roast beef',
  macinato: 'ground beef|minced meat|ground meat|meatballs|ground turkey',
  hamburger: 'burger|burgers|patties',
  salsiccia: 'sausage|sausages|bratwurst|italian sausage',
  wurstel: 'hot dogs|hot dog|frankfurters|wieners',
  pancetta: 'bacon',
  prosciutto: 'ham|deli meat|cold cuts|turkey slices|sliced turkey',
  salame: 'salami|pepperoni',
  maiale: 'pork|pork chops|ribs|pork loin|pulled pork',
  tacchino: 'turkey',
  cotoletta: 'breaded cutlet|chicken nuggets|nuggets|schnitzel',
  costata: 't-bone|bone-in steak',
  agnello: 'lamb|mutton',
  coniglio: 'rabbit',
  spiedini: 'skewers',
  kebab: 'gyro|gyros|shawarma',
  pesce: 'fish|cod|sea bass|sea bream|trout|tilapia|swordfish|fish fillet|haddock|halibut',
  salmone: 'salmon|smoked salmon',
  tonno: 'tuna|canned tuna|sardines|anchovies|mackerel',
  gamberi: 'shrimp|prawns',
  calamari: 'squid|calamari|cuttlefish',
  polpo: 'octopus',
  cozze: 'mussels|clams|shellfish|seafood',
  granchio: 'crab|imitation crab',
  bastoncini: 'fish sticks|fish fingers',
  pescefritto: 'fried fish|tempura',
  aragosta: 'lobster',
  ostriche: 'oysters|scallops',
  latte: 'milk|whole milk|skim milk|2% milk',
  lattevegetale: 'almond milk|oat milk|soy milk|plant milk|rice milk|coconut milk',
  yogurt: 'yogurt|yoghurt|greek yogurt',
  uova: 'egg|eggs',
  formaggio: 'cheese|cheddar|swiss cheese|gouda|feta|provolone|american cheese|cheese slices|monterey jack',
  parmigiano: 'parmesan|grated cheese|parmesan cheese',
  mozzarella: 'mozzarella|string cheese',
  ricotta: 'cream cheese|cottage cheese|goat cheese',
  burro: 'butter|margarine',
  panna: 'cream|heavy cream|whipping cream|sour cream|half and half',
  tofu: 'tofu|tempeh|seitan',
  budino: 'pudding|custard',
  pasta: 'penne|macaroni|fusilli|rigatoni|farfalle|mac and cheese',
  spaghetti: 'spaghetti|linguine|fettuccine|angel hair',
  riso: 'rice|basmati|jasmine rice|quinoa|couscous|barley|bulgur',
  pane: 'bread|loaf|sandwich bread|buns|rolls|bagel|bagels',
  baguette: 'baguette',
  piadina: 'tortillas|tortilla|wraps|wrap|pita|flatbread',
  ravioli: 'tortellini|filled pasta|lasagna sheets',
  cracker: 'crackers|rusks|breadcrumbs',
  grissini: 'breadsticks',
  gallette: 'rice cakes|corn cakes',
  farina: 'flour|cornmeal|semolina|cornstarch',
  cereali: 'cereal|cereals|corn flakes|granola|muesli|oats|oatmeal|porridge',
  noodles: 'ramen|udon|soba|rice noodles|instant noodles',
  croissant: 'croissant|croissants|pastry|pastries',
  sandwich: 'sandwich|sandwiches',
  pancake: 'pancakes|crepes|waffles',
  passata: 'tomato sauce|tomato puree|marinara|tomato paste',
  pelati: 'canned tomatoes|canned goods|canned',
  legumi: 'beans|lentils|kidney beans|black beans|pinto beans|fava beans|baked beans',
  ceci: 'chickpeas|garbanzo beans|garbanzos',
  olio: 'oil|olive oil|extra virgin olive oil|vegetable oil|canola oil|sunflower oil',
  aceto: 'vinegar|balsamic vinegar',
  sale: 'salt',
  pepe: 'black pepper|pepper',
  zucchero: 'sugar|brown sugar|sweetener',
  spezie: 'spices|oregano|paprika|curry|turmeric|cinnamon|nutmeg|cumin',
  dado: 'bouillon|stock cube|yeast|baking soda|baking powder',
  brodo: 'broth|stock|chicken broth',
  sugo: 'pasta sauce|capers',
  maionese: 'mayo|mayonnaise|ranch|salad dressing|dressing',
  ketchup: 'ketchup|bbq sauce|barbecue sauce|hot sauce|sriracha',
  senape: 'mustard',
  soia: 'soy sauce|teriyaki|worcestershire',
  miele: 'honey|maple syrup|syrup',
  marmellata: 'jam|jelly|marmalade|preserves',
  cremanocciola: 'hazelnut spread|chocolate spread',
  caffe: 'coffee|espresso|coffee beans|ground coffee|coffee pods|k-cups',
  te: 'tea|herbal tea|chamomile|green tea',
  biscotti: 'cookies|cookie|biscuits|wafers',
  cioccolato: 'chocolate|chocolate bar|candy bar|cocoa',
  merendine: 'snack cakes|twinkies',
  patatine: 'chips|potato chips|tortilla chips|pretzels|crisps',
  patatinefritte: 'french fries|fries|hash browns|tater tots',
  popcorn: 'popcorn',
  gelato: 'ice cream|sorbet|frozen yogurt',
  ghiaccioli: 'popsicle|popsicles|ice pops|ice cream cones',
  torta: 'cake|cheesecake',
  crostata: 'pie|tart',
  ciambella: 'donut|donuts|doughnut|doughnuts',
  muffin: 'muffin|muffins|cupcakes|cupcake',
  caramelle: 'candy|candies|gummies|gummy bears|licorice|sweets',
  acqua: 'water|sparkling water|mineral water|bottled water',
  succo: 'juice|orange juice|apple juice|lemonade|iced tea',
  bibita: 'soda|coke|pepsi|sprite|soft drink|soft drinks|energy drink|root beer|diet coke',
  birra: 'beer|beers|lager|ale|ipa',
  vino: 'wine|red wine|white wine|rose wine',
  spumante: 'champagne|sparkling wine',
  liquore: 'liquor|whiskey|vodka|rum|gin|tequila|bourbon',
  avanzi: 'leftovers|leftover',
  zuppa: 'soup|chili|stew',
  insalatapronta: 'salad kit|salad bowl',
  piattopronto: 'ready meal|frozen dinner|tv dinner|microwave meal|lasagna|meal prep',
  asporto: 'takeout|take out|takeaway|chinese food',
  hummus: 'guacamole|salsa|dip',
  falafel: 'veggie burger|plant-based burger|plant based burger',
  pizzasurgelata: 'frozen pizza',
};

// Macronutriente principale di ogni cibo del catalogo
export const MACROS = [
  { id: 'proteine', name: 'Proteine', short: 'P' },
  { id: 'carboidrati', name: 'Carboidrati', short: 'C' },
  { id: 'grassi', name: 'Grassi', short: 'G' },
  { id: 'fibre', name: 'Fibre', short: 'F' },
];
const CAT_MACRO = { verdura: 'fibre', frutta: 'carboidrati', carne: 'proteine', pesce: 'proteine', latticini: 'proteine', pane: 'carboidrati', dolci: 'carboidrati' };
const MACRO_OVERRIDE = {};
for (const k of 'olive avocado noci mandorle arachidi pancetta salame burro panna olio maionese cremanocciola patatine pesto cocco'.split(' ')) MACRO_OVERRIDE[k] = 'grassi';
for (const k of 'patata patatadolce mais castagne piselli patatinefritte budino zucchero miele marmellata farina pizza pizzasurgelata sandwich pancake croissant succo bibita gelato ghiaccioli'.split(' ')) MACRO_OVERRIDE[k] = 'carboidrati';
for (const k of 'legumi ceci tofu hummus falafel uova'.split(' ')) MACRO_OVERRIDE[k] = 'proteine';
for (const k of 'sale pepe spezie dado brodo aceto soia senape ketchup acqua caffe te birra vino spumante liquore erbe aglio zenzero peperoncino passata sugo pelati lattevegetale'.split(' ')) MACRO_OVERRIDE[k] = 'nessuno';
for (const k of 'zuppa insalatapronta verduresurgelate'.split(' ')) MACRO_OVERRIDE[k] = 'fibre';

for (const f of CATALOG) {
  const en = EN_KW[f.key];
  if (en) f.kws.push(...en.split('|').map(norm));
  const m = f.key in MACRO_OVERRIDE ? MACRO_OVERRIDE[f.key] : CAT_MACRO[f.cat] || null;
  f.macro = m === 'nessuno' ? null : m;
}

// Macronutriente di un cibo in dispensa: quello salvato (da Gemini/etichetta) o quello del catalogo
export const macroOf = (item) => (item.macro !== undefined && item.macro !== '' ? item.macro : BY_KEY[item.food]?.macro || null);
