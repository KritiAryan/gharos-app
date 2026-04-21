-- ============================================================
-- PHASE 0 DOWN MIGRATION: Rollback GharOS Recipe Architecture
-- Drops: recipes, ingredient_catalog, meal_history
-- Run this ONLY to fully revert phase 0
-- WARNING: this permanently deletes all seeded recipe data
-- ============================================================

DROP TABLE IF EXISTS meal_history CASCADE;
DROP TABLE IF EXISTS ingredient_catalog CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- Verify rollback:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('recipes','ingredient_catalog','meal_history');
-- Should return 0 rows.
