-- =============================================================
-- 20260422_003_align_ingredient_catalog.sql
--
-- Align ingredient_catalog with the naming convention used
-- everywhere else in the app (canonical_id, not canonical_name)
-- and add is_staple so the extractor's "anchor LLM on common
-- items" query works.
--
-- Side effect: fixes a silently-broken query in
-- admin/app/recipes/new/actions.ts (fetchCatalogContext), which
-- had been returning nothing for every extraction because it
-- was SELECTing a column that didn't exist.
-- =============================================================

BEGIN;

-- ── 1. Unify naming: canonical_name → canonical_id ─────────────
ALTER TABLE ingredient_catalog
  RENAME COLUMN canonical_name TO canonical_id;

-- Enforce uniqueness so seed ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_catalog_canonical_id_key
  ON ingredient_catalog (canonical_id);

-- ── 2. Add is_staple flag ──────────────────────────────────────
ALTER TABLE ingredient_catalog
  ADD COLUMN IF NOT EXISTS is_staple boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ingredient_catalog_is_staple
  ON ingredient_catalog (is_staple) WHERE is_staple = true;

-- ── 3. Reload PostgREST cache ──────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
