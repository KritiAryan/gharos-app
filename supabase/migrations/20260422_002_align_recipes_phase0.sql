-- =============================================================
-- 20260422_002_align_recipes_phase0.sql
--
-- Brings the legacy `recipes` table in line with the Phase-0
-- schema (20260421_001_phase0_up.sql). Safe to run on a DB that
-- still has the pre-Phase-0 columns.
--
-- Renames keep data. Drops remove obsolete legacy columns.
-- Adds fill in everything the extractor expects.
-- =============================================================

BEGIN;

-- ── 1. Rename legacy columns to Phase-0 names (preserves data) ──
ALTER TABLE recipes RENAME COLUMN prep_time_mins    TO prep_time_minutes;
ALTER TABLE recipes RENAME COLUMN cook_time_mins    TO cook_time_minutes;
ALTER TABLE recipes RENAME COLUMN instructions      TO steps;
ALTER TABLE recipes RENAME COLUMN macros_per_serving TO nutrition;
ALTER TABLE recipes RENAME COLUMN image_url         TO source_image_url;

-- total_time_mins → total_time_minutes, but make it a GENERATED column
-- (matching Phase-0 definition). Can't rename+convert in one step, so
-- drop and re-add as generated. Any existing values are recomputed.
ALTER TABLE recipes DROP COLUMN IF EXISTS total_time_mins;
ALTER TABLE recipes DROP COLUMN IF EXISTS total_time_minutes;
ALTER TABLE recipes ADD COLUMN total_time_minutes integer GENERATED ALWAYS AS
  (prep_time_minutes + cook_time_minutes) STORED;

-- serving_size is an integer base_servings was added separately.
-- If serving_size has useful data and base_servings is default,
-- copy it across and drop the legacy column.
UPDATE recipes
   SET base_servings = serving_size
 WHERE serving_size IS NOT NULL
   AND (base_servings IS NULL OR base_servings = 2);
ALTER TABLE recipes DROP COLUMN IF EXISTS serving_size;

-- ── 2. Drop obsolete legacy columns ─────────────────────────────
ALTER TABLE recipes DROP COLUMN IF EXISTS thumbnail_url;
ALTER TABLE recipes DROP COLUMN IF EXISTS season;
ALTER TABLE recipes DROP COLUMN IF EXISTS spice_level;
ALTER TABLE recipes DROP COLUMN IF EXISTS meal_occasion;
ALTER TABLE recipes DROP COLUMN IF EXISTS allergens;
ALTER TABLE recipes DROP COLUMN IF EXISTS equipment_needed;
ALTER TABLE recipes DROP COLUMN IF EXISTS storage_notes;
ALTER TABLE recipes DROP COLUMN IF EXISTS reheat_notes;
ALTER TABLE recipes DROP COLUMN IF EXISTS batch_friendly;
ALTER TABLE recipes DROP COLUMN IF EXISTS freezer_friendly;
ALTER TABLE recipes DROP COLUMN IF EXISTS version;
ALTER TABLE recipes DROP COLUMN IF EXISTS created_by;

-- ── 3. Add columns the Phase-0 schema expects ───────────────────
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS description           text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS region                text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS meal_types            text[]  DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dish_type             text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_storage_path    text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_prompt          text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS tips                  jsonb   DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS faqs                  jsonb   DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS notes                 jsonb   DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS pairs_well_with       jsonb   DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS key_ingredients       text[]  DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_author         text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_updated        date;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS extraction_confidence text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS extracted_at          timestamptz;

-- ── 4. Region + confidence CHECK constraints (idempotent) ───────
DO $$ BEGIN
  ALTER TABLE recipes
    ADD CONSTRAINT recipes_region_check
    CHECK (region IS NULL OR region IN (
      'north_indian','south_indian','east_indian',
      'west_indian','pan_indian','continental','other'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE recipes
    ADD CONSTRAINT recipes_extraction_confidence_check
    CHECK (extraction_confidence IS NULL
           OR extraction_confidence IN ('high','medium','low'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Phase-0 indexes (idempotent) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recipes_dish_role  ON recipes (dish_role);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine    ON recipes (cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_verified   ON recipes (verified);
CREATE INDEX IF NOT EXISTS idx_recipes_meal_types ON recipes USING gin (meal_types);
CREATE INDEX IF NOT EXISTS idx_recipes_diet_tags  ON recipes USING gin (diet_tags);

-- ── 6. Reload PostgREST schema cache so new shape is visible ────
NOTIFY pgrst, 'reload schema';

COMMIT;
