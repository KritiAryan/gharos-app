# GharOS Product Roadmap

Living document. Anything we've discussed, scoped, or deferred goes here so it doesn't
get lost between sessions. Move items between sections as they progress.

Last updated: 2026-04-24 (Phase 7 shipped)

---

## Shipped

### Phase 1–3 — Foundations
- React Native + Expo mobile app scaffolded
- Next.js admin panel at `gharos-managerpanel.vercel.app`
- Supabase schema: `recipes`, `profiles`, `pantry`, `favourites`, `meal_history`
- Auth, profile onboarding, pantry/favourites UI

### Phase 4 — Agent B pipeline (URL → verified recipe)
- **B1**: Jina reader + Groq llama-3.3-70b extracts structured recipe from URL
- **B2**: Groq enriches with `diet_tags`, `meal_types`, `key_ingredients`, `dish_role`
- Admin review + verify UI
- `recipes_region_check` / `recipes_dish_role` enum normaliser (alias map)

### Phase 5 — Gemini image generation
- `gemini-2.5-flash-image-preview` with `responseModalities: ["IMAGE"]`
- Brand-consistent prompt builder (45° overhead, warm natural light, no text/faces)
- Supabase Storage bucket `recipe-images` (public, 5MB, png/jpeg/webp)
- 90s timeout, cache-buster via `updated_at`

### Phase 6 part 1 — Scoring lab
- Pure scoring module at `admin/lib/scoring.ts` (7 signals, hard filters, T1/T2/T3 tiering)
- Interactive admin tool at `/scoring-lab` with live weight tuning
- Default weights: pantry 30% / novelty 20% / favourite 15% / calorie 10% /
  cuisine variety 10% / prep load 10% / seasonality 5%

### Phase 7 — Agent E: Deterministic prep planner
- `services/agentE.ts`: generatePrepPlanFromCatalog() — classifies prep_components
  into EVENING_BEFORE (soak ≥4h), WEEKEND_PREP (≥20 min), or MORNING_OF (<20 min)
- Deduplicates shared bases across recipes (one task, multiple `forMeals`)
- Adjusts daily cook card times by subtracting prepped component time
- `services/geminiService.js`: tries catalog first, falls back to LLM Agent E
- Output shape unchanged — meal-prep.tsx requires zero changes

### Phase 6 part 2 — Mobile Agent A catalog mode
- `services/scoring.ts` — byte-for-byte mobile copy of admin scoring module
- `services/agentA.ts` — catalog-based suggestion pipeline
  (fetch verified recipes → score per slot → dedupe → rank → cards)
- `services/geminiService.js` — tries catalog first, falls back to LLM invention
- Seed threshold `SEED_MIN = 20` below which LLM fallback fires

---

## In progress

### Phase 6 part 2 — QA
- Blocked on seeding ≥20 verified recipes per profile cuisine.
- Once unblocked, validate end-to-end per `docs/TESTING.md` Phase 6 part 2 section.
- Expect: `whyRecommended` explanations from scoring, not Gemini prose.

---

## Planned — next up

### Phase 8 — Card UI "show why"
Scope:
- Surface `whyRecommended` + `tier` + `score` on the card or in a details drawer
- Let user tap "why this?" and see a breakdown of the 7 signals for that card
- Uses the same data Scoring Lab already computes per recipe

Rationale: trust + transparency — users should understand why a card was chosen so
they can override intelligently when the system is wrong.

### Phase 9 — Legacy cleanup
- Remove the old LLM-invents-cards path once catalog mode is stable for 2+ weeks
- Delete `generateSuggestionsLLM` fallback in `services/geminiService.js`
- Remove any now-dead prompt files

---

## Backlog

### Tuning + ops
- **Monorepo / shared package** for `scoring.ts` so admin + mobile stop drifting.
  Today: byte-for-byte copy with a scary warning header. Needs pnpm workspace or similar.
- **Scoring lab presets** — save named weight configurations (e.g. "busy weekday",
  "weekend cook", "kid-friendly") so we can A/B user profiles against known contexts.
