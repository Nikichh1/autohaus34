/* ============================================================
   AUTOHAUS — BG / EN  (v45)

   WHY THIS IS A DICTIONARY AND NOT A REFACTOR

   Every page on this site is written in Bulgarian, and roughly half of what
   a visitor reads is not in the HTML at all — it is assembled at runtime by
   catalog.js, collection.js, showroom.js, vehicle.js and concierge.js out of
   the dataset. Threading a t() call through five renderers and four HTML
   files would touch every line of copy on the site and would go stale the
   first time someone edits a sentence in place.

   So the key IS the Bulgarian. This file walks text nodes and translatable
   attributes and swaps any whose content it recognises, which means:

     · no other file changes, and none of them can drift out of step;
     · a phrase that is not in the table simply stays in Bulgarian rather
       than rendering as a missing key — the failure mode is "untranslated",
       never "broken";
     · runtime-rendered markup is covered by the same table, because a
       MutationObserver translates whatever the renderers drop into the DOM.

   The original Bulgarian is cached on the node itself, so switching back is
   an exact restore rather than a second translation.

   Numbers are the one thing an exact table cannot hold — "Виж всички 87
   автомобила" changes with the inventory — so those go through RULES, a
   short list of patterns applied only when the exact lookup misses.
   ============================================================ */
