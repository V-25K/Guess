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
}) => {
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(
    null
  );
  const [showExplanation, setShowExplanation] = useState(false);

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

  // If showing explanation, render that view
  if (showExplanation) {
    return (
      <AnswerExplanationView
        challenge={challenge}
        onBack={handleCloseExplanation}
      />
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
          <button
            onPress={onBackToMenu}
            appearance="primary"
            size="small"
            icon="back"
          />

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

        {/* Description (if provided) */}
        {challenge.description && (
          <vstack
            width="100%"
            padding="small"
            backgroundColor="#FFFFFF"
            cornerRadius="small"
            border="thin"
            borderColor="#E0E0E0"
          >
            <text size="small" color="#666666" wrap>
              {challenge.description}
            </text>
          </vstack>
        )}

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

      {/* Image hint text */}
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
