// ─────────────────────────────────────────────────────────────────────────────
// Pantry Synonym Dictionary
// Each key = canonical_name (matches DEFAULT_PANTRY item IDs for standard items)
// aliases   = dialect / regional / common alternate names (Hindi, Marathi, Tamil,
//             Telugu, Bengali, Gujarati, Kannada, Malayalam + English variants)
// ─────────────────────────────────────────────────────────────────────────────

export const PANTRY_DICT = {

  // ── GRAINS & LENTILS ────────────────────────────────────────────────────────
  "atta": {
    display_name: "Atta", emoji: "🌾", category: "Grains & Lentils",
    aliases: ["wheat flour", "whole wheat flour", "gehu", "gehun", "gehun atta", "chapati flour", "roti flour", "atta flour"],
  },
  "rice": {
    display_name: "Rice", emoji: "🍚", category: "Grains & Lentils",
    aliases: ["chawal", "chaval", "akki", "bhat", "arisi", "biyam", "tandul", "sadam", "annam"],
  },
  "poha": {
    display_name: "Poha", emoji: "🌾", category: "Grains & Lentils",
    aliases: ["flattened rice", "beaten rice", "aval", "atukulu", "chira", "pauwa", "pohe"],
  },
  "sooji": {
    display_name: "Sooji / Rava", emoji: "🌾", category: "Grains & Lentils",
    aliases: ["rava", "semolina", "suji", "rawa", "bombay rava", "cream of wheat"],
  },
  "besan": {
    display_name: "Besan", emoji: "🟡", category: "Grains & Lentils",
    aliases: ["chickpea flour", "gram flour", "chana flour", "senagapindi", "kadalai maavu", "harbharyache peeth"],
  },
  "toor_dal": {
    display_name: "Toor Dal", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["tuvar dal", "arhar dal", "pigeon pea", "togari bele", "kandipappu", "toovar dal", "arhar"],
  },
  "moong_dal": {
    display_name: "Moong Dal", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["mung dal", "mung bean", "green gram", "pesara pappu", "paasi paruppu", "pesarapappu", "moong"],
  },
  "chana_dal": {
    display_name: "Chana Dal", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["split chickpea", "bengal gram dal", "kadale bele", "shanaga pappu"],
  },
  "masoor_dal": {
    display_name: "Masoor Dal", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["red lentil", "musur dal", "mysore dal", "masur", "red dal", "masoor"],
  },
  "rajma": {
    display_name: "Rajma", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["kidney beans", "red kidney beans", "lal rajma", "rajmah"],
  },
  "chana": {
    display_name: "Chana", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["chickpeas", "kabuli chana", "white chana", "garbanzo", "chole", "chhole", "safed chana"],
  },
  "urad_dal": {
    display_name: "Urad Dal", emoji: "🫘", category: "Grains & Lentils",
    aliases: ["black gram", "black lentil", "white lentil", "maa ki dal", "urad", "ulundu", "minapappu", "maa dal"],
  },

  // ── VEGETABLES ──────────────────────────────────────────────────────────────
  "onion": {
    display_name: "Onion", emoji: "🧅", category: "Vegetables",
    aliases: ["pyaaz", "pyaz", "kanda", "vengayam", "ulli", "dungli", "pyaj", "eerulli", "nirulli", "neerulli"],
  },
  "tomato": {
    display_name: "Tomato", emoji: "🍅", category: "Vegetables",
    aliases: ["tamatar", "tamater", "thakkali", "tomat", "tamato"],
  },
  "potato": {
    display_name: "Potato", emoji: "🥔", category: "Vegetables",
    aliases: ["aloo", "alu", "batata", "urulaikizhangu", "aaloo", "bangaladumpa", "batate", "aalu"],
  },
  "ginger": {
    display_name: "Ginger", emoji: "🫚", category: "Vegetables",
    aliases: ["adrak", "inji", "allam", "shunti", "sonth", "adark", "ardraka"],
  },
  "garlic": {
    display_name: "Garlic", emoji: "🧄", category: "Vegetables",
    aliases: ["lehsun", "lasun", "vellulli", "poondu", "vellai poondu", "lasoon", "rasun", "belluli", "velluli", "lahsun"],
  },
  "green_chilli": {
    display_name: "Green Chilli", emoji: "🌶️", category: "Vegetables",
    aliases: ["hari mirch", "hara mircha", "haari mirchi", "pacchi mirapa", "pacha mulagu", "hirvi mirchi", "green chili"],
  },
  "coriander": {
    display_name: "Coriander", emoji: "🌿", category: "Vegetables",
    aliases: ["dhania", "dhaniya", "kothimbir", "kothamalli", "kottimara", "cilantro", "hara dhania", "kothmir", "dhane", "dhaniye"],
  },
  "curry_leaves": {
    display_name: "Curry Leaves", emoji: "🍃", category: "Vegetables",
    aliases: ["kadi patta", "kadhi patta", "karivepilai", "karivembu", "meetha neem", "curry leaf", "karivepaku", "karbevu"],
  },
  "capsicum": {
    display_name: "Capsicum", emoji: "🫑", category: "Vegetables",
    aliases: ["shimla mirch", "bell pepper", "sweet pepper", "dhobli mirchi", "kudai milagai", "dhobi mirchi"],
  },
  "carrot": {
    display_name: "Carrot", emoji: "🥕", category: "Vegetables",
    aliases: ["gajar", "gaajar", "carotte"],
  },
  "spinach": {
    display_name: "Spinach", emoji: "🥬", category: "Vegetables",
    aliases: ["palak", "paalak", "keerai", "palakura", "pasalai keerai", "palak bhaji"],
  },
  "cauliflower": {
    display_name: "Cauliflower", emoji: "🥦", category: "Vegetables",
    aliases: ["gobhi", "gobi", "phool gobhi", "phoolgobi", "hoo kosu", "cauliflower", "phul gobi"],
  },
  "peas": {
    display_name: "Peas", emoji: "🫛", category: "Vegetables",
    aliases: ["matar", "matter", "green peas", "vatana", "batani", "pachipattani", "mattar"],
  },
  "beans": {
    display_name: "Beans", emoji: "🫛", category: "Vegetables",
    aliases: ["french beans", "fansi", "farasbi", "green beans", "phaliyan", "string beans"],
  },
  "eggplant": {
    display_name: "Brinjal", emoji: "🍆", category: "Vegetables",
    aliases: ["brinjal", "baingan", "baingun", "begun", "kathirikkai", "vankaya", "ringna", "vangi", "aubergine", "eggplant"],
  },
  "ladyfinger": {
    display_name: "Bhindi", emoji: "🫛", category: "Vegetables",
    aliases: ["bhindi", "bhende", "okra", "ladies finger", "lady finger", "bendakaya", "vendakkai", "bende", "ramturai"],
  },
  "bitter_gourd": {
    display_name: "Bitter Gourd", emoji: "🥒", category: "Vegetables",
    aliases: ["karela", "kerela", "pavakkai", "kakarakaya", "bittergourd", "bitter gourd", "karela sabzi"],
  },
  "bottle_gourd": {
    display_name: "Bottle Gourd", emoji: "🥒", category: "Vegetables",
    aliases: ["lauki", "doodhi", "dudhi", "sorakkai", "anapakaya", "ghiya", "lau"],
  },
  "cabbage": {
    display_name: "Cabbage", emoji: "🥬", category: "Vegetables",
    aliases: ["patta gobhi", "patta gobi", "kobi", "muttaikose", "kosu", "bund gobi", "band gobi"],
  },
  "broccoli": {
    display_name: "Broccoli", emoji: "🥦", category: "Vegetables",
    aliases: ["broccoli"],
  },
  "mushroom": {
    display_name: "Mushroom", emoji: "🍄", category: "Vegetables",
    aliases: ["mushrooms", "khumb", "khumbi", "dhingri", "mushroom"],
  },
  "corn": {
    display_name: "Corn", emoji: "🌽", category: "Vegetables",
    aliases: ["makka", "makkai", "makka cholam", "bhutta", "maize", "sweet corn", "corn"],
  },
  "drumstick": {
    display_name: "Drumstick", emoji: "🌿", category: "Vegetables",
    aliases: ["sahjan", "sahajana", "murungakkai", "murunga", "shevga", "moringa"],
  },
  "raw_banana": {
    display_name: "Raw Banana", emoji: "🍌", category: "Vegetables",
    aliases: ["kachha kela", "kacha kela", "plantain", "raw plantain", "vazhai"],
  },
  "sweet_potato": {
    display_name: "Sweet Potato", emoji: "🍠", category: "Vegetables",
    aliases: ["shakarkand", "shakarkandi", "chilagada dumpa", "sathumaavalli"],
  },
  "radish": {
    display_name: "Radish", emoji: "🌱", category: "Vegetables",
    aliases: ["mooli", "muli", "mulangi", "mullangi"],
  },
  "mint": {
    display_name: "Mint", emoji: "🌿", category: "Vegetables",
    aliases: ["pudina", "pudhina", "podina", "mint leaves"],
  },
  "fenugreek_leaves": {
    display_name: "Methi Leaves", emoji: "🌿", category: "Vegetables",
    aliases: ["methi", "methi leaves", "methi bhaji", "menthya soppu", "venthayakeerai", "fresh methi", "fenugreek leaves"],
  },
  "spring_onion": {
    display_name: "Spring Onion", emoji: "🧅", category: "Vegetables",
    aliases: ["spring onion", "green onion", "scallion", "hara pyaaz", "hara pyaz"],
  },
  "raw_mango": {
    display_name: "Raw Mango", emoji: "🥭", category: "Vegetables",
    aliases: ["kairi", "kairee", "kacha aam", "raw mango", "kachcha aam"],
  },
  "cluster_beans": {
    display_name: "Cluster Beans", emoji: "🫛", category: "Vegetables",
    aliases: ["gawar", "guar", "cluster beans", "gawar phali"],
  },
  "ridge_gourd": {
    display_name: "Ridge Gourd", emoji: "🥒", category: "Vegetables",
    aliases: ["turai", "torai", "peerkangai", "beerakaya", "ghosavle"],
  },
  "snake_gourd": {
    display_name: "Snake Gourd", emoji: "🥒", category: "Vegetables",
    aliases: ["padwal", "chichinda", "padavalanga", "potlakaaya"],
  },
  "taro": {
    display_name: "Taro / Arbi", emoji: "🥔", category: "Vegetables",
    aliases: ["arbi", "arvi", "colocasia", "taro", "chamadumpa", "seppankizhangu"],
  },

  // ── DAIRY ───────────────────────────────────────────────────────────────────
  "milk": {
    display_name: "Milk", emoji: "🥛", category: "Dairy",
    aliases: ["doodh", "dudh", "paal", "haalu", "palu"],
  },
  "curd": {
    display_name: "Curd", emoji: "🥣", category: "Dairy",
    aliases: ["yogurt", "dahi", "doi", "thayir", "mosaru", "perugu", "yoghurt", "curds"],
  },
  "paneer": {
    display_name: "Paneer", emoji: "🧀", category: "Dairy",
    aliases: ["cottage cheese", "chenna", "chhana", "panir"],
  },
  "butter": {
    display_name: "Butter", emoji: "🧈", category: "Dairy",
    aliases: ["makhan", "makkhan", "vennai", "benne"],
  },
  "ghee": {
    display_name: "Ghee", emoji: "🫙", category: "Dairy",
    aliases: ["clarified butter", "toop", "tuppa", "neyyi", "nei", "desi ghee"],
  },
  "cream": {
    display_name: "Fresh Cream", emoji: "🥛", category: "Dairy",
    aliases: ["fresh cream", "malai", "milk cream", "heavy cream", "whipping cream"],
  },
  "cheese": {
    display_name: "Cheese", emoji: "🧀", category: "Dairy",
    aliases: ["cheese"],
  },
  "khoya": {
    display_name: "Khoya / Mawa", emoji: "🥛", category: "Dairy",
    aliases: ["khoya", "mawa", "khoa", "condensed milk solid"],
  },
  "condensed_milk": {
    display_name: "Condensed Milk", emoji: "🥛", category: "Dairy",
    aliases: ["condensed milk", "mithai milk", "milkmaid"],
  },

  // ── SPICES & MASALAS ────────────────────────────────────────────────────────
  "salt": {
    display_name: "Salt", emoji: "🧂", category: "Spices & Masalas",
    aliases: ["namak", "uppu", "meeta namak", "table salt", "rock salt", "sendha namak", "black salt", "kala namak"],
  },
  "turmeric": {
    display_name: "Turmeric", emoji: "🟡", category: "Spices & Masalas",
    aliases: ["haldi", "halud", "manjal", "pasupu", "arisina", "turmeric powder", "haldi powder"],
  },
  "red_chilli": {
    display_name: "Red Chilli Powder", emoji: "🌶️", category: "Spices & Masalas",
    aliases: ["lal mirch", "laal mirchi", "red chilli", "red chilly", "mirchi powder", "lal mirchi powder", "red chilli powder", "red chili"],
  },
  "coriander_pwd": {
    display_name: "Coriander Powder", emoji: "🟤", category: "Spices & Masalas",
    aliases: ["dhania powder", "dhaniya powder", "coriander powder"],
  },
  "cumin_pwd": {
    display_name: "Cumin Powder", emoji: "🟤", category: "Spices & Masalas",
    aliases: ["jeera powder", "jira powder", "cumin powder", "zeera powder"],
  },
  "garam_masala": {
    display_name: "Garam Masala", emoji: "🫙", category: "Spices & Masalas",
    aliases: ["garam masala", "spice mix"],
  },
  "cumin": {
    display_name: "Cumin Seeds", emoji: "🌰", category: "Spices & Masalas",
    aliases: ["jeera", "jira", "zeera", "safed jeera", "jeeragam", "jilakarra", "cumin seed", "cumin seeds"],
  },
  "mustard": {
    display_name: "Mustard Seeds", emoji: "🌰", category: "Spices & Masalas",
    aliases: ["rai", "sarson", "kadugu", "aava", "mohari", "sasive", "mustard seed", "mustard seeds"],
  },
  "hing": {
    display_name: "Hing (Asafoetida)", emoji: "🫙", category: "Spices & Masalas",
    aliases: ["asafoetida", "heeng", "perungayam", "inguva", "kayam", "asafetida"],
  },
  "pepper": {
    display_name: "Black Pepper", emoji: "🖤", category: "Spices & Masalas",
    aliases: ["kali mirch", "milagu", "menasukalu", "mire", "black pepper", "whole pepper", "kali mirchi"],
  },
  "cardamom": {
    display_name: "Cardamom", emoji: "🌿", category: "Spices & Masalas",
    aliases: ["elaichi", "elakkai", "yalakkayi", "ela", "green cardamom", "choti elaichi", "elachi"],
  },
  "cloves": {
    display_name: "Cloves", emoji: "🌿", category: "Spices & Masalas",
    aliases: ["laung", "lavang", "lavangam", "kirambu", "lavangalu"],
  },
  "cinnamon": {
    display_name: "Cinnamon", emoji: "🪵", category: "Spices & Masalas",
    aliases: ["dalchini", "ilavangapattai", "dalcheeni", "taj", "chakke"],
  },
  "bay_leaf": {
    display_name: "Bay Leaf", emoji: "🍃", category: "Spices & Masalas",
    aliases: ["tej patta", "tej pata", "biryani leaf", "tamalpatra", "tej patte"],
  },
  "chaat_masala": {
    display_name: "Chaat Masala", emoji: "🫙", category: "Spices & Masalas",
    aliases: ["chaat masala", "chat masala"],
  },
  "kitchen_king": {
    display_name: "Kitchen King Masala", emoji: "🫙", category: "Spices & Masalas",
    aliases: ["kitchen king", "kitchen king masala"],
  },
  "amchur": {
    display_name: "Amchur (Dry Mango Powder)", emoji: "🟤", category: "Spices & Masalas",
    aliases: ["amchur", "aamchur", "dry mango powder", "mango powder"],
  },
  "kasoori_methi": {
    display_name: "Kasoori Methi", emoji: "🌿", category: "Spices & Masalas",
    aliases: ["kasoori methi", "kasuri methi", "dried fenugreek", "dried fenugreek leaves", "dry methi"],
  },
  "star_anise": {
    display_name: "Star Anise", emoji: "⭐", category: "Spices & Masalas",
    aliases: ["chakri phool", "star anise", "anasphal"],
  },
  "fennel": {
    display_name: "Fennel Seeds", emoji: "🌿", category: "Spices & Masalas",
    aliases: ["saunf", "sauf", "fennel", "fennel seeds", "sombu", "badi saunf"],
  },
  "pav_bhaji_masala": {
    display_name: "Pav Bhaji Masala", emoji: "🫙", category: "Spices & Masalas",
    aliases: ["pav bhaji masala", "pavbhaji masala"],
  },
  "biryani_masala": {
    display_name: "Biryani Masala", emoji: "🫙", category: "Spices & Masalas",
    aliases: ["biryani masala", "biryani spice"],
  },
  "sesame": {
    display_name: "Sesame Seeds", emoji: "🌾", category: "Spices & Masalas",
    aliases: ["til", "ellu", "nuvvulu", "sesame", "sesame seeds", "white sesame"],
  },
  "fenugreek_seeds": {
    display_name: "Fenugreek Seeds", emoji: "🌰", category: "Spices & Masalas",
    aliases: ["methi seeds", "methi dana", "fenugreek", "vendhayam", "menthulu"],
  },
  "nigella": {
    display_name: "Kalonji (Nigella Seeds)", emoji: "🌰", category: "Spices & Masalas",
    aliases: ["kalonji", "nigella", "onion seeds", "black seeds", "kala jeera"],
  },
  "saffron": {
    display_name: "Saffron", emoji: "🟡", category: "Spices & Masalas",
    aliases: ["kesar", "zafran", "saffron"],
  },

  // ── OILS & CONDIMENTS ───────────────────────────────────────────────────────
  "oil": {
    display_name: "Cooking Oil", emoji: "🫙", category: "Oils & Condiments",
    aliases: ["tel", "ennai", "sunflower oil", "vegetable oil", "refined oil", "cooking oil", "safola", "saffola"],
  },
  "lemon": {
    display_name: "Lemon", emoji: "🍋", category: "Oils & Condiments",
    aliases: ["nimbu", "neembu", "elumichai", "nimboo", "lime", "nimboa", "limbu"],
  },
  "sugar": {
    display_name: "Sugar", emoji: "🍬", category: "Spices & Masalas",
    aliases: ["chini", "cheeni", "shakkar", "sakhar", "sarkara"],
  },
  "jaggery": {
    display_name: "Jaggery", emoji: "🟫", category: "Spices & Masalas",
    aliases: ["gud", "gur", "bella", "vellam", "bellam", "gol", "gurr", "nolen gur"],
  },
  "tamarind": {
    display_name: "Tamarind", emoji: "🟤", category: "Spices & Masalas",
    aliases: ["imli", "imlee", "puli", "chintapandu", "tetul", "chinch", "tamarind paste"],
  },
  "vinegar": {
    display_name: "Vinegar", emoji: "🫙", category: "Oils & Condiments",
    aliases: ["sirka", "sirca", "white vinegar", "apple cider vinegar"],
  },
  "soy_sauce": {
    display_name: "Soy Sauce", emoji: "🫙", category: "Oils & Condiments",
    aliases: ["soy sauce", "soya sauce", "soysauce", "dark soy"],
  },
  "honey": {
    display_name: "Honey", emoji: "🍯", category: "Oils & Condiments",
    aliases: ["shahad", "madh", "then", "honey"],
  },
  "coconut_oil": {
    display_name: "Coconut Oil", emoji: "🫙", category: "Oils & Condiments",
    aliases: ["coconut oil", "nariyal tel", "thengai ennai", "kobri tel"],
  },
  "mustard_oil": {
    display_name: "Mustard Oil", emoji: "🫙", category: "Oils & Condiments",
    aliases: ["sarson tel", "sarson ka tel", "mustard oil", "rai tel"],
  },
  "tomato_ketchup": {
    display_name: "Tomato Ketchup", emoji: "🍅", category: "Oils & Condiments",
    aliases: ["ketchup", "tamatar sauce", "tomato sauce", "tomato ketchup"],
  },
  "green_chutney": {
    display_name: "Green Chutney", emoji: "🟢", category: "Oils & Condiments",
    aliases: ["hari chutney", "pudina chutney", "dhania chutney", "green chutney"],
  },
  "coconut": {
    display_name: "Coconut", emoji: "🥥", category: "Oils & Condiments",
    aliases: ["nariyal", "thengai", "kobbari", "narikel", "naral", "coconut"],
  },
  "kokum": {
    display_name: "Kokum", emoji: "🟣", category: "Oils & Condiments",
    aliases: ["kokum", "garcinia", "amsol"],
  },

  // ── DRY FRUITS & NUTS ───────────────────────────────────────────────────────
  "cashew": {
    display_name: "Cashews", emoji: "🥜", category: "Dry Fruits & Nuts",
    aliases: ["kaju", "kaayu", "munthiri", "jiddi", "cashew nut", "cashews"],
  },
  "peanut": {
    display_name: "Peanuts", emoji: "🥜", category: "Dry Fruits & Nuts",
    aliases: ["moongphali", "shengdana", "kadalakai", "groundnut", "verusenaga", "peanuts", "mungphali"],
  },
  "almond": {
    display_name: "Almonds", emoji: "🌰", category: "Dry Fruits & Nuts",
    aliases: ["badam", "badaam", "vatham", "almonds"],
  },
  "raisin": {
    display_name: "Raisins", emoji: "🍇", category: "Dry Fruits & Nuts",
    aliases: ["kishmish", "draksha", "raisin", "raisins", "munakka"],
  },
  "walnut": {
    display_name: "Walnuts", emoji: "🌰", category: "Dry Fruits & Nuts",
    aliases: ["akhrot", "akha rot", "walnut", "walnuts"],
  },
  "pistachio": {
    display_name: "Pistachios", emoji: "🌰", category: "Dry Fruits & Nuts",
    aliases: ["pista", "pistachio", "pistachios"],
  },
  "dates": {
    display_name: "Dates", emoji: "🌴", category: "Dry Fruits & Nuts",
    aliases: ["khajur", "khajoori", "pericham pazham", "dates"],
  },
  "makhana": {
    display_name: "Makhana (Fox Nuts)", emoji: "🌰", category: "Dry Fruits & Nuts",
    aliases: ["makhana", "fox nuts", "lotus seeds", "phool makhana"],
  },

  // ── FRUITS ──────────────────────────────────────────────────────────────────
  "banana": {
    display_name: "Banana", emoji: "🍌", category: "Fruits",
    aliases: ["kela", "kele", "vaazha pazham", "aratipandu", "keli"],
  },
  "mango": {
    display_name: "Mango", emoji: "🥭", category: "Fruits",
    aliases: ["aam", "mango", "mamidi", "maanga"],
  },
  "apple": {
    display_name: "Apple", emoji: "🍎", category: "Fruits",
    aliases: ["seb", "apple"],
  },
  "pomegranate": {
    display_name: "Pomegranate", emoji: "🍎", category: "Fruits",
    aliases: ["anar", "dalimb", "mathalam pazham", "danimma pandu"],
  },
  "papaya": {
    display_name: "Papaya", emoji: "🍈", category: "Fruits",
    aliases: ["papaya", "papita", "pappaya", "boppayi"],
  },

  // ── BEVERAGES ───────────────────────────────────────────────────────────────
  "tea": {
    display_name: "Tea", emoji: "🍵", category: "Beverages",
    aliases: ["chai", "chaha", "tea leaves", "tea"],
  },
  "coffee": {
    display_name: "Coffee", emoji: "☕", category: "Beverages",
    aliases: ["coffee", "kaapi", "kapi"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// lookupIngredient(input)
// Returns full metadata if found (canonical_name, display_name, emoji, category)
// Returns null if not in local dictionary
// ─────────────────────────────────────────────────────────────────────────────
export function lookupIngredient(input) {
  if (!input) return null;
  const q = input.trim().toLowerCase();

  // 1. Direct canonical key match
  if (PANTRY_DICT[q]) {
    return { canonical_name: q, ...PANTRY_DICT[q] };
  }

  // 2. Check display_name + aliases across all entries
  for (const [key, data] of Object.entries(PANTRY_DICT)) {
    if (data.display_name.toLowerCase() === q) {
      return { canonical_name: key, ...data };
    }
    if (data.aliases.some((a) => a === q)) {
      return { canonical_name: key, ...data };
    }
  }

  // 3. Partial/contains match on aliases (less strict — only if no exact found)
  for (const [key, data] of Object.entries(PANTRY_DICT)) {
    if (
      data.aliases.some((a) => a.includes(q) && q.length >= 4) ||
      data.display_name.toLowerCase().includes(q) && q.length >= 4
    ) {
      return { canonical_name: key, ...data };
    }
  }

  return null;
}
