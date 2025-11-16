/**
 * PlayGameView Component
 * Main gameplay view for playing challenges
 */

import { Devvit } from '@devvit/public-api';
import type { GameChallenge } from '../../../shared/models/index.js';

export interface PlayGameViewProps {
    challenge: GameChallenge;
    gameState: {
        revealedCount: number;
        score: number;
        message: string;
        isGameOver: boolean;
    };
    onRevealImage: (index: number) => void;
    onSubmitAnswer: () => void;
    onNextChallenge: () => void;
    onBackToMenu: () => void;
}

/**
 * Render individual image cell with proper image fitting
 */
const ImageCell: Devvit.BlockComponent<{
    image: any;
    index: number;
    sizePx: number;
    isGameOver: boolean;
    onReveal: (index: number) => void;
}> = ({ image, index, sizePx, isGameOver, onReveal }) => (
    <vstack 
        width={`${sizePx}px`}
        height={`${sizePx}px`}
        backgroundColor={image.isRevealed ? "#FFFFFF" : "#E0E0E0"}
        cornerRadius="medium"
        alignment="center middle"
        border="thick"
        borderColor={image.isRevealed ? "#4CAF50" : "#BDBDBD"}
        onPress={() => {
            if (!image.isRevealed && !isGameOver) {
                onReveal(index);
            }
        }}
    >
        {image.isRevealed ? (
            <image 
                url={image.url} 
                imageWidth={sizePx} 
                imageHeight={sizePx} 
                resizeMode="cover"
                width={`${sizePx}px`}
                height={`${sizePx}px`}
            />
        ) : (
            <text size="xxlarge">🔒</text>
        )}
    </vstack>
);

/**
 * Render image grid based on image count
 */
const ImageGrid: Devvit.BlockComponent<{
    images: any[];
    isGameOver: boolean;
    onReveal: (index: number) => void;
}> = ({ images, isGameOver, onReveal }) => {
    const imageCount = images.length;

    if (imageCount === 5) {
        return (
            <vstack gap="small" width="100%" alignment="center middle">
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[0]} index={0} sizePx={80} isGameOver={isGameOver} onReveal={onReveal} />
                    <ImageCell image={images[1]} index={1} sizePx={80} isGameOver={isGameOver} onReveal={onReveal} />
                    <ImageCell image={images[2]} index={2} sizePx={80} isGameOver={isGameOver} onReveal={onReveal} />
                </hstack>
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[3]} index={3} sizePx={80} isGameOver={isGameOver} onReveal={onReveal} />
                    <ImageCell image={images[4]} index={4} sizePx={80} isGameOver={isGameOver} onReveal={onReveal} />
                </hstack>
            </vstack>
        );
    } else if (imageCount === 4) {
        return (
            <vstack gap="small" width="100%" alignment="center middle">
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[0]} index={0} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                    <ImageCell image={images[1]} index={1} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                </hstack>
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[2]} index={2} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                    <ImageCell image={images[3]} index={3} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                </hstack>
            </vstack>
        );
    } else if (imageCount === 3) {
        return (
            <vstack gap="small" width="100%" alignment="center middle">
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[0]} index={0} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                    <ImageCell image={images[1]} index={1} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                </hstack>
                <hstack gap="small" alignment="center middle">
                    <ImageCell image={images[2]} index={2} sizePx={90} isGameOver={isGameOver} onReveal={onReveal} />
                </hstack>
            </vstack>
        );
    } else if (imageCount === 2) {
        return (
            <hstack gap="small" width="100%" alignment="center middle">
                <ImageCell image={images[0]} index={0} sizePx={110} isGameOver={isGameOver} onReveal={onReveal} />
                <ImageCell image={images[1]} index={1} sizePx={110} isGameOver={isGameOver} onReveal={onReveal} />
            </hstack>
        );
    } else {
        return (
            <hstack gap="small" width="100%" alignment="center middle">
                <ImageCell image={images[0]} index={0} sizePx={140} isGameOver={isGameOver} onReveal={onReveal} />
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
    onRevealImage,
    onSubmitAnswer,
    onNextChallenge,
    onBackToMenu,
}) => {
    const isThinking = gameState.message === '🤔 Thinking...';
    
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
                
                {/* Points */}
                <hstack alignment="middle" gap="small">
                    <text size="xlarge" weight="bold" color="#FF4500">{gameState.score}</text>
                    <text size="xsmall" color="#878a8c">pts</text>
                </hstack>
            </hstack>

            {/* Title */}
            <text size="large" weight="bold" color="#1c1c1c">{challenge.title}</text>
            
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
                isGameOver={gameState.isGameOver} 
                onReveal={onRevealImage} 
            />

            {/* Instruction text */}
            {!gameState.isGameOver && (
                <text size="xsmall" color="#878a8c" alignment="center">Tap to reveal</text>
            )}

            {/* AI Judgment Message - Full width */}
            <hstack 
                width="100%"
                padding="small" 
                backgroundColor={
                    isThinking
                        ? "#FFF4E6" 
                        : gameState.message === "..." 
                            ? "#F6F7F8" 
                            : gameState.isGameOver 
                                ? "#E8F5E9" 
                                : "#FFEBEE"
                }
                cornerRadius="medium"
                border="thick"
                borderColor={
                    isThinking
                        ? "#FF8C00" 
                        : gameState.message === "..." 
                            ? "#E0E0E0" 
                            : gameState.isGameOver 
                                ? "#4CAF50" 
                                : "#FF4500"
                }
                alignment="middle"
                gap="small"
            >
                {/* Creator Avatar */}
                {challenge.creator_avatar_url ? (
                    <image 
                        url={challenge.creator_avatar_url}
                        imageWidth={24}
                        imageHeight={24}
                        width="24px"
                        height="24px"
                        resizeMode="cover"
                    />
                ) : (
                    <vstack 
                        width="24px" 
                        height="24px" 
                        backgroundColor="#FF4500"
                        cornerRadius="full"
                        alignment="center middle"
                    >
                        <text size="small" weight="bold" color="#FFFFFF">
                            {challenge.creator_username.charAt(0).toUpperCase()}
                        </text>
                    </vstack>
                )}
                
                {/* AI Message */}
                <text 
                    size="small" 
                    weight="bold" 
                    color={
                        isThinking
                            ? "#FF8C00" 
                            : gameState.message === "..." 
                                ? "#878a8c" 
                            : gameState.isGameOver 
                                    ? "#2E7D32" 
                                    : "#D32F2F"
                    }
                >
                    {gameState.message}
                </text>
            </hstack>

            {/* Answer Button */}
            {!gameState.isGameOver && (
                <button 
                    onPress={onSubmitAnswer}
                    appearance="primary"
                    size="medium"
                    width="100%"
                    disabled={isThinking}
                >
                    {isThinking ? '⏳ Checking...' : '💬 Submit Answer'}
                </button>
            )}

            {/* Game Over Actions */}
            {gameState.isGameOver && (
                <vstack gap="small" width="100%">
                    <button
                        onPress={onNextChallenge}
                        appearance="primary"
                        size="medium"
                        width="100%"
                    >
                        Next Challenge →
                    </button>
                    <button 
                        onPress={onBackToMenu} 
                        appearance="secondary" 
                        size="small"
                        width="100%"
                    >
                        Back to Menu
                    </button>
                </vstack>
            )}
        </vstack>
    );
};
