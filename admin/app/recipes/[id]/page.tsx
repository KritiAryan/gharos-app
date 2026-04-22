"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { updateRecipe, deleteRecipe } from "./actions";
import { runAgentB2 } from "./run-b2";

const inputCls     = "w-full border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text";
const textareaCls  = `${inputCls} font-mono text-xs resize-y`;
const DISH_ROLES   = ["hero", "side", "staple", "condiment", "snack"];
const DISH_TYPES   = ["gravy", "dry_sabzi", "dal", "rice", "roti", "chutney", "raita", "biryani", "salad", "bread", "sweet", "snack"];
const CUISINES     = ["north_indian", "south_indian", "east_indian", "west_indian", "pan_indian", "continental", "other"];
const REGIONS      = ["north_indian", "south_indian", "east_indian", "west_indian", "pan_indian", "other"];
const DIET_TAGS    = ["vegetarian", "vegan", "jain", "non_vegetarian", "eggetarian"];
const MEAL_TYPES   = ["breakfast", "lunch", "dinner", "snack", "dessert"];

function jsonStr(val: unknown): string {
  if (!val) return "[]";
  if (typeof val === "string") return val;
  return JSON.stringify(val, null, 2);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-card p-5">
      <h2 className="font-serif font-semibold text-brand-text mb-4 text-sm uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1">
      <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wide">{children}</label>
      {hint && <p className="text-xs text-brand-muted/70 mt-0.5">{hint}</p>}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)}
      className="w-full border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text">
      {options.map(o => <option key={o} value={o}>{o || "— select —"}</option>)}
    </select>
  );
}

function PillGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onToggle(o)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            selected.includes(o)
              ? "bg-brand-primary text-white border-brand-primary"
              : "border-brand-border text-brand-text hover:bg-brand-border/30"
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function RecipeDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const supabase  = createClient();

  // `any` here is deliberate: the recipe shape is a wide JSONB bag; every
  // consumer site already casts the specific field it reads (`as string`,
  // `as number`, etc). Typing as `unknown` forces the same casts but
  // confuses TS's JSX ReactNode inference further down the tree.
  const [recipe, setRecipe]     = useState<Record<string, any> | null>(null);
  const [form, setForm]         = useState<Record<string, any>>({});
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState("");
  const [saved, setSaved]       = useState(false);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  // Agent B2
  const [runningB2, setRunningB2] = useState(false);
  const [b2Summary, setB2Summary] = useState<string>("");

  useEffect(() => {
    supabase.from("recipes").select("*").eq("id", id).single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError("Recipe not found."); return; }
        setRecipe(data);
        setForm({
          ...data,
          pairs_well_with: Array.isArray(data.pairs_well_with) ? data.pairs_well_with.join(", ") : "",
          key_ingredients: Array.isArray(data.key_ingredients) ? data.key_ingredients.join(", ") : "",
          ingredients:     jsonStr(data.ingredients),
          steps:           jsonStr(data.steps),
          tips:            jsonStr(data.tips),
          faqs:            jsonStr(data.faqs),
          notes:           jsonStr(data.notes),
          prep_components: jsonStr(data.prep_components),
          nutrition:       data.nutrition ? JSON.stringify(data.nutrition, null, 2) : "",
        });
      });
  }, [id]);

  function setField(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleArray(key: string, value: string) {
    const arr = (form[key] as string[]) ?? [];
    setField(key, arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  }

  function validateJson(key: string, value: string): boolean {
    if (!value) { setJsonErrors(e => ({ ...e, [key]: "" })); return true; }
    try {
      JSON.parse(value);
      setJsonErrors(e => ({ ...e, [key]: "" }));
      return true;
    } catch {
      setJsonErrors(e => ({ ...e, [key]: "Invalid JSON" }));
      return false;
    }
  }

  async function handleSave(verify?: boolean) {
    const jsonFields = ["ingredients", "steps", "tips", "faqs", "notes", "prep_components"];
    const allValid = jsonFields.every(f => validateJson(f, form[f] as string));
    if (!allValid) { setError("Fix JSON errors before saving."); return; }

    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      ...form,
      pairs_well_with:    typeof form.pairs_well_with === "string"
        ? form.pairs_well_with.split(",").map((s: string) => s.trim()).filter(Boolean) : form.pairs_well_with,
      key_ingredients:    typeof form.key_ingredients === "string"
        ? form.key_ingredients.split(",").map((s: string) => s.trim()).filter(Boolean) : form.key_ingredients,
      ingredients:        JSON.parse((form.ingredients as string) || "[]"),
      steps:              JSON.parse((form.steps as string) || "[]"),
      tips:               JSON.parse((form.tips as string) || "[]"),
      faqs:               JSON.parse((form.faqs as string) || "[]"),
      notes:              JSON.parse((form.notes as string) || "[]"),
      prep_components:    JSON.parse((form.prep_components as string) || "[]"),
      nutrition:          form.nutrition ? JSON.parse(form.nutrition as string) : null,
    };
    if (verify !== undefined) payload.verified = verify;
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    // total_time_minutes is a generated column; writing it throws 428C9.
    delete payload.total_time_minutes;

    const result = await updateRecipe(id, payload);
    if (!result.ok) {
      setError(`Update failed — ${result.error}`);
      console.error("[updateRecipe]", result.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  async function handleRunB2() {
    if (!confirm("Run Agent B2? This will OVERWRITE ingredients (canonical_ids), key_ingredients, and prep_components with B2's output. Unsaved form changes on other fields are preserved.")) return;
    setRunningB2(true);
    setB2Summary("");
    setError("");
    const result = await runAgentB2(id);
    if (!result.ok) {
      setError(`Agent B2 failed — ${result.error}`);
      setRunningB2(false);
      return;
    }
    // Reload recipe from DB so the form reflects B2's output.
    const { data } = await supabase.from("recipes").select("*").eq("id", id).single();
    if (data) {
      setRecipe(data);
      setForm((f: Record<string, any>) => ({
        ...f,
        key_ingredients: Array.isArray(data.key_ingredients) ? data.key_ingredients.join(", ") : "",
        ingredients:     jsonStr(data.ingredients),
        prep_components: jsonStr(data.prep_components),
      }));
    }
    const c = result.changes;
    setB2Summary(`Agent B2 done. ${c.ingredients_remapped} canonical_ids remapped · ${c.key_ingredients_count} key ingredients · ${c.prep_components_count} prep components.`);
    setRunningB2(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${recipe?.display_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const result = await deleteRecipe(id);
    if (!result.ok) {
      setError(`Delete failed — ${result.error}`);
      setDeleting(false);
      return;
    }
    router.push("/recipes");
  }

  if (!recipe && !error) return <div className="text-brand-muted text-sm p-4">Loading…</div>;
  if (error && !recipe) return <div className="text-red-600 text-sm p-4">{error}</div>;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-xs text-brand-muted hover:text-brand-text mb-1 flex items-center gap-1">
            ← Back
          </button>
          <h1 className="font-serif text-2xl font-bold text-brand-text">{recipe?.display_name as string}</h1>
          <p className="text-brand-muted text-xs mt-0.5 font-mono">{id}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleRunB2} disabled={runningB2 || saving}
            className="border border-purple-300 text-purple-700 text-sm px-3 py-2 rounded-button hover:bg-purple-50 disabled:opacity-50"
            title="Normalise canonical_ids + refine key_ingredients + generate prep_components using the catalog">
            {runningB2 ? "Running B2…" : "🧑‍🍳 Run Agent B2"}
          </button>
          {(recipe?.verified as boolean)
            ? <span className="text-xs text-green-600 font-medium self-center">✅ Verified</span>
            : <button onClick={() => handleSave(true)} disabled={saving}
                className="bg-green-600 text-white text-sm px-3 py-2 rounded-button hover:opacity-90 disabled:opacity-50">
                Verify ✅
              </button>
          }
          <button onClick={() => handleSave(false)} disabled={saving}
            className="border border-brand-border text-brand-text text-sm px-3 py-2 rounded-button hover:bg-brand-border/30 disabled:opacity-50">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
          <button onClick={() => handleSave((recipe?.verified as boolean) ? undefined : false)} disabled={saving}
            className="bg-brand-primary text-white text-sm px-3 py-2 rounded-button hover:opacity-90 disabled:opacity-50">
            Save Changes
          </button>
        </div>
      </div>

      {b2Summary && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 text-sm rounded-button px-4 py-3 mb-6">
          {b2Summary} <span className="text-purple-500">Review the updated fields below, then Save or Verify.</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-button px-4 py-3 mb-6">{error}</div>
      )}

      {/* Image preview */}
      {(recipe?.image_storage_path || recipe?.source_image_url) && (
        <div className="bg-brand-card border border-brand-border rounded-card p-4 mb-6 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.image_storage_path
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images/${recipe.image_storage_path}`
              : recipe.source_image_url as string}
            alt={recipe.display_name as string}
            className="w-24 h-24 rounded-card object-cover border border-brand-border"
          />
          <div>
            <p className="text-xs text-brand-muted mb-1">Recipe Image</p>
            <p className="text-xs font-mono text-brand-text break-all">{(recipe.image_storage_path || recipe.source_image_url) as string}</p>
            <button className="mt-2 text-xs text-brand-primary hover:underline opacity-50 cursor-not-allowed" disabled>
              🎨 Regenerate with Gemini (coming soon)
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Identity */}
        <Section title="Identity">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Canonical Name</FieldLabel>
              <input className={inputCls} value={(form.canonical_name as string) ?? ""}
                onChange={e => setField("canonical_name", e.target.value)} />
            </div>
            <div>
              <FieldLabel>Display Name</FieldLabel>
              <input className={inputCls} value={(form.display_name as string) ?? ""}
                onChange={e => setField("display_name", e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <FieldLabel>Description</FieldLabel>
            <textarea className={inputCls} rows={2} value={(form.description as string) ?? ""}
              onChange={e => setField("description", e.target.value)} />
          </div>
        </Section>

        {/* Classification */}
        <Section title="Classification">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              ["dish_role", "Dish Role", ["", ...DISH_ROLES]],
              ["dish_type", "Dish Type", ["", ...DISH_TYPES]],
              ["cuisine",   "Cuisine",   ["", ...CUISINES]],
              ["region",    "Region",    ["", ...REGIONS]],
            ].map(([key, label, opts]) => (
              <div key={key as string}>
                <FieldLabel>{label as string}</FieldLabel>
                <Select value={(form[key as string] as string) ?? ""} options={opts as string[]}
                  onChange={v => setField(key as string, v)} />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <FieldLabel>Meal Types</FieldLabel>
            <PillGroup options={MEAL_TYPES} selected={(form.meal_types as string[]) ?? []}
              onToggle={v => toggleArray("meal_types", v)} />
          </div>
          <div>
            <FieldLabel>Diet Tags</FieldLabel>
            <PillGroup options={DIET_TAGS} selected={(form.diet_tags as string[]) ?? []}
              onToggle={v => toggleArray("diet_tags", v)} />
          </div>
        </Section>

        {/* Timing */}
        <Section title="Timing & Serving">
          <div className="grid grid-cols-4 gap-4">
            {[["prep_time_minutes","Prep (min)"],["cook_time_minutes","Cook (min)"],["total_time_minutes","Total (min)"],["base_servings","Servings"]].map(([k,l]) => (
              <div key={k}>
                <FieldLabel>{l}</FieldLabel>
                <input type="number" className={inputCls} value={(form[k] as number) ?? ""}
                  onChange={e => setField(k, e.target.value ? Number(e.target.value) : null)} />
              </div>
            ))}
          </div>
        </Section>

        {/* Source */}
        <Section title="Source">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <FieldLabel>Source URL</FieldLabel>
              <input className={inputCls} value={(form.source_url as string) ?? ""}
                onChange={e => setField("source_url", e.target.value)} />
            </div>
            <div>
              <FieldLabel>Site Name</FieldLabel>
              <input className={inputCls} value={(form.source_name as string) ?? ""}
                onChange={e => setField("source_name", e.target.value)} />
            </div>
            <div>
              <FieldLabel>Author</FieldLabel>
              <input className={inputCls} value={(form.source_author as string) ?? ""}
                onChange={e => setField("source_author", e.target.value)} />
            </div>
            <div className="col-span-3">
              <FieldLabel hint="YouTube URL if the source page has an embedded video">Video URL</FieldLabel>
              <input className={inputCls} value={(form.video_url as string) ?? ""}
                onChange={e => setField("video_url", e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…" />
            </div>
          </div>
        </Section>

        {/* Pairing */}
        <Section title="Pairing & Key Ingredients">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel hint="comma-separated">Pairs Well With</FieldLabel>
              <input className={inputCls} value={(form.pairs_well_with as string) ?? ""}
                onChange={e => setField("pairs_well_with", e.target.value)} />
            </div>
            <div>
              <FieldLabel hint="comma-separated canonical_ids">Key Ingredients</FieldLabel>
              <input className={inputCls} value={(form.key_ingredients as string) ?? ""}
                onChange={e => setField("key_ingredients", e.target.value)} />
            </div>
          </div>
        </Section>

        {/* JSON fields */}
        {([
          ["ingredients",     "Ingredients (JSON)"],
          ["steps",           "Steps (JSON)"],
          ["prep_components", "Prep Components (JSON)"],
          ["tips",            "Tips (JSON)"],
          ["faqs",            "FAQs (JSON)"],
          ["notes",           "Notes / Substitutions (JSON)"],
          ["nutrition",       "Nutrition (JSON, optional)"],
        ] as [string, string][]).map(([key, label]) => (
          <Section key={key} title={label}>
            <textarea
              className={`${textareaCls} ${jsonErrors[key] ? "border-red-400 ring-1 ring-red-400" : ""}`}
              rows={6}
              value={(form[key] as string) ?? ""}
              onChange={e => { setField(key, e.target.value); validateJson(key, e.target.value); }}
            />
            {jsonErrors[key] && <p className="text-red-500 text-xs mt-1">{jsonErrors[key]}</p>}
          </Section>
        ))}

        {/* Danger zone */}
        <Section title="Danger Zone">
          <button onClick={handleDelete} disabled={deleting}
            className="border border-red-300 text-red-600 text-sm px-4 py-2 rounded-button hover:bg-red-50 disabled:opacity-50">
            {deleting ? "Deleting…" : "🗑 Delete Recipe"}
          </button>
          <p className="text-xs text-brand-muted mt-2">This permanently deletes the recipe and cannot be undone.</p>
        </Section>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 bg-brand-bg border-t border-brand-border mt-8 -mx-8 px-8 py-4 flex justify-end gap-3">
        {saved && <p className="text-green-600 text-sm self-center mr-auto">✓ Changes saved</p>}
        {error && <p className="text-red-600 text-sm self-center mr-auto">{error}</p>}
        <button onClick={() => handleSave()} disabled={saving}
          className="bg-brand-primary text-white text-sm px-4 py-2 rounded-button hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
