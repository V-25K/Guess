/**
 * PlayGameView Component
 * Main gameplay view for playing challenges
 */

import { Devvit, useState } from "@devvit/public-api";
import type { GameChallenge } from "../../../shared/models/index.js";
import { AnswerExplanationView } from "./AnswerExplanationView.js";
import { BG_PRIMARY } from "../../constants/colors.js";

/**
 * Get the appropriate icon for a bonus type
 */
const getBonusIcon = (bonusType: string): string => {
  switch (bonusType) {
    case "first_clear":
      return "rising_star.png";
    case "perfect_solve":
      return "expert_solver.png";
    case "speed_demon":
      return "streak_master.png";
    case "comeback_king":
      return "high_roller.png";
    case "streak":
      return "streak_master.png";
    case "creator_bonus":
      return "creator.png";
    default:
      return "points.png";
  }
};

export type BonusDisplay = {
  type: string;
  points: number;
  exp: number;
  label: string;
};

export interface PlayGameViewProps {
  challenge: GameChallenge;
  gameState: {
    message: string;
    isGameOver: boolean;
    isCorrect: boolean;
    bonuses?: BonusDisplay[];
  };
  attemptCount: number;
  attemptsRemaining: number;
  potentialScore: number;
  onSubmitAnswer: () => void;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  isCreator: boolean;
  isCompleted: boolean;
  isGameOver: boolean;
  completedScore: number;
  checkingCompletion: boolean;
  isProcessing: boolean;
  uniquePlayerCount: number;
  playersCompleted: number;
  isLoadingNext?: boolean;
  hintsUsed?: number[];
  onRevealHint?: (imageIndex: number, hintCost: number) => Promise<void> | void;
  userTotalPoints?: number;
  isRevealingHint?: boolean;
}

/**
 * Render individual image cell with proper image fitting
 * All images are now revealed immediately - only enlarge functionality remains
 */
const ImageCell: Devvit.BlockComponent<{
  image: any;
  index: number;
  sizePx: number;
  onEnlarge: (index: number) => void;
}> = ({ image, index, sizePx, onEnlarge }) => (
  <vstack
    width={`${sizePx}px`}
    height={`${sizePx}px`}
    backgroundColor="#FFFFFF"
    cornerRadius="medium"
    alignment="center middle"
    border="thick"
    borderColor="#4CAF50"
    onPress={() => {
      // Only enlarge functionality - all images are revealed
      onEnlarge(index);
    }}
  >
    <image
      url={image.url}
      imageWidth={sizePx}
      imageHeight={sizePx}
      resizeMode="cover"
      width={`${sizePx}px`}
      height={`${sizePx}px`}
    />
  </vstack>
);

/**
 * Render image grid based on image count
 * Mobile-first: 3 images per row, max 2 rows
 */
const ImageGrid: Devvit.BlockComponent<{
  images: any[];
  onEnlarge: (index: number) => void;
}> = ({ images, onEnlarge }) => {
  const imageCount = images.length;
  const imageSize = 90; // Consistent size for all images

  if (imageCount === 3) {
    // All 3 images in one row
    return (
      <hstack gap="small" width="100%" alignment="center middle">
        <ImageCell
          image={images[0]}
          index={0}
          sizePx={imageSize}
          onEnlarge={onEnlarge}
        />
        <ImageCell
          image={images[1]}
          index={1}
          sizePx={imageSize}
          onEnlarge={onEnlarge}
        />
        <ImageCell
          image={images[2]}
          index={2}
          sizePx={imageSize}
          onEnlarge={onEnlarge}
        />
      </hstack>
    );
  } else if (imageCount === 2) {
    // 2 images centered
    return (
      <hstack gap="small" width="100%" alignment="center middle">
        <ImageCell
          image={images[0]}
          index={0}
          sizePx={imageSize}
          onEnlarge={onEnlarge}
        />
        <ImageCell
          image={images[1]}
          index={1}
          sizePx={imageSize}
          onEnlarge={onEnlarge}
        />
      </hstack>
    );
  } else {
    // Single image
    return (
      <hstack gap="small" width="100%" alignment="center middle">
        <ImageCell
          image={images[0]}
          index={0}
          sizePx={imageSize}
          onEnlarge={onEnlarge}
        />
      </hstack>
    );
  }
};

