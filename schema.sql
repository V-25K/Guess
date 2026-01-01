-- ============================================================================
-- Guess The Link - Database Schema
-- ============================================================================
-- This file contains the complete PostgreSQL database schema for the
-- Guess The Link application, including tables, indexes, constraints,
-- and stored procedures.
--
-- Database: PostgreSQL (via Supabase)
-- Version: 1.1
-- Last Updated: 2025
--
-- Usage:
--   psql -U postgres -d guessthelink -f schema.sql
--
-- Note: This schema is designed for PostgreSQL 12+ and uses Supabase-specific
-- features like gen_random_uuid() and now() functions.
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_profiles
-- ----------------------------------------------------------------------------
-- Stores user profile information, statistics, and progression data.
-- This is the root table that other tables reference for user identification.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL UNIQUE,
    username text NOT NULL,
    total_points integer NOT NULL DEFAULT 0,
    total_experience integer NOT NULL DEFAULT 0,
    level integer NOT NULL DEFAULT 1,
    challenges_created integer NOT NULL DEFAULT 0,
    challenges_attempted integer NOT NULL DEFAULT 0,
    challenges_solved integer NOT NULL DEFAULT 0,
    current_streak integer NOT NULL DEFAULT 0,
    best_streak integer NOT NULL DEFAULT 0,
    last_challenge_created_at timestamp,
    role text NOT NULL DEFAULT 'player',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'Stores user profile information, statistics, and progression data';
COMMENT ON COLUMN user_profiles.user_id IS 'Reddit user ID in format t2_* (unique identifier)';
COMMENT ON COLUMN user_profiles.username IS 'Reddit username for display purposes';
COMMENT ON COLUMN user_profiles.role IS 'User role: player or mod';

-- ----------------------------------------------------------------------------
-- challenges
-- ----------------------------------------------------------------------------
-- Stores challenge definitions including images, answers, and metadata.
-- Each challenge is created by a user and can be attempted by multiple users.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id text NOT NULL,
    creator_username text NOT NULL,
    title text NOT NULL,
    image_url text NOT NULL,
    image_descriptions text[],
    tags text[] NOT NULL,
    correct_answer text NOT NULL,
    answer_explanation text,
    answer_set jsonb,
    max_score integer NOT NULL,
    score_deduction_per_hint integer NOT NULL,
    reddit_post_id text UNIQUE,
    players_played integer NOT NULL DEFAULT 0,
    players_completed integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    
    -- Foreign key constraint
    CONSTRAINT fk_challenges_creator 
        FOREIGN KEY (creator_id) 
        REFERENCES user_profiles(user_id) 
        ON DELETE CASCADE
);

-- Add comments for documentation
COMMENT ON TABLE challenges IS 'Stores challenge definitions including images, answers, and metadata';
COMMENT ON COLUMN challenges.creator_id IS 'Reddit user ID of the challenge creator';
COMMENT ON COLUMN challenges.image_url IS 'Comma-separated list of image URLs';
COMMENT ON COLUMN challenges.image_descriptions IS 'Array of short descriptions for each image';
COMMENT ON COLUMN challenges.tags IS 'Array of category tags for filtering';
COMMENT ON COLUMN challenges.answer_set IS 'Pre-generated answer sets for local validation (JSONB)';
COMMENT ON COLUMN challenges.reddit_post_id IS 'Associated Reddit post ID if challenge was posted';

