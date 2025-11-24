/**
 * Challenge Creation View Component
 * Handles the entire challenge creation flow with form and UI
 */

import { Devvit, useForm } from '@devvit/public-api';
import type { ChallengeService } from '../../../server/services/challenge.service.js';
import type { UserService } from '../../../server/services/user.service.js';
import type { Challenge } from '../../../shared/models/challenge.types.js';

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
}

/**
 * Challenge Creation View
 * Displays creation UI and handles form submission
 */
export const ChallengeCreationView: Devvit.BlockComponent<ChallengeCreationViewProps> = (
    { userId, username, canCreateChallenge, userLevel, isModerator, challengeService, userService, onSuccess, onCancel },
    context
) => {
    const REQUIRED_LEVEL = 3;
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
            try {
                if (!values) {
                    console.error('[ChallengeCreationView] No values received from form');
                    context.ui.showToast('❌ Form data missing');
                    return;
                }

                const rateLimitCheck = await userService.canCreateChallenge(userId);
                if (!rateLimitCheck.canCreate) {
                    context.ui.showToast('⏳ Please wait before creating another challenge');
                    return;
                }

                const imageUrlArray: string[] = [];
                if (values.image1) imageUrlArray.push(values.image1);
                if (values.image2) imageUrlArray.push(values.image2);
                if (values.image3) imageUrlArray.push(values.image3);

                if (imageUrlArray.length < 2 || imageUrlArray.length > 3) {
                    context.ui.showToast('❌ Please upload 2-3 images');
                    return;
                }

                // Collect image descriptions (max 100 chars each) - mandatory for uploaded images
                const imageDescriptions: string[] = [];
                if (values.image1) {
                    if (!values.desc1?.trim()) {
                        context.ui.showToast('❌ Please describe Image 1');
                        return;
                    }
                    imageDescriptions.push(values.desc1.trim().substring(0, 100));
                }
                if (values.image2) {
                    if (!values.desc2?.trim()) {
                        context.ui.showToast('❌ Please describe Image 2');
                        return;
                    }
                    imageDescriptions.push(values.desc2.trim().substring(0, 100));
                }
                if (values.image3) {
                    if (!values.desc3?.trim()) {
                        context.ui.showToast('❌ Please describe Image 3');
                        return;
                    }
                    imageDescriptions.push(values.desc3.trim().substring(0, 100));
                }


                const tagArray: string[] = values.tag
                    ? (Array.isArray(values.tag) ? values.tag : [values.tag])
                    : [];

                // Fixed scoring values for attempt-based system
                const maxScore = 30;
                const scoreDeductionPerHint = 2;

                const challenge = await challengeService.createChallenge({
                    creator_id: userId,
                    creator_username: username,
                    title: values.title.trim(),
                    description: null,
                    image_url: imageUrlArray.join(','),
                    image_descriptions: imageDescriptions,
                    answer_explanation: values.answerExplanation?.trim() || undefined,
                    correct_answer: values.answer.trim(),
                    tags: tagArray,
                    max_score: maxScore,
                    score_deduction_per_hint: scoreDeductionPerHint,
                    players_played: 0,
                    players_completed: 0,
                });

                if (challenge) {
                    // Create Reddit post for the challenge (in proper async context)
                    const postId = await challengeService.createRedditPostForChallenge(challenge.id);

                    if (postId) {
                        context.ui.showToast('✅ Challenge created with post! +5 pts, +5 exp');
                    } else {
                        context.ui.showToast('✅ Challenge created! +5 pts, +5 exp (post creation pending)');
                    }

                    onSuccess(challenge);
                } else {
                    context.ui.showToast('❌ Failed to create challenge');
                }
            } catch (error) {
                console.error('Error creating challenge:', error);
                context.ui.showToast('❌ Error creating challenge');
            }
        }
    );

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
                    onPress={() => {
                        if (!isModerator && userLevel < REQUIRED_LEVEL) {
                            context.ui.showToast(
                                `Reach level ${REQUIRED_LEVEL} to create challenges (Current: Level ${userLevel})`
                            );
                        } else if (!canCreateChallenge) {
                            context.ui.showToast('Please wait before creating another challenge');
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
