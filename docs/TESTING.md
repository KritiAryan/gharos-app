# GharOS Test Sheet

Living QA checklist. Add new sections as features ship. Check boxes only when you've
actually run the test — not when the code compiles.

Last updated: 2026-04-24 (Phase 7 added)

---

## Environment prep (run once per test session)

- [ ] Confirm Groq TPD (daily token) budget is not exhausted — resets at UTC midnight
      (~05:30 IST). A 429 with `x-ratelimit-reset-tokens` showing hours means TPD, not TPM.
- [ ] Confirm Gemini API key is set in Vercel prod env (`GEMINI_API_KEY`).
- [ ] Confirm Supabase URL + service role key are set in Vercel prod env.
- [ ] Metro/Expo started with `--clear` after any change under `services/`.

---

## Phase 4 — Agent B2 (catalog enrichment)

**How to run:** Admin panel → Recipes → any recipe → "Run B2". Watch Vercel function logs
if it fails.

- [ ] B2 succeeds end-to-end on a short recipe (<2k token input).
- [ ] B2 succeeds on a long recipe (markdown capped at 9k chars by design).
- [ ] B2 429 now surfaces `x-ratelimit-remaining-*` and reset times in the error message
      (check after next Vercel deploy).
- [ ] `diet_tags`, `meal_types`, `key_ingredients`, `dish_role` populate correctly.
- [ ] Recipe `verified` flag flips to true after manual review + save.

---

## Phase 5 — Gemini image generation

**How to run:** Admin panel → Recipes → any verified recipe → "Regenerate image".

- [ ] Migration `20260423_001_recipe_images_bucket.sql` has been run in Supabase SQL Editor.
- [ ] Bucket `recipe-images` is public, 5MB limit, png/jpeg/webp only.
- [ ] Image generates within 90s timeout.
- [ ] Image uploads to `{recipe_id}/{timestamp}.png`.
- [ ] `image_storage_path` column updates.
- [ ] Public URL loads in browser with `?v={updated_at}` cache-buster.
- [ ] **KNOWN ISSUE (deferred):** user reported a Gemini error — reproduce + log details.
      Check: is it an API key issue, quota, or content-policy refusal?

---

## Phase 6 part 1 — Scoring lab (admin panel)

**How to run:** Admin panel → `/scoring-lab`.

- [ ] Profile dropdown loads real users from Supabase.
- [ ] "Test profile" mode works without a real user.
- [ ] All 7 weight sliders respond; total does not need to sum to 1.
- [ ] Slot selector (breakfast/lunch/dinner) changes results.
- [ ] Tier pills filter correctly (T1 / T2 / T3 / Filtered / All).
- [ ] Expanding a row shows per-signal breakdown with `raw`, `weighted`, `explanation`.
- [ ] Filtered recipes show the rejection reason (e.g. "diet mismatch (non_veg vs veg)").
- [ ] Changing weights re-ranks rows live (via `useTransition`, no blocking spinner).

---

## Phase 6 part 2 — Mobile Agent A (catalog-based suggestions)

**Prerequisite:** ≥20 verified recipes matching the test user's profile cuisines.
Current seed threshold: `SEED_MIN = 20` in `services/agentA.ts`.

**How to run:**
```bash
cd C:\Users\kriti\Desktop\gharos-app
npx expo start --clear
```

Then on device: open app → meal suggestions → refresh.

### Sanity check (run first in Supabase SQL editor)

```sql
select cuisine, count(*)
from recipes
where verified = true
group by cuisine
order by count(*) desc;
```

Profile cuisines must each have ≥20 rows, OR temporarily lower `SEED_MIN` in `services/agentA.ts`.

### Metro log signals

- [ ] `[agentA] catalog returned N cards (from M verified)` → catalog path worked.
- [ ] `[agentA] catalog has only N verified … recipes — falling back to LLM` → under seed minimum.
- [ ] `[generateSuggestions] catalog path failed, falling back to LLM: …` → real error,
      capture the message.

### Card-level checks

- [ ] `whyRecommended` shows signal explanations (e.g. `"4/5 key ingredients in pantry · never shown before"`),
      NOT Gemini prose.
- [ ] Tapping a card opens a real Supabase recipe — ingredients + steps match the DB row.
- [ ] Cards have `tier` = "T1" or "T2" (not "T3"; T3 is filtered out by pool).
- [ ] `extraIngredients` count matches how many key ingredients are NOT in user's pantry.
- [ ] `isFavourite = true` for recipes the user has favourited.
- [ ] Images load (Supabase storage URL or `source_image_url` fallback).

### Novelty + variety (needs `meal_history` rows)

- [ ] Refresh twice in quick succession — second refresh should show different top cards
      because scoring considers novelty.
- [ ] A recipe shown yesterday should score lower on novelty than one from 10+ days ago.
      Check the scoring lab's breakdown to confirm numbers.

