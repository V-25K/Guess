/**
 * Answer Explanation View Component
 * Shows the correct answer, images with descriptions in a slide view, and explanation
 */

import { Devvit, useState } from '@devvit/public-api';
import type { GameChallenge } from '../../../shared/models/index.js';
import { BG_PRIMARY } from '../../constants/colors.js';

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
        <vstack padding="small" gap="small" width="100%" height="100%" backgroundColor={BG_PRIMARY}>
            {/* Compact Header */}
            <hstack width="100%" alignment="middle" gap="small">
                <button
                    onPress={onBack}
                    appearance="primary"
                    size="small"
                    icon="back-fill"
                    textColor="global-white"
                    lightTextColor="global-white"
                    darkTextColor="global-white"
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

            {/* Image Carousel - Compact */}
            <vstack
                width="100%"
                padding="small"
                backgroundColor="#FFFFFF"
                cornerRadius="small"
                border="thin"
                borderColor="#E0E0E0"
                gap="small"
            >
                <text size="small" weight="bold" color="#1c1c1c">
                    📸 {currentImageIndex + 1}/{challenge.images.length}
                </text>

                {/* Image Display with Overlay Navigation */}
                <zstack width="100%" height="180px" alignment="center middle">
                    <image
                        url={currentImage.url}
                        imageWidth={180}
                        imageHeight={180}
                        width="180px"
                        height="180px"
                        resizeMode="cover"
                    />

                    {/* Navigation Overlay */}
                    <hstack width="100%" height="100%" alignment="middle" padding="xsmall">
                        <button
                            onPress={handlePrevious}
                            appearance="primary"
                            size="small"
                            disabled={isFirstImage}
                            icon="left-fill"
                            textColor="global-white"
                            lightTextColor="global-white"
                            darkTextColor="global-white"
                        />
                        <spacer grow />
                        <button
                            onPress={handleNext}
                            appearance="primary"
                            size="small"
                            disabled={isLastImage}
                            icon="right-fill"
                            textColor="global-white"
                            lightTextColor="global-white"
                            darkTextColor="global-white"
                        />
                    </hstack>

                    {/* Page Indicators Overlay */}
                    <vstack width="100%" height="100%" alignment="bottom center" padding="small">
                        <hstack gap="small" alignment="center middle">
                            {challenge.images.map((_, index) => (
                                <vstack
                                    key={`indicator-${index}`}
                                    width="6px"
                                    height="6px"
                                    backgroundColor={index === currentImageIndex ? "#4CAF50" : "rgba(255, 255, 255, 0.8)"}
                                    cornerRadius="full"
                                />
                            ))}
                        </hstack>
                    </vstack>
                </zstack>

                {/* Description */}
                <vstack
                    width="100%"
                    padding="small"
                    backgroundColor={BG_PRIMARY}
                    cornerRadius="small"
                >
                    <text size="small" color="#666666" wrap alignment="center">
                        {currentImage.description || 'No description provided'}
                    </text>
                </vstack>
            </vstack>

            {/* Answer Explanation - Takes remaining space */}
            <vstack
                width="100%"
                padding="small"
                backgroundColor="#FFF9E6"
                cornerRadius="small"
                border="thin"
                borderColor="#FFB300"
                gap="none"
                grow
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
