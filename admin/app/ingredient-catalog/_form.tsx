"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIngredient, updateIngredient, deleteIngredient, type IngredientPayload } from "./actions";

// Categories match the Phase 3 seed taxonomy.
const CATEGORIES = [
  "spice_whole", "spice_ground", "herb_fresh", "herb_dried",
  "lentil", "bean", "grain", "flour",
  "vegetable", "leafy_green", "root_vegetable", "fruit",
  "dairy", "paneer_tofu", "egg", "meat", "seafood",
  "oil_fat", "nut_seed", "dried_fruit",
  "sweetener", "salt", "acid",
  "paste_compound", "condiment_sauce", "stock_broth",
  "leavening", "other",
];

const UNITS = [
  "teaspoon", "tablespoon", "cup", "gram", "ml",
  "piece", "clove", "inch", "pinch",
];

const inputCls    = "w-full border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text";
const textareaCls = `${inputCls} resize-y`;
const labelCls    = "block text-xs font-medium text-brand-muted uppercase tracking-wide mb-1.5";

type Props = {
  mode: "create" | "edit";
  initial?: Partial<IngredientPayload>;
};

export default function IngredientForm({ mode, initial }: Props) {
  const router = useRouter();

  const [canonicalId, setCanonicalId] = useState(initial?.canonical_id ?? "");
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [category,    setCategory]    = useState(initial?.category     ?? "");
  const [unitDefault, setUnitDefault] = useState(initial?.unit_default ?? "");
  const [aliasesStr,  setAliasesStr]  = useState((initial?.aliases   ?? []).join(", "));
  const [allergensStr,setAllergensStr]= useState((initial?.allergens ?? []).join(", "));
  const [seasonStr,   setSeasonStr]   = useState((initial?.season    ?? []).join(", "));
  const [isStaple,    setIsStaple]    = useState(initial?.is_staple ?? false);
  const [verified,    setVerified]    = useState(initial?.verified ?? true);
  const [notes,       setNotes]       = useState(initial?.notes ?? "");

  const [saving, startSaving]   = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState("");

  const parseList = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

  const buildPayload = (): IngredientPayload => ({
    canonical_id:  canonicalId.trim().toLowerCase().replace(/\s+/g, "_"),
    display_name:  displayName.trim(),
    category:      category || null,
    unit_default:  unitDefault || null,
    aliases:       parseList(aliasesStr),
    allergens:     parseList(allergensStr),
    season:        parseList(seasonStr),
    is_staple:     isStaple,
    verified,
    notes:         notes.trim() || null,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = buildPayload();
    if (!payload.canonical_id) { setError("canonical_id is required"); return; }
    if (!payload.display_name) { setError("display_name is required"); return; }

    startSaving(async () => {
      const result = mode === "create"
        ? await createIngredient(payload)
        : await updateIngredient(payload.canonical_id, payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "create") {
        router.push(`/ingredient-catalog/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (mode !== "edit" || !initial?.canonical_id) return;
    if (!confirm(`Delete "${initial.display_name}"? Any recipe that references ${initial.canonical_id} will break.`)) return;
    startDelete(async () => {
      const result = await deleteIngredient(initial.canonical_id!);
      if (!result.ok) { setError(result.error); return; }
      router.push("/ingredient-catalog");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Canonical ID *</label>
          <input className={`${inputCls} font-mono`} value={canonicalId}
            onChange={e => setCanonicalId(e.target.value)}
            placeholder="e.g. turmeric_powder"
            disabled={mode === "edit"} />
          {mode === "create" && <p className="text-xs text-brand-muted mt-1">Lowercase, snake_case. Cannot be changed after creation.</p>}
        </div>
        <div>
          <label className={labelCls}>Display Name *</label>
          <input className={inputCls} value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Turmeric Powder" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category ?? ""} onChange={e => setCategory(e.target.value)}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Default Unit</label>
          <select className={inputCls} value={unitDefault ?? ""} onChange={e => setUnitDefault(e.target.value)}>
            <option value="">—</option>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Aliases</label>
        <input className={inputCls} value={aliasesStr}
          onChange={e => setAliasesStr(e.target.value)}
          placeholder="comma-separated: haldi, manjal, turmeric" />
        <p className="text-xs text-brand-muted mt-1">Regional names, synonyms — used for pantry/shopping matching.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Allergens</label>
          <input className={inputCls} value={allergensStr}
            onChange={e => setAllergensStr(e.target.value)}
            placeholder="comma-separated: dairy, nuts" />
        </div>
        <div>
          <label className={labelCls}>Seasons</label>
          <input className={inputCls} value={seasonStr}
            onChange={e => setSeasonStr(e.target.value)}
            placeholder="comma-separated: winter, monsoon" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={textareaCls} rows={3} value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Storage tips, substitution notes, etc." />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
          <input type="checkbox" checked={isStaple} onChange={e => setIsStaple(e.target.checked)} />
          Staple (always in pantry)
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
          <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />
          Verified
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-button px-4 py-3">{error}</div>
      )}

      <div className="flex items-center justify-between border-t border-brand-border pt-5">
        <div>
          {mode === "edit" && (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="border border-red-300 text-red-600 text-sm px-4 py-2 rounded-button hover:bg-red-50 disabled:opacity-50">
              {deleting ? "Deleting…" : "🗑 Delete"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/ingredient-catalog")}
            className="border border-brand-border text-brand-text text-sm px-4 py-2 rounded-button hover:bg-brand-border/30">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-button hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
