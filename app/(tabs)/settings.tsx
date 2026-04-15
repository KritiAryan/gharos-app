import { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { DEFAULT_RECIPE_SITES } from "../../data/recipeSites";

// ─── Constants ────────────────────────────────────────────────────────────────
const CUISINE_OPTIONS = [
  "North Indian","South Indian","Maharashtrian","Gujarati",
  "Bengali","Udupi","Continental","Pan-Indian",
];
const DIET_OPTIONS = [
  { value:"veg",        label:"🥦 Vegetarian" },
  { value:"eggetarian", label:"🥚 Eggetarian" },
  { value:"nonveg",     label:"🍗 Non-Vegetarian" },
  { value:"jain",       label:"🙏 Jain" },
  { value:"vegan",      label:"🌱 Vegan" },
];

// ─── Reusable UI bits ─────────────────────────────────────────────────────────
function SettingRow({ emoji, label, value, onPress }: {
  emoji: string; label: string; value?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      className="flex-row items-center justify-between py-4 border-b border-gray-50">
      <View className="flex-row items-center gap-3">
        <Text style={{ fontSize:20 }}>{emoji}</Text>
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {value ? <Text className="text-sm text-gray-400">{value}</Text> : null}
        <Text className="text-gray-300 text-lg">›</Text>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2 px-1">{title}</Text>;
}

function Sheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" }}
        activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl" style={{ maxHeight:"88%" }}>
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
              <Text className="font-bold text-gray-800 text-base">{title}</Text>
              <TouchableOpacity onPress={onClose}><Text className="text-gray-400 text-2xl">×</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding:24 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function SaveBtn({ onPress, saving }: { onPress: () => void; saving: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={saving}
      className="w-full py-3 bg-green-500 rounded-xl items-center mt-4"
      style={{ opacity: saving ? 0.5 : 1 }} activeOpacity={0.8}>
      {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">Save</Text>}
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);

  // Editable state
  const [persons, setPersons] = useState(2);
  const [diet, setDiet] = useState("veg");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [calorieTarget, setCalorieTarget] = useState("");
  const [disabledDefaultSites, setDisabledDefaultSites] = useState<string[]>([]);
  const [recipeSites, setRecipeSites] = useState<{url:string}[]>([]);
  const [customSiteInput, setCustomSiteInput] = useState("");
  const [favouriteRecipes, setFavouriteRecipes] = useState<string[]>([""]);
  const [customRecipes, setCustomRecipes] = useState<any[]>([]);
  const [newCustom, setNewCustom] = useState({ name:"", url:"", cuisine:"" });
  const [editingRecipe, setEditingRecipe] = useState<any>(null);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setUser(session.user);
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (data) {
      setProfile(data);
      const c = data.config || {};
      setPersons(c.persons || 2);
      setDiet(c.diet || "veg");
      setCuisines(c.cuisines || []);
      setCalorieTarget(c.calorieTarget || "");
      setDisabledDefaultSites(c.disabledDefaultSites || []);
      setRecipeSites((c.recipeSites || []).map((s: any) => typeof s==="string" ? {url:s} : {url:s?.url||""}).filter((s: any)=>s.url));
      setFavouriteRecipes(c.favouriteRecipes?.length ? c.favouriteRecipes : [""]);
      setCustomRecipes(c.customRecipes || []);
    }
  };

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const saveConfig = async (extra: Record<string, any> = {}) => {
    if (!user) return;
    setSaving(true);
    const newConfig = {
      ...profile?.config,
      persons, diet, cuisines, calorieTarget,
      disabledDefaultSites, recipeSites, favouriteRecipes, customRecipes,
      ...extra,
    };
    await supabase.from("profiles").update({ config: newConfig }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, config: newConfig }));
    setSaving(false);
    setActiveSheet(null);
    setEditingRecipe(null);
  };

  const toggleCuisine = (c: string) =>
    setCuisines((p) => p.includes(c) ? p.filter((x)=>x!==c) : [...p,c]);

  const toggleDefaultSite = (url: string) =>
    setDisabledDefaultSites((p) =>
      p.includes(url) ? p.filter((u)=>u!==url) : [...p, url]
    );

  const addCustomSite = () => {
    const raw = customSiteInput.trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
    if (!raw) return;
    setRecipeSites((p) => [...p, { url: raw }]);
    setCustomSiteInput("");
  };

  const addCustomRecipe = () => {
    if (!newCustom.name) return;
    setCustomRecipes((p) => [...p, { ...newCustom, id: Date.now() }]);
    setNewCustom({ name:"", url:"", cuisine:"" });
  };

  const config = profile?.config || {};
  const activeSiteCount = DEFAULT_RECIPE_SITES.length - disabledDefaultSites.length + recipeSites.length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom:40 }} showsVerticalScrollIndicator={false}>

        <View className="bg-white border-b border-gray-100 px-4 py-3 items-center">
          <Text className="text-base font-bold text-gray-800">Settings</Text>
        </View>

        <View className="px-4">

          {/* ── Profile ── */}
          <SectionHeader title="Profile" />
          <View className="bg-white rounded-2xl px-4 border border-gray-100" style={{ elevation:1 }}>
            <SettingRow emoji="👥" label="Household size" value={`${config.persons||2} people`} onPress={() => setActiveSheet("persons")} />
            <SettingRow emoji="🥦" label="Diet preference" value={DIET_OPTIONS.find(d=>d.value===config.diet)?.label?.replace(/^\S+ /,"") || "—"} onPress={() => setActiveSheet("diet")} />
            <SettingRow emoji="🍛" label="Cuisines" value={config.cuisines?.length ? `${config.cuisines.length} selected` : "—"} onPress={() => setActiveSheet("cuisines")} />
            <SettingRow emoji="🔥" label="Calorie target" value={config.calorieTarget ? `${config.calorieTarget} kcal` : "Not set"} onPress={() => setActiveSheet("calories")} />
          </View>

          {/* ── My Kitchen ── */}
          <SectionHeader title="My Kitchen" />
          <View className="bg-white rounded-2xl px-4 border border-gray-100" style={{ elevation:1 }}>
            <SettingRow emoji="❤️" label="Favourite Meals" value={`${profile?.favourites?.length||0}`} onPress={() => setActiveSheet("favourites")} />
            <SettingRow emoji="🧺" label="Update Pantry" onPress={() => router.push("/(tabs)/pantry")} />
          </View>

          {/* ── Recipes ── */}
          <SectionHeader title="Recipes" />
          <View className="bg-white rounded-2xl px-4 border border-gray-100" style={{ elevation:1 }}>
            <SettingRow emoji="📎" label="Recipe Sources" value={`${activeSiteCount} active`} onPress={() => setActiveSheet("recipeSites")} />
            <SettingRow emoji="✨" label="Favourite Recipe Links" value={`${config.favouriteRecipes?.filter((r: string)=>r)?.length||0}`} onPress={() => setActiveSheet("favouriteRecipes")} />
            <SettingRow emoji="📝" label="Custom Recipes" value={`${config.customRecipes?.length||0}`} onPress={() => setActiveSheet("customRecipes")} />
          </View>

          {/* ── Past Plans ── */}
          <SectionHeader title="History" />
          <View className="bg-white rounded-2xl px-4 border border-gray-100" style={{ elevation:1 }}>
            <SettingRow emoji="📋" label="Past Plans" onPress={() => router.push("/past-plans")} />
          </View>

          {/* ── Account ── */}
          <SectionHeader title="Account" />
          <View className="bg-white rounded-2xl px-4 border border-gray-100" style={{ elevation:1 }}>
            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center gap-3">
                <Text style={{ fontSize:20 }}>📧</Text>
                <Text className="text-sm font-medium text-gray-700">Email</Text>
              </View>
              <Text className="text-sm text-gray-400" numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => setShowSignOut(true)}
            className="mt-6 py-3.5 border-2 border-red-100 rounded-2xl items-center" activeOpacity={0.8}>
            <Text className="text-red-500 text-sm font-medium">🚪 Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Household size ── */}
      <Sheet visible={activeSheet==="persons"} title="Household size" onClose={() => setActiveSheet(null)}>
        <View className="flex-row items-center gap-8 justify-center py-4">
          <TouchableOpacity onPress={() => setPersons(p=>Math.max(1,p-1))}
            className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center">
            <Text className="text-2xl font-bold text-gray-600">−</Text>
          </TouchableOpacity>
          <Text className="text-5xl font-bold text-green-600">{persons}</Text>
          <TouchableOpacity onPress={() => setPersons(p=>Math.min(10,p+1))}
            className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center">
            <Text className="text-2xl font-bold text-gray-600">+</Text>
          </TouchableOpacity>
        </View>
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Diet ── */}
      <Sheet visible={activeSheet==="diet"} title="Diet preference" onClose={() => setActiveSheet(null)}>
        <View className="gap-3 mb-4">
          {DIET_OPTIONS.map(d => (
            <TouchableOpacity key={d.value} onPress={() => setDiet(d.value)}
              className={`px-4 py-3 rounded-xl border-2 ${diet===d.value?"border-green-500 bg-green-50":"border-gray-100 bg-gray-50"}`}
              activeOpacity={0.7}>
              <Text className={`text-sm ${diet===d.value?"text-green-700 font-semibold":"text-gray-600"}`}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Cuisines ── */}
      <Sheet visible={activeSheet==="cuisines"} title="Cuisine preferences" onClose={() => setActiveSheet(null)}>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {CUISINE_OPTIONS.map(c => (
            <TouchableOpacity key={c} onPress={() => toggleCuisine(c)}
              className={`px-4 py-2 rounded-full border-2 ${cuisines.includes(c)?"border-green-500 bg-green-50":"border-gray-200"}`}
              activeOpacity={0.7}>
              <Text className={`text-sm ${cuisines.includes(c)?"text-green-700 font-semibold":"text-gray-500"}`}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Calories ── */}
      <Sheet visible={activeSheet==="calories"} title="Daily calorie target" onClose={() => setActiveSheet(null)}>
        <TextInput placeholder="e.g. 2000" value={calorieTarget} onChangeText={setCalorieTarget}
          keyboardType="number-pad"
          className="border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-gray-700 mb-2" />
        <Text className="text-xs text-gray-400 mb-4">Leave blank to disable. Shown as a soft alert only.</Text>
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Recipe Sources ── */}
      <Sheet visible={activeSheet==="recipeSites"} title="Recipe sources" onClose={() => setActiveSheet(null)}>
        <Text className="text-xs text-gray-400 mb-4">
          GharOS fetches recipes from these trusted sites. Turn off any you don't want.
        </Text>
        <View className="gap-2 mb-5">
          {DEFAULT_RECIPE_SITES.map((site) => {
            const isActive = !disabledDefaultSites.includes(site.url);
            return (
              <TouchableOpacity key={site.url} onPress={() => toggleDefaultSite(site.url)}
                className={`flex-row items-center gap-3 px-4 py-3 rounded-xl border-2 ${isActive?"border-green-200 bg-green-50":"border-gray-100 bg-gray-50 opacity-50"}`}
                activeOpacity={0.7}>
                <Text style={{ fontSize:22 }}>{site.emoji}</Text>
                <View className="flex-1 min-w-0">
                  <Text className={`text-sm font-semibold ${isActive?"text-green-800":"text-gray-500"}`}>{site.name}</Text>
                  <Text className="text-xs text-gray-400" numberOfLines={1}>{site.url}</Text>
                </View>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isActive?"border-green-500 bg-green-500":"border-gray-300"}`}>
                  {isActive && <Text className="text-white text-xs">✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add your own</Text>
        <View className="flex-row gap-2 mb-3">
          <TextInput placeholder="e.g. mycookingblog.com" value={customSiteInput}
            onChangeText={setCustomSiteInput} onSubmitEditing={addCustomSite}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700" />
          <TouchableOpacity onPress={addCustomSite} className="bg-green-500 rounded-xl px-4 py-2 items-center justify-center" activeOpacity={0.8}>
            <Text className="text-white text-sm font-semibold">Add</Text>
          </TouchableOpacity>
        </View>
        {recipeSites.length > 0 && (
          <View className="gap-1 mb-4">
            {recipeSites.map((site, i) => (
              <View key={i} className="flex-row items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <Text className="text-sm text-gray-600 flex-1">{site.url}</Text>
                <TouchableOpacity onPress={() => setRecipeSites(p=>p.filter((_,idx)=>idx!==i))}>
                  <Text className="text-gray-300 text-xl ml-2">×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <Text className="text-xs text-gray-400 mb-3">{activeSiteCount} source{activeSiteCount!==1?"s":""} active</Text>
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Favourite Recipe Links ── */}
      <Sheet visible={activeSheet==="favouriteRecipes"} title="My favourite recipe links" onClose={() => setActiveSheet(null)}>
        <Text className="text-xs text-gray-400 mb-3">Add recipe URLs — these seed your meal suggestions.</Text>
        <View className="gap-3 mb-4">
          {favouriteRecipes.map((r, i) => (
            <View key={i} className="flex-row gap-2 items-center">
              <TextInput placeholder={`Recipe URL ${i+1}`} value={r}
                onChangeText={v => { const u=[...favouriteRecipes]; u[i]=v; setFavouriteRecipes(u); }}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                autoCapitalize="none" keyboardType="url" />
              {favouriteRecipes.length > 1 && (
                <TouchableOpacity onPress={() => setFavouriteRecipes(p=>p.filter((_,idx)=>idx!==i))}>
                  <Text className="text-gray-300 text-xl">×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
        {favouriteRecipes.length < 10 && (
          <TouchableOpacity onPress={() => setFavouriteRecipes(p=>[...p,""])}
            className="border-2 border-dashed border-gray-200 rounded-xl py-3 items-center mb-4" activeOpacity={0.7}>
            <Text className="text-gray-400 text-sm">+ Add recipe ({favouriteRecipes.length}/10)</Text>
          </TouchableOpacity>
        )}
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Custom Recipes ── */}
      <Sheet visible={activeSheet==="customRecipes" && !editingRecipe} title="Custom recipes" onClose={() => setActiveSheet(null)}>
        <Text className="text-xs text-gray-400 mb-3">Recipes added manually.</Text>
        {customRecipes.length > 0 && (
          <View className="gap-2 mb-4">
            {customRecipes.map((r, i) => (
              <View key={i} className="bg-gray-50 rounded-xl px-3 py-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-700">{r.name}</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">{r.cuisine}{r.cookTime?` · ⏱ ${r.cookTime} min`:""}</Text>
                  </View>
                  <View className="flex-row gap-2 ml-2">
                    <TouchableOpacity onPress={() => setEditingRecipe({ ...r, index: i })}>
                      <Text className="text-xs text-green-500 font-medium">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCustomRecipes(p=>p.filter((_,idx)=>idx!==i))}>
                      <Text className="text-gray-300 text-xl leading-none">×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add manually</Text>
        <View className="border border-gray-100 rounded-xl p-3 bg-gray-50 gap-2 mb-4">
          <TextInput placeholder="Recipe name" value={newCustom.name}
            onChangeText={v => setNewCustom(p=>({...p,name:v}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white" />
          <TextInput placeholder="Recipe URL (optional)" value={newCustom.url}
            onChangeText={v => setNewCustom(p=>({...p,url:v}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            autoCapitalize="none" keyboardType="url" />
          <View className="border border-gray-200 rounded-lg bg-white px-3 py-2">
            <Text className="text-sm text-gray-400">
              Cuisine: {newCustom.cuisine || "tap to set"}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-1.5 mb-1">
            {["North Indian","South Indian","Maharashtrian","Gujarati","Bengali","Udupi","Continental","Pan-Indian"].map(c=>(
              <TouchableOpacity key={c} onPress={() => setNewCustom(p=>({...p,cuisine:c}))}
                className={`px-2.5 py-1 rounded-full border ${newCustom.cuisine===c?"border-green-500 bg-green-50":"border-gray-200"}`}
                activeOpacity={0.7}>
                <Text className={`text-xs ${newCustom.cuisine===c?"text-green-700 font-semibold":"text-gray-500"}`}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={addCustomRecipe}
            className="py-2 bg-gray-100 rounded-lg items-center" activeOpacity={0.8}>
            <Text className="text-sm font-medium text-gray-600">+ Add recipe</Text>
          </TouchableOpacity>
        </View>
        <SaveBtn onPress={() => saveConfig()} saving={saving} />
      </Sheet>

      {/* ── Edit Custom Recipe ── */}
      <Sheet visible={activeSheet==="customRecipes" && !!editingRecipe}
        title={editingRecipe ? `Edit — ${editingRecipe.name}` : ""}
        onClose={() => setEditingRecipe(null)}>
        {editingRecipe && (
          <View className="gap-3 mb-4">
            <View>
              <Text className="text-xs text-gray-400 mb-1">Recipe name</Text>
              <TextInput value={editingRecipe.name}
                onChangeText={v => setEditingRecipe((p: any)=>({...p,name:v}))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700" />
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-1">Cook time (min)</Text>
                <TextInput value={String(editingRecipe.cookTime||"")}
                  onChangeText={v => setEditingRecipe((p: any)=>({...p,cookTime:Number(v)}))}
                  keyboardType="number-pad"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-1">Cuisine</Text>
                <View className="flex-row flex-wrap gap-1">
                  {["North Indian","South Indian","Gujarati","Pan-Indian"].map(c=>(
                    <TouchableOpacity key={c} onPress={() => setEditingRecipe((p: any)=>({...p,cuisine:c}))}
                      className={`px-2 py-1 rounded-full border ${editingRecipe.cuisine===c?"border-green-500 bg-green-50":"border-gray-200"}`}
                      activeOpacity={0.7}>
                      <Text style={{fontSize:10}} className={editingRecipe.cuisine===c?"text-green-700 font-semibold":"text-gray-500"}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View className="flex-row gap-2">
              {["cal","protein","carbs","fat"].map(m => (
                <View key={m} className="flex-1">
                  <Text className="text-xs text-gray-400 text-center mb-1">{m}</Text>
                  <TextInput value={String(editingRecipe.macros?.[m]||"")}
                    onChangeText={v => setEditingRecipe((p: any)=>({...p,macros:{...p.macros,[m]:Number(v)}}))}
                    keyboardType="number-pad"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center text-gray-700" />
                </View>
              ))}
            </View>
          </View>
        )}
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => setEditingRecipe(null)}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl items-center" activeOpacity={0.8}>
            <Text className="text-gray-500 font-semibold text-sm">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            if (!editingRecipe) return;
            const updated = [...customRecipes];
            const { index, ...recipe } = editingRecipe;
            updated[index] = recipe;
            setCustomRecipes(updated);
            setEditingRecipe(null);
          }} className="flex-1 py-3 bg-green-500 rounded-xl items-center" activeOpacity={0.8}>
            <Text className="text-white font-semibold text-sm">Save changes</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* ── Favourites ── */}
      <Sheet visible={activeSheet==="favourites"} title="Favourite meals" onClose={() => setActiveSheet(null)}>
        {profile?.favourites?.length > 0 ? (
          <View className="gap-2">
            {profile.favourites.map((f: any, i: number) => (
              <View key={i} className="flex-row items-center gap-3 bg-gray-50 rounded-xl px-3 py-3">
                <Text style={{ fontSize:20 }}>❤️</Text>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700">{f.name}</Text>
                  <Text className="text-xs text-gray-400">{f.cuisine}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center py-8">
            <Text className="text-4xl mb-2">❤️</Text>
            <Text className="text-gray-400 text-sm text-center">
              No favourites yet. Mark meals as favourite from your weekly plan!
            </Text>
          </View>
        )}
      </Sheet>

      {/* ── Sign out ── */}
      <Modal visible={showSignOut} transparent animationType="slide" onRequestClose={() => setShowSignOut(false)}>
        <TouchableOpacity style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" }}
          activeOpacity={1} onPress={() => setShowSignOut(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View className="bg-white rounded-t-3xl px-6 py-8">
              <Text className="text-base font-bold text-gray-800 text-center mb-1">Sign out of GharOS?</Text>
              <Text className="text-sm text-gray-400 text-center mb-6">
                Your pantry and plans are safely saved to your account.
              </Text>
              <TouchableOpacity onPress={() => supabase.auth.signOut()}
                className="py-4 bg-red-500 rounded-2xl items-center mb-3">
                <Text className="text-white font-semibold">Sign out</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSignOut(false)} className="py-3 items-center">
                <Text className="text-gray-500 text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
