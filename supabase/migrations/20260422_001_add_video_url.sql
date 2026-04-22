-- ============================================================
-- Phase 2 follow-up: Add video_url column to recipes
-- Stores YouTube/Vimeo video links extracted from source pages.
-- Useful for future in-app recipe video embeds.
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS video_url text;

-- Nothing to backfill. Existing rows will have NULL until re-extracted.
