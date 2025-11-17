/**
 * PlayGameView Component
 * Main gameplay view for playing challenges
 */

import { Devvit, useState } from '@devvit/public-api';
import type { GameChallenge } from '../../../shared/models/index.js';

export interface PlayGameViewProps {
    challenge: GameChallenge;
    gameState: {
        message: string;
        isGameOver: boolean;
        isCorrect: boolean;
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
 */
const ImageGrid: Devvit.BlockComponent<{
    images: any[];
    onEnlarge: (index: number) => void;
}> = ({ images, onEnlarge }) => {
    const imageCount = images.length;

    if (imageCount === 5) {
        return (
            <vstack gap="small" width="100%" alignment="center middle">
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[0]} index={0} sizePx={80} onEnlarge={onEnlarge} />
                    <ImageCell image={images[1]} index={1} sizePx={80} onEnlarge={onEnlarge} />
                    <ImageCell image={images[2]} index={2} sizePx={80} onEnlarge={onEnlarge} />
                </hstack>
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[3]} index={3} sizePx={80} onEnlarge={onEnlarge} />
                    <ImageCell image={images[4]} index={4} sizePx={80} onEnlarge={onEnlarge} />
                </hstack>
            </vstack>
        );
    } else if (imageCount === 4) {
        return (
            <vstack gap="small" width="100%" alignment="center middle">
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[0]} index={0} sizePx={90} onEnlarge={onEnlarge} />
                    <ImageCell image={images[1]} index={1} sizePx={90} onEnlarge={onEnlarge} />
                </hstack>
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[2]} index={2} sizePx={90} onEnlarge={onEnlarge} />
                    <ImageCell image={images[3]} index={3} sizePx={90} onEnlarge={onEnlarge} />
                </hstack>
            </vstack>
        );
    } else if (imageCount === 3) {
        return (
            <vstack gap="small" width="100%" alignment="center middle">
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[0]} index={0} sizePx={90} onEnlarge={onEnlarge} />
                    <ImageCell image={images[1]} index={1} sizePx={90} onEnlarge={onEnlarge} />
                </hstack>
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[2]} index={2} sizePx={90} onEnlarge={onEnlarge} />
                </hstack>
            </vstack>
        );
    } else if (imageCount === 2) {
        return (
            <hstack gap="small" width="100%" alignment="center middle">
                <ImageCell image={images[0]} index={0} sizePx={110} onEnlarge={onEnlarge} />
                <ImageCell image={images[1]} index={1} sizePx={110} onEnlarge={onEnlarge} />
            </hstack>
        );
    } else {
        return (
            <hstack gap="small" width="100%" alignment="center middle">
                <ImageCell image={images[0]} index={0} sizePx={140} onEnlarge={onEnlarge} />
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
}) => {
    const isThinking = gameState.message === '🤔 Thinking...';
    const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(null);
    
    const handleEnlargeImage = (index: number) => {
        setEnlargedImageIndex(index);
    };
    
    const handleCloseEnlarged = () => {
        setEnlargedImageIndex(null);
    };
    
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
                >
                    ✕ Close
                </button>
            </vstack>
        );
    }
    
    return (
        <vstack padding="small" gap="small" width="100%" height="100%" backgroundColor="#F6F7F8">
            {/* Top Section: Header - Mobile First */}
            <hstack width="100%" alignment="middle" gap="small">
                {/* Back button */}
                <button 
                    onPress={onBackToMenu} 
                    appearance="secondary"
                    size="small"
                    icon="back"
                />
                
                {/* Creator info */}
                <text size="xsmall" color="#878a8c">By {challenge.creator_username}</text>
                
                <spacer grow />
                
                {/* Score and Attempt tracking - stacked vertically */}
                <vstack alignment="end top" gap="none">
                    <text size="xlarge" weight="bold" color="#4CAF50">
                        {potentialScore} pts
                    </text>
                    <text size="small" color="#666666">
                        Attempt {Math.min(attemptCount + 1, 10)} of 10
                    </text>
                </vstack>
            </hstack>

            {/* Title with completion badge */}
            <hstack gap="small" alignment="middle">
                <text size="large" weight="bold" color="#1c1c1c">{challenge.title}</text>
                {isCompleted && (
                    <text size="large">✅</text>
                )}
            </hstack>
            
            {/* Tags on separate line */}
            {challenge.tags && challenge.tags.length > 0 && (
                <hstack gap="small" alignment="middle">
                    {challenge.tags.slice(0, 2).map((tag) => (
                        <hstack 
                            padding="small"
                            backgroundColor="#228B22"
                            cornerRadius="small"
                            gap="small"
                            alignment="middle"
                        >
                            <text size="xsmall" color="#FFFFFF">🏷️</text>
                            <text size="xsmall" color="#FFFFFF" weight="bold">{tag}</text>
                        </hstack>
                    ))}
                </hstack>
            )}
            
            {/* Description */}
            {challenge.description && (
                <text size="small" color="#666666">{challenge.description}</text>
            )}

            {/* Image Grid - Compact */}
            <ImageGrid 
                images={challenge.images} 
                onEnlarge={handleEnlargeImage}
            />

            {/* Low-attempt warning */}
            {attemptsRemaining <= 3 && attemptsRemaining > 0 && !gameState.isGameOver && (
                <hstack 
                    padding="small" 
                    backgroundColor="#FFF4E6"
                    cornerRadius="small"
                    border="thin"
                    borderColor="#FF8C00"
                    width="100%"
                    alignment="center middle"
                >
                    <text size="small" color="#FF8C00" weight="bold">
                        ⚠️ Only {attemptsRemaining} attempts remaining!
                    </text>
                </hstack>
            )}

            {/* AI Judgment Message - Flexible height, positioned at bottom-left with avatar */}
            <hstack 
                width="100%"
                gap="small"
                alignment="start top"
            >
                {/* Creator Avatar - Large on bottom-left */}
                {challenge.creator_avatar_url ? (
                    <image 
                        url={challenge.creator_avatar_url}
                        imageWidth={80}
                        imageHeight={80}
                        width="80px"
                        height="80px"
                        resizeMode="cover"
                    />
                ) : (
                    <vstack 
                        width="80px" 
                        height="80px" 
                        backgroundColor="#FF4500"
                        cornerRadius="full"
                        alignment="center middle"
                    >
                        <text size="xxlarge" weight="bold" color="#FFFFFF">
                            {challenge.creator_username.charAt(0).toUpperCase()}
                        </text>
                    </vstack>
                )}
                
                {/* AI Message Box - Shows game state, AI feedback, or end game messages */}
                <vstack 
                    grow
                    padding="medium" 
                    backgroundColor={
                        isCompleted
                            ? "#E8F5E9"  // Green for already completed
                            : isGameOver && !isCompleted
                                ? "#FFEBEE"  // Red for game over (failed)
                            : isCreator
                                ? "#FFF4E6"  // Orange for creator
                                : gameState.isGameOver && !gameState.isCorrect
                                    ? "#FFEBEE"  // Red for game over (failed)
                                    : gameState.isGameOver && gameState.isCorrect
                                        ? "#E8F5E9"  // Green for success
                                        : isThinking
                                            ? "#FFF4E6"  // Orange for thinking
                                            : gameState.message === "..." 
                                                ? "#F6F7F8"  // Gray for initial state
                                                : "#FFEBEE"  // Red for incorrect guess
                    }
                    cornerRadius="medium"
                    border="thick"
                    borderColor={
                        isCompleted
                            ? "#4CAF50"  // Green border for completed
                            : isGameOver && !isCompleted
                                ? "#D32F2F"  // Red border for game over
                            : isCreator
                                ? "#FF8C00"  // Orange border for creator
                                : gameState.isGameOver && !gameState.isCorrect
                                    ? "#D32F2F"  // Red border for game over
                                    : gameState.isGameOver && gameState.isCorrect
                                        ? "#4CAF50"  // Green border for success
                                        : isThinking
                                            ? "#FF8C00"  // Orange border for thinking
                                            : gameState.message === "..." 
                                                ? "#E0E0E0"  // Gray border for initial
                                                : "#FF4500"  // Red border for incorrect
                    }
                    alignment="start top"
                    gap="small"
                    minHeight="100px"
                    maxHeight="140px"
                >
                    {/* Already Completed Message */}
                    {isCompleted ? (
                        <vstack gap="small" alignment="start top" width="100%">
                            <text size="large" weight="bold" color="#2E7D32" wrap>
                                Already Completed!
                            </text>
                            <text size="medium" color="#1B5E20" wrap>
                                You earned {completedScore} points
                            </text>
                        </vstack>
                    ) : isGameOver && !isCompleted ? (
                        /* Game Over - Failed (loaded from database) */
                        <vstack gap="small" alignment="start top" width="100%">
                            <text size="large" weight="bold" color="#D32F2F" wrap>
                                Game Over
                            </text>
                            <text size="medium" color="#666666" wrap>
                                You've used all 10 attempts
                            </text>
                            <text size="medium" color="#1c1c1c" weight="bold" wrap>
                                The answer was: {challenge.correct_answer}
                            </text>
                        </vstack>
                    ) : isCreator ? (
                        /* Creator Message */
                        <vstack gap="small" alignment="start top" width="100%">
                            <text size="large" weight="bold" color="#FF8C00" wrap>
                                This is your challenge!
                            </text>
                            <text size="medium" color="#666666" wrap>
                                You can't answer your own challenge
                            </text>
                        </vstack>
                    ) : gameState.isGameOver && !gameState.isCorrect ? (
                        /* Game Over - Failed */
                        <vstack gap="small" alignment="start top" width="100%">
                            <text size="large" weight="bold" color="#D32F2F" wrap>
                                Game Over
                            </text>
                            <text size="medium" color="#666666" wrap>
                                You've used all 10 attempts
                            </text>
                            <text size="medium" color="#1c1c1c" weight="bold" wrap>
                                The answer was: {challenge.correct_answer}
                            </text>
                        </vstack>
                    ) : gameState.isGameOver && gameState.isCorrect ? (
                        /* Success Message */
                        <vstack gap="small" alignment="start top" width="100%">
                            <text size="large" weight="bold" color="#2E7D32" wrap>
                                🎉 Correct!
                            </text>
                            <text size="medium" color="#1B5E20" wrap>
                                {gameState.message}
                            </text>
                        </vstack>
                    ) : (
                        /* Regular AI Feedback */
                        <text 
                            size="medium" 
                            weight="bold" 
                            color={
                                isThinking
                                    ? "#FF8C00" 
                                    : gameState.message === "..." 
                                        ? "#878a8c" 
                                        : "#D32F2F"
                            }
                            wrap
                            width="100%"
                        >
                            {gameState.message}
                        </text>
                    )}
                </vstack>
            </hstack>

            {/* Spacer to push button down */}
            <spacer size="small" />

            {/* Answer Button or Status */}
            {!gameState.isGameOver && !isCompleted && !isGameOver && !isCreator && (
                <hstack width="100%" alignment="center middle">
                    {checkingCompletion ? (
                        <text size="small" color="#878a8c">Checking status...</text>
                    ) : (
                        <button 
                            onPress={onSubmitAnswer}
                            appearance="primary"
                            size="medium"
                            disabled={isThinking}
                        >
                            {isThinking ? '⏳ Checking...' : '✍️ Click to Answer'}
                        </button>
                    )}
                </hstack>
            )}

            {/* Game Over Actions */}
            {(gameState.isGameOver || isGameOver) && (
                <vstack gap="small" width="100%">
                    <button
                        onPress={onNextChallenge}
                        appearance="primary"
                        size="medium"
                        width="100%"
                    >
                        Next Challenge →
                    </button>
                </vstack>
            )}
        </vstack>
    );
};
