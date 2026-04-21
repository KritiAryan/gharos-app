import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { categorizeItem } from "../../services/categorizeItem";
import ScreenGuide from "../../components/ScreenGuide";

// ─── Layout constants ─────────────────────────────────────────────────────────
const SIDEBAR_W = 80;
const COLS      = 3;
const CELL_GAP  = 8;
const GRID_PAD  = 12;

// ─── Image CDN ────────────────────────────────────────────────────────────────
// Same filenames as the web app (ingredients_100x100 — lighter, faster)
const IMG_BASE = "https://spoonacular.com/cdn/ingredients_100x100/";

const ITEM_IMAGES: Record<string, string> = {
  // Grains & Lentils
  atta:         "flour.jpg",
  rice:         "rice.jpg",
  poha:         "rolled-oats.jpg",
  sooji:        "semolina.jpg",
  besan:        "chickpea-flour.jpg",
  toor_dal:     "lentils.jpg",
  moong_dal:    "mung-beans.jpg",
  chana_dal:    "chickpeas.jpg",
  masoor_dal:   "red-lentil.jpg",
  rajma:        "kidney-beans.jpg",
  chana:        "chickpeas.jpg",
  urad_dal:     "black-beans.jpg",
  // Vegetables
  onion:        "onion.jpg",
  tomato:       "tomato.jpg",
  potato:       "potatoes-yukon-gold.jpg",
  ginger:       "ginger.jpg",
  garlic:       "garlic.jpg",
  green_chilli: "chili-peppers.jpg",
  coriander:    "cilantro.jpg",
  curry_leaves: "curry-leaves.png",
  capsicum:     "peppers-and-chili-peppers.jpg",
  carrot:       "carrots.jpg",
  spinach:      "spinach.jpg",
  cauliflower:  "cauliflower.jpg",
  peas:         "peas.jpg",
  beans:        "green-beans.jpg",
  // Dairy
  milk:         "milk.jpg",
  curd:         "plain-yogurt.jpg",
  paneer:       "cream-cheese.jpg",
  butter:       "butter.jpg",
  ghee:         "butter-salted.jpg",
  cream:        "heavy-cream.jpg",
  // Spices & Masalas
  salt:         "salt.jpg",
  turmeric:     "turmeric.jpg",
  red_chilli:   "chili-powder.jpg",
  coriander_pwd:"coriander.jpg",
  cumin_pwd:    "cumin.jpg",
  garam_masala: "indian-seasoning-mix.jpg",
  cumin:        "cumin.jpg",
  mustard:      "mustard-seeds.jpg",
  hing:         "asafoetida.jpg",
  pepper:       "black-pepper.jpg",
  cardamom:     "cardamom.jpg",
  cloves:       "cloves.jpg",
  cinnamon:     "cinnamon.jpg",
  bay_leaf:     "bay-leaves.jpg",
  chaat_masala: "spices.jpg",
  kitchen_king: "spices.jpg",
  // Oils & Condiments
  oil:          "oil-cooking.jpg",
  lemon:        "lemon.jpg",
  sugar:        "sugar-in-bowl.jpg",
  jaggery:      "brown-sugar.jpg",
  tamarind:     "tamarind.jpg",
  vinegar:      "vinegar.jpg",
  soy_sauce:    "soy-sauce.jpg",
  // Dry Fruits & Nuts
  cashew:       "cashew-nuts.jpg",
  peanut:       "peanuts.jpg",
  almond:       "almonds.jpg",
  raisin:       "raisins.jpg",
};

function getItemImageUri(id: string) {
  const file = ITEM_IMAGES[id];
  return file ? `${IMG_BASE}${file}` : null;
}

// ─── Category metadata ────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { emoji: string }> = {
  "Grains & Lentils":  { emoji: "🌾" },
  "Vegetables":        { emoji: "🥦" },
  "Dairy":             { emoji: "🥛" },
  "Spices & Masalas":  { emoji: "🌶️" },
  "Oils & Condiments": { emoji: "🫙" },
  "Dry Fruits & Nuts": { emoji: "🥜" },
  "Fruits":            { emoji: "🍎" },
  "Beverages":         { emoji: "🍵" },
  "Other":             { emoji: "✨" },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_META);

