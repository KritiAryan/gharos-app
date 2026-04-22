"use client";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { extractRecipe, type ExtractedRecipe } from "./actions";

const DISH_ROLES   = ["hero", "side", "staple", "condiment", "snack"];
const DISH_TYPES   = ["gravy", "dry_sabzi", "dal", "rice", "roti", "chutney", "raita", "biryani", "salad", "bread", "sweet", "snack"];
const CUISINES     = ["north_indian", "south_indian", "east_indian", "west_indian", "pan_indian", "continental", "other"];
const REGIONS      = ["north_indian", "south_indian", "east_indian", "west_indian", "pan_indian", "other"];
const DIET_TAGS    = ["vegetarian", "vegan", "jain", "non_vegetarian", "eggetarian"];
const MEAL_TYPES   = ["breakfast", "lunch", "dinner", "snack", "dessert"];

const EMPTY_RECIPE = {
  canonical_name: "",
  display_name: "",
  description: "",
  cuisine: "",
  region: "",
  dish_role: "hero",
  dish_type: "",
  meal_types: [] as string[],
  diet_tags: [] as string[],
  prep_time_minutes: "" as string | number,
  cook_time_minutes: "" as string | number,
  total_time_minutes: "" as string | number,
  base_servings: 2,
  source_url: "",
  source_name: "",
  source_author: "",
  pairs_well_with: "",   // comma-separated string, converted to array on save
  key_ingredients: "",   // comma-separated
  ingredients: "[]",
  steps: "[]",
  tips: "[]",
  faqs: "[]",
  notes: "[]",
  prep_components: "[]",
  nutrition: "",
  verified: false,
  source_image_url: null as string | null,
  video_url: "" as string,
};

type FormState = typeof EMPTY_RECIPE;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative ${checked ? "bg-brand-primary" : "bg-brand-border"}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </div>
      <span className="text-sm text-brand-text">{label}</span>
    </label>
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

const inputCls = "w-full border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text";
const textareaCls = `${inputCls} font-mono text-xs resize-y`;

/** Convert ExtractedRecipe into form state */
function extractedToForm(e: ExtractedRecipe, url: string): FormState {
  return {
    canonical_name:      e.canonical_name ?? "",
    display_name:        e.display_name ?? "",
    description:         e.description ?? "",
    cuisine:             e.cuisine ?? "",
    region:              e.region ?? "",
    dish_role:           e.dish_role ?? "hero",
    dish_type:           e.dish_type ?? "",
    meal_types:          Array.isArray(e.meal_types) ? e.meal_types : [],
    diet_tags:           Array.isArray(e.diet_tags) ? e.diet_tags : [],
    prep_time_minutes:   e.prep_time_minutes ?? "",
    cook_time_minutes:   e.cook_time_minutes ?? "",
    total_time_minutes:  e.total_time_minutes ?? "",
    base_servings:       e.base_servings ?? 2,
    source_url:          url,
    source_name:         e.source_name ?? "",
    source_author:       e.source_author ?? "",
    pairs_well_with:     (e.pairs_well_with ?? []).join(", "),
    key_ingredients:     (e.key_ingredients ?? []).join(", "),
    ingredients:         JSON.stringify(e.ingredients ?? [], null, 2),
    steps:               JSON.stringify(e.steps ?? [], null, 2),
    prep_components:     JSON.stringify(e.prep_components ?? [], null, 2),
    tips:                JSON.stringify(e.tips ?? [], null, 2),
    faqs:                JSON.stringify(e.faqs ?? [], null, 2),
    notes:               JSON.stringify(e.notes ?? [], null, 2),
    nutrition:           e.nutrition ? JSON.stringify(e.nutrition, null, 2) : "",
    verified:            false,
    source_image_url:    e.source_image_url ?? null,
    video_url:           e.video_url ?? "",
  };
}