-- ----------------------------------------------------------------------------
-- challenge_attempts
-- ----------------------------------------------------------------------------
-- Tracks user attempts at solving challenges.
-- Each user can only have one attempt per challenge (enforced by unique constraint).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS challenge_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    challenge_id uuid NOT NULL,
    attempts_made integer NOT NULL DEFAULT 0,
    images_revealed integer NOT NULL DEFAULT 0,
    is_solved boolean NOT NULL DEFAULT false,
    game_over boolean NOT NULL DEFAULT false,
    points_earned integer NOT NULL DEFAULT 0,
    experience_earned integer NOT NULL DEFAULT 0,
    attempted_at timestamp NOT NULL DEFAULT now(),
    completed_at timestamp,
    hints_used integer[] NOT NULL DEFAULT '{}',
    
    -- Foreign key constraints
    CONSTRAINT fk_attempts_user 
        FOREIGN KEY (user_id) 
        REFERENCES user_profiles(user_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_attempts_challenge 
        FOREIGN KEY (challenge_id) 
        REFERENCES challenges(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint: one attempt per user per challenge
    CONSTRAINT uq_user_challenge 
        UNIQUE (user_id, challenge_id)
);

-- Add comments for documentation
COMMENT ON TABLE challenge_attempts IS 'Tracks user attempts at solving challenges';
COMMENT ON COLUMN challenge_attempts.attempts_made IS 'Number of guesses made by the player';
COMMENT ON COLUMN challenge_attempts.images_revealed IS 'DEPRECATED - Legacy field, use attempts_made instead';
COMMENT ON COLUMN challenge_attempts.hints_used IS 'Array of hint indices used by the player';

-- ----------------------------------------------------------------------------
-- attempt_guesses
-- ----------------------------------------------------------------------------
-- Stores individual guesses made during challenge attempts.
-- Provides detailed history of all guesses for analysis and feedback.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attempt_guesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL,
    guess_text text NOT NULL,
    validation_result text NOT NULL,
    ai_explanation text,
    created_at timestamp NOT NULL DEFAULT now(),
    
    -- Foreign key constraint
    CONSTRAINT fk_guesses_attempt 
        FOREIGN KEY (attempt_id) 
        REFERENCES challenge_attempts(id) 
        ON DELETE CASCADE
);

-- Add comments for documentation
COMMENT ON TABLE attempt_guesses IS 'Stores individual guesses made during challenge attempts';
COMMENT ON COLUMN attempt_guesses.validation_result IS 'Validation outcome: CORRECT, CLOSE, or INCORRECT';
COMMENT ON COLUMN attempt_guesses.ai_explanation IS 'Optional AI-generated explanation for the validation result';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_profiles indexes
-- ----------------------------------------------------------------------------

-- Index for leaderboard queries (order by points descending)
CREATE INDEX IF NOT EXISTS idx_user_profiles_total_points 
    ON user_profiles(total_points DESC);

-- Index for user lookup by user_id (already covered by UNIQUE constraint)
-- CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- ----------------------------------------------------------------------------
-- challenges indexes
-- ----------------------------------------------------------------------------

-- Index for filtering challenges by creator
CREATE INDEX IF NOT EXISTS idx_challenges_creator_id 
    ON challenges(creator_id);

-- Index for ordering challenges by creation time
CREATE INDEX IF NOT EXISTS idx_challenges_created_at 
    ON challenges(created_at DESC);

-- GIN index for array containment queries on tags
CREATE INDEX IF NOT EXISTS idx_challenges_tags 
    ON challenges USING GIN(tags);

-- Index for reddit_post_id lookup (already covered by UNIQUE constraint)
-- CREATE INDEX idx_challenges_reddit_post_id ON challenges(reddit_post_id);

-- ----------------------------------------------------------------------------
-- challenge_attempts indexes
-- ----------------------------------------------------------------------------

-- Index for filtering attempts by user
CREATE INDEX IF NOT EXISTS idx_attempts_user_id 
    ON challenge_attempts(user_id);

-- Index for filtering attempts by challenge
CREATE INDEX IF NOT EXISTS idx_attempts_challenge_id 
    ON challenge_attempts(challenge_id);

-- Index for ordering attempts by time
CREATE INDEX IF NOT EXISTS idx_attempts_attempted_at 
    ON challenge_attempts(attempted_at DESC);

-- Composite unique index (already covered by UNIQUE constraint)
-- CREATE INDEX idx_attempts_user_challenge ON challenge_attempts(user_id, challenge_id);

-- ----------------------------------------------------------------------------
-- attempt_guesses indexes
-- ----------------------------------------------------------------------------