// Short labels for vertical tab — match web app
const CAT_SHORT: Record<string, string> = {
  "Grains & Lentils":  "Grains",
  "Vegetables":        "Vegetables",
  "Dairy":             "Dairy",
  "Spices & Masalas":  "Spices",
  "Oils & Condiments": "Oils",
  "Dry Fruits & Nuts": "Dry Fruits",
  "Fruits":            "Fruits",
  "Beverages":         "Drinks",
  "Other":             "Other",
};

// ─── Standard pantry catalogue ────────────────────────────────────────────────
const DEFAULT_PANTRY: Record<string, { id: string; display_name: string; emoji: string }[]> = {
  "Grains & Lentils": [
    { id: "atta",       display_name: "Atta",         emoji: "🌾" },
    { id: "rice",       display_name: "Rice",          emoji: "🍚" },
    { id: "poha",       display_name: "Poha",          emoji: "🌾" },
    { id: "sooji",      display_name: "Sooji / Rava",  emoji: "🌾" },
    { id: "besan",      display_name: "Besan",         emoji: "🟡" },
    { id: "toor_dal",   display_name: "Toor Dal",      emoji: "🫘" },
    { id: "moong_dal",  display_name: "Moong Dal",     emoji: "🫘" },
    { id: "chana_dal",  display_name: "Chana Dal",     emoji: "🫘" },
    { id: "masoor_dal", display_name: "Masoor Dal",    emoji: "🫘" },
    { id: "rajma",      display_name: "Rajma",         emoji: "🫘" },
    { id: "chana",      display_name: "Chana",         emoji: "🫘" },
    { id: "urad_dal",   display_name: "Urad Dal",      emoji: "🫘" },
  ],
  "Vegetables": [
    { id: "onion",        display_name: "Onion",         emoji: "🧅" },
    { id: "tomato",       display_name: "Tomato",        emoji: "🍅" },
    { id: "potato",       display_name: "Potato",        emoji: "🥔" },
    { id: "ginger",       display_name: "Ginger",        emoji: "🫚" },
    { id: "garlic",       display_name: "Garlic",        emoji: "🧄" },
    { id: "green_chilli", display_name: "Green Chilli",  emoji: "🌶️" },
    { id: "coriander",    display_name: "Coriander",     emoji: "🌿" },
    { id: "curry_leaves", display_name: "Curry Leaves",  emoji: "🍃" },
    { id: "capsicum",     display_name: "Capsicum",      emoji: "🫑" },
    { id: "carrot",       display_name: "Carrot",        emoji: "🥕" },
    { id: "spinach",      display_name: "Spinach",       emoji: "🥬" },
    { id: "cauliflower",  display_name: "Cauliflower",   emoji: "🥦" },
    { id: "peas",         display_name: "Peas",          emoji: "🫛" },
    { id: "beans",        display_name: "Beans",         emoji: "🫛" },
    { id: "lemon",        display_name: "Lemon",         emoji: "🍋" },
  ],
  "Dairy": [
    { id: "milk",   display_name: "Milk",        emoji: "🥛" },
    { id: "curd",   display_name: "Curd",        emoji: "🥣" },
    { id: "paneer", display_name: "Paneer",      emoji: "🧀" },
    { id: "butter", display_name: "Butter",      emoji: "🧈" },
    { id: "ghee",   display_name: "Ghee",        emoji: "🫙" },
    { id: "cream",  display_name: "Fresh Cream", emoji: "🥛" },
  ],
  "Spices & Masalas": [
    { id: "salt",          display_name: "Salt",                emoji: "🧂" },
    { id: "turmeric",      display_name: "Turmeric",            emoji: "🟡" },
    { id: "red_chilli",    display_name: "Red Chilli Powder",   emoji: "🌶️" },
    { id: "coriander_pwd", display_name: "Coriander Powder",    emoji: "🟤" },
    { id: "cumin_pwd",     display_name: "Cumin Powder",        emoji: "🟤" },
    { id: "garam_masala",  display_name: "Garam Masala",        emoji: "🫙" },
    { id: "cumin",         display_name: "Cumin Seeds",         emoji: "🌰" },
    { id: "mustard",       display_name: "Mustard Seeds",       emoji: "🌰" },
    { id: "hing",          display_name: "Hing (Asafoetida)",   emoji: "🫙" },
    { id: "pepper",        display_name: "Black Pepper",        emoji: "🖤" },
    { id: "cardamom",      display_name: "Cardamom",            emoji: "🌿" },
    { id: "cloves",        display_name: "Cloves",              emoji: "🌿" },
    { id: "cinnamon",      display_name: "Cinnamon",            emoji: "🪵" },
    { id: "bay_leaf",      display_name: "Bay Leaf",            emoji: "🍃" },
    { id: "chaat_masala",  display_name: "Chaat Masala",        emoji: "🫙" },
    { id: "kitchen_king",  display_name: "Kitchen King",        emoji: "🫙" },
    { id: "sugar",         display_name: "Sugar",               emoji: "🍬" },
    { id: "jaggery",       display_name: "Jaggery",             emoji: "🟫" },
    { id: "tamarind",      display_name: "Tamarind",            emoji: "🟤" },
  ],
  "Oils & Condiments": [
    { id: "oil",       display_name: "Cooking Oil", emoji: "🫙" },
    { id: "vinegar",   display_name: "Vinegar",     emoji: "🫙" },
    { id: "soy_sauce", display_name: "Soy Sauce",   emoji: "🫙" },
  ],
  "Dry Fruits & Nuts": [
    { id: "cashew", display_name: "Cashews", emoji: "🥜" },
    { id: "peanut", display_name: "Peanuts", emoji: "🥜" },
    { id: "almond", display_name: "Almonds", emoji: "🌰" },
    { id: "raisin", display_name: "Raisins", emoji: "🍇" },
  ],
};

