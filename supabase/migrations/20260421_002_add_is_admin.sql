-- ============================================================
-- Add is_admin column to profiles
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set your account as admin (replace with your email)
-- Run this separately after adding the column:
-- UPDATE profiles SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');