(function () {
  "use strict";
  var D = document, STORE = "ah-lang";

  /* ============================================================
     THE TABLE.  Keys are whitespace-collapsed Bulgarian.
     ============================================================ */
  var DICT = {

    /* ---- navigation, chrome, actions ---- */
    "Автомобили": "Vehicles",
    "Услуги": "Services",
    "Лизинг": "Leasing",
    "За нас": "About",
    "Контакт": "Contact",
    "Меню": "Menu",
    "Начало": "Home",
    "Затвори": "Close",
    "Назад": "Back",
    "Напред": "Next",
    "Продължи": "Continue",
    "Пропусни": "Skip",
    "Изчисти": "Clear",
    "Приложи": "Apply",
    "Покажи": "Show",
    "Покажи още": "Show more",
    "Покажи по-малко": "Show less",
    "Покажи всички": "Show all",
    "Виж ги": "See them",
    "Търси": "Search",
    "Още": "More",
    "Скрий": "Hide",
    "Прочети още": "Read more",
    "Резултати": "Results",
    "Показани": "Showing",
    "Основна навигация": "Main navigation",
    "Долна навигация": "Footer navigation",
    "Към съдържанието": "Skip to content",
    "Към резултатите": "Skip to results",
    "Към заявката": "Go to the enquiry",
    "AutoHaus — начало": "AutoHaus — home",
    "AutoHaus — към началото": "AutoHaus — back to top",
    "Предишен": "Previous",
    "Следващ": "Next",
    "Предишен кадър": "Previous frame",
    "Следващ кадър": "Next frame",
    "Уголемен кадър": "Enlarged frame",
    "Кадър": "Frame",
    "Превърти наляво": "Scroll left",
    "Превърти надясно": "Scroll right",
    "Галерия": "Gallery",
    "Сподели": "Share",
    "Запази": "Save",
    "Запази досието като PDF": "Save the dossier as a PDF",
    "Копиран линк": "Link copied",
    "Копирайте адреса": "Copy the address",
    "Копирано": "Copied",
    "Копирай заявката": "Copy the enquiry",
    "Обаждане": "Call",
    "Обади се": "Call",
    "Пиши в WhatsApp": "Message on WhatsApp",
    "Изпрати в WhatsApp": "Send on WhatsApp",
    "Изпрати по имейл": "Send by email",
    "Разгледай": "Explore",
    "Запитване": "Enquire",
    "Пълно запитване": "Full enquiry",
    "Бърз преглед": "Quick look",
    "Пълно досие": "Full dossier",
    "Стъпка": "Step",
    "Език / Language": "Language",
    /* THE WORD ITSELF.  The source language of this site is Bulgarian, so
       what is written in the markup IS the Bulgarian — and for a long time
       the markup said "Concierge", which meant the one page named after a
       person sitting down with you was the one thing on the site that never
       spoke Bulgarian. The pages now say Консиерж and this table carries it
       back the other way. */
    "Консиерж": "Concierge",
    "AutoHaus Консиерж": "AutoHaus Concierge",

    /* ---- the hero ---- */
    "AutoHaus Пловдив": "AutoHaus Plovdiv",
    "AutoHaus · Пловдив": "AutoHaus · Plovdiv",
    "Автомобили в наличност": "Vehicles in stock",
    "Виж колекцията": "See the collection",
    "Един стандарт, 87 пъти": "One standard, 87 times",
    "Как работим": "How we work",
    "Цялата колекция": "The whole collection",
    "Достъп, а не обяви": "Access, not listings",
    "Заявка за търсене": "Request a search",
    "Шоурумът на AutoHaus в Пловдив по здрач, с осветена фасада":
      "The AutoHaus showroom in Plovdiv at dusk, its facade lit",
    "Витрината на AutoHaus — автомобили в шоурума при залез":
      "The AutoHaus showroom floor at sunset",
    "Шоурумът на AutoHaus отвътре, със слънце през остъклената фасада":
      "Inside the AutoHaus showroom, sun through the glazed facade",

    /* ---- the marque row and the collection preview ---- */
    "Разгледай по марка": "Browse by marque",
    "Всички марки": "All marques",
    "Всички модели": "All models",
    "Всички раздели": "All chapters",
    "Всички автомобили": "All vehicles",
    "Всички": "All",
    "Колекцията": "The collection",
    "Колекцията на AutoHaus": "The AutoHaus collection",
    "Целият каталог": "The full catalogue",
    "автомобила в наличност": "vehicles in stock",
    "в наличност": "in stock",
    "Подредба": "Sort",
    "Препоръчани": "Recommended",
    "Най-нови постъпления": "Latest arrivals",
    "Цена — низходящо": "Price — high to low",
    "Цена — възходящо": "Price — low to high",
    "Година — най-нови": "Year — newest first",
    "Пробег — най-малък": "Mileage — lowest first",
    "Мощност — най-висока": "Power — highest first",
    "Обратно към колекцията": "Back to the collection",
    "Обратно към": "Back to",
    "колекцията": "the collection",
    "Наличните": "In stock now",
    "Съвпадения в наличност": "Matches in stock",
    "Резултати от търсенето в наличната колекция.": "Search results within the collection in stock.",
    "Търсене в колекцията": "Search the collection",
    "Търсене и филтри": "Search and filters",
    "Марка, модел, референция…": "Marque, model, reference…",
    "Няма съвпадение при текущите филтри": "Nothing matches the current filters",
    "Няма съвпадение в наличност.": "Nothing in stock matches.",
    "Не намерихте я?": "Didn't find it?",
    "Което не значи, че го няма. Голяма част от това, което продаваме, никога не е стояло във витрината — намерено е по поръчка. Търсенето и филтрите се прехвърлят в заявката, така че няма да ги въвеждате отново.":
      "Which does not mean it does not exist. Much of what we sell has never stood in the showroom — it was sourced to order. Your search and filters carry over into the enquiry, so you will not type them twice.",
    "Търсих:": "I searched for:",

    /* ---- filters ---- */
    "Филтри": "Filters",
    "Изчисти филтрите": "Clear the filters",
    "Изчисти търсенето": "Clear the search",
    "Затвори филтрите": "Close the filters",
    "Марка": "Marque",
    "Модел": "Model",
    "Раздел": "Chapter",
    "Година": "Year",
    "Цена": "Price",
    "Пробег": "Mileage",
    "Двигател": "Engine",
    "Мощност": "Power",
    "Скоростна кутия": "Gearbox",
    "Цвят": "Colour",
    "Каросерия": "Body",
    "Тип каросерия": "Body style",
    "Състояние": "Condition",
    "Диапазон": "Range",
    "От": "From",
    "До": "To",
    "Филтър": "Filter",
    /* the two handles of every range control, spelled out rather than
       pattern-matched: eight lines that can be read, against one regex that
       has to reach back into the table for the half of the string that is
       itself a key */
    "Цена — минимум": "Price — minimum",
    "Цена — максимум": "Price — maximum",
    "Година — минимум": "Year — minimum",
    "Година — максимум": "Year — maximum",
    "Пробег — минимум": "Mileage — minimum",
    "Пробег — максимум": "Mileage — maximum",
    "Мощност — минимум": "Power — minimum",
    "Мощност — максимум": "Power — maximum",
    "От година": "Year from",
    "До година": "Year to",
    "Година от": "Year from",
    "Година до": "Year to",
    "Година — от": "Year — from",
    "Година — до": "Year — to",
    "Цена от": "Price from",
    "Цена до": "Price to",
    "Цена — минимум": "Price — minimum",
    "Цена — максимум": "Price — maximum",
    "Долна граница на цената": "Lower price bound",
    "Горна граница на цената": "Upper price bound",
    "Пробег от": "Mileage from",
    "Пробег до": "Mileage to",
    "Пробег (км)": "Mileage (km)",
    "Пробег — минимум": "Mileage — minimum",
    "Пробег — максимум": "Mileage — maximum",
    "до 30 000 €": "up to €30,000",
    "над 200 000 €": "over €200,000",
    "напр. 2019": "e.g. 2019",
    "напр. 90 000": "e.g. 90 000",

    /* ---- fuels, gearboxes, chapters, badges ---- */
    "Бензин": "Petrol",
    "Дизел": "Diesel",
    "Хибрид": "Hybrid",
    "Plug-in хибрид": "Plug-in hybrid",
    "Електрически": "Electric",
    "Автоматична": "Automatic",
    "Автоматик": "Automatic",
    "Ръчна": "Manual",
    "Ръчна скоростна кутия": "Manual gearbox",
    "Брониран клас": "Armoured class",
    "брониран клас": "armoured class",
    "Брониран": "Armoured",
    "Фабрично брониран": "Factory-armoured",
    "Представителен": "Chauffeur-driven",
    "Представителен клас": "Chauffeur class",
    "Терен": "Off-road",
    "Класика": "Classic",
    "Селекция": "Selection",
    "Електрифицирани": "Electrified",
    "Нерегистриран": "Unregistered",
    "нерегистриран": "unregistered",
    "Нов / нерегистриран": "New / unregistered",
    "Доставъчен пробег": "Delivery mileage",
    "доставъчен пробег": "delivery mileage",
    "Първа регистрация": "First registration",
    "Без първа регистрация,": "No first registration,",
    "Дискретна продажба": "Discreet sale",
    "При запитване": "On enquiry",
    "Цена при запитване": "Price on enquiry",
    "цена при запитване": "price on enquiry",
    "Крайна цена": "Final price",
    "Референция": "Reference",
    "Дълга база": "Long wheelbase",
    "Панорама": "Panoramic roof",
    "Теглич": "Tow bar",
    "Кабрио": "Convertible",
    "Комби": "Estate",
    "Купе": "Coupé",
    "Седан": "Saloon",
    "Пикап": "Pick-up",
    "Ван / бус": "Van / minibus",
    "SUV / офроуд": "SUV / off-road",
    "Малко каран": "Low mileage",
    "Задно забавление": "Rear-wheel drive",
    "Сервизна история": "Service history",
    "Пълна сервизна история": "Full service history",
    "Колекционерска стойност": "Collector value",
    "Рядкост в този клас.": "A rarity in this class.",
    "марки": "marques",
    "Друга марка": "Another marque",

    "Ателието е на разположение и след покупката — за автомобил, купен от нас или не.":
      "The studio is available after the purchase too — for a car bought from us or not.",
    "Сервизът поема и поддръжката след покупката.":
      "The workshop takes on the maintenance after the purchase as well.",
    "AutoHaus Пловдив · Асеновградско шосе": "AutoHaus Plovdiv · Asenovgradsko Shose",
    "Опишете я накратко — марка, година, пробег и състояние. Ако е на лизинг, посочете го.":
      "Describe it briefly — marque, year, mileage and condition. If it is on finance, say so.",
    "Заявката е пълна и стига до екипа на AutoHaus.":
      "The enquiry is complete and reaches the AutoHaus team.",
    "Заявката стига до екипа на AutoHaus в Пловдив.":
      "The enquiry reaches the AutoHaus team in Plovdiv.",
    /* ---- За AutoHaus ---- */
    "AutoHaus е комплекс в Пловдив, на Асеновградско шосе, и работи с автомобили от горния клас — в наличност на място и по поръчка.":
      "AutoHaus is a complex in Plovdiv, on Asenovgradsko Shose, working with upper-segment cars — in stock on site and sourced to order.",
    "Във витрината стоят автомобилите в наличност. Ако търсеният не е сред тях, той се издирва и внася — марка, оборудване, състояние и бюджет се уточняват предварително. Приемаме автомобил и насрещно, за изкупуване или като част от плащането.":
      "On the showroom floor are the cars in stock. If the one you are after is not among them, it is sourced and imported — marque, equipment, condition and budget agreed beforehand. We also take a car the other way, outright or against the purchase.",
    "Финансирането и застраховането се уреждат на място, с партньорски институции; одобрението остава тяхно решение. В базата са и собственият сервиз — диагностика и обслужване — и AutoSpa за измиване, детайлинг и защита на лака. И двата остават на разположение и след покупката.":
      "Finance and insurance are arranged on site, with partner institutions; approval remains their decision. The site also holds our own workshop — diagnostics and servicing — and AutoSpa for washing, detailing and paint protection. Both stay available after the purchase.",
    "Кафе барът на терасата е отворен и за хора, които просто минават. Разговорът за автомобил върви по-добре на маса.":
      "The cafe bar on the terrace is open to people simply passing by. A conversation about a car goes better at a table.",
    "Отделите": "The departments",

    /* ---- the vehicle dossier: the listing's own eight rows and its notes ----
       These are the labels autohaus.bg prints, in its order. The month names
       and the euro figure go through RULES below, because they carry values. */
    "Спецификация": "Specification",
    "Оборудване": "Equipment",
    "Регистрация": "Registration",
    "Тип двигател": "Engine",
    "Трансмисия": "Transmission",
    "Без първа регистрация": "Not first registered",
    "Цена без начислен 20% ДДС": "Price excludes 20% VAT",
    "Възможен лизинг": "Leasing available",
    "Възможен бартер": "Part-exchange available",
    "Фабрично нов автомобил": "Factory new",
    "Сертификат N1 за товарен автомобил": "N1 goods-vehicle certificate",
    "Автомобилът е цялостно облепен в предпазно фолио с матиращ ефект":
      "Fully wrapped in matte protective film",
    "Добавена е спортна изпускателна система MILLTEK Sport":
      "MILLTEK Sport exhaust system fitted",
    "Автомобилът е с електроника и компоненти за повишаване на мощността до 800 к.с.":
      "Electronics and components taking output to 800 hp",
    "Добавен екстериорен пакет от G63 AMG": "G63 AMG exterior package fitted",
    "Цената на този автомобил се съобщава при запитване.":
      "The price of this vehicle is given on request.",

    /* ---- the contact panel ----
       Six departments, an address and a map. The address is transliterated
       rather than translated: a street name is how a courier finds the
       building, and "Nestor Abadzhiev" is what is written on it. */
    "Карта до AutoHaus Пловдив": "Map to AutoHaus Plovdiv",
    "Отвори в Google Maps": "Open in Google Maps",
    "ул. „Нестор Абаджиев“ №24": "24 Nestor Abadzhiev Street",
    "Асеновградско шосе": "Asenovgradsko Shose",
    "4023 Пловдив, България": "4023 Plovdiv, Bulgaria",
    "ул. „Нестор Абаджиев“ №24, 4023 Пловдив": "24 Nestor Abadzhiev Street, 4023 Plovdiv",
    "ЕИК 200771286 · ДДС BG200771286": "Company No. 200771286 · VAT BG200771286",
    "Офис": "Office",
    "Продажби": "Sales",
    "Щети": "Claims",
    "ГТП": "Annual test",
    "Пон – Пет · 09:00 – 18:00": "Mon – Fri · 09:00 – 18:00",
    "Пон – Нед · 08:00 – 20:00": "Mon – Sun · 08:00 – 20:00",
    "Всички телефони и картата": "All numbers and the map",
    "Последвайте ни": "Follow us",
    "Фирмени данни": "Company information",

    /* ---- the service wall — the four rooms ----
       Card three is provisional: the owner has not supplied the final
       leasing and insurance terms, so every figure on it is marked
       [data-tbd] in index.html and every one of them is a key here.
       Replacing a figure means replacing one line in each file. */
    "Собствено ателие": "Our own studio",
    "AutoSpa": "AutoSpa",
    "Auto Spa": "Auto Spa",
    "Ръчно измиване, детайлинг, полиране и защита — на място в базата.":
      "Hand washing, detailing, polishing and protection — on site.",
    "Ръчно измиване, детайлинг, полиране, керамично покритие и защитно фолио — в собствено ателие в базата, не при подизпълнител.":
      "Hand washing, detailing, polishing, ceramic coating and paint protection film — in our own studio on site, not at a subcontractor.",
    "Всеки автомобил от колекцията минава оттук, преди да бъде показан. Ателието остава на разположение и след покупката — за автомобил, купен от нас или не.":
      "Every car in the collection passes through here before it is shown. The studio stays available after the purchase too — for a car bought from us or not.",
    "Ръчно измиване и сушене": "Hand washing and drying",
    "Детайлинг на интериора": "Interior detailing",
    "Полиране и корекция на лака": "Polishing and paint correction",
    "Керамично покритие": "Ceramic coating",
    "Защитно фолио": "Paint protection film",
    "Подготовка преди продажба": "Pre-sale preparation",
    "Автомобил пред входа на AutoSpa в базата на AutoHaus":
      "A car at the AutoSpa entrance on the AutoHaus site",
    "Запази час": "Book a slot",

    "Собствен сервиз": "Our own workshop",
    "Сервиз": "Service",
    "Диагностика, обслужване и поддръжка — в базата в Пловдив.":
      "Diagnostics, servicing and maintenance — on site in Plovdiv.",
    "Компютърна диагностика, планово обслужване, окачване, спирачки, климатик и гуми — в собствен сервиз в базата в Пловдив.":
      "Computer diagnostics, scheduled servicing, suspension, brakes, air conditioning and tyres — in our own workshop on site in Plovdiv.",
    "Всеки автомобил минава пълна механична подготовка, преди да влезе във витрината. Същият сервиз поема и поддръжката след покупката.":
      "Every car goes through full mechanical preparation before it reaches the showroom floor. The same workshop takes on the maintenance after the purchase.",
    "Компютърна диагностика": "Computer diagnostics",
    "Планово обслужване": "Scheduled servicing",
    "Окачване и спирачки": "Suspension and brakes",
    "Климатик и електроника": "Air conditioning and electronics",
    "Гуми и реглаж": "Tyres and alignment",
    "Подготовка за годишен преглед": "Preparation for the annual test",
    "Час се запазва по телефона или през Консиерж — за автомобил, купен от нас или не.":
      "Book by phone or through the Concierge — for a car bought from us or not.",
    "Автомобил след механична подготовка пред сервиза":
      "A car outside the workshop after mechanical preparation",

    "Условия при запитване": "Terms on request",
    "Лизинг и застраховане": "Leasing and insurance",
    "Финансиране, каско и гражданска отговорност — подготвени на едно място.":
      "Finance, comprehensive and third-party cover — arranged in one place.",
    "Финансирането и застраховките се уреждат при нас, с партньорски институции. Документите се подготвят на място, заедно с регистрацията.":
      "Finance and insurance are arranged here, with partner institutions. The paperwork is prepared on site, along with the registration.",
    "Застраховане": "Insurance",
    "Лихва": "Interest",
    "6.9% годишно": "6.9% a year",
    "Първоначална вноска": "Deposit",
    "от 20%": "from 20%",
    /* NOT "Срок". That bare word is the concierge's delivery-timescale
       question further down this table, and one key cannot be both. */
    "Срок на лизинга": "Leasing term",
    "до 60 месеца": "up to 60 months",
    "Одобрение": "Approval",
    "до два работни дни": "up to two working days",
    "Каско": "Comprehensive cover",
    "Гражданска отговорност": "Third-party liability",
    "Асистанс": "Roadside assistance",
    "Гаранция": "Warranty",
    "условия при запитване": "terms on request",
    "Показаните условия са примерни и подлежат на потвърждение от партньорска лизингова и застрахователна институция.":
      "The terms shown are indicative and subject to confirmation by a partner leasing and insurance institution.",
    "Mercedes-Maybach GLS пред шоурума на AutoHaus":
      "Mercedes-Maybach GLS outside the AutoHaus showroom",

    "На терасата": "On the terrace",
    "Кафе, закуски и маса за разговора — с изглед към витрината.":
      "Coffee, something to eat and a table for the conversation — overlooking the showroom floor.",
    "В повечето шоуруми кафето идва от автомат в ъгъла. Тук е част от сградата — тераса с изглед към витрината, маси навън и вътре.":
      "In most showrooms the coffee comes from a machine in the corner. Here it is part of the building — a terrace overlooking the showroom floor, tables outside and in.",
    "Отворен е за всеки, не само за клиенти. Разговорът за автомобил върви по-добре на маса, отколкото прав до колата — и голяма част от огледите и документите минават именно оттук.":
      "It is open to everyone, not only to customers. A conversation about a car goes better at a table than standing beside one — and a good deal of the viewings and the paperwork happen right here.",
    "Кафе и напитки": "Coffee and drinks",
    "Закуски": "Something to eat",
    "Тераса с изглед": "A terrace with a view",
    "Безплатен Wi-Fi": "Free Wi-Fi",
    "Паркинг пред входа": "Parking at the door",
    "Отворено и за гости": "Open to visitors too",
    "Как да стигнете": "How to find us",
    "Терасата на кафе бара на AutoHaus при залез":
      "The AutoHaus cafe bar terrace at sunset",

    "Внос по поръчка": "Sourcing to order",
    "Изкупуване и бартер": "Buying and part-exchange",

    "AMG, RS, Turbo S, GT. Автомобили, които се избират с ушите.":
      "AMG, RS, Turbo S, GT. Cars chosen with your ears.",
    "G-класа, Land Cruiser, Range Rover. Построени да не се извиняват.":
      "G-Class, Land Cruiser, Range Rover. Built to apologise for nothing.",
    "Maybach, дълга база, VIP салон. Задната седалка е работното място.":
      "Maybach, long wheelbase, VIP cabin. The back seat is the office.",
    "Автомобили, чиято стойност вече не се обезценява.": "Cars whose value has stopped falling.",
    "Електрически и хибридни, с пълна история на батерията.":
      "Electric and hybrid, with full battery history.",
    "Останалата част от колекцията — седани, купета и SUV.":
      "The rest of the collection — saloons, coupés and SUVs.",
    "Фабрично брониран представителен транспорт — B7/VR9 и VR10.":
      "Factory-armoured chauffeur transport — B7/VR9 and VR10.",

    /* ---- the services teaser and the about band ---- */
    "Подбор и внос по поръчка, изкупуване и бартер, застраховки и регистрация, Auto Spa. Всичко около автомобила, на едно място.":
      "Selection and sourcing to order, buying and part-exchange, insurance and registration, Auto Spa. Everything around the car, in one place.",
    "За AutoHaus": "About AutoHaus",
    "Всяка кола минава един и същ път — проверка, подготовка, Auto Spa, витрина — и всяка тръгва с проверен произход и пълна сервизна история. В салона има кафе бар, отворен за всички: елате за еспресо и разгледайте без никакъв натиск.":
      "Every car takes the same route — inspection, preparation, Auto Spa, showroom floor — and every one leaves with verified provenance and a full service history. There is a coffee bar in the showroom, open to everyone: come for an espresso and look around with no pressure at all.",
    "Запази оглед": "Book a viewing",
    "Виж услугите": "See the services",
    "Вашият AutoHaus": "Your AutoHaus",
    "Салонът": "The showroom",
    "Кафе бар": "Coffee bar",
    "Намерете ни": "Find us",
    "Новини": "News",
    "Партньорство": "Partnership",
    "Поверителност": "Privacy",
    "Общи условия": "Terms",
    /* The footer's legal column and the social label were never in the
       table, so four links, a heading and two aria-labels stayed Bulgarian
       in English on EVERY page. Found by walking the document for leftover
       Cyrillic rather than by reading it — which is the only way this kind
       of gap ever shows up. */
    "Правни": "Legal",
    "Политика за поверителност": "Privacy policy",
    "Политика за бисквитки": "Cookie policy",
    "Вашите права по GDPR": "Your rights under GDPR",
    "Бисквитки": "Cookies",
    "AutoHaus в социалните мрежи": "AutoHaus on social media",
    "ДДС BG200771286": "VAT BG200771286",
    "Оглед и тест драйв": "Viewing and test drive",
    "Застраховки и регистрация": "Insurance and registration",
    "Auto Spa и детайлинг": "Auto Spa and detailing",
    "Лизинг от 6.9%": "Leasing from 6.9%",
    "Лизинг 6.9%": "Leasing 6.9%",
    "Как подготвяме колите": "How we prepare the cars",
    "Пон – Пет 09:00 – 18:00": "Mon – Fri 09:00 – 18:00",
    "ул. „Нестор Абаджиев“ №24, Пловдив": "24 Nestor Abadzhiev St, Plovdiv",
    "Mercedes-Benz 420 SEL, 1991 — класиката в AutoHaus":
      "Mercedes-Benz 420 SEL, 1991 — the classic at AutoHaus",
    "Аутохаус България ЕООД": "Autohaus Bulgaria EOOD",
    "© 2026 Аутохаус България ЕООД": "© 2026 Autohaus Bulgaria EOOD",
    "ЕИК 200771286": "Company no. 200771286",
    "ДДС № BG200771286": "VAT no. BG200771286",
    "Аутохаус България ЕООД · ЕИК 200771286 · ул. „Нестор Абаджиев“ №24, Асеновградско шосе, 4023 Пловдив · +359 884 777 147 · autohausbg@gmail.com":
      "Autohaus Bulgaria EOOD · Company no. 200771286 · 24 Nestor Abadzhiev St, Asenovgradsko shose, 4023 Plovdiv · +359 884 777 147 · autohausbg@gmail.com",
    "Обявените цени са крайни. Лизинг от 6.9% годишно при 20% първоначална вноска и срок до 60 месеца; месечната вноска е ориентировъчна и подлежи на одобрение от партньорска лизингова институция. Автомобил се запазва за 48 часа след капаро. Възможен бартер с вашия автомобил.":
      "Prices shown are final. Leasing from 6.9% a year with a 20% deposit and terms up to 60 months; the monthly payment is indicative and subject to approval by a partner leasing institution. A car is held for 48 hours against a deposit. Part-exchange with your car is possible.",
    "Обявените цени са крайни. Лизингът е ориентировъчен: 6.9% годишна лихва при 20% първоначална вноска и срок до 60 месеца; окончателните условия се потвърждават след одобрение от партньорска лизингова институция. Автомобил се запазва за 48 часа след капаро. Възможен бартер с вашия автомобил.":
      "Prices shown are final. Leasing figures are indicative: 6.9% annual interest with a 20% deposit and terms up to 60 months; final terms are confirmed after approval by a partner leasing institution. A car is held for 48 hours against a deposit. Part-exchange with your car is possible.",

    /* ---- the collection ---- */
    "Всяка кола тук е физически в Пловдив и е минала през един и същ път: проверка на произход и история, механична подготовка, Auto Spa, витрина. Продадените се свалят в същия ден.":
      "Every car here is physically in Plovdiv and has taken the same route: provenance and history checks, mechanical preparation, Auto Spa, showroom floor. Sold cars come down the same day.",
    "Колекцията се подрежда в браузъра, а тук той не изпълнява скриптове. Наличността се проверява по телефона за секунди — и е същата, която бихте видели тук.":
      "The collection is assembled in the browser, and scripts are not running here. Availability can be checked by phone in seconds — and it is the same availability you would see on this page.",
    "Колекцията се движи бързо. Кажете ни какво търсите и ще го намерим — голяма част от това, което продаваме, никога не е стояло във витрината.":
      "The collection moves quickly. Tell us what you are looking for and we will find it — much of what we sell has never stood in the showroom.",

    /* ---- the dossier ---- */
    "За този автомобил": "About this car",
    "Защо този": "Why this one",
    "Детайли": "Details",
    "Гаранции и оглед": "Guarantees and viewing",
    "Въпрос към AutoHaus": "A question for AutoHaus",
    "Други от колекцията": "More from the collection",
    "Автомобили от същия раздел или от същата марка, в наличност сега.":
      "Cars from the same chapter or the same marque, in stock now.",
    "Цена и запитване": "Price and enquiry",
    "Лизинг · 20% първоначална вноска": "Leasing · 20% deposit",
    "Заявката стига директно до": "The enquiry goes straight to",
    "Иван Манев": "Ivan Manev",
    "ИМ": "IM",
    "Одобри лично този автомобил, преди да бъде показан.":
      "Personally approved this car before it was shown.",
    "Автомобилът не е намерен — AutoHaus": "Car not found — AutoHaus",
    "Този автомобил вече не е в колекцията.": "This car is no longer in the collection.",
    "Продадените се свалят в деня на продажбата. Ако сте го харесали,":
      "Sold cars come down the day they sell. If you liked it,",
    "вероятно можем да намерим същия — или по-добър.":
      "we can probably find the same one — or better.",
    "Намерете ми такъв": "Find me one",
    "Този автомобил се предлага дискретно. Цената се съобщава при заявка.":
      "This car is offered discreetly. The price is given on enquiry.",
    "Този автомобил не се обявява публично. Цената и условията се съобщават при заявка.":
      "This car is not advertised publicly. The price and terms are given on enquiry.",
    "Цената на този автомобил не се обявява публично; съобщава се при заявка.":
      "The price of this car is not advertised publicly; it is given on enquiry.",
    "Не се обявява публично; цената се съобщава при заявка.":
      "Not advertised publicly; the price is given on enquiry.",
    "Автомобилът не е регистриран.": "The car is unregistered.",
    "Практически нови автомобили — под 1 000 км, някои изобщо нерегистрирани.":
      "Practically new cars — under 1,000 km, some never registered at all.",
    "Мощност, която оправдава подготовката.": "Power that earns the preparation.",
    "Възраст, в която състоянието е единственото, което тежи.":
      "An age at which condition is the only thing that counts.",
    "С пълна история на батерията.": "With full battery history.",
    "Ниво на защита и документация — лично при оглед.":
      "Protection level and documentation — in person, at the viewing.",
    "Книжки, фактури и справка за произход при огледа.":
      "Service books, invoices and the provenance report at the viewing.",
    "Запазване за 48 часа след капаро, докато уредите финансирането.":
      "Held for 48 hours against a deposit while you arrange the finance.",
    "Тест драйв по уговорка — автомобилът трябва да е подготвен и застрахован за него.":
      "Test drive by arrangement — the car has to be prepared and insured for it.",
    "Оглед всеки делничен ден 09:00 – 18:00, без записване. Автомобилът е физически в салона.":
      "Viewing every weekday 09:00 – 18:00, no appointment. The car is physically in the showroom.",
    "Бартер: оглеждаме вашия автомобил на място и даваме твърда оферта същия ден.":
      "Part-exchange: we inspect your car in person and give a firm offer the same day.",
    "Оглеждаме го на място и даваме твърда оферта същия ден. Ако е на лизинг, поемаме и комуникацията с институцията.":
      "We inspect it in person and give a firm offer the same day. If it is on finance, we handle the lender as well.",
    "Кратък въпрос за този автомобил": "A short question about this car",
    "Например: свободен ли е за оглед в събота?": "For example: is it free to view on Saturday?",
    "Въпросът се добавя към": "The question is added to",
    "заявката и стига до": "the enquiry and reaches",
    "Търся друг": "Looking for another",
    "Търся друг автомобил": "Looking for another car",
    "Търся такъв": "I want one of these",
    "Фабрично брониран автомобил. Нивото на защита и документацията към":
      "A factory-armoured car. The protection level and the documentation for",
    "бронирането се преглеждат лично при огледа, не се описват в обява.":
      "the armouring are reviewed in person at the viewing, not described in a listing.",
    "Преминал е през същия път като всеки автомобил в колекцията: проверка на":
      "It has taken the same route as every car in the collection: checks on",
    "произход и сервизна история, механична подготовка в собствен сервиз, пълен Auto Spa":
      "provenance and service history, mechanical preparation in our own workshop, a full Auto Spa",
    "детайлинг и лично одобрение от": "detail and personal approval by",
    "Документите — справка за произход, сервизни книжки и фактури — са на":
      "The documents — provenance report, service books and invoices — are",
    "разположение при огледа, преди да е поет какъвто и да било ангажимент.":
      "available at the viewing, before any commitment is made.",
    "в Пловдив, с пълна история и подготовка от нашия сервиз.":
      "in Plovdiv, with full history and preparation by our workshop.",
    "е доставъчен; автомобилът е практически нов.":
      "is delivery mileage; the car is practically new.",
    "са доставъчен пробег — от завода до салона.":
      "are delivery mileage — factory to showroom.",
    "от завода.": "from the factory.",
    "Пробегът от": "The mileage of",
    "г. са изминати": "was covered",
    "км средногодишно от": "km a year on average since",
    "км средногодишно.": "km a year on average.",
    "— практически нов автомобил.": "— a practically new car.",
    "Около": "About",
    "— около": "— about",
    "Забележки": "Notes",
    "Бележка": "Note",
    "Задължително": "Required",
    "Плащане": "Payment",
    "Бюджет": "Budget",
    /* the delivery timescale, not a leasing term — index.html's term
       selector asks for "Срок в месеци" so the two never share a key */
    "Срок": "Timescale",
    "срок": "term",
    "бюджет": "budget",
    "марка и модел": "marque and model",
    "година и пробег": "year and mileage",
    "телефон": "phone",
    "описание на въпроса": "a description of the question",
    "Стои в раздел „": "Sits in the chapter “",
    "и": "and",
    "от": "from",
    "до": "to",
    "г.": "",
    "хил.": "k",
    "к.с.": "hp",
    "км": "km",

    /* ---- concierge: the room ----
       The page became a consultation room rather than a form (see "v41" in
       style.css), which means most of its copy is now something a person
       says rather than something a field is labelled with. Иван's asides
       reach the page as text nodes written by concierge.js, so they are
       ordinary table entries — no attribute translation is involved. */
    "Седнете за момент.": "Take a seat.",
    "Няколко въпроса, около две минути. Толкова, колкото да разберем какво търсите — и да го намерим вместо Вас.":
      "A few questions, about two minutes. Just enough for us to understand what you are looking for — and to go and find it for you.",
    "Консиерж · AutoHaus Пловдив": "Concierge · AutoHaus Plovdiv",
    "Хода на разговора": "The shape of the conversation",
    "Отговор до 24 часа в работни дни": "An answer within 24 hours on working days",
    "Дотук": "So far",
    "Запазено": "Saved",

    /* the names of the questions, as the rail lists them */
    "Посока": "Direction",
    "Автомобилът": "The car",
    "Изисквания": "Requirements",
    "Замяната": "The part-exchange",
    "Преглед": "Review",

    /* what Иван says at each one */
    "Кажете ми накъде, и ще Ви спестя останалите въпроси.":
      "Tell me which way, and I will spare you the rest of the questions.",
    "Дори само марката е достатъчна за начало.":
      "Even the marque on its own is enough to start with.",
    "Пропуснете спокойно — това го уточняваме и на място.":
      "Skip it if you like — this is something we settle in person anyway.",
    "Числото не е обещание. То само скъсява търсенето.":
      "The figure is not a promise. It only shortens the search.",
    "Срокът решава дали чакаме правилната кола, или взимаме от наличното.":
      "The timescale decides whether we wait for the right car or take one from stock.",
    "Оценката е твърда и е от мен, не от таблица.":
      "The valuation is firm, and it comes from me rather than from a table.",
    "Само за да отговоря. Нищо друго.": "Only so that I can answer. Nothing else.",
    "Това е, което ще прочета. Проверете го.": "This is what I will read. Please check it.",
    "Заявката е при мен. Ще се чуем.": "The enquiry is with me. We will speak.",

    /* the questions themselves */
    "С какво да започнем?": "Where shall we start?",
    "Отговорът тук решава кои въпроси изобщо ще Ви задам.":
      "Your answer here decides which questions I ask you at all.",
    "Кой автомобил Ви е в главата?": "Which car do you have in mind?",
    "Колкото по-конкретно, толкова по-точно търсим. „Още не знам“ също е отговор.":
      "The more specific you are, the more precisely we search. “I don’t know yet” is an answer too.",
    "Без какво не става?": "What is non-negotiable?",
    "Само задължителното. Останалото ще подберем ние.":
      "Only what is essential. We will choose the rest.",
    "В какви рамки?": "Within what range?",
    "Разкажете ми за нея.": "Tell me about it.",
    "Оглеждаме я на място и даваме твърда оферта същия ден. Ако е на лизинг, поемаме и комуникацията с институцията.":
      "We inspect it here and give a firm offer the same day. If it is on finance, we handle the lender too.",
    "Как да Ви намеря?": "How do I reach you?",
    "Ето какво стига до мен.": "Here is what reaches me.",
    "В наличност сега": "In stock now",
    "Или просто питайте": "Or simply ask",

    /* the match readout, the brief's addressee and the hand-off screen —
       all three are written by concierge.js and none of them was ever in
       the table */
    "автомобила в колекцията отговарят на описаното дотук.":
      "vehicles in the collection match what you have described so far.",
    "автомобил в колекцията отговаря на описаното дотук.":
      "vehicle in the collection matches what you have described so far.",
    "автомобила в наличност отговарят. Точно за това съществува тази заявка — ще го намерим.":
      "vehicles in stock match. This enquiry exists for precisely that reason — we will find it.",
    "За Иван Манев": "For Ivan Manev",
    "Номер на заявката:": "Enquiry number:",
    "Заявката е готова и е с номер": "The enquiry is ready, under number",
    ". Изберете как да стигне до нас — текстът вече е попълнен.":
      ". Choose how it should reach us — the text is already written for you.",

    "AutoHaus Консиерж — заявка за автомобил": "AutoHaus Concierge — vehicle enquiry",
    "Кажете ни какво търсите.": "Tell us what you are looking for.",
    "Няколко въпроса, около две минути. Заявките с описан автомобил, бюджет и срок се разглеждат лично от Иван Манев и получават отговор до 24 часа в работни дни.":
      "A few questions, about two minutes. Enquiries that describe the car, the budget and the timescale are reviewed personally by Ivan Manev and answered within 24 hours on working days.",
    "С какво можем да сме полезни?": "How can we help?",
    "Отговорът определя останалите въпроси — няма да Ви питаме нищо излишно.":
      "Your answer decides the rest of the questions — we will not ask you anything unnecessary.",
    "Автомобил от колекцията": "A car from the collection",
    "Видях конкретна кола и искам да продължа.": "I have seen a specific car and want to go ahead.",
    "Търсене по поръчка": "A search to order",
    "Знам какво искам, но го няма при вас. Намерете го.":
      "I know what I want, but you do not have it. Find it.",
    "Продажба или замяна": "Selling or part-exchange",
    "Имам автомобил за изкупуване или бартер.": "I have a car to sell or part-exchange.",
    "Друго": "Something else",
    "Друго запитване": "Another enquiry",
    "Auto Spa, лизинг, застраховка, регистрация.": "Auto Spa, leasing, insurance, registration.",
    "Кой автомобил?": "Which car?",
    "Марка и модел": "Marque and model",
    "Модел и версия": "Model and version",
    "напр. BMW X5 xDrive30d": "e.g. BMW X5 xDrive30d",
    "напр. 911 Turbo S, G 63 AMG, S 580 L": "e.g. 911 Turbo S, G 63 AMG, S 580 L",
    "Колкото по-конкретно, толкова по-точно търсим. „Не съм сигурен“ също е отговор.":
      "The more specific you are, the more precisely we search. “Not sure” is an answer too.",
    "Какво е задължително?": "What is essential?",
    "Изберете само това, без което автомобилът не Ви върши работа.":
      "Choose only what the car is no use to you without.",
    "Какъв е бюджетът?": "What is the budget?",
    "Ориентировъчно е достатъчно. Това е въпросът, който най-много скъсява търсенето.":
      "A rough figure is enough. This is the question that shortens the search most.",
    "Как плащате": "How you are paying",
    "В брой": "Cash",
    "С бартер": "With part-exchange",
    "Фирмени": "Company purchase",
    "Кога искате да я карате?": "When do you want to be driving it?",
    "Срокът решава дали търсим от наличното, или можем да чакаме правилния автомобил.":
      "The timescale decides whether we search what is in stock or can wait for the right car.",
    "Веднага": "Immediately",
    "До две седмици. Търсим само от наличното.": "Within two weeks. We search stock only.",
    "До 3 месеца": "Within 3 months",
    "До 6 месеца": "Within 6 months",
    "Достатъчно време за внос по поръчка.": "Enough time to source to order.",
    "Още проучвам": "Still researching",
    "Проучвам": "Researching",
    "Без срок. Искам да знам какво е възможно.": "No deadline. I want to know what is possible.",
    "Ще чакам точния автомобил.": "I will wait for the right car.",
    "Автомобилът за замяна": "The car you are part-exchanging",
    "За замяна": "For part-exchange",
    "На лизинг ли е?": "Is it on finance?",
    "Да, с остатък по договора": "Yes, with a balance outstanding",
    "Не": "No",
    "Няма значение": "Doesn't matter",
    "Предпочитам": "I prefer",
    "Предпочита": "Prefers",
    "Състояние и забележки": "Condition and notes",
    "Сервизна история, забележки по купето, допълнително оборудване…":
      "Service history, bodywork notes, additional equipment…",
    "Свободен текст — всичко, което не се е побрало по-горе.":
      "Free text — anything that did not fit above.",
    "Нещо, което трябва да знаем": "Anything we should know",
    "Как да Ви намерим?": "How do we reach you?",
    "Име": "Name",
    "Телефон": "Phone",
    "Имейл": "Email",
    "Моля, въведете име.": "Please enter a name.",
    "Моля, въведете телефон или имейл.": "Please enter a phone number or an email.",
    "Проверете имейл адреса.": "Please check the email address.",
    "Използваме тези данни само за да отговорим на тази заявка.":
      "We use these details only to answer this enquiry.",
    "С изпращането се съгласявате AutoHaus да съхрани данните Ви за целите на тази заявка.":
      "By sending it you agree that AutoHaus may keep your details for the purposes of this enquiry.",
    "Прегледайте и коригирайте, ако е нужно. Точно това ще види Иван.":
      "Review and correct if needed. This is exactly what Ivan will see.",
    "Ето какво изпращаме.": "Here is what we are sending.",
    "Изпрати заявката": "Send the enquiry",
    "Изпращане…": "Sending…",
    "Заявката е приета": "Enquiry received",
    "Благодарим. Заявката е при нас.": "Thank you. We have your enquiry.",
    "Заявката е пълна. Разглежда се лично от Иван Манев, с отговор до 24 часа в работни дни.":
      "The enquiry is complete. Ivan Manev reviews it personally, with an answer within 24 hours on working days.",
    "Иван Манев я преглежда лично и ще получите отговор до 24 часа в работни дни.":
      "Ivan Manev reviews it personally and you will have an answer within 24 hours on working days.",
    "Ще се свържем с вас в рамките на един работен ден.":
      "We will be in touch within one working day.",
    "Готово — остава да я изпратите.": "Done — all that is left is to send it.",
    "Може да я изпратите и така. Ако добавите": "You can send it as it is. If you add",
    ", отговорът идва по-бързо и по-точно.": ", the answer comes faster and sharper.",
    "Само един бърз въпрос?": "Just one quick question?",
    "Наличност, цени, лизинг, бартер, документи и оглед — тези отговори са публикувани и са актуални. Ако въпросът Ви е сред тях, ще получите отговора веднага, вместо утре.":
      "Availability, prices, leasing, part-exchange, documents and viewings — those answers are published and current. If your question is among them you get the answer now instead of tomorrow.",
    "Опишете автомобила, който търсите. Заявката се разглежда лично от Иван Манев и получава отговор до 24 часа.":
      "Describe the car you are looking for. The enquiry is reviewed personally by Ivan Manev and answered within 24 hours.",
    "Продължи към заявка": "Continue to the enquiry",
    "Тогава още не сме я купили. Опишете автомобила — марка, оборудване, бюджет и срок — и ние го издирваме в Германия и Австрия. Доклад със снимки, преди да е платено каквото и да било.":
      "Then we have not bought it yet. Describe the car — marque, equipment, budget and timescale — and we track it down in Germany and Austria. A report with photographs, before anything is paid.",
    "Тип заявка": "Enquiry type",
    "Заявка": "Enquiry",
    "Подадена през autohaus.bg/concierge": "Submitted via autohaus.bg/concierge",
    "Употребяван, до 3 години": "Used, up to 3 years",
    "Употребяван, до 7 години": "Used, up to 7 years",
    "По-възрастен, но перфектен": "Older, but perfect",
    "По поръчка": "To order",
    "Бартер": "Part-exchange",
    "Нищо с тези условия точно сега.": "Nothing on these terms right now.",
    "Искам оглед и тест драйв.": "I would like a viewing and a test drive.",
    "Автомобил": "Vehicle",
    "Лизинг по замяната": "Finance on the part-exchange",
    "Срок в месеци": "Term in months",
    "Автомобил — AutoHaus Пловдив": "Vehicle — AutoHaus Plovdiv",
    "Колекцията — AutoHaus Пловдив": "The collection — AutoHaus Plovdiv",
    "AutoHaus Пловдив — подбрани автомобили в наличност":
      "AutoHaus Plovdiv — selected vehicles in stock",
    "— AutoHaus Пловдив": "— AutoHaus Plovdiv",
    "— кадър": "— frame",
    "— уголеми": "— enlarge",
    "· избран автомобил": "· selected vehicle",
    "€ / месец": "€ / month",
    "€ / мес. при 20% първоначална вноска": "€ / mo with a 20% deposit",
    "€ на месец при 20% първоначална вноска и 60 месеца.":
      "€ a month with a 20% deposit over 60 months.",
    "Лизинг от ≈": "Leasing from ≈",
    "Обявената цена е крайна. Лизинг от ≈": "The price shown is final. Leasing from ≈",

    /* ---- meta descriptions ---- */
    "87 подбрани автомобила в наличност в Пловдив — от брониран клас и Maybach до AMG и Porsche. Лизинг от 6.9%, внос по поръчка, бартер, Auto Spa.":
      "87 selected vehicles in stock in Plovdiv — from armoured class and Maybach to AMG and Porsche. Leasing from 6.9%, sourcing to order, part-exchange, Auto Spa.",
    "87 подбрани автомобила в наличност в Пловдив. Брониран клас, Maybach, AMG, Porsche, G-класа. Филтри по марка, модел, година, цена и двигател.":
      "87 selected vehicles in stock in Plovdiv. Armoured class, Maybach, AMG, Porsche, G-Class. Filter by marque, model, year, price and engine.",
    "Пълно досие на автомобила: спецификация, галерия, произход, лизинг и запитване към AutoHaus Пловдив.":
      "The car's full dossier: specification, gallery, provenance, leasing and an enquiry to AutoHaus Plovdiv.",

    /* ---- the tail: single words and colours that reach the page only as
       part of something a renderer built ---- */
    "Калкулатор": "Calculator",
    "Пловдив": "Plovdiv",
    "автомобила": "vehicles",
    "автомобил": "vehicle",
    "бензин": "petrol",
    "дизел": "diesel",
    "хибрид": "hybrid",
    "plug-in хибрид": "plug-in hybrid",
    "електрически": "electric",
    "Бял": "White",
    "Бял металик": "White metallic",
    "Зелен металик": "Green metallic",
    "Кафяв металик": "Brown metallic",
    "Сив": "Grey",
    "Сив мат": "Matte grey",
    "Сив металик": "Grey metallic",
    "Син": "Blue",
    "Син металик": "Blue metallic",
    "Сребърен металик": "Silver metallic",
    "Тъмно зелен металик": "Dark green metallic",
    "Тъмно кафяв металик": "Dark brown metallic",
    "Тъмно сив металик": "Dark grey metallic",
    "Тъмно син металик": "Dark blue metallic",
    "Червен металик": "Red metallic",
    "Черен": "Black",
    "Черен / Сив мат": "Black / matte grey",
    "Черен металик": "Black metallic",

    /* ---- the dossier's prose, where it carries no numbers ---- */
    "Фабрично брониран автомобил. Нивото на защита и документацията към бронирането се преглеждат лично при огледа, не се описват в обява.":
      "A factory-armoured car. The protection level and the documentation for the armouring are reviewed in person at the viewing, not described in a listing.",
    "Документите — справка за произход, сервизни книжки и фактури — са на разположение при огледа, преди да е поет какъвто и да било ангажимент.":
      "The documents — provenance report, service books and invoices — are available at the viewing, before any commitment is made."
  };

  /* ============================================================
     THE PATTERNS.  Only consulted when the exact lookup misses —
     everything here carries a number the table cannot know.
     ============================================================ */
  /* the renderers lowercase a fuel and a colour before dropping them into a
     sentence, and a table keyed on the display form cannot see them */
  function lc(t) {
    var hit = Object.prototype.hasOwnProperty.call(DICT, t) ? DICT[t] : null;
    if (hit != null) return hit;
    var cap = t.charAt(0).toUpperCase() + t.slice(1);
    hit = Object.prototype.hasOwnProperty.call(DICT, cap) ? DICT[cap] : null;
    return hit == null ? t : hit.charAt(0).toLowerCase() + hit.slice(1);
  }

  /* the three units a filter range can carry, kept beside the rules that
     interpolate them so a new unit cannot be added in one place only */
  var UNITS = { "к.с.": "hp", "км": "km", "€": "€" };
  function UNIT(u) { return UNITS[u] || u; }

  var RULES = [
    /* the hero counter's screen-reader line. The visible "1 / 3" is
       aria-hidden — its separator is drawn on the house angle rather than
       typed — so this sentence is the whole of what a screen reader gets,
       and main.js rewrites it on every frame change. */
    [/^Кадър (\d+) от (\d+)$/, "Frame $1 of $2"],
    /* the dossier's registration row — the listing writes the month as a
       Bulgarian word, so it is a rule and not 12 table entries */
    [/^(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември) (\d{4}) г\.$/,
      function (m, mo, y) {
        var EN = {"януари":"January","февруари":"February","март":"March",
                  "април":"April","май":"May","юни":"June","юли":"July",
                  "август":"August","септември":"September","октомври":"October",
                  "ноември":"November","декември":"December"};
        return EN[mo] + " " + y;
      }],
    [/^([\d\s ]+) евро$/, "€ $1"],
    [/^Виж всички (\d[\d\s ]*) автомобила$/, "See all $1 vehicles"],
    [/^Виж всички (\d[\d\s ]*) (?:кадъра|кадър)$/, "See all $1 frames"],
    [/^Виж (\d[\d\s ]*) автомобила$/, "See $1 vehicles"],
    [/^Виж (\d[\d\s ]*) автомобил$/, "See $1 vehicle"],
    [/^Покажи (\d[\d\s ]*) автомобила$/, "Show $1 vehicles"],
    [/^Покажи (\d[\d\s ]*) автомобил$/, "Show $1 vehicle"],
    [/^Още (\d[\d\s ]*) автомобила$/, "$1 more vehicles"],
    [/^Още (\d[\d\s ]*) автомобил$/, "$1 more vehicle"],
    [/^(\d[\d\s ]*) от (\d[\d\s ]*)$/, "$1 of $2"],
    [/^(\d[\d\s ]*) автомобила в наличност$/, "$1 vehicles in stock"],
    [/^(\d[\d\s ]*) автомобил в наличност$/, "$1 vehicle in stock"],
    [/^(\d[\d\s ]*) автомобила$/, "$1 vehicles"],
    [/^(\d[\d\s ]*) автомобил$/, "$1 vehicle"],
    [/^(\d[\d\s ]*) \/ (\d[\d\s ]*) кадъра$/, "$1 / $2 frames"],
    [/^(\d[\d\s ]*) \/ (\d[\d\s ]*) кадър$/, "$1 / $2 frame"],
    [/^(\d[\d\s ]*) кадъра$/, "$1 frames"],
    [/^(\d[\d\s ]*) кадър$/, "$1 frame"],
    [/^Кадър (\d+) от (\d+) — уголеми$/, "Frame $1 of $2 — enlarge"],
    [/^Стъпка (\d+)$/, "Step $1"],
    /* The filter rail states its own answer on its face — "от 500 к.с.",
       "до 200 000 €", "500–680 к.с.", and the same three for a bare year.
       A pattern rather than a table because the numbers are the inventory's,
       not ours, and a fragment substitution ("от" alone) would translate the
       word out of every other sentence on the site that uses it. */
    [/^(от|до) ([\d\s  ]+?)(?: (к\.с\.|км|€))?$/, function (m, dir, n, unit) {
      return (dir === "от" ? "from " : "up to ") + n + (unit ? " " + UNIT(unit) : "");
    }],
    [/^([\d\s  ]+?)–([\d\s  ]+?)(?: (к\.с\.|км|€))?$/, function (m, a, z, unit) {
      return a + "–" + z + (unit ? " " + UNIT(unit) : "");
    }],
    /* the concierge counts questions, not steps, and the total only exists
       once the intent has decided which questions there are */
    [/^Въпрос (\d+) от (\d+)$/, "Question $1 of $2"],
    [/^Въпрос (\d+)$/, "Question $1"],
    [/^(\d[\d\s ]*) км\.?$/, "$1 km"],
    [/^(\d[\d\s ]*) к\.с\.$/, "$1 hp"],
    [/^(\d{4}) г\.$/, "$1"],
    [/^(\d[\d\s ]*) марки$/, "$1 marques"],
    [/^(\d[\d\s ]*) в наличност$/, "$1 in stock"],
    [/^(\d[\d\s ]*) брониран клас$/, "$1 armoured class"],
    [/^(\d[\d\s ]*) доставъчен пробег$/, "$1 delivery mileage"],
    [/^≈ ([\d\s ]+) € \/ месец$/, "≈ $1 € / month"],
    [/^(.+) — кадър (\d+)$/, "$1 — frame $2"],
    [/^Кадър (\d+)$/, "Frame $1"],
    [/^реф\. (.+)$/, "ref. $1"],
    [/^Покажи още (\d+)$/, "Show $1 more"],
    [/^Показани (\d+) от (\d+)\.$/, "Showing $1 of $2."],

    /* ---- the dossier's generated prose ----
       Whole-sentence patterns, never fragment substitution: a sentence that
       comes back half-translated reads worse than one that never changed. */
    [/^(.+?) — (нерегистриран|\d{4} г\.), ([\d ]+) км, (\d+) к\.с\. (.+?), (ръчна|автоматична) скоростна кутия(?:, (.+?))?\.$/,
      function (m, car, reg, km, hp, fuel, gear, colour) {
        return car + " — " + (reg === "нерегистриран" ? "unregistered" : reg.replace(/ г\.$/, "")) +
          ", " + km + " km, " + hp + " hp " + lc(fuel) + ", " +
          (gear === "ръчна" ? "manual" : "automatic") + " gearbox" +
          (colour ? ", " + lc(colour) : "") + ".";
      }],
    [/^Автомобилът не е регистриран\. ([\d ]+) км са доставъчен пробег — от завода до салона\.$/,
      "The car is unregistered. Its $1 km are delivery mileage — factory to showroom."],
    [/^Пробегът от ([\d ]+) км е доставъчен; автомобилът е практически нов\.$/,
      "Its $1 km are delivery mileage; the car is practically new."],
    [/^От (\d{4}) г\. са изминати ([\d ]+) км — около ([\d ]+) км средногодишно\.$/,
      "$2 km covered since $1 — about $3 km a year."],
    [/^Стои в раздел „(.+?)“(?:\.|: (.+))$/,
      function (m, ch, blurb) {
        return "Sits in the “" + lc(ch) + "” chapter" + (blurb ? ": " + lc(blurb) : ".");
      }],
    [/^Преминал е през същия път като всеки автомобил в колекцията: проверка на произход и сервизна история, механична подготовка в собствен сервиз, пълен Auto Spa детайлинг и лично одобрение от (.+?), преди да бъде показан\.$/,
      function (m, who) {
        return "It has taken the same route as every car in the collection: provenance " +
          "and service-history checks, mechanical preparation in our own workshop, a full " +
          "Auto Spa detail and personal approval by " + lc(who) + ", before it was shown.";
      }],
    [/^Обявената цена е крайна\. Лизинг от ≈ ([\d ]+) € на месец при 20% първоначална вноска и 60 месеца\.$/,
      "The price shown is final. Leasing from ≈ $1 € a month with a 20% deposit over 60 months."],
    [/^Без първа регистрация, ([\d ]+) км от завода\.$/,
      "No first registration, $1 km from the factory."],
    [/^([\d ]+) км — практически нов автомобил\.$/,
      "$1 km — a practically new car."],
    [/^Около ([\d ]+) км средногодишно от (\d{4}) г\.$/,
      "About $1 km a year since $2."],
    [/^Въпросът се добавя към заявката и стига до (.+?) — отговор до 24 часа в работни дни\.$/,
      function (m, who) {
        return "The question is added to the enquiry and reaches " + lc(who) +
          " — an answer within 24 hours on working days.";
      }],
    [/^Заявката стига директно до (.+?) и получава отговор до 24 часа в работни дни\. За спешни въпроси:$/,
      function (m, who) {
        return "The enquiry goes straight to " + lc(who) +
          " and is answered within 24 hours on working days. For anything urgent:";
      }]
  ];

  /* ============================================================
     THE ENGINE
     ============================================================ */
  var ATTRS = ["alt", "aria-label", "placeholder", "title", "aria-roledescription"];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1 };
  var lang = "bg", busy = false, swapping = false;

  function norm(t) { return t.replace(/[\s ]+/g, " ").trim(); }

  function look(key, deep) {
    if (Object.prototype.hasOwnProperty.call(DICT, key)) return DICT[key];
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(key)) return key.replace(RULES[i][0], RULES[i][1]);
    }
    /* A card's meta line and the dossier's place line are built by joining
       independent facts with " · " — "500 км · 530 к.с. · Бензин". Rather than a
       pattern per permutation of what the record happens to carry, the joined
       string is split back into its parts and each part is looked up on its
       own. `deep` stops that recursing: a part is a leaf. The result is used
       only if at least one part actually changed, so a line the table does not
       know is left alone rather than rebuilt identically. */
    if (!deep && key.indexOf(" · ") > -1) {
      var parts = key.split(" · "), hit = false;
      var out = parts.map(function (part) {
        var t = look(part, true);
        if (t == null) return part;
        hit = true;
        return t;
      });
      if (hit) return out.join(" · ");
    }
    return null;
  }

  /* keeps the node's own leading and trailing whitespace, which in indented
     markup is what holds words apart across inline elements */
  function tx(raw) {
    var key = norm(raw);
    if (!key) return null;
    var hit = look(key);
    if (hit == null) return null;
    return /^[\s ]*/.exec(raw)[0] + hit + /[\s ]*$/.exec(raw)[0];
  }

  /* A subtree can opt out entirely — the switch itself and the wipe's own
     word must never be translated, or the control would rename its own
     buttons and the observer would chase the animation it just started. */
  /* the switch renames its own buttons and the wipe carries the name of the
     language being switched TO — both must stay out of the table's way, and
     saying so here means no page has to remember to mark them up */
  var NT = "[data-nt],.lang,.wipe";
  function optedOut(el) {
    return !!(el && el.closest && el.closest(NT));
  }

  function textNodes(root) {
    var out = [];
    if (root.nodeType === 3) { if (!optedOut(root.parentNode)) out.push(root); return out; }
    if (root.nodeType !== 1) return out;
    if (optedOut(root)) return out;
    var w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, function (n) {
      var p = n.parentNode;
      if (!p || SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
      if (p.closest && p.closest(NT)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    });
    var n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  function doText(n) {
    if (lang === "en") {
      if (n.__ahbg != null) return;            /* already carrying English */
      var out = tx(n.nodeValue);
      if (out == null) return;
      n.__ahbg = n.nodeValue;
      n.nodeValue = out;
    } else if (n.__ahbg != null) {
      n.nodeValue = n.__ahbg;
      n.__ahbg = null;
    }
  }

  function doAttrs(el) {
    if (optedOut(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var cache = el.__ahattr || (el.__ahattr = {});
      if (lang === "en") {
        if (cache[a] != null) continue;
        var out = tx(el.getAttribute(a));
        if (out == null) continue;
        cache[a] = el.getAttribute(a);
        el.setAttribute(a, out);
      } else if (cache[a] != null) {
        el.setAttribute(a, cache[a]);
        cache[a] = null;
      }
    }
  }

  function applyTo(root) {
    textNodes(root).forEach(doText);
    if (root.nodeType === 1) {
      doAttrs(root);
      var els = root.querySelectorAll("[alt],[aria-label],[placeholder],[title],[aria-roledescription]");
      for (var i = 0; i < els.length; i++) doAttrs(els[i]);
    }
  }

  /* the tab and the search result, which are text a walker cannot reach */
  var titleBG = null, descBG = null;
  function applyHead() {
    var meta = D.querySelector('meta[name="description"]');
    if (lang === "en") {
      if (titleBG == null) {
        var t = tx(D.title);
        if (t != null) { titleBG = D.title; D.title = t; }
      }
      if (meta && descBG == null) {
        var d = tx(meta.getAttribute("content") || "");
        if (d != null) { descBG = meta.getAttribute("content"); meta.setAttribute("content", d); }
      }
    } else {
      if (titleBG != null) { D.title = titleBG; titleBG = null; }
      if (meta && descBG != null) { meta.setAttribute("content", descBG); descBG = null; }
    }
  }

  function repaintSwitches() {
    var groups = D.querySelectorAll(".lang");
    for (var i = 0; i < groups.length; i++) {
      groups[i].setAttribute("data-lang", lang);
      var opts = groups[i].querySelectorAll(".lang__o");
      for (var j = 0; j < opts.length; j++) {
        var on = opts[j].getAttribute("data-lang") === lang;
        opts[j].classList.toggle("is-on", on);
        opts[j].setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
  }

  function commit(next) {
    lang = next;
    try { localStorage.setItem(STORE, lang); } catch (e) { /* private mode */ }
    D.documentElement.setAttribute("lang", lang);
    busy = true;
    applyTo(D.body);
    applyHead();
    busy = false;
    repaintSwitches();
  }

  /* ---- the switch, with the wipe ----
     Cover, swap where nobody can see it, uncover. The swap itself is
     synchronous and instant; the 980ms belongs entirely to the animation,
     which is the point — a repaint the eye can follow reads as a decision,
     and the same repaint with no cover reads as a fault. */
  function setLang(next) {
    if (swapping || next === lang || (next !== "bg" && next !== "en")) return;
    var wipe = D.getElementById("wipe");
    var word = D.getElementById("wipe-word");
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!wipe || reduce) { commit(next); return; }
    swapping = true;
    if (word) word.textContent = next === "en" ? "English" : "Български";
    wipe.classList.remove("is-clear");
    wipe.classList.add("is-live", "is-cover");
    setTimeout(function () {
      commit(next);
      wipe.classList.remove("is-cover");
      wipe.classList.add("is-clear");
      setTimeout(function () {
        wipe.classList.remove("is-live", "is-clear");
        swapping = false;
      }, 700);
    }, 400);
  }

  /* ---- runtime-rendered markup ----
     Five renderers drop finished Bulgarian HTML into the page, some of it
     long after load and some of it in response to a filter. Rather than
     teaching each of them about language, whatever lands in the DOM is
     translated on the next frame. Our own writes are nodeValue and attribute
     changes, neither of which is a childList mutation, so this cannot feed
     itself; `busy` is the belt to that pair of braces. */
  var pending = [], queued = false;
  function drain() {
    queued = false;
    var list = pending;
    pending = [];
    if (lang === "bg") return;
    busy = true;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.nodeType === 1 || n.nodeType === 3) applyTo(n);
    }
    busy = false;
  }
  function watch() {
    if (!("MutationObserver" in window)) return;
    new MutationObserver(function (muts) {
      if (busy) return;
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) pending.push(added[j]);
      }
      if (pending.length && !queued) { queued = true; requestAnimationFrame(drain); }
    }).observe(D.body, { childList: true, subtree: true });
  }

  function reapply() {
    if (lang !== "en") return;
    busy = true;
    applyTo(D.body);
    applyHead();
    busy = false;
  }

  /* ---- go ---- */
  var stored = null;
  try { stored = localStorage.getItem(STORE); } catch (e) { /* private mode */ }
  lang = stored === "en" ? "en" : "bg";

  D.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".lang__o");
    if (!b) return;
    e.preventDefault();
    setLang(b.getAttribute("data-lang"));
  });

  if (lang === "en") { D.documentElement.setAttribute("lang", "en"); reapply(); }
  repaintSwitches();
  watch();
  addEventListener("DOMContentLoaded", reapply);
  addEventListener("load", reapply);

  window.AHLang = { get: function () { return lang; }, set: setLang, t: look };
})();
