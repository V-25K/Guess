/**
 * Challenge Creation View Component
 * Handles the entire challenge creation flow with form and UI
 */

import { Devvit, useForm, useState } from '@devvit/public-api';
import { ChallengeService } from '../../../server/services/challenge.service.js';
import { UserService } from '../../../server/services/user.service.js';
import type { Challenge } from '../../../shared/models/challenge.types.js';
import { formatTimeRemaining } from '../../../shared/utils/date-utils.js';

export interface ChallengeCreationViewProps {
    userId: string;
    username: string;
    canCreateChallenge: boolean;
    userLevel: number;
    isModerator: boolean;
    challengeService: ChallengeService;
    userService: UserService;
    onSuccess: (challenge: Challenge) => void;
    onCancel: () => void;
    onBackToMenu: () => void;
}

/**
 * Challenge Creation View
 * Displays creation UI and handles form submission
 */
export const ChallengeCreationView: Devvit.BlockComponent<ChallengeCreationViewProps> = (
    { userId, username, canCreateChallenge, userLevel, isModerator, challengeService, userService, onSuccess, onCancel, onBackToMenu },
    context
) => {
    const REQUIRED_LEVEL = 3;
    
    // State: 'idle' | 'creating' | 'success' | 'error'
    const [status, setStatus] = useState<string>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Process challenge creation
    const processCreation = async (values: Record<string, unknown>) => {
        try {
            // Check rate limit
            const rateLimitCheck = await userService.canCreateChallenge(userId);
            if (!rateLimitCheck.canCreate) {
                const timeStr = formatTimeRemaining(rateLimitCheck.timeRemaining);
                throw new Error(`Challenge cooldown active. Try again in ${timeStr}`);
            }

            // Validate images
            const imageUrlArray: string[] = [];
            if (values.image1) imageUrlArray.push(values.image1 as string);
            if (values.image2) imageUrlArray.push(values.image2 as string);
            if (values.image3) imageUrlArray.push(values.image3 as string);

            if (imageUrlArray.length < 2 || imageUrlArray.length > 3) {
                throw new Error('Please upload 2-3 images');
            }

            // Collect and validate image descriptions
            const imageDescriptions: string[] = [];
            if (values.image1) {
                const desc1 = values.desc1 as string | undefined;
                if (!desc1?.trim()) {
                    throw new Error('Please describe Image 1');
                }
                imageDescriptions.push(desc1.trim().substring(0, 100));
            }
            if (values.image2) {
                const desc2 = values.desc2 as string | undefined;
                if (!desc2?.trim()) {
                    throw new Error('Please describe Image 2');
                }
                imageDescriptions.push(desc2.trim().substring(0, 100));
            }
            if (values.image3) {
                const desc3 = values.desc3 as string | undefined;
                if (!desc3?.trim()) {
                    throw new Error('Please describe Image 3');
                }
                imageDescriptions.push(desc3.trim().substring(0, 100));
            }

            const tag = values.tag as string | string[] | undefined;
            const tagArray: string[] = tag
                ? (Array.isArray(tag) ? tag : [tag])
                : [];

            // Fixed scoring values for attempt-based system
            const maxScore = 30;
            const scoreDeductionPerHint = 2;

            const title = values.title as string;
            const answer = values.answer as string;
            const answerExplanation = values.answerExplanation as string | undefined;

            // Create challenge
            const challenge = await challengeService.createChallenge({
                creator_id: userId,
                creator_username: username,
                title: title.trim(),
                description: null,
                image_url: imageUrlArray.join(','),
                image_descriptions: imageDescriptions,
                answer_explanation: answerExplanation?.trim() || undefined,
                correct_answer: answer.trim(),
                tags: tagArray,
                max_score: maxScore,
                score_deduction_per_hint: scoreDeductionPerHint,
                players_played: 0,
                players_completed: 0,
            });

            if (challenge) {
                // Create Reddit post for the challenge
                await challengeService.createRedditPostForChallenge(challenge.id);

                // Call parent's success handler to refresh data in background
                onSuccess(challenge);

                // Set success status - this will show success screen after form closes
                setStatus('success');
            } else {
                throw new Error('Failed to create challenge');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error creating challenge';
            setErrorMessage(message);
            setStatus('error');
            context.ui.showToast(`❌ ${message}`);
        }
    };

    const createForm = useForm(
        {
            title: 'Create Challenge',
            description: 'Upload images and create your puzzle',
            fields: [
                {
                    name: 'title',
                    label: 'Challenge Title *',
                    type: 'string',
                    required: true,
                    helpText: 'A catchy title for your challenge',
                },
                {
                    name: 'answer',
                    label: 'Correct Answer *',
                    type: 'string',
                    required: true,
                    helpText: 'The common link between all images',
                },
                {
                    name: 'tag',
                    label: 'Category *',
                    type: 'select',
                    required: true,
                    options: [
                        { label: '🎌 Anime', value: 'anime' },
                        { label: '🌐 General', value: 'general' },
                        { label: '⚽ Sport', value: 'sport' },
                        { label: '🎬 Movies', value: 'movies' },
                        { label: '🎵 Music', value: 'music' },
                        { label: '🎮 Gaming', value: 'gaming' },
                        { label: '📜 History', value: 'history' },
                        { label: '🔬 Science', value: 'science' },
                        { label: '🗺️ Geography', value: 'geography' },
                        { label: '🍕 Food', value: 'food' },
                        { label: '🎨 Art', value: 'art' },
                        { label: '💻 Technology', value: 'technology' },
                        { label: '🌿 Nature', value: 'nature' },
                        { label: '⭐ Celebrities', value: 'celebrities' },
                        { label: '🏷️ Brands', value: 'brands' },
                    ],
                    helpText: 'Select the main category for your challenge',
                },
                {
                    name: 'image1',
                    label: 'Image 1 *',
                    type: 'image',
                    required: true,
                    helpText: 'Upload first image',
                },
                {
                    name: 'desc1',
                    label: 'Image 1 Description *',
                    type: 'string',
                    required: true,
                    helpText: 'What does this image show? (max 100 chars)',
                },
                {
                    name: 'image2',
                    label: 'Image 2 *',
                    type: 'image',
                    required: true,
                    helpText: 'Upload second image',
                },
                {
                    name: 'desc2',
                    label: 'Image 2 Description *',
                    type: 'string',
                    required: true,
                    helpText: 'What does this image show? (max 100 chars)',
                },
                {
                    name: 'image3',
                    label: 'Image 3',
                    type: 'image',
                    required: false,
                    helpText: 'Upload third image (optional)',
                },
                {
                    name: 'desc3',
                    label: 'Image 3 Description',
                    type: 'string',
                    required: false,
                    helpText: 'What does this image show? (max 50 chars)',
                },
                {
                    name: 'answerExplanation',
                    label: 'Answer Explanation *',
                    type: 'paragraph',
                    required: true,
                    helpText: 'Explain how the images relate to the answer (1-2 sentences)',
                },
            ],
            acceptLabel: 'Create Challenge',
            cancelLabel: 'Cancel',
        },
        async (values) => {
            if (!values) {
                context.ui.showToast('❌ Form data missing');
                return;
            }

            await processCreation(values);
        }
    );

    // Show success screen after creation
    if (status === 'success') {
        return (
            <vstack
                alignment="center middle"
                padding="medium"
                gap="large"
                width="100%"
                height="100%"
                backgroundColor="#F6F7F8"
            >
                <vstack alignment="center middle" gap="medium">
                    <text style="heading" size="xxlarge">
                        ✅
                    </text>
                    <text style="heading" size="xlarge" color="#FF4500">
                        Challenge Created!
                    </text>
                    <text style="body" color="#878a8c" alignment="center">
                        Your challenge has been created successfully.
                    </text>
                    <text style="body" color="#878a8c" alignment="center">
                        You earned +5 points and +5 experience!
                    </text>
                </vstack>

                <button
                    onPress={() => {
                        setStatus('idle');
                        onBackToMenu();
                    }}
                    appearance="primary"
                    size="large"
                    width="80%"
                >
                    Back to Menu
                </button>
            </vstack>
        );
    }

    // Show error screen if creation failed
    if (status === 'error') {
        return (
            <vstack
                alignment="center middle"
                padding="medium"
                gap="large"
                width="100%"
                height="100%"
                backgroundColor="#F6F7F8"
            >
                <vstack alignment="center middle" gap="medium">
                    <text style="heading" size="xxlarge">
                        ❌
                    </text>
                    <text style="heading" size="xlarge" color="#FF4500">
                        Creation Failed
                    </text>
                    <text style="body" color="#878a8c" alignment="center">
                        {errorMessage || 'Something went wrong. Please try again.'}
                    </text>
                </vstack>

                <button
                    onPress={() => {
                        setStatus('idle');
                        setErrorMessage('');
                    }}
                    appearance="primary"
                    size="large"
                    width="80%"
                >
                    Try Again
                </button>
            </vstack>
        );
    }

    return (
        <vstack
            alignment="center middle"
            padding="medium"
            gap="medium"
            width="100%"
            height="100%"
            backgroundColor="#F6F7F8"
        >
            <vstack alignment="center middle" gap="small" width="100%">
                <text style="heading" size="xxlarge" color="#FF4500">
                    ✨ Create Challenge
                </text>
                <text style="body" color="#878a8c" alignment="center">
                    Create a new image puzzle for others to solve
                </text>
            </vstack>

            <vstack gap="medium" width="80%" alignment="center middle">
                <button
                    onPress={async () => {
                        if (!isModerator && userLevel < REQUIRED_LEVEL) {
                            const levelsNeeded = REQUIRED_LEVEL - userLevel;
                            context.ui.showToast(
                                `🎯 Reach Level ${REQUIRED_LEVEL} to create challenges! (${levelsNeeded} level${levelsNeeded > 1 ? 's' : ''} to go)`
                            );
                        } else if (!canCreateChallenge) {
                            const rateLimitCheck = await userService.canCreateChallenge(userId);
                            const timeStr = formatTimeRemaining(rateLimitCheck.timeRemaining);
                            context.ui.showToast(`⏳ Challenge cooldown active. Next creation in ${timeStr}`);
                        } else {
                            context.ui.showForm(createForm);
                        }
                    }}
                    appearance="primary"
                    size="large"
                    width="100%"
                >
                    {isModerator ? 'Open Create Form (Moderator)' : 'Open Create Form'}
                </button>

                <button
                    onPress={onCancel}
                    appearance="secondary"
                    size="medium"
                    width="100%"
                >
                    Back to Menu
                </button>
            </vstack>

            <vstack
                padding="medium"
                gap="small"
                width="80%"
                backgroundColor="#FFFFFF"
                cornerRadius="medium"
            >
                <text style="body" size="small" color="#1c1c1c" weight="bold">
                    💡 Tips:
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Upload 2-3 images that share a common link
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Describe each image clearly
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Explain how images relate to the answer
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Choose a specific, not too broad answer
                </text>
            </vstack>
        </vstack>
    );
};
