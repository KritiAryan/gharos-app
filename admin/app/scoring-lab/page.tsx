"use client";

import { useEffect, useState, useTransition } from "react";
import { runScoringLab, listProfiles, type LabInput } from "./actions";
import type { ScoredRecipe, ScoringWeights } from "@/lib/scoring";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";

const DIETS     = ["vegetarian", "vegan", "jain", "eggetarian", "non_vegetarian"];
const CUISINES  = ["north_indian", "south_indian", "east_indian", "west_indian", "pan_indian", "continental"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const inputCls = "w-full border border-brand-border rounded-button px-2 py-1.5 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text";

function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide">{label}</label>
        <span className="text-xs text-brand-text font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-brand-primary" />
      {hint && <p className="text-[10px] text-brand-muted/70 mt-0.5">{hint}</p>}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === "T1"       ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : tier === "T2"     ? "bg-blue-50 border-blue-200 text-blue-700"
    : tier === "T3"     ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-red-50 border-red-200 text-red-600";
  return (
    <span className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold ${cls}`}>
      {tier}
    </span>
  );
}

export default function ScoringLabPage() {
  const [profiles,  setProfiles]  = useState<Array<{ id: string; email: string; full_name: string | null }>>([]);
  const [userId,    setUserId]    = useState<string>("");
  const [useTest,   setUseTest]   = useState(true);

  // Test profile (editable inline)
  const [diet,              setDiet]              = useState("vegetarian");
  const [cuisines,          setCuisines]          = useState<string[]>(["north_indian", "south_indian"]);
  const [calorieTarget,     setCalorieTarget]     = useState(500);
  const [pantryText,        setPantryText]        = useState("rice\ntoor_dal\nonion\ntomato\nginger\ngarlic\nturmeric_powder\ncumin_seeds\ngaram_masala\nsalt\noil\npaneer\nspinach");
  const [favouriteIdsText,  setFavouriteIdsText]  = useState("");
  const [mealSlot,          setMealSlot]          = useState("dinner");
  const [isWeekend,         setIsWeekend]         = useState(false);

  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);

  const [candidates, setCandidates] = useState<ScoredRecipe[]>([]);
  const [meta,       setMeta]       = useState<{ totalRecipes: number; filteredCount: number; t1Count: number; t2Count: number; t3Count: number; recentMealsCount: number } | null>(null);
  const [error,      setError]      = useState("");
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [pending, startTransition]  = useTransition();

  useEffect(() => {
    listProfiles().then(r => { if (r.ok) setProfiles(r.profiles); });
  }, []);

  function toggleCuisine(c: string) {
    setCuisines(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  }

  function setWeight<K extends keyof ScoringWeights>(k: K, v: number) {
    setWeights(w => ({ ...w, [k]: v }));
  }

  function handleRun() {
    setError("");
    setCandidates([]);
    setMeta(null);

    const input: LabInput = {
      mealTypeSlot: mealSlot,
      isWeekend,
      weights,
    };

    if (useTest) {
      input.testProfile = {
        diet,
        cuisines,
        pantryIds:          pantryText.split(/\s+|,/).map(s => s.trim()).filter(Boolean),
        favouriteRecipeIds: favouriteIdsText.split(/\s+|,/).map(s => s.trim()).filter(Boolean),
        calorieTargetPerMeal: calorieTarget,
      };
    } else {
      if (!userId) { setError("Pick a user or toggle Test Profile"); return; }
      input.userId = userId;
    }

    startTransition(async () => {
      const r = await runScoringLab(input);
      if (!r.ok) { setError(r.error); return; }
      setCandidates(r.candidates);
      setMeta(r.meta);
    });
  }

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const visibleCandidates = tierFilter === "ALL"
    ? candidates
    : candidates.filter(c => c.tier === tierFilter);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-brand-text mb-1">Scoring Lab</h1>
      <p className="text-brand-muted text-sm mb-8">
        Agent A — Phase 6 pantry-aware scoring preview. Score all verified recipes against a user
        profile, tune weights, and see which T1 candidates the LLM selector will pick from.
      </p>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* ───── Profile ───── */}
        <div className="bg-brand-card border border-brand-border rounded-card p-5">
          <h2 className="font-serif font-semibold text-brand-text mb-3 text-sm uppercase tracking-wide">Profile</h2>

          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm text-brand-text mb-2">
              <input type="checkbox" checked={useTest} onChange={e => setUseTest(e.target.checked)} />
              Use test profile
            </label>
            {!useTest && (
              <select value={userId} onChange={e => setUserId(e.target.value)} className={inputCls}>
                <option value="">— select user —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.email}{p.full_name ? ` (${p.full_name})` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {useTest && (
            <div className="space-y-2 text-sm">
              <div>
                <label className="text-xs text-brand-muted">Diet</label>
                <select value={diet} onChange={e => setDiet(e.target.value)} className={inputCls}>
                  {DIETS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-muted">Cuisines</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {CUISINES.map(c => (
                    <button key={c} type="button" onClick={() => toggleCuisine(c)}
                      className={`text-[10px] px-2 py-1 rounded-full border ${
                        cuisines.includes(c) ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text"
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted">Calorie target / meal</label>
                <input type="number" value={calorieTarget} onChange={e => setCalorieTarget(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-brand-muted">Pantry canonical_ids (one per line / comma-sep)</label>
                <textarea value={pantryText} onChange={e => setPantryText(e.target.value)}
                  rows={5} className={`${inputCls} font-mono text-xs resize-y`} />
              </div>
              <div>
                <label className="text-xs text-brand-muted">Favourite recipe IDs</label>
                <textarea value={favouriteIdsText} onChange={e => setFavouriteIdsText(e.target.value)}
                  rows={2} className={`${inputCls} font-mono text-xs resize-y`}
                  placeholder="(optional) recipe UUIDs, one per line" />
              </div>
            </div>
          )}
        </div>

        {/* ───── Slot ───── */}
        <div className="bg-brand-card border border-brand-border rounded-card p-5">
          <h2 className="font-serif font-semibold text-brand-text mb-3 text-sm uppercase tracking-wide">Slot</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-brand-muted">Meal type</label>
              <select value={mealSlot} onChange={e => setMealSlot(e.target.value)} className={inputCls}>
                {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-brand-text">
              <input type="checkbox" checked={isWeekend} onChange={e => setIsWeekend(e.target.checked)} />
              Weekend (allows heavier prep)
            </label>
            <button onClick={handleRun} disabled={pending}
              className="w-full bg-brand-primary text-white text-sm px-4 py-2 rounded-button hover:opacity-90 disabled:opacity-50 mt-4">
              {pending ? "Scoring…" : "⚖️  Run Scoring"}
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>

        {/* ───── Weights ───── */}
        <div className="bg-brand-card border border-brand-border rounded-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif font-semibold text-brand-text text-sm uppercase tracking-wide">Weights</h2>
            <span className={`text-xs ${Math.abs(weightSum - 1) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
              sum {(weightSum * 100).toFixed(0)}%
            </span>
          </div>
          <div className="space-y-3">
            <Slider label="Pantry match"    value={weights.pantry_match}    onChange={v => setWeight("pantry_match", v)}    hint="% of key ingredients in pantry" />
            <Slider label="Novelty"         value={weights.novelty}         onChange={v => setWeight("novelty", v)}         hint="not shown in last 14 days" />
            <Slider label="Favourite"       value={weights.favourite}       onChange={v => setWeight("favourite", v)}       hint="boost for saved favourites" />
            <Slider label="Calorie fit"     value={weights.calorie_fit}     onChange={v => setWeight("calorie_fit", v)}     hint="closeness to target kcal" />
            <Slider label="Cuisine variety" value={weights.cuisine_variety} onChange={v => setWeight("cuisine_variety", v)} hint="under-represented cuisine bonus" />
            <Slider label="Prep load"       value={weights.prep_load}       onChange={v => setWeight("prep_load", v)}       hint="lighter weekdays, heavier weekends" />
            <Slider label="Seasonality"     value={weights.seasonality}     onChange={v => setWeight("seasonality", v)}     hint="not implemented yet — neutral 0.5" />
          </div>
          <button onClick={() => setWeights(DEFAULT_WEIGHTS)}
            className="text-[10px] text-brand-muted hover:text-brand-text mt-3 underline">
            reset defaults
          </button>
        </div>
      </div>

      {/* ───── Meta / filter bar ───── */}
      {meta && (
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-brand-muted">
          <span>{meta.totalRecipes} recipes</span>
          <span>·</span>
          <button onClick={() => setTierFilter("T1")}
            className={`px-2 py-0.5 rounded-full border ${tierFilter === "T1" ? "bg-emerald-50 border-emerald-300" : "border-brand-border"}`}>
            T1 ({meta.t1Count})
          </button>
          <button onClick={() => setTierFilter("T2")}
            className={`px-2 py-0.5 rounded-full border ${tierFilter === "T2" ? "bg-blue-50 border-blue-300" : "border-brand-border"}`}>
            T2 ({meta.t2Count})
          </button>
          <button onClick={() => setTierFilter("T3")}
            className={`px-2 py-0.5 rounded-full border ${tierFilter === "T3" ? "bg-amber-50 border-amber-300" : "border-brand-border"}`}>
            T3 ({meta.t3Count})
          </button>
          <button onClick={() => setTierFilter("FILTERED")}
            className={`px-2 py-0.5 rounded-full border ${tierFilter === "FILTERED" ? "bg-red-50 border-red-300" : "border-brand-border"}`}>
            Filtered ({meta.filteredCount})
          </button>
          <button onClick={() => setTierFilter("ALL")}
            className={`px-2 py-0.5 rounded-full border ${tierFilter === "ALL" ? "bg-brand-bg border-brand-text" : "border-brand-border"}`}>
            All
          </button>
          <span className="ml-auto text-xs">meal_history recent: {meta.recentMealsCount}</span>
        </div>
      )}

      {/* ───── Ranked candidates ───── */}
      {visibleCandidates.length > 0 && (
        <div className="space-y-2">
          {visibleCandidates.slice(0, 100).map((c, i) => (
            <div key={c.recipe.id} className="bg-brand-card border border-brand-border rounded-card overflow-hidden">
              <button
                className="w-full p-3 flex items-center gap-3 hover:bg-brand-bg/50 transition-colors text-left"
                onClick={() => setExpanded(s => {
                  const n = new Set(s); n.has(c.recipe.id) ? n.delete(c.recipe.id) : n.add(c.recipe.id); return n;
                })}
              >
                <span className="text-xs text-brand-muted font-mono w-6">{i + 1}</span>
                <TierBadge tier={c.tier} />
                <span className="font-semibold text-brand-text flex-1 truncate">{c.recipe.display_name}</span>
                <span className="text-xs text-brand-muted">{c.recipe.cuisine ?? "—"}</span>
                <span className="text-xs text-brand-muted">{c.recipe.dish_type ?? "—"}</span>
                <span className="font-mono text-sm text-brand-text w-16 text-right">
                  {c.tier === "FILTERED" ? "—" : c.score.toFixed(3)}
                </span>
              </button>
              {expanded.has(c.recipe.id) && (
                <div className="px-3 pb-3 border-t border-brand-border bg-brand-bg/30">
                  {c.filteredReason ? (
                    <p className="text-xs text-red-600 mt-2">Filtered: {c.filteredReason}</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {(Object.entries(c.breakdown) as Array<[string, { raw: number; weighted: number; explanation: string }]>).map(([k, s]) => (
                        <div key={k} className="flex items-baseline gap-2">
                          <span className="text-brand-muted w-28 shrink-0">{k.replace(/_/g, " ")}</span>
                          <span className="font-mono text-brand-text w-12 shrink-0">{s.raw.toFixed(2)}</span>
                          <span className="font-mono text-brand-muted w-12 shrink-0">+{s.weighted.toFixed(3)}</span>
                          <span className="text-brand-muted text-[11px] truncate">{s.explanation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-brand-muted mt-2 font-mono break-all">id: {c.recipe.id}</p>
                </div>
              )}
            </div>
          ))}
          {visibleCandidates.length > 100 && (
            <p className="text-xs text-brand-muted text-center py-2">
              Showing top 100 of {visibleCandidates.length}.
            </p>
          )}
        </div>
      )}

      {!pending && candidates.length === 0 && !error && (
        <div className="bg-brand-card border border-brand-border rounded-card p-8 text-center">
          <p className="text-4xl mb-3">⚖️</p>
          <p className="text-sm text-brand-muted">
            Pick a profile (or use the test one), adjust weights, and click Run Scoring.
          </p>
        </div>
      )}
    </div>
  );
}
