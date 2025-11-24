/**
 * Application Configuration Constants
 */

export const APP_CONFIG = {
  // Rate limiting
  CHALLENGE_CREATION_COOLDOWN_HOURS: 24,

  // Image constraints
  MIN_IMAGES_PER_CHALLENGE: 2,
  MAX_IMAGES_PER_CHALLENGE: 3,

  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Leaderboard
  LEADERBOARD_TOP_COUNT: 10,
  LEADERBOARD_CACHE_TTL_MS: 60000, // 1 minute

  // Profile
  PROFILE_CACHE_TTL_MS: 300000, // 5 minutes

  // Validation
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_ANSWER_LENGTH: 200,
  MIN_TITLE_LENGTH: 3,
  MIN_ANSWER_LENGTH: 2,

  // Retry logic
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

export const STORAGE_CONFIG = {
  BUCKET_NAME: 'challenge-assets',
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
} as const;
