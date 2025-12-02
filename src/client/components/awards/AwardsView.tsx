import { Devvit, useAsync, useState } from "@devvit/public-api";
import type { UserService } from "../../../server/services/user.service.js";
import type { UserProfile } from "../../../shared/models/user.types.js";
import { LoadingView } from "../shared/LoadingView.js";
import { BG_PRIMARY, BG_SECONDARY } from "../../constants/colors.js";

export interface AwardsViewProps {
  userId: string;
  username: string;
  userService: UserService;
  onBack: () => void;
  cachedProfile?: UserProfile | null;
  onProfileLoaded?: (profile: UserProfile) => void;
}

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  condition: (profile: UserProfile) => boolean;
  progress?: (profile: UserProfile) => number; // 0 to 1
  progressLabel?: (profile: UserProfile) => string;
};

const BADGES: Badge[] = [
  {
    id: "novice_solver",
    name: "Novice Solver",
    description: "Solve your first challenge",
    icon: "novice_solver.png",
    color: "#4CAF50",
    condition: (p) => p.challenges_solved >= 1,
    progress: (p) => Math.min(p.challenges_solved / 1, 1),
    progressLabel: (p) => `${p.challenges_solved}/1`,
  },
  {
    id: "expert_solver",
    name: "Expert Solver",
    description: "Solve 50 challenges",
    icon: "expert_solver.png",
    color: "#2196F3",
    condition: (p) => p.challenges_solved >= 50,
    progress: (p) => Math.min(p.challenges_solved / 50, 1),
    progressLabel: (p) => `${p.challenges_solved}/50`,
  },
  {
    id: "creator",
    name: "Creator",
    description: "Create a challenge",
    icon: "creator.png",
    color: "#9C27B0",
    condition: (p) => p.challenges_created >= 1,
    progress: (p) => Math.min(p.challenges_created / 1, 1),
    progressLabel: (p) => `${p.challenges_created}/1`,
  },
  {
    id: "master_creator",
    name: "Master Creator",
    description: "Create 10 challenges",
    icon: "master_creator.png",
    color: "#673AB7",
    condition: (p) => p.challenges_created >= 10,
    progress: (p) => Math.min(p.challenges_created / 10, 1),
    progressLabel: (p) => `${p.challenges_created}/10`,
  },
  {
    id: "streak_master",
    name: "Streak Master",
    description: "Reach a streak of 5",
    icon: "streak_master.png",
    color: "#FF5722",
    condition: (p) => (p.best_streak || 0) >= 5,
    progress: (p) => Math.min((p.best_streak || 0) / 5, 1),
    progressLabel: (p) => `${p.best_streak || 0}/5`,
  },
  {
    id: "point_millionaire",
    name: "High Roller",
    description: "Earn 1000 points",
    icon: "high_roller.png",
    color: "#00BCD4",
    condition: (p) => p.total_points >= 1000,
    progress: (p) => Math.min(p.total_points / 1000, 1),
    progressLabel: (p) => `${p.total_points}/1000`,
  },
  {
    id: "level_5",
    name: "Rising Star",
    description: "Reach Level 5",
    icon: "rising_star.png",
    color: "#FFC107",
    condition: (p) => p.level >= 5,
    progress: (p) => Math.min(p.level / 5, 1),
    progressLabel: (p) => `Lvl ${p.level}/5`,
  },
];

const BADGES_PER_PAGE = 4; // Show 4 badges per page (2 rows of 2)

