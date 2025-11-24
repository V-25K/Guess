/**
 * Challenge Types
 * Defines all types related to challenges, images, and gameplay
 */

export type Challenge = {
  id: string;
  creator_id: string;
  creator_username: string;
  title: string;
  description: string | null;
  image_url: string;
  // Array of short (<100 chars) descriptions for each image, in order
  image_descriptions?: string[];
  tags: string[];
  correct_answer: string;
  // Creator's explanation of how the images relate to the answer
  answer_explanation?: string;
  max_score: number;
  score_deduction_per_hint: number;
  reddit_post_id: string | null;
  players_played: number;
  players_completed: number;
  created_at: string;
};

export type ChallengeCreate = Omit<Challenge, 'id' | 'created_at' | 'reddit_post_id'>;

export type ImageItem = {
  url: string;
  isRevealed: boolean;
  description?: string;
};

export type GameChallenge = Challenge & {
  images: ImageItem[];
  keywords: string[];
  creator_avatar_url?: string; // Optional Snoovatar URL
};

export type ChallengeFilters = {
  tags?: string[];
  creatorId?: string;
  limit?: number;
  offset?: number;
};
