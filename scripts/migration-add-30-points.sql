-- Migration: Add 30 points to all existing users
-- This is a one-time migration to give existing players the welcome bonus
-- that new players now receive automatically.
--
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Add 30 points to all existing users
UPDATE user_profiles
SET 
    total_points = total_points + 30,
    updated_at = now();

-- Verify the update
SELECT 
    COUNT(*) as users_updated,
    MIN(total_points) as min_points,
    MAX(total_points) as max_points,
    AVG(total_points)::integer as avg_points
FROM user_profiles;