const DEFAULT_SELECTED = [
  "atta","rice","toor_dal","moong_dal","onion","tomato","potato",
  "ginger","garlic","green_chilli","coriander","milk","curd","ghee",
  "oil","salt","turmeric","red_chilli","coriander_pwd","cumin_pwd",
  "garam_masala","cumin","mustard","hing","sugar","lemon",
];

const ITEM_META: Record<string, any> = Object.entries(DEFAULT_PANTRY).reduce((acc: any, [cat, items]) => {
  items.forEach((i) => { acc[i.id] = { ...i, category: cat }; });
  return acc;
}, {});

type PantryItem = { id: string; display_name: string; emoji: string; category?: string; is_custom?: boolean };

// ─── TileGrid ─────────────────────────────────────────────────────────────────
function TileGrid({
  items, tileW, selectedSet, onToggle,
}: {
  items: PantryItem[]; tileW: number; selectedSet: Set<string>; onToggle: (id: string) => void;
}) {
  if (tileW <= 0) return null; // wait for layout measurement

  const rows: PantryItem[][] = [];
  for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS));

  return (
    <View style={{ width: "100%" }}>
      {rows.map((row, ri) => (
        <View
          key={ri}
          style={{ flexDirection: "row", marginBottom: CELL_GAP }}
        >
          {row.map((item, ci) => (
            <View
              key={item.id}
              style={{ width: tileW, marginLeft: ci === 0 ? 0 : CELL_GAP }}
            >
              <ItemTile item={item} selected={selectedSet.has(item.id)} onToggle={onToggle} />
            </View>
          ))}
          {/* ghost spacers so last row stays left-aligned */}
          {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, gi) => (
            <View key={`g${gi}`} style={{ width: tileW, marginLeft: CELL_GAP }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Item tile — matches web: 56×56 photo, rounded card, green badge ─────────
function ItemTile({ item, selected, onToggle }: { item: PantryItem; selected: boolean; onToggle: (id: string) => void }) {
  const [imgError, setImgError] = useState(false);
  const imgUri = getItemImageUri(item.id);
  const showPhoto = !!imgUri && !imgError;

  return (
    <TouchableOpacity
      onPress={() => onToggle(item.id)}
      activeOpacity={0.7}
      // Fixed height so single-line & two-line labels produce the same tile size.
      // Avoids the stagger you saw on "Curry Leaves" / "Red Chilli Powder".
      style={{
        width: "100%",
        height: 120,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 4,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? "#4ade80" : "#f3f4f6",
        backgroundColor: selected ? "#f0fdf4" : "#ffffff",
        elevation: selected ? 2 : 0,
      }}
    >
      {/* Green tick badge */}
      {selected && (
        <View
          style={{
            position: "absolute", top: 6, right: 6,
            width: 20, height: 20, borderRadius: 10,
            backgroundColor: "#22c55e",
            alignItems: "center", justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 12 }}>✓</Text>
        </View>
      )}

      {/* 56×56 photo — matches web w-14 h-14 */}
      <View
        style={{
          width: 56, height: 56,
          borderRadius: 14,
          overflow: "hidden",
          alignItems: "center", justifyContent: "center",
          marginBottom: 6,
        }}
      >
        {showPhoto ? (
          <Image
            source={{ uri: imgUri! }}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            onError={() => setImgError(true)}
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={{ fontSize: 28, lineHeight: 34 }}>{item.emoji}</Text>
        )}
      </View>

      {/* Name — fixed text block so 1-line and 2-line labels align */}
      <View style={{ height: 32, justifyContent: "flex-start", width: "100%" }}>
        <Text
          style={{
            fontSize: 12, lineHeight: 15, textAlign: "center",
            fontWeight: "500",
            color: selected ? "#15803d" : "#4b5563",
            paddingHorizontal: 2,
          }}
          numberOfLines={2}
        >
          {item.display_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Vertical category tab — matches web: w-20, border-l-4, text-2xl emoji ───
function CategoryTab({ cat, active, onPress }: {
  cat: string; active: boolean; onPress: () => void;
}) {
  const meta = CATEGORY_META[cat] || { emoji: "🛒" };
  const shortLabel = CAT_SHORT[cat] || cat;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: SIDEBAR_W,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        paddingHorizontal: 4,
        borderLeftWidth: 4,
        borderLeftColor: active ? "#22c55e" : "transparent",
        backgroundColor: active ? "#f0fdf4" : "#ffffff",
      }}
    >
      <Text style={{ fontSize: 24, lineHeight: 28 }}>{meta.emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          lineHeight: 13,
          marginTop: 6,
          textAlign: "center",
          fontWeight: "500",
          color: active ? "#15803d" : "#6b7280",
        }}
        numberOfLines={1}
      >
        {shortLabel}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PantryScreen() {
  const { width: screenW } = useWindowDimensions();
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [customItems, setCustomItems] = useState<PantryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ORDER[0]);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [totalSaved, setTotalSaved] = useState(0);
  const [loading, setLoading] = useState(true);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customItemsRef = useRef<PantryItem[]>([]);
  useEffect(() => { customItemsRef.current = customItems; }, [customItems]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadFromDB = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setUser(session.user);

    const { data } = await supabase
      .from("pantry_items")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const sel = new Set<string>(data.filter((r: any) => r.in_stock).map((r: any) => r.item_key));
      const custom = data
        .filter((r: any) => r.is_custom)
        .map((r: any) => ({ id: r.item_key, display_name: r.display_name, emoji: r.emoji, category: r.category, is_custom: true }));
      setSelected(sel);
      setCustomItems(custom);
      setTotalSaved(sel.size);
    } else {
      const { data: prof } = await supabase.from("profiles").select("pantry").eq("id", session.user.id).maybeSingle();
      if (prof?.pantry?.length > 0) {
        setSelected(new Set(prof.pantry));
        setTotalSaved(prof.pantry.length);
      }
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadFromDB(); }, []));

  const scheduleSave = useCallback((sel: Set<string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const arr = [...sel];
      setTotalSaved(arr.length);
      if (user) await supabase.from("profiles").update({ pantry: arr }).eq("id", user.id);
    }, 1200);
  }, [user]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const inStock = next.has(id) ? (next.delete(id), false) : (next.add(id), true);
      scheduleSave(next);
      if (user) {
        const stdMeta = ITEM_META[id];
        const customMeta = customItemsRef.current.find((c) => c.id === id);
        const meta = stdMeta || customMeta || { display_name: id, emoji: "🛒", category: "Other" };
        supabase.from("pantry_items").upsert({
          user_id: user.id, item_key: id, canonical_name: id,
          display_name: meta.display_name, emoji: meta.emoji, category: meta.category,
          in_stock: inStock, stock_level: inStock ? "plenty" : "out",
          is_custom: !stdMeta, source: stdMeta ? "standard" : "custom",
        }, { onConflict: "user_id,item_key" });
      }
      return next;
    });
  }, [user, scheduleSave]);

  const addCustom = async () => {
    const val = customInput.trim();
    if (!val || addingCustom) return;
    setAddingCustom(true);
    try {
      const result = await categorizeItem(val);
      if (!result) throw new Error("categorize failed");
      const { canonical_name, display_name, emoji, category } = result;
      const dupe = ITEM_META[canonical_name] || customItemsRef.current.find((c) => c.id === canonical_name);
      if (dupe) { showToast(`${display_name} is already in your pantry`); setCustomInput(""); setAddingCustom(false); return; }
      const newItem: PantryItem = { id: canonical_name, display_name, emoji, category, is_custom: true };
      setCustomItems((prev) => [...prev, newItem]);
      setSelected((prev) => { const next = new Set([...prev, canonical_name]); scheduleSave(next); return next; });
      setActiveCategory(CATEGORY_ORDER.includes(category) ? category : "Other");
      setCustomInput("");
      showToast(`${display_name} added to ${category} ✓`);
      if (user) {
        supabase.from("pantry_items").upsert({
          user_id: user.id, item_key: canonical_name, canonical_name,
          display_name, emoji, category, in_stock: true, stock_level: "plenty",
          is_custom: true, source: result.source || "llm",
        }, { onConflict: "user_id,item_key" });
      }
    } catch {
      const safeId = "custom_" + val.toLowerCase().replace(/\s+/g, "_");
      const displayName = val.replace(/\b\w/g, (c) => c.toUpperCase());
      const safeItem: PantryItem = { id: safeId, display_name: displayName, emoji: "🛒", category: "Other", is_custom: true };
      setCustomItems((prev) => [...prev, safeItem]);
      setSelected((prev) => { const next = new Set([...prev, safeId]); scheduleSave(next); return next; });
      setCustomInput("");
      showToast(`${displayName} added to your pantry`);
    }
    setAddingCustom(false);
  };

  // ── Build merged catalogue ─────────────────────────────────────────────────
  const allCategories = (() => {
    const cats: Record<string, PantryItem[]> = {};
    for (const [cat, items] of Object.entries(DEFAULT_PANTRY)) cats[cat] = [...items];
    for (const item of customItems) {
      const cat = CATEGORY_ORDER.includes(item.category || "") ? item.category! : "Other";
      if (!cats[cat]) cats[cat] = [];
      if (!cats[cat].find((x) => x.id === item.id)) cats[cat].push(item);
    }
    const result: Record<string, PantryItem[]> = {};
    for (const cat of CATEGORY_ORDER) { if (cats[cat]?.length) result[cat] = cats[cat]; }
    return result;
  })();

  const isSearching = search.trim().length > 0;
  const searchResults = isSearching
    ? Object.values(allCategories).flat().filter((i) =>
        i.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const activeItems = allCategories[activeCategory] || [];
  const inPantry = activeItems.filter((i) => selected.has(i.id));
  const addMore  = activeItems.filter((i) => !selected.has(i.id));

  // Synchronous tile width — available immediately, no layout events needed
  // When searching, sidebar is hidden so grid takes full screen width
  const gridW = isSearching ? screenW : screenW - SIDEBAR_W;
  const tileW = Math.floor((gridW - GRID_PAD * 2 - CELL_GAP * (COLS - 1)) / COLS);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center" }}>
        <Text className="text-3xl mb-2">🥘</Text>
        <ActivityIndicator color="#16a34a" />
        <Text className="text-gray-400 text-sm mt-2">Loading your pantry…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <ScreenGuide
        screenKey="pantry"
        emoji="🥫"
        title="Your Kitchen Pantry"
        points={[
          "Tap any item to toggle whether it's in stock.",
          "Items in stock are skipped from your shopping list automatically.",
          "Browse categories in the left sidebar — grains, dals, spices, etc.",
          "Add custom items with the + button; we auto-categorize them.",
        ]}
      />
      {/* Toast */}
      {toast && (
        <View className="absolute top-14 left-4 right-4 z-50 bg-gray-800 rounded-2xl px-4 py-3"
          style={{ elevation: 20 }}>
          <Text className="text-white text-sm font-medium">{toast}</Text>
        </View>
      )}

      {/* Header */}
      <View className="bg-white px-4 pt-4 pb-3 border-b border-gray-100" style={{ elevation: 2 }}>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xl font-bold text-gray-800">Your Pantry</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Tap items you have · changes saved automatically</Text>
          </View>
          <View className="bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 flex-row items-center gap-1">
            <Text className="text-base font-bold text-green-600">{totalSaved || selected.size}</Text>
            <Text className="text-xs text-green-500">stocked</Text>
          </View>
        </View>
        {/* Search */}
        <TextInput
          placeholder="🔍 Search pantry items..."
          value={search}
          onChangeText={setSearch}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50"
        />
      </View>

      {/* Body: vertical tabs + grid — inline styles (not NativeWind) to guarantee flex-row */}
      <View style={{ flex: 1, flexDirection: "row" }}>

        {/* ── Left: vertical category tabs ── */}
        {!isSearching && (
          <ScrollView
            style={{ width: SIDEBAR_W, flexShrink: 0, backgroundColor: "#ffffff", borderRightWidth: 1, borderRightColor: "#f0f0f0" }}
            contentContainerStyle={{ width: SIDEBAR_W }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {Object.keys(allCategories).map((cat) => (
              <CategoryTab
                key={cat}
                cat={cat}
                active={activeCategory === cat}
                onPress={() => setActiveCategory(cat)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Right: item grid — explicit pixel width, no flex ambiguity ── */}
        <ScrollView
          style={{ width: gridW, backgroundColor: "#f9fafb" }}
          contentContainerStyle={{ paddingHorizontal: GRID_PAD, paddingTop: GRID_PAD, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Helper: render a row of tiles with exact pixel widths */}
          {/* Search results */}
          {isSearching && (
            searchResults.length === 0 ? (
              <View className="items-center py-12">
                <Text className="text-3xl mb-2">🔍</Text>
                <Text className="text-gray-400 text-sm">No matches for "{search}"</Text>
                <Text className="text-gray-400 text-xs mt-1">Add it as a custom item below ↓</Text>
              </View>
            ) : (
              <>
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Results ({searchResults.length})
                </Text>
                <TileGrid items={searchResults} tileW={tileW} selectedSet={selected} onToggle={toggle} />
              </>
            )
          )}

          {/* Category view — matches web: no category header, just IN PANTRY / ADD MORE */}
          {!isSearching && (
            <>
              {/* In Pantry */}
              {inPantry.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#16a34a", textTransform: "uppercase", letterSpacing: 1 }}>
                      In Pantry
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: "#16a34a", marginLeft: 6 }}>
                      ({inPantry.length})
                    </Text>
                  </View>
                  <TileGrid items={inPantry} tileW={tileW} selectedSet={selected} onToggle={toggle} />
                </View>
              )}

              {inPantry.length > 0 && addMore.length > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: "#e5e7eb", borderStyle: "dashed", marginVertical: 12 }} />
              )}

              {/* Add More */}
              {addMore.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    Add More
                  </Text>
                  <TileGrid items={addMore} tileW={tileW} selectedSet={selected} onToggle={toggle} />
                </View>
              )}
            </>
          )}

          {/* Add custom item */}
          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 16 }}>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Add Custom Item
            </Text>
            <Text className="text-xs text-gray-400 mb-2.5">
              Any language — we'll find the right category
            </Text>
            {/* Row: input shrinks, button has a fixed width so it never overflows */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, width: "100%" }}>
              <TextInput
                placeholder="e.g. Kokum, pyaaz…"
                value={customInput}
                onChangeText={setCustomInput}
                onSubmitEditing={addCustom}
                editable={!addingCustom}
                style={{
                  flex: 1, minWidth: 0,
                  borderWidth: 1, borderColor: "#e5e7eb",
                  borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, backgroundColor: "#fff", color: "#374151",
                  opacity: addingCustom ? 0.6 : 1,
                }}
              />
              <TouchableOpacity
                onPress={addCustom}
                disabled={!customInput.trim() || addingCustom}
                style={{
                  width: 56, height: 42,
                  backgroundColor: "#22c55e",
                  borderRadius: 12,
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  opacity: !customInput.trim() || addingCustom ? 0.5 : 1,
                }}
                activeOpacity={0.8}
              >
                {addingCustom
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>+</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