-- Index for filtering guesses by attempt
CREATE INDEX IF NOT EXISTS idx_guesses_attempt_id 
    ON attempt_guesses(attempt_id);

-- Index for ordering guesses chronologically
CREATE INDEX IF NOT EXISTS idx_guesses_created_at 
    ON attempt_guesses(created_at ASC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_guesses ENABLE ROW LEVEL SECURITY;

-- Note: For Devvit apps, RLS policies should allow service role full access
-- since the backend handles authorization. These policies are for direct
-- database access protection.

-- attempt_guesses: Service role has full access
CREATE POLICY "Service role has full access to guesses" ON attempt_guesses
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- STORED PROCEDURES AND FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_user_rank_optimized
-- ----------------------------------------------------------------------------
-- Efficiently calculates a user's leaderboard rank based on total points.
-- Returns the user's rank (1-based), or NULL if user not found.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_rank_optimized(p_user_id text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user_points integer;
    v_rank integer;
BEGIN
    -- Get the user's total points
    SELECT total_points INTO v_user_points
    FROM user_profiles
    WHERE user_id = p_user_id;
    
    -- Return NULL if user not found
    IF v_user_points IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Count users with more points and add 1 for rank
    SELECT COUNT(*) + 1 INTO v_rank
    FROM user_profiles
    WHERE total_points > v_user_points;
    
    RETURN v_rank;
END;
$$;

COMMENT ON FUNCTION get_user_rank_optimized IS 'Efficiently calculates user leaderboard rank based on total points';

-- ----------------------------------------------------------------------------
-- batch_update_user_stats
-- ----------------------------------------------------------------------------
-- Atomically updates multiple user statistics in a single transaction.
-- Returns the updated user profile record.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION batch_update_user_stats(
    p_user_id text,
    p_points_delta integer DEFAULT 0,
    p_exp_delta integer DEFAULT 0,
    p_challenges_created_delta integer DEFAULT 0,
    p_challenges_attempted_delta integer DEFAULT 0,
    p_challenges_solved_delta integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    user_id text,
    username text,
    total_points integer,
    total_experience integer,
    level integer,
    challenges_created integer,
    challenges_attempted integer,
    challenges_solved integer,
    current_streak integer,
    best_streak integer,
    last_challenge_created_at timestamp,
    role text,
    created_at timestamp,
    updated_at timestamp
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE user_profiles
    SET 
        total_points = user_profiles.total_points + p_points_delta,
        total_experience = user_profiles.total_experience + p_exp_delta,
        challenges_created = user_profiles.challenges_created + p_challenges_created_delta,
        challenges_attempted = user_profiles.challenges_attempted + p_challenges_attempted_delta,
        challenges_solved = user_profiles.challenges_solved + p_challenges_solved_delta,
        updated_at = now()
    WHERE user_profiles.user_id = p_user_id
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION batch_update_user_stats IS 'Atomically updates multiple user statistics in a single transaction';

-- ----------------------------------------------------------------------------
-- increment_players_played
-- ----------------------------------------------------------------------------
-- Atomically increments the players_played count for a challenge.
-- Returns true if successful, false otherwise.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_players_played(p_challenge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE challenges
    SET players_played = players_played + 1
    WHERE id = p_challenge_id;
    
    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION increment_players_played IS 'Atomically increments the players_played count for a challenge';

-- ----------------------------------------------------------------------------
-- record_challenge_completion_v2
-- ----------------------------------------------------------------------------
-- Atomically records challenge completion by updating both the attempt record
-- and the user profile in a single transaction.
-- Returns true if successful, false otherwise.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_challenge_completion_v2(
    p_attempt_id uuid,
    p_user_id text,
    p_attempts_made integer,
    p_points integer,
    p_experience integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Update the challenge attempt
    UPDATE challenge_attempts
    SET 
        is_solved = true,
        game_over = true,
        completed_at = now(),
        attempts_made = p_attempts_made,
        points_earned = p_points,
        experience_earned = p_experience
    WHERE id = p_attempt_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Update the user profile
    UPDATE user_profiles
    SET 
        total_points = total_points + p_points,
        total_experience = total_experience + p_experience,
        challenges_solved = challenges_solved + 1,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

COMMENT ON FUNCTION record_challenge_completion_v2 IS 'Atomically records challenge completion updating attempt and user profile';

-- ----------------------------------------------------------------------------
-- anonymize_inactive_users
-- ----------------------------------------------------------------------------
-- Anonymizes user profiles that have been inactive for a specified number of days.
-- This function supports Devvit-compliant data retention by:
-- 1. Identifying users whose updated_at is older than the cutoff date
-- 2. Transforming user_id to "[deleted]:{uuid}" format
-- 3. Setting username to "[deleted]"
-- 4. Updating creator_username on challenges created by anonymized users
-- 5. Skipping already-anonymized users (idempotent operation)
--
-- Parameters:
--   p_days_inactive - Number of days of inactivity before anonymization (default: 30)
--
-- Returns:
--   profiles_anonymized - Number of user profiles that were anonymized
--   challenges_updated - Number of challenges where creator_username was updated
--   attempts_updated - Number of attempts updated (reserved for future use)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION anonymize_inactive_users(p_days_inactive integer DEFAULT 30)
RETURNS TABLE (
    profiles_anonymized integer,
    challenges_updated integer,
    attempts_updated integer
)
LANGUAGE plpgsql
SET search_path = public
AS $
DECLARE
    v_cutoff_date timestamp;
    v_profiles_count integer := 0;
    v_challenges_count integer := 0;
    v_attempts_count integer := 0;
    v_user record;
    v_new_user_id text;
BEGIN
    -- Calculate the cutoff date
    v_cutoff_date := now() - (p_days_inactive || ' days')::interval;
    
    -- Process each inactive user that hasn't been anonymized yet
    FOR v_user IN
        SELECT id, user_id
        FROM user_profiles
        WHERE updated_at < v_cutoff_date
          AND user_id NOT LIKE '[deleted]%'
    LOOP
        -- Generate new anonymized user_id
        v_new_user_id := '[deleted]:' || gen_random_uuid()::text;
        
        -- Update the user profile
        UPDATE user_profiles
        SET 
            user_id = v_new_user_id,
            username = '[deleted]',
            updated_at = now()
        WHERE id = v_user.id;
        
        v_profiles_count := v_profiles_count + 1;
        
        -- Count challenges created by this user before updating
        v_challenges_count := v_challenges_count + (
            SELECT COUNT(*)::integer 
            FROM challenges 
            WHERE creator_id = v_user.user_id
        );
        
        -- Update challenges created by this user (set creator_username and creator_id)
        UPDATE challenges
        SET 
            creator_username = '[deleted]',
            creator_id = v_new_user_id
        WHERE creator_id = v_user.user_id;
        
        -- Update user_id reference in challenge_attempts to new anonymized ID
        UPDATE challenge_attempts
        SET user_id = v_new_user_id
        WHERE user_id = v_user.user_id;
    END LOOP;
    
    -- Return the counts
    profiles_anonymized := v_profiles_count;
    challenges_updated := v_challenges_count;
    attempts_updated := v_attempts_count;
    
    RETURN NEXT;
END;
$;

COMMENT ON FUNCTION anonymize_inactive_users IS 'Anonymizes user profiles inactive for specified days, replacing identifiable info with [deleted] markers';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Note: Adjust these grants based on your Supabase role configuration
-- These are examples and may need to be customized for your setup

-- Grant usage on schema
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table permissions
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant sequence permissions
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant function execution permissions
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE 'Schema creation completed successfully!';
    RAISE NOTICE 'Tables created: user_profiles, challenges, challenge_attempts, attempt_guesses';
    RAISE NOTICE 'Indexes created: 8 indexes for query optimization';
    RAISE NOTICE 'Functions created: 5 stored procedures for atomic operations';
END $$;

