/**
 * Comment Reward Types
 * Defines all types related to comment tracking and rewards
 */

export type CommentReward = {
  id: string;
  challenge_id: string;
  creator_id: string;
  commenter_id: string;
  comment_id: string;
  points_awarded: number;
  experience_awarded: number;
  created_at: string;
};

export type CommentRewardCreate = Omit<CommentReward, 'id' | 'created_at'>;
