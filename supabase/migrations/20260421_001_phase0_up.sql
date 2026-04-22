-- ============================================================
-- PHASE 0 UP MIGRATION: GharOS Recipe Architecture
-- Creates: recipes, ingredient_catalog, meal_history
-- NOTE: existing recipe_db table is left untouched (parallel)
-- Run this in Supabase SQL Editor
-- ============================================================


-- ─────────────────────────────────────────
-- 1. RECIPES
-- Atomic recipe table. Each row = one dish (palak paneer,
-- jeera rice, cucumber raita). Heroes, sides, staples, all here.
-- ─────────────────────────────────────────

CREATE TABLE recipes (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name        text NOT NULL UNIQUE,       -- 'palak_paneer'
  display_name          text NOT NULL,              -- 'Palak Paneer'
  description           text,

  -- Classification
  cuisine               text,                       -- 'north_indian', 'south_indian', etc.
  region                text CHECK (region IN (
                          'north_indian','south_indian','east_indian',
                          'west_indian','pan_indian','continental','other'
                        )),
  meal_types            text[]  DEFAULT '{}',       -- ['lunch','dinner']
  diet_tags             text[]  DEFAULT '{}',       -- ['vegetarian','vegan','jain','non_vegetarian','eggetarian']
  dish_role             text NOT NULL CHECK (dish_role IN (
                          'hero','side','staple','condiment','snack'
                        )),
  dish_type             text,                       -- 'gravy','dry_sabzi','dal','rice','roti',
                                                    -- 'chutney','raita','biryani','salad','bread','sweet'

  -- Media
  source_image_url      text,                       -- og:image from source page (reference only)
  image_storage_path    text,                       -- supabase storage: 'recipe-images/{id}.webp'
  image_prompt          text,                       -- the Gemini prompt used to generate the image

  -- Timing & serving
  prep_time_minutes     integer,
  cook_time_minutes     integer,
  -- Generated column — prep + cook. NEVER write to this directly
  -- (Postgres throws 428C9 on INSERT/UPDATE). NULLs propagate: if
  -- either input is NULL, total_time_minutes is NULL.
  total_time_minutes    integer GENERATED ALWAYS AS
                          (prep_time_minutes + cook_time_minutes) STORED,
  base_servings         integer DEFAULT 2,

  -- Core content (required)
  -- ingredients: array of {
  --   canonical_id, display_name, quantity, unit, quantity_us,
  --   is_optional, group, notes, prep_hint
  -- }
  ingredients           jsonb   DEFAULT '[]',

  -- steps: array of { heading, steps: [text, ...] }
  steps                 jsonb   DEFAULT '[]',

  -- Rich content (nullable — not all sites have all)
  tips                  jsonb   DEFAULT '[]',       -- [text, ...]
  faqs                  jsonb   DEFAULT '[]',       -- [{q, a}, ...]
  notes                 jsonb   DEFAULT '[]',       -- substitution/scaling tips

  -- Pairing
  -- e.g. ["phulka","basmati_rice","jeera_rice","naan"]
  -- values are canonical_names of other recipes or generic dish-type strings
  pairs_well_with       jsonb   DEFAULT '[]',

  -- Nutrition per base_servings (nullable)
  -- {calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg}
  nutrition             jsonb,

  -- Scoring helpers
  key_ingredients       text[]  DEFAULT '{}',       -- canonical_ids of 3–5 defining ingredients

  -- Prep scheduling
  -- Array of {
  --   id, task, time_minutes,
  --   storage_options: [{location: 'refrigerator'|'freezer', shelf_life_days}],
  --   default_location, portion_note
  -- }
  prep_components       jsonb   DEFAULT '[]',

  -- Source provenance
  source_url            text,
  source_name           text,                       -- 'indianhealthyrecipes.com'
  source_author         text,                       -- 'Swasthi'
  source_updated        date,

  -- Quality control
  verified              boolean DEFAULT false,
  extraction_confidence text    CHECK (extraction_confidence IN ('high','medium','low')),
  extracted_at          timestamptz,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for common query patterns
CREATE INDEX idx_recipes_dish_role       ON recipes (dish_role);
CREATE INDEX idx_recipes_cuisine         ON recipes (cuisine);
CREATE INDEX idx_recipes_verified        ON recipes (verified);
CREATE INDEX idx_recipes_meal_types      ON recipes USING gin (meal_types);
CREATE INDEX idx_recipes_diet_tags       ON recipes USING gin (diet_tags);
CREATE INDEX idx_recipes_key_ingredients ON recipes USING gin (key_ingredients);

-- RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read verified recipes
CREATE POLICY "recipes_read"
  ON recipes FOR SELECT
  TO authenticated
  USING (true);

-- Only service role / admin can insert or update
-- (admin platform uses service_role key, mobile app uses anon/authenticated)
CREATE POLICY "recipes_write"
  ON recipes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────
-- 2. INGREDIENT_CATALOG
-- Single source of truth for every ingredient.
-- Recipes reference canonical_id from here.
-- ─────────────────────────────────────────

CREATE TABLE ingredient_catalog (
  canonical_id            text PRIMARY KEY,          -- 'paneer', 'spinach', 'cumin_seeds'
  display_name            text NOT NULL,             -- 'Paneer'

  -- All known names for this ingredient (used during extraction mapping)
  aliases                 text[]  DEFAULT '{}',      -- ['palak','spinach','palong']

  -- Classification
  category                text,                      -- 'dairy','leafy_greens','spice','grain',
                                                     -- 'pulse','vegetable','fruit','oil',
                                                     -- 'sweetener','condiment','protein','nut'
  subcategory             text,

  -- Behaviour flags
  is_staple               boolean DEFAULT false,     -- always in most Indian pantries
  is_spice                boolean DEFAULT false,     -- spice = minor buy (T1 tolerance)
  is_perishable           boolean DEFAULT false,

  -- Raw ingredient shelf life (uncooked, in fridge unless noted)
  shelf_life_days_fresh   integer,                   -- days in fridge
  shelf_life_days_frozen  integer,                   -- days in freezer (null if not freezable)

  -- Shopping list cost math
  typical_pack_unit       text,                      -- 'grams','ml','pieces','bunch','packet'
  typical_pack_size       numeric,                   -- e.g. 200 (grams), 1 (bunch)
  typical_cost_inr        integer,                   -- approx cost per pack in INR

  -- Substitutes (canonical_ids of alternatives)
  substitutes             text[]  DEFAULT '{}',      -- ['tofu','almond_flour']

  -- Pantry display
  default_pantry_category text,                      -- matches pantry sidebar labels
  emoji                   text,

  created_at              timestamptz DEFAULT now()
);

-- Index on aliases for fast lookup during extraction
CREATE INDEX idx_catalog_aliases ON ingredient_catalog USING gin (aliases);
CREATE INDEX idx_catalog_category ON ingredient_catalog (category);

-- RLS
ALTER TABLE ingredient_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_read"
  ON ingredient_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "catalog_write"
  ON ingredient_catalog FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────
-- 3. MEAL_HISTORY
-- Per-user history of what was scheduled/cooked.
-- Used by Agent A for variety enforcement (no same recipe
-- in last 14 days) and future preference learning.
-- ─────────────────────────────────────────

CREATE TABLE meal_history (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id               uuid REFERENCES meal_plans(id) ON DELETE SET NULL,
  recipe_id             uuid REFERENCES recipes(id) ON DELETE SET NULL,

  shown_at              timestamptz DEFAULT now(),  -- when scheduled in the plan
  cooked_at             timestamptz,                -- null = not yet cooked / skipped
  user_rating           smallint CHECK (user_rating BETWEEN 1 AND 5),

  -- Denormalised snapshot (so history survives recipe edits/deletes)
  recipe_canonical_name text,
  recipe_display_name   text,
  dish_role             text,
  cuisine               text,

  created_at            timestamptz DEFAULT now()
);

-- Indexes for scoring queries
CREATE INDEX idx_meal_history_user_id    ON meal_history (user_id);
CREATE INDEX idx_meal_history_shown_at   ON meal_history (shown_at);
CREATE INDEX idx_meal_history_recipe_id  ON meal_history (recipe_id);

-- Composite: "what did this user have in the last 14 days?"
CREATE INDEX idx_meal_history_user_recent
  ON meal_history (user_id, shown_at DESC);

-- RLS
ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_history_own"
  ON meal_history FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- DONE
-- Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('recipes','ingredient_catalog','meal_history');
-- ─────────────────────────────────────────