export default function NewRecipePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [extractUrl, setExtractUrl]   = useState("");
  const [extracting, startExtract]    = useTransition();
  const [extractError, setExtractError] = useState("");
  const [extracted, setExtracted]     = useState(false);

  const [form, setForm]       = useState<FormState>({ ...EMPTY_RECIPE });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  function setField(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function toggleArray(key: "meal_types" | "diet_tags", value: string) {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v: string) => v !== value)
        : [...f[key], value],
    }));
  }

  function validateJson(key: string, value: string): boolean {
    if (!value.trim()) { setJsonErrors(e => ({ ...e, [key]: "" })); return true; }
    try {
      JSON.parse(value);
      setJsonErrors(e => ({ ...e, [key]: "" }));
      return true;
    } catch {
      setJsonErrors(e => ({ ...e, [key]: "Invalid JSON" }));
      return false;
    }
  }

  // ── B1 Extraction ──────────────────────────────────────────────────────────
  function handleExtract() {
    if (!extractUrl.trim()) return;
    setExtractError("");
    startExtract(async () => {
      const result = await extractRecipe(extractUrl.trim());
      if (result.ok) {
        setForm(extractedToForm(result.data, extractUrl.trim()));
        setExtracted(true);
        setExtractError("");
      } else {
        setExtractError(result.error);
      }
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(verified: boolean) {
    setError("");

    if (!form.canonical_name || !form.display_name || !form.dish_role) {
      setError("Canonical name, display name, and dish role are required.");
      return;
    }

    const jsonFields = ["ingredients", "steps", "tips", "faqs", "notes", "prep_components"];
    const allValid = jsonFields.every(f => validateJson(f, form[f as keyof typeof form] as string));
    if (!allValid) { setError("Fix JSON errors before saving."); return; }

    setSaving(true);
    try {
      const parseOptional = (v: string) => { try { return v.trim() ? JSON.parse(v) : null; } catch { return null; } };
      const parseArr      = (v: string) => { try { return v.trim() ? JSON.parse(v) : []; } catch { return []; } };

      const payload = {
        canonical_name:      form.canonical_name.trim().toLowerCase().replace(/\s+/g, "_"),
        display_name:        form.display_name.trim(),
        description:         form.description || null,
        cuisine:             form.cuisine || null,
        region:              form.region || null,
        dish_role:           form.dish_role,
        dish_type:           form.dish_type || null,
        meal_types:          form.meal_types,
        diet_tags:           form.diet_tags,
        prep_time_minutes:   form.prep_time_minutes ? Number(form.prep_time_minutes) : null,
        cook_time_minutes:   form.cook_time_minutes ? Number(form.cook_time_minutes) : null,
        total_time_minutes:  form.total_time_minutes ? Number(form.total_time_minutes) : null,
        base_servings:       Number(form.base_servings),
        source_url:          form.source_url || null,
        source_name:         form.source_name || null,
        source_author:       form.source_author || null,
        pairs_well_with:     form.pairs_well_with ? form.pairs_well_with.split(",").map(s => s.trim()).filter(Boolean) : [],
        key_ingredients:     form.key_ingredients ? form.key_ingredients.split(",").map(s => s.trim()).filter(Boolean) : [],
        ingredients:         parseArr(form.ingredients),
        steps:               parseArr(form.steps),
        tips:                parseArr(form.tips),
        faqs:                parseArr(form.faqs),
        notes:               parseArr(form.notes),
        prep_components:     parseArr(form.prep_components),
        nutrition:           parseOptional(form.nutrition),
        source_image_url:    form.source_image_url || null,
        video_url:           form.video_url.trim() || null,
        verified,
        extraction_confidence: extracted ? "high" : "manual",
        extracted_at:        new Date().toISOString(),
      };

      const { data, error: err } = await supabase.from("recipes").insert(payload).select("id").single();
      if (err) throw err;
      router.push(`/recipes/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brand-text">Import Recipe</h1>
          <p className="text-brand-muted text-sm mt-0.5">
            Paste a URL to auto-extract, or fill in the form manually.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="border border-brand-border text-brand-text text-sm px-4 py-2 rounded-button hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-brand-primary text-white text-sm px-4 py-2 rounded-button hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save & Verify ✅"}
          </button>
        </div>
      </div>

      {/* ── B1 Extractor ──────────────────────────────────────────────────── */}
      <div className={`border rounded-card p-4 mb-6 transition-colors ${
        extracted
          ? "bg-green-50 border-green-200"
          : "bg-brand-accent/20 border-brand-accent"
      }`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{extracted ? "✅" : "🔬"}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-text">
              {extracted ? "B1 Extraction Complete — Review &amp; Edit Below" : "B1 Auto-Extraction"}
            </p>
            <p className="text-xs text-brand-muted mt-0.5 mb-3">
              {extracted
                ? "All fields have been pre-filled. Verify the JSON fields, then save."
                : "Paste a recipe URL and Agent B1 will extract all fields via Jina + Groq."}
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={extractUrl}
                onChange={e => setExtractUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleExtract()}
                placeholder="https://www.indianhealthyrecipes.com/palak-paneer…"
                disabled={extracting}
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={handleExtract}
                disabled={extracting || !extractUrl.trim()}
                className="bg-brand-primary text-white text-sm px-4 py-2 rounded-button hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              >
                {extracting ? "Extracting…" : extracted ? "Re-extract" : "Extract →"}
              </button>
            </div>
            {extracting && (
              <div className="mt-3 flex items-center gap-2 text-xs text-brand-muted">
                <span className="inline-block w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                Fetching via Jina reader + Groq LLM — takes 10–30 seconds…
              </div>
            )}
            {extractError && (
              <p className="mt-2 text-xs text-red-600 font-medium">⚠ {extractError}</p>
            )}
          </div>
        </div>

        {/* og:image preview */}
        {extracted && form.source_image_url && (
          <div className="mt-3 flex items-center gap-3 pt-3 border-t border-green-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.source_image_url}
              alt="Recipe preview"
              className="w-20 h-16 object-cover rounded-button border border-green-200"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <p className="text-xs font-medium text-brand-text">Source image detected</p>
              <p className="text-xs text-brand-muted break-all">{form.source_image_url}</p>
              <p className="text-xs text-brand-muted mt-0.5">
                This will be stored as <code className="text-brand-primary">source_image_url</code>.
                AI-generated image will replace it in Phase 5.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-button px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* ── Form fields ────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Identity */}
        <Section title="Identity">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel hint="lowercase_with_underscores, unique">Canonical Name *</FieldLabel>
              <input className={inputCls} value={form.canonical_name}
                onChange={e => setField("canonical_name", e.target.value.toLowerCase().replace(/\s+/g, "_"))} />
            </div>
            <div>
              <FieldLabel hint="Human-readable display name">Display Name *</FieldLabel>
              <input className={inputCls} value={form.display_name}
                onChange={e => setField("display_name", e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <FieldLabel>Description</FieldLabel>
            <textarea className={inputCls} rows={2} value={form.description}
              onChange={e => setField("description", e.target.value)} />
          </div>
        </Section>

        {/* Classification */}
        <Section title="Classification">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <FieldLabel>Dish Role *</FieldLabel>
              <Select value={form.dish_role} options={DISH_ROLES} onChange={v => setField("dish_role", v)} />
            </div>
            <div>
              <FieldLabel>Dish Type</FieldLabel>
              <Select value={form.dish_type} options={["", ...DISH_TYPES]} onChange={v => setField("dish_type", v)} />
            </div>
            <div>
              <FieldLabel>Cuisine</FieldLabel>
              <Select value={form.cuisine} options={["", ...CUISINES]} onChange={v => setField("cuisine", v)} />
            </div>
            <div>
              <FieldLabel>Region</FieldLabel>
              <Select value={form.region} options={["", ...REGIONS]} onChange={v => setField("region", v)} />
            </div>
          </div>
          <div className="mb-3">
            <FieldLabel>Meal Types</FieldLabel>
            <PillGroup options={MEAL_TYPES} selected={form.meal_types} onToggle={v => toggleArray("meal_types", v)} />
          </div>
          <div>
            <FieldLabel>Diet Tags</FieldLabel>
            <PillGroup options={DIET_TAGS} selected={form.diet_tags} onToggle={v => toggleArray("diet_tags", v)} />
          </div>
        </Section>

        {/* Timing & Serving */}
        <Section title="Timing &amp; Serving">
          <div className="grid grid-cols-4 gap-4">
            {[["prep_time_minutes","Prep Time (min)"],["cook_time_minutes","Cook Time (min)"],["total_time_minutes","Total Time (min)"],["base_servings","Base Servings"]].map(([key, label]) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input type="number" className={inputCls} value={form[key as keyof typeof form] as string}
                  onChange={e => setField(key, e.target.value)} />
              </div>
            ))}
          </div>
        </Section>

        {/* Source */}
        <Section title="Source">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <FieldLabel>Source URL</FieldLabel>
              <input className={inputCls} value={form.source_url}
                onChange={e => setField("source_url", e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <FieldLabel>Site Name</FieldLabel>
              <input className={inputCls} value={form.source_name}
                onChange={e => setField("source_name", e.target.value)} placeholder="indianhealthyrecipes.com" />
            </div>
            <div>
              <FieldLabel>Author</FieldLabel>
              <input className={inputCls} value={form.source_author}
                onChange={e => setField("source_author", e.target.value)} placeholder="Swasthi" />
            </div>
            <div className="col-span-3">
              <FieldLabel hint="YouTube URL if the page has an embedded recipe video">
                Video URL
              </FieldLabel>
              <input
                className={inputCls}
                value={form.video_url}
                onChange={e => setField("video_url", e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {form.video_url && isValidYouTube(form.video_url) && (
                <p className="text-xs text-brand-muted mt-1">
                  ✓ Recognised YouTube video — ID: <code className="text-brand-primary">{youTubeId(form.video_url)}</code>
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Pairing & Keys */}
        <Section title="Pairing &amp; Key Ingredients">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel hint="comma-separated canonical_names">Pairs Well With</FieldLabel>
              <input className={inputCls} value={form.pairs_well_with}
                onChange={e => setField("pairs_well_with", e.target.value)}
                placeholder="phulka, basmati_rice, jeera_rice" />
            </div>
            <div>
              <FieldLabel hint="3–5 defining ingredient canonical_ids">Key Ingredients</FieldLabel>
              <input className={inputCls} value={form.key_ingredients}
                onChange={e => setField("key_ingredients", e.target.value)}
                placeholder="paneer, spinach, onion, tomato" />
            </div>
          </div>
        </Section>

        {/* JSON fields */}
        {([
          ["ingredients",     "Ingredients (JSON array)",      `[{"canonical_id":"paneer","display_name":"Paneer","quantity":150,"unit":"grams","is_optional":false,"group":"main","notes":"","raw_text":"150 grams paneer, cubed"}]`],
          ["steps",           "Steps (JSON array)",             `[{"heading":"Preparation","steps":["Step 1 text","Step 2 text"]}]`],
          ["prep_components", "Prep Components (JSON array)",   `[{"id":"spinach_puree","task":"Blanch + blend spinach","time_minutes":10,"storage_options":[{"location":"refrigerator","shelf_life_days":2},{"location":"freezer","shelf_life_days":30}],"default_location":"refrigerator","portion_note":""}]`],
          ["tips",            "Tips (JSON array of strings)",   `["Use young tender spinach to avoid bitterness"]`],
          ["faqs",            "FAQs (JSON array)",              `[{"q":"Can you freeze?","a":"Yes, for up to a month."}]`],
          ["notes",           "Notes / Substitutions",          `["Substitute cashews with blanched almonds"]`],
          ["nutrition",       "Nutrition (JSON object, optional)", `{"calories":320,"protein_g":18,"carbs_g":12,"fat_g":22,"fiber_g":4}`],
        ] as [string, string, string][]).map(([key, label, placeholder]) => (
          <Section key={key} title={label}>
            <textarea
              className={`${textareaCls} ${jsonErrors[key] ? "border-red-400 ring-1 ring-red-400" : ""}`}
              rows={key === "ingredients" || key === "steps" || key === "prep_components" ? 8 : 4}
              value={form[key as keyof typeof form] as string}
              placeholder={placeholder}
              onChange={e => { setField(key, e.target.value); validateJson(key, e.target.value); }}
            />
            {jsonErrors[key] && <p className="text-red-500 text-xs mt-1">{jsonErrors[key]}</p>}
          </Section>
        ))}

        {/* Verified toggle */}
        <Section title="Quality">
          <Toggle label="Mark as verified" checked={form.verified} onChange={v => setField("verified", v)} />
          {extracted && (
            <p className="text-xs text-brand-muted mt-2">
              Extracted by B1 · Review all fields before verifying
            </p>
          )}
        </Section>
      </div>

      {/* Bottom save bar */}
      <div className="sticky bottom-0 bg-brand-bg border-t border-brand-border mt-8 -mx-8 px-8 py-4 flex justify-end gap-3">
        {error && <p className="text-red-600 text-sm self-center mr-auto">{error}</p>}
        <button onClick={() => handleSave(false)} disabled={saving}
          className="border border-brand-border text-brand-text text-sm px-4 py-2 rounded-button hover:bg-brand-border/30 disabled:opacity-50">
          Save Draft
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          className="bg-brand-primary text-white text-sm px-4 py-2 rounded-button hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save & Verify ✅"}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-card p-5">
      <h2 className="font-serif font-semibold text-brand-text mb-4 text-sm uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text">
      {options.map(o => <option key={o} value={o}>{o || "— select —"}</option>)}
    </select>
  );
}

function isValidYouTube(url: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[A-Za-z0-9_\-]{6,}/.test(url);
}

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_\-]{6,})/);
  return m?.[1] ?? null;
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
