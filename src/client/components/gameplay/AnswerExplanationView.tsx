/**
 * Answer Explanation View Component
 * Shows the correct answer, images with descriptions in a slide view, and explanation
 */

import { Devvit, useState } from '@devvit/public-api';
import type { GameChallenge } from '../../../shared/models/index.js';

export interface AnswerExplanationViewProps {
    challenge: GameChallenge;
    onBack: () => void;
}

/**
 * Answer Explanation View
 * Displays answer, image carousel with descriptions, and explanation
 */
export const AnswerExplanationView: Devvit.BlockComponent<AnswerExplanationViewProps> = ({
    challenge,
    onBack,
}) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handlePrevious = () => {
        setCurrentImageIndex(prev => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        setCurrentImageIndex(prev => Math.min(challenge.images.length - 1, prev + 1));
    };

    const currentImage = challenge.images[currentImageIndex];
    const isFirstImage = currentImageIndex === 0;
    const isLastImage = currentImageIndex === challenge.images.length - 1;

    return (
        <vstack padding="small" gap="small" width="100%" height="100%" backgroundColor="#F6F7F8">
            {/* Compact Header */}
            <hstack width="100%" alignment="middle" gap="small">
                <button
                    onPress={onBack}
                    appearance="secondary"
                    size="small"
                    icon="back"
                />
                <text size="medium" weight="bold" color="#1c1c1c">
                    Answer Explanation
                </text>
            </hstack>

            {/* Compact Answer Section */}
            <vstack
                width="100%"
                padding="small"
                backgroundColor="#E8F5E9"
                cornerRadius="small"
                border="thin"
                borderColor="#4CAF50"
                gap="none"
            >
                <text size="xsmall" color="#2E7D32" weight="bold">
                    ✅ Answer:
                </text>
                <text size="large" weight="bold" color="#1B5E20">
                    {challenge.correct_answer}
                </text>
            </vstack>

            {/* Image Carousel - Takes 70% of space */}
            <vstack
                width="100%"
                padding="small"
                backgroundColor="#FFFFFF"
                cornerRadius="small"
                border="thin"
                borderColor="#E0E0E0"
                gap="small"
                grow
            >
                <text size="small" weight="bold" color="#1c1c1c">
                    📸 {currentImageIndex + 1}/{challenge.images.length}
                </text>

                {/* Image Display - Smaller size */}
                <vstack
                    width="100%"
                    alignment="center middle"
                    gap="small"
                    grow
                >
                    <image
                        url={currentImage.url}
                        imageWidth={200}
                        imageHeight={200}
                        width="200px"
                        height="200px"
                        resizeMode="cover"
                    />

                    {/* Compact Image Description */}
                    <vstack
                        width="100%"
                        padding="small"
                        backgroundColor="#F6F7F8"
                        cornerRadius="small"
                    >
                        <text size="small" color="#666666" wrap alignment="center">
                            {currentImage.description || 'No description provided'}
                        </text>
                    </vstack>
                </vstack>

                {/* Compact Navigation Controls */}
                <hstack width="100%" alignment="center middle" gap="small">
                    <button
                        onPress={handlePrevious}
                        appearance="primary"
                        size="small"
                        disabled={isFirstImage}
                        icon="left"
                    />

                    {/* Page Indicators */}
                    <hstack gap="small" alignment="center middle">
                        {challenge.images.map((_, index) => (
                            <vstack
                                key={`indicator-${index}`}
                                width="6px"
                                height="6px"
                                backgroundColor={index === currentImageIndex ? "#4CAF50" : "#E0E0E0"}
                                cornerRadius="full"
                            />
                        ))}
                    </hstack>

                    <button
                        onPress={handleNext}
                        appearance="primary"
                        size="small"
                        disabled={isLastImage}
                        icon="right"
                    />
                </hstack>
            </vstack>

            {/* Compact Answer Explanation */}
            <vstack
                width="100%"
                padding="small"
                backgroundColor="#FFF9E6"
                cornerRadius="small"
                border="thin"
                borderColor="#FFB300"
                gap="none"
            >
                <text size="xsmall" color="#F57C00" weight="bold">
                    💡 Explanation:
                </text>
                <text size="small" color="#666666" wrap>
                    {challenge.answer_explanation || 'No explanation provided'}
                </text>
            </vstack>

            {/* Compact Back Button */}
            <button
                onPress={onBack}
                appearance="secondary"
                size="small"
                width="100%"
            >
                ← Back
            </button>
        </vstack>
    );
};
