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
    "Локация": "Location",
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
    "Обслужване": "Personal service",
    "AutoHaus Обслужване": "AutoHaus Personal Service",

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
    /* the hero's four rooms. The kicker names the place and the headline
       names it again in the house's own words, so both have to travel —
       and "Ателието" is the same word the AutoSpa card uses, deliberately. */
    "Към AutoSpa": "To AutoSpa",
    "Към сервиза": "To the workshop",
    "Пространството": "The space",
    "Място за събития": "A place for events",
    "Модно ревю в шоурума на AutoHaus, Ламборгини на преден план":
      "A fashion show in the AutoHaus showroom, a Lamborghini in the foreground",
    "Порше 911 Turbo S влиза в AutoSpa през нощта, надпис AUTO SPA на стената":
      "A Porsche 911 Turbo S entering AutoSpa at night, the AUTO SPA sign on the wall",
    "Терасата на кафе бара на AutoHaus с 3D графит на автомобил, пробиващ бетонна стена":
      "The AutoHaus cafe bar terrace with a 3D mural of a car breaking through a concrete wall",
    "Шоурумът": "The showroom",
    "Отблизо": "Up close",
    "Локацията": "The location",
    "Заповядайте": "Welcome",
    "Свържете се": "Get in touch",
    "Сградата на AutoHaus в Пловдив през деня, с надпис AutoHaus на фасадата":
      "The AutoHaus building in Plovdiv by day, the AutoHaus sign on its facade",
    "Автомобили в шоурума на AutoHaus на златна светлина":
      "Cars in the AutoHaus showroom in golden light",
    "Три знамена AutoHaus над площадката пред шоурума":
      "Three AutoHaus banners above the forecourt in front of the showroom",
    "Три спортни автомобила в шоурума на AutoHaus вечер":
      "Three sports cars in the AutoHaus showroom in the evening",
    "Базата": "The premises",
    "Приемната": "Reception",
    "Ателието": "The studio",
    "Работилницата": "The workshop",
    "Добре дошли": "Welcome",
    "Шоурумът на AutoHaus в Пловдив по здрач, с осветена фасада и надпис AutoHaus":
      "The AutoHaus showroom in Plovdiv at dusk, its facade lit and the AutoHaus sign above it",
    "Надписът „Welcome to www.AutoHaus.bg“ на стената в приемната":
      "The \"Welcome to www.AutoHaus.bg\" lettering on the reception wall",
    "Автомобил пред ателието AutoSpa в базата на AutoHaus":
      "A car outside the AutoSpa studio at the AutoHaus premises",
    "Шоурумът на AutoHaus в Пловдив по здрач, с осветена фасада":
      "The AutoHaus showroom in Plovdiv at dusk, its facade lit",
    "Витрината на AutoHaus — автомобили в шоурума при залез":
      "The AutoHaus showroom floor at sunset",
    "Шоурумът на AutoHaus отвътре, със слънце през остъклената фасада":
      "Inside the AutoHaus showroom, sun through the glazed facade",

    /* ---- the make row and the collection preview ---- */
    "Разгледай по марка": "Browse by make",
    "Всички марки": "All makes",
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
    "Марка, модел, референция…": "Make, model, reference…",
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
    "Марка": "Make",
    "Избор на марка": "Select make",
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
    "Задно задвижване": "Rear-wheel drive",
    "Сервизна история": "Service history",
    "Пълна сервизна история": "Full service history",
    "Колекционерска стойност": "Collector value",
    "Рядкост в този клас.": "A rarity in this class.",
    "марки": "makes",
    "Друга марка": "Another make",

    "Ателието е на разположение и след покупката — за автомобил, купен от нас или не.":
      "The studio is available after the purchase too — for a car bought from us or not.",
    "Сервизът поема и поддръжката след покупката.":
      "The workshop takes on the maintenance after the purchase as well.",
    "AutoHaus Пловдив · Асеновградско шосе": "AutoHaus Plovdiv · Asenovgradsko Shose",
    "Опишете я накратко — марка, година, пробег и състояние. Ако е на лизинг, посочете го.":
      "Describe it briefly — make, year, mileage and condition. If it is on finance, say so.",
    "Заявката е пълна и стига до екипа на AutoHaus.":
      "The enquiry is complete and reaches the AutoHaus team.",
    "Заявката стига до екипа на AutoHaus в Пловдив.":
      "The enquiry reaches the AutoHaus team in Plovdiv.",
    /* ---- За AutoHaus ---- */
    "AutoHaus е комплекс в Пловдив, на Асеновградско шосе, и работи с автомобили от горния клас — в наличност на място и по поръчка.":
      "AutoHaus is a complex in Plovdiv, on Asenovgradsko Shose, working with upper-segment cars — in stock on site and sourced to order.",
    "Във витрината стоят автомобилите в наличност. Ако търсеният не е сред тях, той се издирва и внася — марка, оборудване, състояние и бюджет се уточняват предварително. Приемаме автомобил и насрещно, за изкупуване или като част от плащането.":
      "On the showroom floor are the cars in stock. If the one you are after is not among them, it is sourced and imported — make, equipment, condition and budget agreed beforehand. We also take a car the other way, outright or against the purchase.",
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
    "Гориво": "Fuel",
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
    /* The inventory stores these short listing notes with their original
       exclamation marks. Keep those exact variants here so a dossier never
       falls back to Bulgarian after the language switch. */
    "Възможен бартер!": "Part-exchange available!",
    "Възможен лизинг!": "Leasing available!",
    "Пълна сервизна история!": "Full service history!",
    "Фабрично нов автомобил!": "Factory new!",
    "Сертификат N1 за товарен автомобил!": "N1 goods-vehicle certificate!",
    "Цена без начислен 20% ДДС!": "Price excludes 20% VAT!",
    "Автомобилът е цялостно облепен в предпазно фолио с матиращ ефект!":
      "Fully wrapped in matte protective film!",
    "Добавена е спортна изпускателна система MILLTEK Sport!":
      "MILLTEK Sport exhaust system fitted!",
    "Автомобилът е с електроника и компоненти за повишаване на мощността до 800 к.с.!":
      "Electronics and components taking output to 800 hp!",
    "Добавен екстериорен пакет от G63 AMG!": "G63 AMG exterior package fitted!",
    "Фабрична гаранция до 07.2026 г. или 200 000 км.!":
      "Factory warranty until 07/2026 or 200,000 km!",

    /* ---- technical equipment ----
       Equipment arrives after the dossier itself, from the individual listing
       file. These are repeated OEM descriptions, kept as precise English
       rather than leaving the first visible dossier half-translated. */
    "Ексклузивен черен кожен салон BMW Individual Gran Lusso":
      "Exclusive black BMW Individual Gran Lusso leather upholstery",
    "Заводски брониран автомобил": "Factory-armoured vehicle",
    "Специални гуми PAX с възможност за шофиране при спукване": "PAX run-flat tyres",
    "Противопожарна система": "Fire-suppression system",
    "Система за аварийно напускане на автомобила": "Emergency exit system",
    "Сваляеми стъкла на предни и задни врати": "Removable front and rear door windows",
    "Система за аварийно подаване на чист въздух": "Emergency fresh-air supply system",
    "Спортна автоматична скоростна кутия": "Sport automatic transmission",
    "Датчик за налягане на гумите": "Tyre pressure monitoring",
    "Интегрално активно управление": "Integral Active Steering",
    "Алармена система Plus": "Alarm system Plus",
    "Алармена система": "Alarm system",
    "Вградено универсално дистанционно управление": "Integrated universal remote control",
    "BMW Iconic Glow радиаторна решетка": "BMW Iconic Glow kidney grille",
    "Кристални фарове BMW Crystal Glow": "BMW Crystal Glow headlights",
    "Щори за задните места": "Rear sunblinds",
    "Затъмнени задни стъкла": "Tinted rear windows",
    "Пожарогасител": "Fire extinguisher",
    "Интериорни декорации в карбон със сребърни нишки": "Carbon interior trim with silver threads",
    "Интериорни кристални елементи Crafted Clarity": "CraftedClarity crystal interior elements",
    "Активна вентилация на предните места": "Active front-seat ventilation",
    "Активна вентилация на задните седалки": "Active rear-seat ventilation",
    "Мултифункционални задни седалки": "Multifunction rear seats",
    "Мултифункционални предни седалки": "Multifunction front seats",
    "Задни места Executive Lounge": "Executive Lounge rear seats",
    "Система Travel & Comfort": "Travel & Comfort system",
    "Пакет “Комфортно отопление”": "Heat Comfort Package",
    "Масажна функция за задните места": "Rear-seat massage function",
    "Масажна функция за предните места": "Front-seat massage function",
    "Стационарно отопление": "Auxiliary heating",
    "Пакет асистиращи системи за паркиране Plus": "Parking Assistant Plus",
    "Интериорни елементи с кристално покритие „CraftedClarity“":
      "CraftedClarity crystal-finish interior trim",
    "Седалки Executive Lounge": "Executive Lounge seats",
    "Задна конзола Executive Lounge": "Executive Lounge rear console",
    "Топлинно комфорт Пакет": "Heat Comfort Package",
    "Пакет Heat Comfort": "Heat Comfort Package",
    "Функция масажи за задните места": "Rear-seat massage function",
    "Масажна функция за пътниците на задните места": "Rear-passenger massage function",
    "Функция масажи за предните места": "Front-seat massage function",
    "Масажна функция за шофьора и пътника до него":
      "Driver and front-passenger massage function",
    "BMW Телеуслуги": "BMW TeleServices",
    "BMW Спешно повикване": "BMW Emergency Call",
    "BMW ConnectedDrive Услуги": "BMW ConnectedDrive Services",
    "Пакет “Смартфон интеграция”": "Smartphone Integration package",
    "Индуктивно зарядно за мобилен телефон отпред": "Front inductive mobile-phone charging",
    "Персонална eSIM": "Personal eSIM",
    "М Shadow Line разширен обхват": "Extended M Shadow Line",
    "Мултифункционален волан “M”": "M multifunction steering wheel",
    "Coolbox хладилник": "Coolbox refrigerator",
    "Устройство против кражба": "Anti-theft device",
    "M Sport екстериорен пакет": "M Sport exterior package",

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

    /* ---- the service wall — the four rooms ---- */
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
    "Час се запазва по телефона или през обслужването — за автомобил, купен от нас или не.":
      "Book by phone or through our service — for a car bought from us or not.",
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
      "Cars from the same chapter or the same make, in stock now.",
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
    "марка и модел": "make and model",
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
    "Обслужване · AutoHaus Пловдив": "Personal service · AutoHaus Plovdiv",
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
      "Even the make on its own is enough to start with.",
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

    "AutoHaus Обслужване — заявка за автомобил": "AutoHaus Personal Service — vehicle enquiry",
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
    "Марка и модел": "Make and model",
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
      "Then we have not bought it yet. Describe the car — make, equipment, budget and timescale — and we track it down in Germany and Austria. A report with photographs, before anything is paid.",
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
    "Автомобилът не е намерен — AutoHaus": "Vehicle not found — AutoHaus",
    "Правна информация — AutoHaus Пловдив": "Legal information — AutoHaus Plovdiv",
    "Колекцията — AutoHaus Пловдив": "The collection — AutoHaus Plovdiv",
    "AutoHaus Пловдив — подбрани автомобили в наличност":
      "AutoHaus Plovdiv — selected vehicles in stock",
    "— AutoHaus Пловдив": "— AutoHaus Plovdiv",
    "— кадър": "— frame",
    "— уголеми": "— enlarge",
    "· избран автомобил": "· selected vehicle",
    /* The leasing-instalment strings (a monthly figure, "20% deposit",
       "over 60 months", "Leasing from ≈") were removed here in the content
       audit: nothing generates them any more, and they encoded exactly the
       invented terms the audit took off the cards. Left out on purpose so no
       stray string can ever render them. */

    /* ---- meta descriptions ---- */
    "87 подбрани автомобила в наличност в Пловдив — от брониран клас и Maybach до AMG и Porsche. Лизинг от 6.9%, внос по поръчка, бартер, Auto Spa.":
      "87 selected vehicles in stock in Plovdiv — from armoured class and Maybach to AMG and Porsche. Leasing from 6.9%, sourcing to order, part-exchange, Auto Spa.",
    "87 подбрани автомобила в наличност в Пловдив. Брониран клас, Maybach, AMG, Porsche, G-класа. Избор по марка.":
      "87 selected vehicles in stock in Plovdiv. Armoured class, Maybach, AMG, Porsche, G-Class. Browse by make.",
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
      "The documents — provenance report, service books and invoices — are available at the viewing, before any commitment is made.",

    /* ---- the legal document, the service cards and two product lines,
            added in the production-readiness pass ---- */
    "екипа на AutoHaus": "the AutoHaus team",
    "Екипът на AutoHaus": "The AutoHaus team",
    "За екипа на AutoHaus": "For the AutoHaus team",
    "Обслужване · Пловдив": "Personal service · Plovdiv",
    "Заявката стига до екипа на AutoHaus. За въпроси по телефона:": "The enquiry reaches the AutoHaus team. For questions by phone:",
    "Въпросът се добавя към заявката и стига до екипа на AutoHaus.": "Your question is added to the enquiry and reaches the AutoHaus team.",
    "В комплекса":
      "At the complex",
    "Грижа за автомобила в комплекса на AutoHaus.":
      "Car care at the AutoHaus complex.",
    "AutoSpa е част от комплекса на AutoHaus. За обхвата на услугите и записване се свържете с нас.":
      "AutoSpa is part of the AutoHaus complex. For the range of services and to book, get in touch.",
    "Обслужване и поддръжка в комплекса на AutoHaus.":
      "Servicing and maintenance at the AutoHaus complex.",
    "Сервизът е част от комплекса на AutoHaus. За обхвата на услугите и записване се свържете с нас.":
      "The workshop is part of the AutoHaus complex. For the range of services and to book, get in touch.",
    "Условия при запитване":
      "Terms on request",
    "Лизинг и застраховане при покупка на автомобил.":
      "Leasing and insurance when buying a car.",
    "Лизинг и застраховане се уреждат при покупка на автомобил от AutoHaus. Условията се уточняват индивидуално — свържете се с нас за оферта.":
      "Leasing and insurance are arranged when you buy a car from AutoHaus. Terms are agreed individually — get in touch for an offer.",
    "Кафе бар на терасата в комплекса.":
      "A café bar on the terrace at the complex.",
    "Кафе барът е на терасата в комплекса на AutoHaus.":
      "The café bar is on the terrace at the AutoHaus complex.",
    "Запитване":
      "Enquiry",
    "Финансирането и застраховането се уреждат с партньорски институции; одобрението остава тяхно решение. В комплекса са и сервиз, и AutoSpa.":
      "Financing and insurance are arranged through partner institutions; approval remains their decision. The complex also houses a workshop and an AutoSpa.",
    "На терасата в комплекса има и кафе бар.":
      "There is also a café bar on the terrace at the complex.",
    "Лизинг и застраховане се уреждат чрез партньорски институции. Сайтът не публикува лихви, вноски или срокове и не съдържа оферта за финансиране.":
      "Leasing and insurance are arranged through partner institutions. The site publishes no interest rates, instalments or terms and contains no financing offer.",
    "Тя определя лихвата, вноската, срока и изискванията към Вас и решава дали да одобри искането. Същото важи за застрахователните оферти и премии, които се определят от застрахователя. Ние подготвяме документите и Ви придружаваме; решението не е наше.":
      "It sets the interest rate, the instalment, the term and the requirements on you, and decides whether to approve the application. The same applies to insurance quotes and premiums, which are set by the insurer. We prepare the documents and accompany you; the decision is not ours.",
    "Автомобил може да бъде запазен при условия, договорени писмено. Замяна с Ваш автомобил е възможна след оглед и писмена оферта; оценката е валидна за срока, посочен в нея.":
      "A car may be reserved on terms agreed in writing. Part-exchange with your car is possible after an inspection and a written offer; the valuation is valid for the period stated in it.",
    "Детайлинг ателие":
      "Detailing studio",
    "Ръчна грижа за всеки детайл — измиване, детайлинг и защита на лака.":
      "Hand care for every detail — washing, detailing and paint protection.",
    "Собствено ателие в базата — не подизпълнител. Ръчно измиване, детайлинг, полиране, керамика и защитно фолио, изпълнени с внимание към всеки детайл.":
      "Our own studio on site, not a subcontractor — hand washing, detailing, polishing, ceramic coating and protective film, carried out with care for every detail.",
    "На разположение и след покупката — за автомобил от нашата колекция или Ваш собствен.":
      "Available after the sale as well — for a car from our collection or your own.",
    "Сервиз в базата":
      "Workshop on site",
    "Диагностика, обслужване и поддръжка — от собствен екип в Пловдив.":
      "Diagnostics, servicing and maintenance — by our own team in Plovdiv.",
    "Компютърна диагностика, планово обслужване, окачване, спирачки, климатик и гуми — в собствен сервиз, по заводски стандарт.":
      "Computer diagnostics, scheduled servicing, suspension, brakes, air conditioning and tyres — in our own workshop, to factory standard.",
    "Поддръжката продължава и след покупката — за автомобил от нас или Ваш.":
      "Maintenance continues after the sale — for a car from us or your own.",
    "Часът се запазва предварително — за автомобил от нас или Ваш собствен.":
      "Appointments are booked in advance — for a car from us or your own.",
    "Финансиране и застраховане — подготвени на едно място.":
      "Financing and insurance — arranged in one place.",
    "Лизинг и застраховане се уреждат при нас, с партньорски институции. Документите и регистрацията — на място.":
      "Leasing and insurance are arranged with us, through partner institutions. The paperwork and the registration — on site.",
    "Кафе, разговор и изглед към витрината — на терасата.":
      "Coffee, conversation and a view of the showroom — on the terrace.",
    "Кафе барът е част от сградата, не автомат в ъгъла — тераса с изглед към витрината, маси навън и вътре.":
      "The café bar is part of the building, not a machine in the corner — a terrace overlooking the showroom, with tables outside and in.",
    "Отворен за всеки. Разговорът за автомобил върви по-добре на маса — както и голяма част от огледите и документите.":
      "Open to everyone. A conversation about a car goes better at a table — as do many of the viewings and much of the paperwork.",
    "Услугите":
      "The services",
    "Въпросът се добавя към заявката и стига до Иван Манев.":
      "Your question is added to the enquiry and reaches Ivan Manev.",
    "Заявката стига до Иван Манев. За въпроси по телефона:":
      "The enquiry reaches Ivan Manev. For questions by phone:",
    "Правна информация":
      "Legal information",
    "Четири документа: какво правим с личните Ви данни, какво този сайт оставя на устройството Ви, при какви условия го ползвате и кой стои зад него. Написани са, за да бъдат прочетени.":
      "Four documents: what we do with your personal data, what this site leaves on your device, the terms on which you use it, and who stands behind it. Written to be read.",
    "Съдържание": "Contents",
    "Последна редакция: 30 август 2026 г.":
      "Last revised: 30 August 2026.",
    "Тук е описано как обработваме лични данни, когато се свържете с нас или използвате услугите ни.":
      "This policy explains how we process personal data when you contact us or use our services.",
    "1. Администратор и контакт": "1. Controller and contact",
    ", ЕИК 200771286, ДДС № BG200771286, със седалище и адрес на управление ул. „Нестор Абаджиев“ №24, Асеновградско шосе, 4023 Пловдив, е администратор на лични данни.":
      ", UIC 200771286, VAT No. BG200771286, with its registered office and management address at 24 Nestor Abadzhiev St, Asenovgradsko Shose, 4023 Plovdiv, is the controller of personal data.",
    "За въпроси или искания за лични данни:": "For personal-data questions or requests:",
    "или": "or",
    "2. Данни, цели и основание": "2. Data, purposes and legal basis",
    "Когато ни изпратите запитване.": "When you send us an enquiry.",
    "Обработваме данните, които ни предоставяте — например име, телефон, имейл, автомобил, бюджет и предпочитания — за да отговорим и да предприемем действия по Ваше искане преди сключване на договор (чл. 6, §1, б. „б“ GDPR).":
      "We process the data you provide — for example your name, phone, email, vehicle, budget and preferences — to reply and take steps at your request before entering into a contract (Art. 6(1)(b) GDPR).",
    "При сделка.": "For a transaction.",
    "Обработваме данните, необходими за договора, регистрацията, плащането и законовите ни задължения (чл. 6, §1, б. „б“ и „в“ GDPR).":
      "We process the data necessary for the contract, registration, payment and our legal obligations (Art. 6(1)(b) and (c) GDPR).",
    "При посещение на сайта.": "When you visit the website.",
    "Хостинг доставчикът може да обработва технически логове, необходими за сигурността и работата на сайта. Не използваме рекламни, аналитични или профилиращи инструменти.":
      "The hosting provider may process technical logs required for the security and operation of the website. We do not use advertising, analytics or profiling tools.",
    "Не обработваме специални категории данни чрез сайта и не вземаме автоматизирани решения за Вас.":
      "We do not process special categories of data through the website and do not make automated decisions about you.",
    "3. Срок на съхранение": "3. Retention period",
    "Пазим запитванията за времето, необходимо да отговорим, да управляваме отношенията си с Вас и да защитим или предявим правни претенции. Данните и документите по сделка се пазят за приложимите законови срокове.":
      "We keep enquiries for the time needed to reply, manage our relationship with you and defend or bring legal claims. Transaction data and documents are kept for the applicable legal periods.",
    "4. Получатели": "4. Recipients",
    "Споделяме данни само когато това е необходимо:": "We share data only where necessary:",
    "Доставчици на хостинг и електронна поща": "Hosting and email providers",
    "— за работата на сайта и кореспонденцията.": "— for the operation of the website and correspondence.",
    "Лизингови и застрахователни партньори": "Financing and insurance partners",
    "— само ако поискате конкретна оферта.": "— only if you ask for a specific offer.",
    "Държавни органи и професионални консултанти": "Public authorities and professional advisers",
    "— когато законът или защитата на наши права го изисква.": "— where required by law or to protect our rights.",
    "Не продаваме и не отдаваме под наем лични данни.": "We do not sell or rent personal data.",
    "5. Вашите права": "5. Your rights",
    "Можете да поискате достъп, коригиране, изтриване, ограничаване, преносимост или да възразите срещу обработване. Когато основанието е съгласие, можете да го оттеглите по всяко време. Пишете на":
      "You may request access, rectification, erasure, restriction or portability, or object to processing. Where consent is the basis, you may withdraw it at any time. Write to",
    "; отговаряме в законовия срок.": "; we respond within the legal time limit.",
    "Можете да подадете жалба до": "You may lodge a complaint with the",
    "Комисията за защита на личните данни": "Commission for Personal Data Protection",
    "6. Сигурност": "6. Security",
    "Прилагаме подходящи технически и организационни мерки според риска. Достъп до данните имат само лица, за които това е необходимо.":
      "We apply appropriate technical and organisational measures according to the risk. Only people who need access to the data have it.",
    "1. Без проследяване": "1. No tracking",
    "Този сайт не използва рекламни, аналитични или проследяващи бисквитки, пиксели или подобни технологии.":
      "This website does not use advertising, analytics or tracking cookies, pixels or similar technologies.",
    "2. Функционална настройка": "2. Functional preference",
    "След като изберете език, сайтът може да запази избора локално в браузъра Ви, за да го използва при следващо отваряне. Тази настройка не се изпраща до AutoHaus и може да бъде изтрита от настройките на браузъра.":
      "After you select a language, the website may store that choice locally in your browser for your next visit. This preference is not sent to AutoHaus and can be removed in your browser settings.",
    "3. Външни услуги": "3. External services",
    "Google Maps, Facebook, Instagram и WhatsApp се отварят само чрез обикновени външни препратки след Ваше действие. Сайтът не зарежда тяхно съдържание автоматично.":
      "Google Maps, Facebook, Instagram and WhatsApp open only through ordinary external links after your action. The website does not load their content automatically.",
    "4. Банер за съгласие": "4. Consent banner",
    "За текущата версия на сайта не е нужен банер за съгласие, защото няма незадължителни бисквитки или вградени услуги на трети страни. Ако такива бъдат добавени, те ще се зареждат само след предварително изрично съгласие и ще бъдат описани тук.":
      "The current version of the website does not need a consent banner because it has no non-essential cookies or embedded third-party services. If these are added, they will load only after prior explicit consent and will be described here.",
    "Общи условия за ползване": "Terms of use",
    "1. Предмет": "1. Scope",
    "Тези условия уреждат ползването на сайта на Аутохаус България ЕООД.":
      "These terms govern the use of the website of Autohaus Bulgaria EOOD.",
    "2. Автомобили, цени и снимки": "2. Vehicles, prices and photographs",
    "Наличността, цените, техническите характеристики и фотографиите могат да се променят. Те са с информационна цел и не са потвърждение за продажба.":
      "Availability, prices, technical specifications and photographs may change. They are for information and are not confirmation of a sale.",
    "Преди покупка потвърдете с нас наличността, цената и конкретното оборудване. Обвързващо е само писмено потвърденото за конкретния автомобил.":
      "Before buying, confirm the availability, price and specific equipment with us. Only what is confirmed in writing for the specific vehicle is binding.",
    "3. Лизинг и застраховане": "3. Financing and insurance",
    "Показаните примерни условия за финансиране са ориентировъчни, не са оферта и не представляват одобрение. Окончателните условия и решението се определят от съответната партньорска институция.":
      "The financing examples shown are indicative, are not an offer and do not constitute approval. Final terms and the decision are set by the relevant partner institution.",
    "Застрахователните оферти и премии се определят от застрахователя.":
      "Insurance quotes and premiums are determined by the insurer.",
    "4. Запазване и замяна": "4. Reservation and part-exchange",
    "Автомобил може да бъде запазен при условия, договорени писмено. Замяна с Ваш автомобил е възможна след оглед и писмена оферта; оценката е валидна за срока, посочен в нея.":
      "A vehicle may be reserved on terms agreed in writing. Part-exchange is possible after an inspection and written offer; the valuation is valid for the period stated in it.",
    "5. Съдържание и права": "5. Content and rights",
    "Текстовете, фотографиите и материалите в сайта са защитени. Марките на производителите принадлежат на техните притежатели и се използват само за обозначаване на автомобилите.":
      "The texts, photographs and materials on the website are protected. Manufacturers' marks belong to their owners and are used only to identify vehicles.",
    "Нищо в тези условия не ограничава права, които законът предоставя на потребителите, или отговорност, която не може да бъде ограничена по закон.":
      "Nothing in these terms limits rights that the law gives consumers or liability that cannot be limited by law.",
    "6. Приложимо право и спорове": "6. Governing law and disputes",
    "Прилага се българското право. При спор първо търсим решение по споразумение. Като потребител можете да се обърнете и към":
      "Bulgarian law applies. In a dispute, we first seek an agreed solution. As a consumer, you may also contact the",
    "Комисията за защита на потребителите": "Consumer Protection Commission",
    "Този сайт се поддържа от:":
      "This site is operated by:",
    "Фирма":
      "Company",
    "На латиница":
      "In Latin script",
    "Правна форма":
      "Legal form",
    "Еднолично дружество с ограничена отговорност":
      "Single-member limited liability company",
    "ЕИК":
      "UIC",
    "ДДС номер":
      "VAT number",
    "Седалище":
      "Registered office",
    "ул. „Нестор Абаджиев“ №24, Асеновградско шосе,":
      "24 Nestor Abadzhiev St, Asenovgradsko Shose,",
    "Търговски регистър и регистър на ЮЛНЦ при Агенцията по вписванията":
      "Commercial Register and Register of Non-Profit Legal Entities at the Registry Agency",
    "Електронна поща":
      "Email",
    "Отговорност за съдържанието":
      "Responsibility for the content",
    "За съдържанието на този сайт отговаря Аутохаус България ЕООД на посочения по-горе адрес. Сайтът съдържа препратки към външни страници (Google Maps, Facebook, Instagram, Комисията за защита на потребителите); за тяхното съдържание отговарят техните оператори.":
      "Responsibility for the content of this site lies with Autohaus Bulgaria EOOD at the address given above. The site contains links to external pages (Google Maps, Facebook, Instagram, the Consumer Protection Commission); their content is the responsibility of their operators.",
    "Надзорни органи":
      "Supervisory authorities",
    "Комисия за защита на потребителите":
      "Consumer Protection Commission",
    "— гр. София 1000, пл. „Славейков“ №4A,":
      "— 4A Slaveykov Sq, 1000 Sofia,",
    "Комисия за защита на личните данни":
      "Commission for Personal Data Protection",
    "— гр. София 1592, бул. „Проф. Цветан Лазаров“ №2,":
      "— 2 Prof. Tsvetan Lazarov Blvd, 1592 Sofia,",
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
    [/^(\d[\d\s ]*) марки$/, "$1 makes"],
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
    /* the "price is final — leasing from ≈ X €/month, 20% deposit, 60 months"
       focus-note rule was removed in the content audit; the note it matched is
       no longer generated, and the figures in it were never AutoHaus's to quote */

    /* The vehicle tab title and its meta description are composed at runtime
       from the car record, so they are matched here as whole strings, not kept
       as fixed keys. Only the Bulgarian tail changes by language; the price,
       when shown, is a number and passes through look() untouched. */
    [/^(.+?) · (.+?) — AutoHaus Пловдив$/, function (m, car, price) {
      return car + " · " + (look(price) || price) + " — AutoHaus Plovdiv";
    }],
    [/^(.+?), (нерегистриран|\d{4} г\.), ([\d ]+) км, (\d+) к\.с\. Проверен автомобил в наличност в AutoHaus Пловдив\.$/,
      function (m, car, reg, km, hp) {
        return car + ", " + (reg === "нерегистриран" ? "unregistered" : reg.replace(/ г\.$/, "")) +
          ", " + km + " km, " + hp + " hp. A checked vehicle in stock at AutoHaus Plovdiv.";
      }],
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

  /* the tab and the search result, which are text a walker cannot reach.
     Both can be rewritten after boot — the vehicle page composes its title
     and description from the car once main.js has the record — so this
     re-derives whenever the live value is not the English it last produced,
     rather than translating once. That also means the BG it restores on the
     way back is the CURRENT source, never one cached before a renderer ran. */
  var titleBG = null, titleEN = null, descBG = null, descEN = null;
  function applyHead() {
    var meta = D.querySelector('meta[name="description"]');
    var mc = meta ? (meta.getAttribute("content") || "") : "";
    if (lang === "en") {
      if (D.title !== titleEN) {
        titleBG = D.title;
        var t = tx(D.title);
        titleEN = t != null ? t : D.title;
        D.title = titleEN;
      }
      if (meta && mc !== descEN) {
        descBG = mc;
        var d = tx(mc);
        descEN = d != null ? d : mc;
        meta.setAttribute("content", descEN);
      }
    } else {
      if (titleEN != null && D.title === titleEN) D.title = titleBG;
      titleBG = titleEN = null;
      if (meta && descEN != null && mc === descEN) meta.setAttribute("content", descBG);
      descBG = descEN = null;
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
    /* Renderers with local bilingual data (the vehicle equipment files) can
       redraw from that source once the document-wide copy has changed. */
    window.dispatchEvent(new CustomEvent("ah:languagechange", { detail: { lang: lang } }));
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
    /* THE OBSERVER CANNOT WATCH A BODY THAT IS NOT THERE YET.
       This threw once already, and the way it threw is worth keeping: a
       loader in <head> decided the stylesheet was ready — true on a warm
       cache on its very first line — and called boot() before the parser
       had opened <body>. observe(null) throws, i18n died on the spot, and
       because it died the page rendered untranslated with no other symptom.
       The loader was gated on readyState afterwards, which fixed it at the
       three call sites that existed. This fixes it here, where the
       assumption actually lives, so a fourth page cannot reintroduce it. */
    if (!D.body) { addEventListener("DOMContentLoaded", watch); return; }
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
    /* same reason as watch(): the <head> is translatable before the body
       exists, so the title still gets done on an early call and the body
       is picked up by the DOMContentLoaded pass a moment later */
    busy = true;
    if (D.body) applyTo(D.body);
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