- **Tier thresholds exposed** — currently hardcoded 20%/50%/30% in `rankAndTier`.
  Expose in admin UI.
- **Seasonality signal** — currently returns 0.5 placeholder. Needs ingredient
  seasonality data source (India-specific produce calendar).

### Agent E improvements
- **Re-run B2 on older recipes** to populate missing `category` field on `prep_components`.
  Some early imports have components without `category`, so Agent E falls back to Saturday
  as the default weekend day. Easily fixed by re-running B2 on those recipes in the admin panel.
- **Leftovers / reuse** — if a recipe makes 4 portions and the plan only needs 2, note that
  it covers another day. Skipped in v1 for complexity.
- **Notification reminders** — "It's 9pm Tuesday — start soaking dal for Wednesday dinner."
  Deferred pending push notification infrastructure.

### Agent B (import) improvements
- **B1 model downgrade to `llama-3.1-8b-instant`** — cheaper, higher TPM, extraction
  is mechanical enough. Keep B2 on 70b.
- **Groq Dev tier upgrade** — when free TPD becomes a pilot bottleneck. ~$0.06 per
  10 imports. Deferred until user decides.
- **Bulk import UI** — paste a list of URLs, queue them with auto-retry on 429.
- **Duplicate detection** — before B1, check if this URL or normalised title already
  exists. Saves tokens.

### Gemini image generation
- **Fix the deferred Gemini error** user reported.
- **Batch regenerate** — admin button to regenerate images for all verified recipes
  missing an image. Rate-limited.
- **Style refresh** — A/B different prompt styles and let user vote.

### Mobile app polish
- **Mobile tsconfig cleanup** — exclude `admin/` and `app-example/` from mobile's
  `tsc` include. Currently pulls ~40 files of @/lib resolution errors.
- **Offline cache of verified recipes** — Agent A should work even when Supabase is
  slow, at least with stale data from last fetch.
- **Favourite toggle from card** — currently requires opening detail view.
- **"Already cooked this week" chip** — visible on cards with recent `meal_history`.

### Data + analytics
- **Meal history writes** — confirm we log every shown card to `meal_history`.
  Without this, novelty signal is blind.
- **User feedback loop** — thumbs up/down on cards, stored, used to retune weights
  per user (Phase 10+).
- **Admin dashboard** — catalog coverage by cuisine, avg score by tier, rate of
  fallback-to-LLM over time.

### Notifications + reminders (speculative)
- Push notification: "Tomorrow's lunch is dal makhani — start soaking rajma tonight."
- Grocery list export from the week's selected cards minus pantry.

### Longer-term / speculative
- **Shared household mode** — multiple users on one pantry + meal plan.
- **Voice input** — "we just made paneer, add 200g to pantry."
- **Nutrition goal tracking** — weekly protein/fibre targets, score against them.
- **Integration with grocery delivery APIs** (BigBasket, Blinkit) for missing ingredients.

---

## Known issues / tech debt

- Mobile tsconfig pulls in admin + app-example files (noise, not breakage).
- `services/scoring.ts` and `admin/lib/scoring.ts` must stay byte-for-byte identical.
  Easy to forget during tuning. Monorepo fixes this.
- Groq free tier TPD caps at ~100k/day. Blocks bulk imports. Fix: paid tier or throttle.
- Gemini image generation has an open error (reported, deferred) — root cause TBD.
- Scoring lab tier thresholds (20/50/30) are hardcoded, not exposed in UI.
- No telemetry on fallback-to-LLM rate — can't tell in production how often catalog
  mode is actually serving cards vs silently falling back.

---

## How to add a new feature to this doc

1. Drop it under **Backlog** first. Don't invent priority.
2. Write 1–3 lines of scope. If it needs more, it's too big — split it.
3. Note the "why" briefly. A feature without a reason gets cut later.
4. Mark dependencies or blockers inline.
5. Move to **Planned** only when we've committed to doing it next.
6. Move to **In progress** when actively building.
7. Move to **Shipped** when QA checklist in `docs/TESTING.md` is green.