### Diet hard filter

- [ ] Set profile diet = `vegan` — verify no eggetarian/vegetarian-only recipes appear.
- [ ] Set profile diet = `vegetarian` — verify vegan + jain recipes also appear.
- [ ] Set profile diet = `non_vegetarian` — verify everything appears (no filter).

---

## Phase 7 — Agent E (deterministic prep planner)

**Prerequisite:** At least some meals in the weekly plan must be catalog cards (i.e. have
`recipe_id` set — cards returned by Agent A catalog path). If all meals are LLM-invented,
Agent E falls back to the old LLM plan automatically.

**How to run:**
1. Build a weekly plan in the app (meal suggestions → select meals → weekly plan → save).
2. Navigate to the Meal Prep screen.
3. Watch Metro logs for Agent E signals.

### Metro log signals

- [ ] `[agentE] catalog plan: N weekend session(s), M evening prep(s), K daily cook card(s)`
      → deterministic path fired.
- [ ] `[agentE] no catalog meals in plan — falling back to LLM` → all meals are LLM-invented;
      verify at least some cards come from the catalog (Phase 6 part 2 must be working).
- [ ] `[agentE] catalog has no weekendPrep/eveningPrep — falling back to LLM` → all
      prep_components are short (<20 min); check the recipes' B2 data has meaningful components.
- [ ] `[generatePrepPlan] catalog path failed, falling back to LLM: …` → Supabase error,
      capture the message.

### Weekend prep checks

- [ ] Saturday session exists and contains heavy tasks (cook_base, boil, long marination).
- [ ] Sunday session exists (if any) and contains light tasks (chop, dough, grind).
- [ ] A shared base used by multiple recipes (e.g. onion-tomato base in Palak Paneer +
      Mushroom Masala) appears as **one task** with both meal names in `forMeals` —
      not duplicated.
- [ ] `estimatedTime` on each session = sum of task `estimatedMinutes`. Roughly:
      Saturday 30–90 min, Sunday 10–40 min.
- [ ] `storageNote` is present and mentions location + shelf life
      (e.g. "Fridge in airtight container, up to 3 days").

### Evening-before checks

- [ ] Recipes with a long soak (≥4h) appear in `weekdayEveningPrep`, NOT in weekend prep.
      Example: Maa Ki Dal (480 min soak) on Wednesday → soak reminder on Tuesday.
- [ ] The day name in `weekdayEveningPrep` is the day *before* the meal day
      (Monday meal → "sunday" evening; Wednesday meal → "tuesday" evening).
- [ ] Same soak component for the same meal is not duplicated if it appears in multiple slots.

### Daily cook card checks

- [ ] Every day in the weekly plan has a daily cook card entry.
- [ ] `estimatedCookMinutes` is less than the recipe's `total_time_minutes` for meals
      that have weekend-prepped components (time savings applied).
- [ ] `estimatedCookMinutes` is at least 10 (floor enforced in code).
- [ ] `preppedItems` lists what was prepped on the weekend for that meal
      (e.g. "Sauté onion-tomato-cashew base and blend (prepped on weekend)").
- [ ] Meals without a `recipe_id` (LLM-invented cards) still appear in daily cook cards
      with their original `cookTime` and empty `preppedItems` — no crash.

### Data quality checks

- [ ] Recipes where B2 populated `prep_components` without a `category` field still
      classify correctly — they fall back to Saturday for weekend tasks.
      **KNOWN ISSUE:** some older B2 runs omit `category`. Re-running B2 on those
      recipes will fix it. Tracked in ROADMAP.md backlog.

### Fallback behaviour

- [ ] Create a plan using only LLM-invented cards (before catalog has ≥20 recipes) →
      Metro log shows LLM fallback, prep screen still renders (LLM plan, not blank).

---

## Phase 8 — Card UI "show why" (NOT STARTED)

_Add checklist when implementation begins._

---

## Cross-cutting / regression

- [ ] Recipe save via `/recipes/new` does NOT throw `recipes_region_check` on values like
      "indian" (alias normaliser handles it).
- [ ] Recipe update via `/recipes/[id]` does NOT throw `recipes_region_check`.
- [ ] Mobile typecheck (`npx tsc --noEmit -p tsconfig.json`) passes for `services/*.ts`
      (admin/ and app-example/ noise is out of scope).
- [ ] Admin typecheck (`npx tsc --noEmit -p admin/tsconfig.json`) passes.

---

## How to add a new test section

1. Use `## Phase N — feature name` as the heading.
2. Put a one-line "how to run" instruction at the top.
3. Checkboxes in `- [ ] action + expected result` form.
4. Note any preconditions (migrations, env vars, seed data).
5. Mark known issues inline with `**KNOWN ISSUE:**`.
