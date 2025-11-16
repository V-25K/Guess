/**
 * Tag Constants
 * Predefined challenge tags/categories
 */

export const CHALLENGE_TAGS = [
  'anime',
  'general',
  'sport',
  'movies',
  'music',
  'gaming',
  'history',
  'science',
  'geography',
  'food',
  'art',
  'technology',
  'nature',
  'celebrities',
  'brands',
] as const;

export type ChallengeTag = typeof CHALLENGE_TAGS[number];

export const TAG_LABELS: Record<string, string> = {
  anime: '🎌 Anime',
  general: '🌐 General',
  sport: '⚽ Sport',
  movies: '🎬 Movies',
  music: '🎵 Music',
  gaming: '🎮 Gaming',
  history: '📜 History',
  science: '🔬 Science',
  geography: '🗺️ Geography',
  food: '🍕 Food',
  art: '🎨 Art',
  technology: '💻 Technology',
  nature: '🌿 Nature',
  celebrities: '⭐ Celebrities',
  brands: '🏷️ Brands',
};