/**
 * PlayGameView - Main gameplay component
 */
export const PlayGameView: Devvit.BlockComponent<PlayGameViewProps> = ({
  challenge,
  gameState,
  attemptCount,
  attemptsRemaining,
  potentialScore,
  onSubmitAnswer,
  onNextChallenge,
  onBackToMenu,
  isCreator,
  isCompleted,
  isGameOver,
  completedScore,
  checkingCompletion,
  isProcessing,
  uniquePlayerCount,
  playersCompleted,
  isLoadingNext = false,
  hintsUsed = [],
  onRevealHint,
  userTotalPoints = 0,
  isRevealingHint = false,
}) => {
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(
    null
  );
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const handleEnlargeImage = (index: number) => {
    setEnlargedImageIndex(index);
  };

  const handleCloseEnlarged = () => {
    setEnlargedImageIndex(null);
  };

  const handleShowExplanation = () => {
    setShowExplanation(true);
  };

  const handleCloseExplanation = () => {
    setShowExplanation(false);
  };

  const handleShowRules = () => {
    setShowRules(true);
  };

  const handleCloseRules = () => {
    setShowRules(false);
  };

  const handleShowHints = () => {
    setShowHints(true);
  };

  const handleCloseHints = () => {
    setShowHints(false);
    setPendingHintIndex(null);
  };

  // State for hint confirmation
  const [pendingHintIndex, setPendingHintIndex] = useState<number | null>(null);

  const handleRequestHint = (index: number) => {
    if (isRevealingHint) return; // Prevent if already revealing
    setPendingHintIndex(index);
  };

  const handleConfirmHint = () => {
    if (pendingHintIndex === null || !onRevealHint || isRevealingHint) return;

    const hintCost = getNextHintCost();
    const indexToReveal = pendingHintIndex;

    // Close dialog immediately
    setPendingHintIndex(null);

    // Call parent handler - parent manages the async and loading state
    onRevealHint(indexToReveal, hintCost);
  };

  const handleCancelHint = () => {
    setPendingHintIndex(null);
  };

  // Calculate cost for the next hint
  const getNextHintCost = (): number => {
    const imageCount = challenge.images.length;
    const hintsCount = hintsUsed.length;

    if (imageCount === 3) {
      if (hintsCount === 0) return 7;
      if (hintsCount === 1) return 6;
      return 5;
    } else {
      if (hintsCount === 0) return 10;
      return 8;
    }
  };

  // If showing explanation, render that view
  if (showExplanation) {
    return (
      <AnswerExplanationView
        challenge={challenge}
        onBack={handleCloseExplanation}
      />
    );
  }

  // If rules are shown, render the rules overlay
  if (showRules) {
    return (
      <vstack
        width="100%"
        height="100%"
        backgroundColor="rgba(0, 0, 0, 0.9)"
        alignment="center middle"
        onPress={handleCloseRules}
        padding="medium"
      >
        <vstack
          width="100%"
          maxWidth="400px"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          padding="medium"
          gap="medium"
          onPress={() => { }} // Catch tap to prevent closing
        >
          {/* Header */}
          <hstack width="100%" alignment="middle">
            <text size="large" weight="bold" color="#1c1c1c">
              How to Play
            </text>
          </hstack>

          <vstack gap="small" width="100%">
            <text size="medium" weight="bold" color="#2E7D32">
              Game Rules
            </text>
            <vstack gap="small" width="100%">
              <hstack gap="small" alignment="start middle">
                <text size="medium">🔍</text>
                <text size="small" color="#1c1c1c" wrap>
                  Find the common link between the images.
                </text>
              </hstack>
              <hstack gap="small" alignment="start middle">
                <text size="medium">🎯</text>
                <text size="small" color="#1c1c1c" wrap>
                  You have 10 attempts to guess correctly.
                </text>
              </hstack>
              <hstack gap="small" alignment="start middle">
                <text size="medium">👆</text>
                <text size="small" color="#1c1c1c" wrap>
                  Tap any image to zoom in.
                </text>
              </hstack>
            </vstack>
          </vstack>

          <vstack gap="small" width="100%">
            <text size="medium" weight="bold" color="#F57C00">
              Points System
            </text>
            <vstack gap="small" width="100%">
              <hstack width="100%" alignment="middle">
                <text size="small" weight="bold" color="#1c1c1c">Max Score</text>
                <spacer grow />
                <text size="small" color="#2E7D32">28 pts (1st Try)</text>
              </hstack>
              <hstack width="100%" alignment="middle">
                <text size="small" weight="bold" color="#1c1c1c">Penalty</text>
                <spacer grow />
                <text size="small" color="#D32F2F">-2 pts / attempt</text>
              </hstack>
              <hstack width="100%" alignment="middle">
                <text size="small" weight="bold" color="#1c1c1c">Min Score</text>
                <spacer grow />
                <text size="small" color="#F57C00">10 pts (10th Try)</text>
              </hstack>
            </vstack>
          </vstack>

          <vstack gap="small" width="100%">
            <text size="medium" weight="bold" color="#D32F2F">
              Hint System
            </text>
            <vstack gap="small" width="100%">
              <text size="small" color="#1c1c1c" wrap>
                Reveal image descriptions if you're stuck!
              </text>
              <text size="xsmall" weight="bold" color="#1c1c1c">3 Image Challenges:</text>
              <hstack width="100%" alignment="middle">
                <text size="xsmall" color="#1c1c1c">1st hint: -7 pts</text>
                <spacer grow />
                <text size="xsmall" color="#1c1c1c">2nd: -6 pts</text>
                <spacer grow />
                <text size="xsmall" color="#1c1c1c">3rd: -5 pts</text>
              </hstack>
              <text size="xsmall" weight="bold" color="#1c1c1c">2 Image Challenges:</text>
              <hstack width="100%" alignment="middle">
                <text size="xsmall" color="#1c1c1c">1st hint: -10 pts</text>
                <spacer grow />
                <text size="xsmall" color="#1c1c1c">2nd: -8 pts</text>
              </hstack>
              <text size="xsmall" color="#878a8c" wrap>
                * Score cannot go below zero.
              </text>
            </vstack>
          </vstack>

          <button
            onPress={handleCloseRules}
            appearance="primary"
            size="medium"
            width="100%"
          >
            Got it!
          </button>
        </vstack >
      </vstack >
    );
  }

  // If hints are shown, render the hints overlay
  if (showHints) {
    return (
      <vstack
        width="100%"
        height="100%"
        backgroundColor="rgba(0, 0, 0, 0.9)"
        alignment="center middle"
        padding="medium"
      >
        <vstack
          width="100%"
          maxWidth="400px"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          padding="medium"
          gap="medium"
        >
          {/* Header */}
          <hstack width="100%" alignment="middle">
            <text size="large" weight="bold" color="#1c1c1c">
              Hints
            </text>
          </hstack>

          <vstack gap="small" width="100%">
            <text size="small" color="#1c1c1c" wrap>
              Reveal hints for each image. Warning: This will deduct points!
            </text>
            <vstack gap="small" width="100%">
              {challenge.images.map((image: any, index: number) => {
                const isRevealed = hintsUsed.includes(index);
                const imageCount = challenge.images.length;
                let positionLabel = `Image ${index + 1}`;

                if (imageCount === 3) {
                  if (index === 0) positionLabel = "Left Image";
                  else if (index === 1) positionLabel = "Middle Image";
                  else if (index === 2) positionLabel = "Right Image";
                } else if (imageCount === 2) {
                  if (index === 0) positionLabel = "Left Image";
                  else if (index === 1) positionLabel = "Right Image";
                }

                return (
                  <vstack key={`hint-dialog-${index}`} width="100%" gap="small" padding="small" backgroundColor="#F5F5F5" cornerRadius="small">
                    <hstack width="100%" alignment="middle">
                      <text size="medium" weight="bold" color="#1c1c1c">{positionLabel}</text>
                      <spacer grow />
                      {isRevealed ? (
                        <text size="small" color="#2E7D32" weight="bold">Revealed</text>
                      ) : (
                        <button
                          onPress={() => handleRequestHint(index)}
                          appearance="secondary"
                          size="small"
                          disabled={potentialScore <= 0 || isProcessing || isRevealingHint || pendingHintIndex !== null}
                        >
                          Reveal
                        </button>
                      )}
                    </hstack>
                    {isRevealed && (
                      <text size="small" color="#1c1c1c" wrap>
                        {image.description || "No description available."}
                      </text>
                    )}
                  </vstack>
                );
              })}
            </vstack>
          </vstack>

          {/* Confirmation Dialog */}
          {pendingHintIndex !== null && (
            <vstack
              width="100%"
              padding="medium"
              backgroundColor={userTotalPoints >= getNextHintCost() ? "#FFF3E0" : "#FFEBEE"}
              cornerRadius="medium"
              border="thin"
              borderColor={userTotalPoints >= getNextHintCost() ? "#FF9800" : "#D32F2F"}
              gap="small"
            >
              <text size="medium" weight="bold" color={userTotalPoints >= getNextHintCost() ? "#E65100" : "#D32F2F"}>
                {userTotalPoints >= getNextHintCost() ? "⚠️ Confirm Hint Reveal" : "❌ Not Enough Points"}
              </text>
              <hstack width="100%" alignment="middle">
                <text size="small" color="#1c1c1c">Your balance:</text>
                <spacer grow />
                <text size="small" weight="bold" color={userTotalPoints >= getNextHintCost() ? "#2E7D32" : "#D32F2F"}>
                  {userTotalPoints} pts
                </text>
              </hstack>
              <hstack width="100%" alignment="middle">
                <text size="small" color="#1c1c1c">Hint cost:</text>
                <spacer grow />
                <text size="small" weight="bold" color="#D32F2F">
                  -{getNextHintCost()} pts
                </text>
              </hstack>
              {userTotalPoints >= getNextHintCost() ? (
                <hstack width="100%" alignment="middle">
                  <text size="small" color="#1c1c1c">After reveal:</text>
                  <spacer grow />
                  <text size="small" weight="bold" color="#1c1c1c">
                    {userTotalPoints - getNextHintCost()} pts
                  </text>
                </hstack>
              ) : (
                <text size="small" color="#D32F2F" wrap>
                  You need {getNextHintCost() - userTotalPoints} more points to use this hint.
                </text>
              )}
              <hstack gap="small" width="100%">
                <button
                  onPress={handleCancelHint}
                  appearance="secondary"
                  size="small"
                  grow
                  disabled={isRevealingHint}
                >
                  Cancel
                </button>
                <button
                  onPress={handleConfirmHint}
                  appearance="primary"
                  size="small"
                  grow
                  disabled={userTotalPoints < getNextHintCost() || isRevealingHint}
                >
                  {isRevealingHint
                    ? "Revealing..."
                    : userTotalPoints >= getNextHintCost()
                      ? `Yes, Reveal (-${getNextHintCost()} pts)`
                      : "Not Enough Points"}
                </button>
              </hstack>
            </vstack>
          )}

          <button
            onPress={handleCloseHints}
            appearance="primary"
            size="medium"
            width="100%"
            disabled={pendingHintIndex !== null}
          >
            Close
          </button>
        </vstack>
      </vstack>
    );
  }

  // If an image is enlarged, show the overlay
  if (enlargedImageIndex !== null) {
    const enlargedImage = challenge.images[enlargedImageIndex];
    return (
      <vstack
        width="100%"
        height="100%"
        backgroundColor="rgba(0, 0, 0, 0.9)"
        alignment="center middle"
        onPress={handleCloseEnlarged}
        padding="medium"
        gap="medium"
      >
        <image
          url={enlargedImage.url}
          imageWidth={300}
          imageHeight={300}
          width="300px"
          height="300px"
          resizeMode="fit"
        />
        <button
          onPress={handleCloseEnlarged}
          appearance="secondary"
          size="medium"
          icon="close"
        />
      </vstack>
    );
  }

  return (
    <vstack
      padding="medium"
      gap="medium"
      width="100%"
      height="100%"
      backgroundColor={BG_PRIMARY}
    >
      {/* Header */}
      <vstack gap="small" width="100%">
        {/* Top row: Back button and stats */}
        <hstack width="100%" alignment="middle">
          <hstack gap="small">
            <button
              onPress={onBackToMenu}
              appearance="primary"
              size="small"
              icon="back"
            />
            <button
              onPress={handleShowRules}
              appearance="secondary"
              size="small"
              icon="help"
            />
          </hstack>

          <spacer grow />

          {/* Played by */}
          <text size="xsmall" color="#878a8c">Played by</text>
          <spacer size="xsmall" />
          <text size="medium" weight="bold" color="#1c1c1c">{uniquePlayerCount}</text>

          <spacer size="medium" />

          {/* Solved by */}
          <text size="xsmall" color="#878a8c">Solved by</text>
          <spacer size="xsmall" />
          <text size="medium" weight="bold" color="#4CAF50">{playersCompleted}</text>

          <spacer grow />

          {/* Points */}
          <image
            url="points.png"
            imageWidth={18}
            imageHeight={18}
            width="18px"
            height="18px"
            resizeMode="fit"
          />
          <spacer size="xsmall" />
          <text size="large" weight="bold" color="#2E7D32">{potentialScore}</text>
          <spacer size="xsmall" />
          <text size="xsmall" color="#878a8c">({Math.min(attemptCount + 1, 10)}/10)</text>
        </hstack>

        {/* Title and completion badge */}
        <hstack gap="small" alignment="middle" width="100%">
          <text size="large" weight="bold" color="#1c1c1c">
            {challenge.title}
          </text>
          {isCompleted && <text size="medium">✅</text>}
        </hstack>

        {/* Creator and tags in one line */}
        <hstack gap="small" alignment="middle" width="100%">
          <text size="xsmall" color="#878a8c">
            by {challenge.creator_username}
          </text>
          {challenge.tags && challenge.tags.length > 0 && (
            <>
              <text size="xsmall" color="#878a8c">
                •
              </text>
              {challenge.tags.slice(0, 2).map((tag) => (
                <hstack
                  key={tag}
                  padding="xsmall"
                  backgroundColor="#E8F5E9"
                  cornerRadius="small"
                >
                  <text size="xsmall" color="#2E7D32" weight="bold">
                    {tag}
                  </text>
                </hstack>
              ))}
            </>
          )}
        </hstack>
      </vstack>

      {/* Image Grid */}
      <ImageGrid images={challenge.images} onEnlarge={handleEnlargeImage} />

      <hstack
        width="100%"
        alignment="center middle"
        padding="xsmall"
        gap="small"
      >
        <text size="xsmall" color="#878a8c" alignment="center">
          Tap any image to view it larger
        </text>
      </hstack>

      {/* Hints Button */}
      {!gameState.isGameOver && !isCompleted && !isGameOver && !isCreator && (
        <vstack width="100%" alignment="center middle" padding="small">
          <button
            onPress={handleShowHints}
            appearance="secondary"
            size="medium"
            icon="views"
          >
            Show Hints
          </button>
        </vstack>
      )}

      {/* Low-attempt warning */}
      {attemptsRemaining <= 3 &&
        attemptsRemaining > 0 &&
        !gameState.isGameOver && (
          <hstack
            padding="small"
            backgroundColor="#FFF4E6"
            cornerRadius="small"
            width="100%"
            alignment="center middle"
          >
            <text size="small" color="#FF8C00" weight="bold">
              ⚠️ {attemptsRemaining} attempts left!
            </text>
          </hstack>
        )}

      {/* Message Box with Avatar */}
      <hstack width="100%" gap="small" alignment="start top">
        {/* Creator Avatar */}
        {challenge.creator_avatar_url ? (
          <image
            url={challenge.creator_avatar_url}
            imageWidth={60}
            imageHeight={60}
            width="60px"
            height="60px"
            resizeMode="cover"
          />
        ) : (
          <vstack
            width="60px"
            height="60px"
            backgroundColor="#FF4500"
            cornerRadius="full"
            alignment="center middle"
          >
            <text size="xlarge" weight="bold" color="#FFFFFF">
              {challenge.creator_username.charAt(0).toUpperCase()}
            </text>
          </vstack>
        )}

        {/* Message Box */}
        <vstack
          grow
          padding="medium"
          backgroundColor={
            isCompleted || (gameState.isGameOver && gameState.isCorrect)
              ? "#E8F5E9"
              : (isGameOver && !isCompleted) ||
                (gameState.isGameOver && !gameState.isCorrect)
                ? "#FFEBEE"
                : isCreator
                  ? "#FFF4E6"
                  : isProcessing
                    ? "#FFF4E6"
                    : "#FFFFFF"
          }
          cornerRadius="medium"
          border="thin"
          borderColor={
            isCompleted || (gameState.isGameOver && gameState.isCorrect)
              ? "#4CAF50"
              : (isGameOver && !isCompleted) ||
                (gameState.isGameOver && !gameState.isCorrect)
                ? "#D32F2F"
                : "#E0E0E0"
          }
          gap="small"
        >
          {isCompleted ? (
            <vstack gap="small" width="100%">
              <hstack gap="small" alignment="middle">
                <image
                  url="novice_solver.png"
                  imageWidth={24}
                  imageHeight={24}
                  width="24px"
                  height="24px"
                  resizeMode="fit"
                />
                <text size="small" weight="bold" color="#2E7D32" wrap>
                  Challenge Completed
                </text>
              </hstack>
              <hstack gap="small" alignment="middle">
                <image
                  url="points.png"
                  imageWidth={18}
                  imageHeight={18}
                  width="18px"
                  height="18px"
                  resizeMode="fit"
                />
                <text size="small" color="#1B5E20" wrap>
                  You earned {completedScore} points
                </text>
              </hstack>
            </vstack>
          ) : isGameOver && !isCompleted ? (
            <vstack gap="small" width="100%">
              <text size="medium" weight="bold" color="#D32F2F" wrap>
                Game Over
              </text>
              <text size="small" color="#666666" wrap>
                Answer: {challenge.correct_answer}
              </text>
            </vstack>
          ) : isCreator ? (
            <vstack gap="small" width="100%">
              <text size="medium" weight="bold" color="#FF8C00" wrap>
                Your Challenge
              </text>
              <text size="small" color="#666666" wrap>
                You can't answer your own challenge
              </text>
            </vstack>
          ) : gameState.isGameOver && !gameState.isCorrect ? (
            <vstack gap="small" width="100%">
              <text size="medium" weight="bold" color="#D32F2F" wrap>
                Game Over
              </text>
              <text size="small" color="#666666" wrap>
                Answer: {challenge.correct_answer}
              </text>
            </vstack>
          ) : gameState.isGameOver && gameState.isCorrect ? (
            <vstack gap="small" width="100%">
              <hstack gap="small" alignment="middle">
                <image
                  url="novice_solver.png"
                  imageWidth={24}
                  imageHeight={24}
                  width="24px"
                  height="24px"
                  resizeMode="fit"
                />
                <text size="medium" weight="bold" color="#2E7D32" wrap>
                  Correct!
                </text>
              </hstack>
              {gameState.bonuses && gameState.bonuses.length > 0 ? (
                <hstack gap="small" width="100%">
                  {gameState.bonuses.map((bonus, idx) => (
                    <hstack
                      key={`bonus-${idx}`}
                      padding="xsmall"
                      backgroundColor="#FFF8E1"
                      cornerRadius="small"
                      gap="small"
                      alignment="middle"
                    >
                      <image
                        url={getBonusIcon(bonus.type)}
                        imageWidth={16}
                        imageHeight={16}
                        width="16px"
                        height="16px"
                        resizeMode="fit"
                      />
                      <text size="xsmall" color="#F57C00" weight="bold">
                        +{bonus.points}
                      </text>
                    </hstack>
                  ))}
                </hstack>
              ) : null}
            </vstack>
          ) : (
            <text
              size="small"
              color={isProcessing ? "#FF8C00" : "#1c1c1c"}
              wrap
            >
              {gameState.message}
            </text>
          )}
        </vstack>
      </hstack>

      <spacer grow />

      {/* Answer Button or Status */}
      {!gameState.isGameOver && !isCompleted && !isGameOver && !isCreator && (
        <hstack width="100%" alignment="center middle">
          {checkingCompletion ? (
            <text size="small" color="#878a8c">
              Checking status...
            </text>
          ) : (
            <button onPress={onSubmitAnswer} appearance="primary" size="medium">
              ✍️ Click to Answer
            </button>
          )}
        </hstack>
      )}

      {/* Game Over Actions */}
      {(gameState.isGameOver || isGameOver) && (
        <vstack gap="small" width="100%">
          <button
            onPress={handleShowExplanation}
            appearance="secondary"
            size="medium"
            width="100%"
          >
            💡 View Explanation
          </button>
          <button
            onPress={onNextChallenge}
            appearance="primary"
            size="medium"
            width="100%"
            disabled={isLoadingNext}
          >
            {isLoadingNext ? "Loading..." : "Next Challenge →"}
          </button>
        </vstack>
      )}
    </vstack>
  );
};
