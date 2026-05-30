/* =============================================================================
   content.js — all landing copy, EN (default) + CS.
   -----------------------------------------------------------------------------
   One source of truth for both languages so the page stays in sync. The
   generative layer is language-neutral; only strings live here. Czech follows
   the studio rules: no anglicisms where a Czech word exists, no calques, full
   diacritics, no em dashes, no "not X but Y" scaffolds. Technical proper nouns
   (OSC, MIDI, DMX, sACN, BOM, LED, TouchDesigner, stage plot, rider) stay in
   English on purpose.

   The motif is "made to measure / na miru", not "by hand": the tools are
   tailored to one task, however they are built.
============================================================================= */

export const content = {
  en: {
    htmlLang: 'en',
    title: 'Antonín Kindl - small software, made to fit',
    description: 'Small custom software, built by Antonín Kindl alongside the art studio at kindl.work. Some tools you can use right now; some I build to order: parametric generators, stage and event calculators, computer-vision and installation utilities.',
    nav: { how: 'how it helps', bench: 'the bench', fields: 'your field', order: 'get a tool' },
    hero: {
      claim1: 'Small software,',
      claim2: 'made to fit.',
      sub: 'Some you can use right now. Some I build to fit.',
      intro: "I'm Antonín Kindl. I build small software shaped to one task and one person at a time, alongside an art practice at kindl.work. Open one in the browser, or tell me the tool you wish existed and I make it.",
      meta: ['cut to one task', 'browser-native', 'no account'],
    },
    how: {
      h: 'A tool the exact size of your task.',
      p1: 'Big software is built for everyone, so it fits no one exactly. You bend your week around its menus. A small tool shaped to a single task works the other way: it fits how you already work, and it quietly does the repeating part for you.',
      p2: 'Most of the bench runs in your browser, free. If the tool you need does not exist yet, that is usually a small job. Tell me the task and the shape of your data; I build the tool around it, in your style, and hand it over. The art studio at kindl.work makes perceptual machines: computer vision, projection, kinetics, generative graphics. The software here comes from the same studio.',
      barLabel: 'one template',
      hintFine: 'move across →',
      hintCoarse: 'drag across →',
      cap: 'One template, every version of the work, made on the spot. That is what a generator does for you: the repeating, instantly, on brand.',
    },
    bench: {
      h: 'What comes off the bench.',
      intro: "Four lines, chosen where the studio's edge shows and the budgets are real. The catalog grows; this is the working face of it.",
      lines: [
        { k: 'Design → tool',                  d: 'A finished visual, rebuilt as a generator the client runs alone.' },
        { k: 'AV + event calculators',          d: 'Stage plots, room layouts, LED pitch and power, projection overlap.' },
        { k: 'Computer vision + installation',  d: 'Browser utilities for new-media, VJ and installation work.' },
        { k: 'TouchDesigner companion',         d: 'Small utilities the big tools never ship: presets, cues, patch math.' },
      ],
      items: [
        { nm: 'Identity generator',      who: 'galleries, festivals' },
        { nm: 'Poster generator',        who: 'studios' },
        { nm: 'Stage plot + rider',      who: 'touring, sound' },
        { nm: 'Seating + venue layout',  who: 'event production' },
        { nm: 'LED pitch + power calc',  who: 'installation' },
        { nm: 'Projection overlap calc', who: 'AV, mapping' },
        { nm: 'pose-to-OSC',             who: 'VJ, installation' },
        { nm: 'Camera to MIDI / OSC',    who: 'performers' },
        { nm: 'Wiring diagram + BOM',    who: 'installation' },
        { nm: 'sACN / DMX patch calc',   who: 'show tech' },
        { nm: 'TouchDesigner presets',   who: 'TD community' },
        { nm: 'Cue sheet / run-of-show', who: 'production' },
        { nm: 'Open call triage',        who: 'juries, residencies' },
        { nm: 'Exhibition catalogue',    who: 'curators' },
        { nm: 'Release forge',           who: 'labels' },
        { nm: 'Invoice generator',       who: 'studios, makers' },
        { nm: 'Press release generator', who: 'galleries, PR' },
        { nm: 'Pixel mapper',            who: 'signage, installation' },
      ],
    },
    fields: {
      h: 'It fits your field too.',
      intro: 'The same idea travels across trades. Pick one and see what a small tool can be.',
      examples: {
        'Studios': [['Brand-compliance checker', 'in-house teams'], ['Brand-manual generator', 'design studios'], ['SVG to icon set', 'designers, devs'], ['Handoff spec generator', 'studio to dev'], ['Print calculator', 'studio, print shop'], ['Portfolio from JSON', 'designers, photographers']],
        'Brands': [['Campaign-set generator', 'brand, agency'], ['Quote-graphic generator', 'media, brand'], ['Content calendar', 'small team'], ['Ad-format resizer', 'performance marketing'], ['Newsletter HTML from markdown', 'brand, author'], ['Press-release generator', 'PR, label']],
        'Galleries': [['Exhibition catalogue from CSV', 'curators'], ['Label + wall-text generator', 'gallery, museum'], ['Open-call triage', 'juries'], ['Install map planner', 'curator'], ['Condition-report generator', 'registrar'], ['Visitor guide web app', 'museum']],
        'Music': [['Stage plot + rider', 'touring, sound'], ['Release metadata forge', 'labels'], ['Split-sheet calculator', 'producers'], ['Tour routing + cost', 'bands'], ['EPK / press-kit generator', 'artists'], ['DMX / sACN patch calc', 'show tech']],
        'Film': [['Call-sheet generator', 'production'], ['Shot list + storyboard', 'director, DOP'], ['Lower-thirds generator', 'editors'], ['Production budget calc', 'producers'], ['Release-form generator', 'production'], ['Footage batch-rename', 'editors']],
        'Architecture': [['Material + area + cost calc', 'architect, interior'], ['Moodboard generator', 'studio'], ['Sun + shadow diagram', 'architect'], ['Furniture spec sheet', 'interior'], ['Floorplan to capacity', 'architect, event'], ['Project-deck generator', 'studio']],
        'Events': [['Seating + table layout', 'event production'], ['Run-of-show + cue sheet', 'production, stage'], ['Event budget calc', 'producers'], ['Power budget + cabling', 'technical production'], ['Schedule generator', 'coordinators'], ['Catering headcount calc', 'production']],
        'New media': [['pose-to-OSC config', 'VJ, installation'], ['Camera to MIDI / OSC', 'performers'], ['Projection calibration', 'installation artists'], ['Wiring diagram + BOM', 'installation'], ['TouchDesigner companion', 'TD community'], ['LED pixel mapper', 'signage, installation']],
        'Shops': [['Product mockup generator', 'e-shops'], ['Price label + QR generator', 'shops, makers'], ['Product-price calculator', 'makers'], ['Product feed (CSV to market)', 'e-shops'], ['Local inventory', 'small retail'], ['Batch watermark + resize', 'e-shops']],
        'Admin': [['Custom invoice generator', 'studios, firms'], ['Quote generator', 'sales, studio'], ['CSV report dashboard', 'management'], ['Contract generator', 'HR, legal'], ['Format converter', 'accounting'], ['Org-chart generator', 'firms']],
      },
    },
    band: { line1: 'Made to fit,', line2: 'one tool at a time.', sub: 'No platform, no subscription, no account. A file you open, or a tool I build and hand you.' },
    ships: {
      h: 'What ships first.',
      items: [
        { no: '01', nm: 'Identity generator', what: 'Your finished visual, rebuilt as a generator your team runs alone. On brand every time, without you in the loop.', who: 'galleries / festivals' },
        { no: '02', nm: 'Plot Calculator',    what: 'A parametric stage plot and rider. The file stays editable. The JPG that never quite fit is gone.', who: 'touring bands / sound' },
        { no: '03', nm: 'pose-to-OSC',        what: 'Your body into OSC, in the browser, no heavy setup. The kind of utility new media shares.', who: 'VJ / installation' },
      ],
    },
    order: {
      h: 'Three ways. The price is on the page.',
      cols: [
        { t: 'Use it',        px: 'free',       d: 'Runs in the browser. No account, no upload to anyone. Most of the bench.' },
        { t: 'License it',    px: '€9 - 49',      d: 'The pro version: no watermark, full export, presets, an offline build you own.' },
        { t: 'Built to order', px: 'from €1500', d: 'A tool in a week, fixed scope, handed over with docs. Or a custom generator from €3000. No discovery call, no open-ended brief.' },
      ],
      cta1: 'Start a tool', cta2: 'The art studio',
    },
    footer: { sig1: 'Antonín Kindl. ', sigBold: 'Small software, made to fit.', sig2: ' Alongside the art studio at kindl.work.', studio: 'Studio', now: 'Now', role: 'design engineer', place: 'Prague' },
  },

  cs: {
    htmlLang: 'cs',
    title: 'Antonín Kindl - malý software na míru',
    description: 'Malý software na míru. Antonín Kindl staví nástroje vedle uměleckého studia na kindl.work. Některé si pustíš rovnou v prohlížeči, jiné postavím na zakázku: parametrické generátory, AV a eventové kalkulačky, utility pro počítačové vidění a instalace.',
    nav: { how: 'jak pomáhá', bench: 'ponk', fields: 'tvůj obor', order: 'získat nástroj' },
    hero: {
      claim1: 'Malý software,',
      claim2: 'šitý na míru.',
      sub: 'Některý si pustíš hned. Jiný ti udělám na zakázku.',
      intro: 'Jsem Antonín Kindl. Vedle umělecké praxe na kindl.work dělám malý software na míru, vždycky pro jednu konkrétní úlohu a jednoho člověka. Něco si otevřeš rovnou v prohlížeči, nebo mi napiš, jaký nástroj ti chybí, a já ho udělám.',
      meta: ['na jednu úlohu', 'běží v prohlížeči', 'bez účtu'],
    },
    how: {
      h: 'Nástroj přesně na tvou úlohu.',
      p1: 'Velký software se dělá pro všechny, a tak nikomu nesedne úplně přesně. Svůj týden ohýbáš podle jeho menu. Malý nástroj na jednu úlohu to má naopak: sedne na to, jak už pracuješ, a tu otravnou opakující se část udělá za tebe.',
      p2: 'Většina nástrojů běží rovnou v prohlížeči a jsou zdarma. A když ten, který potřebuješ, ještě neexistuje, je to většinou práce na pár hodin. Napiš mi, co řešíš a jak vypadají tvoje data; nástroj udělám přímo na to, ve tvém stylu, a předám ti ho. Vedle toho vedu na kindl.work umělecké studio: počítačové vidění, projekce, kinetiku, generativní grafiku. Software tady vzniká ze stejné praxe.',
      barLabel: 'jedna šablona',
      hintFine: 'přejeď přes ni →',
      hintCoarse: 'táhni přes ni →',
      cap: 'Jedna šablona, a každá verze hned. Přesně tohle za tebe generátor udělá: opakování okamžitě a pokaždé ve stejném stylu.',
    },
    bench: {
      h: 'Co vzniká na ponku.',
      intro: 'Čtyři linie tam, kde mám náskok a kde jsou reálné rozpočty. Katalog roste, tohle je jeho pracovní tvář.',
      lines: [
        { k: 'Návrh → nástroj',              d: 'Hotový vizuál, předělaný na generátor, který si klient pustí sám.' },
        { k: 'AV a eventové kalkulačky',     d: 'Stage ploty, rozvržení sálu, rozteč a příkon LED, překryv projekce.' },
        { k: 'Počítačové vidění a instalace', d: 'Nástroje v prohlížeči pro novomediální, VJ a instalační práci.' },
        { k: 'Společník pro TouchDesigner',  d: 'Malé utility, které velké nástroje nemají: presety, cue, výpočty patchů.' },
      ],
      items: [
        { nm: 'Generátor identity',      who: 'galerie, festivaly' },
        { nm: 'Generátor plakátů',       who: 'studia' },
        { nm: 'Stage plot a rider',      who: 'turné, zvuk' },
        { nm: 'Rozvržení sálu a sezení', who: 'eventová produkce' },
        { nm: 'Rozteč a příkon LED',     who: 'instalace' },
        { nm: 'Překryv projekce',        who: 'AV, mapování' },
        { nm: 'pose-to-OSC',             who: 'VJ, instalace' },
        { nm: 'Kamera do MIDI / OSC',    who: 'performeři' },
        { nm: 'Schéma zapojení a BOM',   who: 'instalace' },
        { nm: 'sACN / DMX patch',        who: 'technici show' },
        { nm: 'Presety pro TouchDesigner', who: 'TD komunita' },
        { nm: 'Cue sheet a run-of-show', who: 'produkce' },
        { nm: 'Třídění open callů',      who: 'poroty, rezidence' },
        { nm: 'Katalog výstavy',         who: 'kurátoři' },
        { nm: 'Release forge',           who: 'vydavatelství' },
        { nm: 'Generátor faktur',        who: 'studia, výrobci' },
        { nm: 'Generátor tiskových zpráv', who: 'galerie, PR' },
        { nm: 'Pixel mapper',            who: 'instalace, polepy' },
      ],
    },
    fields: {
      h: 'Sedne i na tvůj obor.',
      intro: 'Stejný princip funguje napříč obory. Vyber si a uvidíš, čím vším může malý nástroj být.',
      examples: {
        'Studia': [['Kontrola dodržení identity', 'interní týmy'], ['Generátor brand manuálu', 'designová studia'], ['SVG do sady ikon', 'designéři, vývojáři'], ['Generátor předávací specifikace', 'od studia k vývojáři'], ['Kalkulačka tisku', 'studio, tiskárna'], ['Portfolio z JSON', 'designéři, fotografové']],
        'Značky': [['Generátor kampaňové sady', 'značka, agentura'], ['Generátor citátových grafik', 'média, značka'], ['Plánovací kalendář obsahu', 'malý tým'], ['Přepočet reklamních formátů', 'výkonnostní marketing'], ['Newsletter z markdownu', 'značka, autor'], ['Generátor tiskových zpráv', 'PR, vydavatelství']],
        'Galerie': [['Katalog výstavy z CSV', 'kurátoři'], ['Generátor popisek a etiket', 'galerie, muzeum'], ['Třídění open callů', 'poroty'], ['Plánovač rozmístění děl', 'kurátor'], ['Generátor protokolů o stavu díla', 'registrátor'], ['Návštěvnický průvodce', 'muzeum']],
        'Hudba': [['Stage plot a rider', 'turné, zvuk'], ['Forge na release metadata', 'vydavatelství'], ['Kalkulačka split sheetů', 'producenti'], ['Plánování trasy a nákladů', 'kapely'], ['Generátor EPK a press kitu', 'umělci'], ['DMX / sACN patch', 'technici show']],
        'Film': [['Generátor call sheetu', 'produkce'], ['Shot list a storyboard', 'režie, kamera'], ['Generátor titulků', 'střih'], ['Kalkulačka rozpočtu', 'producenti'], ['Generátor souhlasů', 'produkce'], ['Hromadné přejmenování záběrů', 'střih']],
        'Architektura': [['Výpočet materiálu a ceny', 'architekt, interiér'], ['Generátor moodboardů', 'studio'], ['Diagram osvitu a stínu', 'architekt'], ['Specifikační list nábytku', 'interiér'], ['Půdorys na kapacitu', 'architekt, event'], ['Generátor prezentace projektu', 'studio']],
        'Eventy': [['Rozvržení sálu a sezení', 'eventová produkce'], ['Run-of-show a cue sheet', 'produkce, scéna'], ['Kalkulačka rozpočtu eventu', 'producenti'], ['Příkon a kabeláž', 'technická produkce'], ['Generátor harmonogramu', 'koordinátoři'], ['Kalkulačka cateringu', 'produkce']],
        'Nová média': [['Konfigurace pose-to-OSC', 'VJ, instalace'], ['Kamera do MIDI / OSC', 'performeři'], ['Kalibrace projekce', 'instalační umělci'], ['Schéma zapojení a BOM', 'instalace'], ['Společník pro TouchDesigner', 'TD komunita'], ['Pixel mapper na LED', 'instalace, polepy']],
        'Obchody': [['Generátor produktových mockupů', 'e-shopy'], ['Generátor cenovek a QR', 'obchody, výrobci'], ['Kalkulačka ceny výrobku', 'výrobci'], ['Produktový feed (CSV na trh)', 'e-shopy'], ['Lokální sklad', 'malý prodej'], ['Hromadný vodoznak a zmenšení', 'e-shopy']],
        'Administrativa': [['Generátor faktur na míru', 'studia, firmy'], ['Generátor nabídek', 'obchod, studio'], ['Přehled z CSV', 'vedení'], ['Generátor smluv', 'HR, právo'], ['Převodník formátů', 'účetnictví'], ['Generátor organizačního schématu', 'firmy']],
      },
    },
    band: { line1: 'Na míru,', line2: 'jeden nástroj po druhém.', sub: 'Žádná platforma, žádné předplatné, žádný účet. Soubor, který otevřeš, nebo nástroj, který ti udělám a předám.' },
    ships: {
      h: 'Co vyjde jako první.',
      items: [
        { no: '01', nm: 'Generátor identity', what: 'Tvůj hotový vizuál, předělaný na generátor, který tvůj tým zvládne sám. Pokaždé ve stylu, a ty u toho nemusíš být.', who: 'galerie / festivaly' },
        { no: '02', nm: 'Plot Calculator',    what: 'Parametrický stage plot a rider. Pořád se dá upravovat. Konec JPG, co nikdy přesně neseděl.', who: 'kapely na turné / zvuk' },
        { no: '03', nm: 'pose-to-OSC',        what: 'Tvoje tělo do OSC, rovnou v prohlížeči, bez složitého nastavení. Přesně ten druh nástroje, jaký si nová média předávají.', who: 'VJ / instalace' },
      ],
    },
    order: {
      h: 'Tři cesty. Cena je na stránce.',
      cols: [
        { t: 'Použij ho',  px: 'zdarma',    d: 'Běží v prohlížeči. Bez účtu, nic se nikam nenahrává. Většina ponku.' },
        { t: 'Kup licenci', px: '€9 - 49',     d: 'Pro verze: bez vodoznaku, plný export, presety, offline verze, kterou vlastníš.' },
        { t: 'Na zakázku',  px: 'od €1500',  d: 'Nástroj za týden, pevný rozsah, předaný s dokumentací. Nebo generátor na míru od €3000. Žádný úvodní hovor, žádné neohraničené zadání.' },
      ],
      cta1: 'Napiš mi', cta2: 'Umělecké studio',
    },
    footer: { sig1: 'Antonín Kindl. ', sigBold: 'Malý software na míru.', sig2: ' Vedle uměleckého studia na kindl.work.', studio: 'Studio', now: 'Teď', role: 'design engineer', place: 'Praha' },
  },
};