export const AwardsView: Devvit.BlockComponent<AwardsViewProps> = ({
  userId,
  username,
  userService,
  onBack,
  cachedProfile,
  onProfileLoaded,
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  const {
    data: profile,
    loading,
    error,
  } = useAsync<UserProfile | null>(async () => {
    return await userService.getUserProfile(userId, username);
  });

  // Update parent cache when fresh data arrives
  if (profile && onProfileLoaded && profile !== cachedProfile) {
    onProfileLoaded(profile);
  }

  // Use fresh data if available, otherwise use cached data
  const displayProfile = profile || cachedProfile;

  // Only show loading if we have no cached data to display
  if (loading && !displayProfile) return <LoadingView />;

  if ((error || !displayProfile) && !displayProfile) {
    return (
      <vstack alignment="center middle" height="100%" gap="medium">
        <text>Failed to load awards.</text>
        <button onPress={onBack}>Back</button>
      </vstack>
    );
  }

  // At this point displayProfile is guaranteed to exist
  if (!displayProfile) {
    return (
      <vstack alignment="center middle" height="100%" gap="medium">
        <text>Failed to load awards.</text>
        <button onPress={onBack}>Back</button>
      </vstack>
    );
  }

  const unlockedCount = BADGES.filter((b) =>
    b.condition(displayProfile)
  ).length;
  const totalPages = Math.ceil(BADGES.length / BADGES_PER_PAGE);
  const startIndex = currentPage * BADGES_PER_PAGE;
  const endIndex = Math.min(startIndex + BADGES_PER_PAGE, BADGES.length);
  const currentBadges = BADGES.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <vstack width="100%" height="100%" backgroundColor={BG_PRIMARY}>
      {/* Header - Three-column layout */}
      <hstack
        width="100%"
        padding="small"
        alignment="middle"
        backgroundColor={BG_SECONDARY}
      >
        <hstack width="50%" alignment="start middle">
          <text size="large" weight="bold" color="#1c1c1c">
            Awards
          </text>
        </hstack>

        <hstack width="50%" alignment="end middle">
          <text size="large" color="#FF6D00">
            {unlockedCount}/{BADGES.length}
          </text>
        </hstack>
      </hstack>

      {/* Badges Grid - Reduced padding to show pagination */}
      <vstack padding="small" gap="medium" width="100%" alignment="center" grow>
        {Array.from({ length: Math.ceil(currentBadges.length / 2) }).map(
          (_, rowIndex) => (
            <hstack
              key={`row-${rowIndex}`}
              gap="medium"
              width="100%"
              height="49%"
            >
              {/* First Badge in Row */}
              <BadgeItem
                badge={currentBadges[rowIndex * 2]}
                profile={displayProfile}
                isEmpty={!currentBadges[rowIndex * 2]}
              />

              {/* Second Badge in Row */}
              <BadgeItem
                badge={currentBadges[rowIndex * 2 + 1]}
                profile={displayProfile}
                isEmpty={!currentBadges[rowIndex * 2 + 1]}
              />
            </hstack>
          )
        )}
      </vstack>

      {/* Pagination Controls - Professional spacing */}
      {totalPages > 1 ? (
        <hstack
          width="100%"
          padding="small"
          gap="medium"
          alignment="center middle"
          backgroundColor={BG_SECONDARY}
        >
          <button
            onPress={handlePrevPage}
            appearance="secondary"
            size="medium"
            disabled={currentPage === 0}
            icon="left"
          />

          <text color="#878a8c" size="small">
            Page {currentPage + 1} of {totalPages}
          </text>

          <button
            onPress={handleNextPage}
            appearance="secondary"
            size="medium"
            disabled={currentPage === totalPages - 1}
            icon="right"
          />
        </hstack>
      ) : null}
    </vstack>
  );
};

const BadgeItem = ({
  badge,
  profile,
  isEmpty,
}: {
  badge?: Badge;
  profile: UserProfile;
  isEmpty: boolean;
}) => {
  // Render invisible placeholder for empty slots to maintain grid structure
  if (isEmpty || !badge) {
    return <vstack width="49%" height="100%" backgroundColor="transparent" />;
  }

  const isUnlocked = badge.condition(profile);

  return (
    <vstack
      width="49%"
      height="100%"
      backgroundColor={BG_SECONDARY}
      cornerRadius="medium"
      padding="medium"
      alignment="center middle"
      gap="small"
      borderColor={isUnlocked ? badge.color : "#E0E0E0"}
    >
      <vstack
        width="48px"
        height="48px"
        cornerRadius="full"
        backgroundColor={isUnlocked ? badge.color : "#EEEEEE"}
        alignment="center middle"
      >
        <image
          url={badge.icon}
          imageWidth={32}
          imageHeight={32}
          width="32px"
          height="32px"
          resizeMode="fit"
        />
      </vstack>

      <text
        size="medium"
        weight="bold"
        color={isUnlocked ? "#1c1c1c" : "#878a8c"}
        alignment="center"
      >
        {badge.name}
      </text>
      <text size="small" color="#878a8c" alignment="center" wrap>
        {badge.description}
      </text>

      {!isUnlocked && badge.progressLabel ? (
        <text size="small" color="#FF6D00" weight="bold">
          {badge.progressLabel(profile)}
        </text>
      ) : null}
    </vstack>
  );
};
