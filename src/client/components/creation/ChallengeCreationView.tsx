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
    { userId, username, canCreateChallenge, challengeService, userService, onSuccess, onCancel },
    context
) => {
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
                    name: 'tags',
                    label: 'Tags * (comma-separated)',
                    type: 'string',
                    required: true,
                    helpText: 'e.g., Movies, Sports, History',
                },
                {
                    name: 'image1',
                    label: 'Image 1 *',
                    type: 'image',
                    required: true,
                    helpText: 'Upload first image',
                },
                {
                    name: 'image2',
                    label: 'Image 2 *',
                    type: 'image',
                    required: true,
                    helpText: 'Upload second image',
                },
                {
                    name: 'image3',
                    label: 'Image 3',
                    type: 'image',
                    required: false,
                    helpText: 'Upload third image (optional)',
                },
                {
                    name: 'image4',
                    label: 'Image 4',
                    type: 'image',
                    required: false,
                    helpText: 'Upload fourth image (optional)',
                },
                {
                    name: 'image5',
                    label: 'Image 5',
                    type: 'image',
                    required: false,
                    helpText: 'Upload fifth image (optional)',
                },
                {
                    name: 'description',
                    label: 'Description',
                    type: 'paragraph',
                    required: false,
                    helpText: 'Additional context or hints (optional)',
                },
            ],
            acceptLabel: 'Create Challenge',
            cancelLabel: 'Cancel',
        },
        async (values) => {
            console.log('[ChallengeCreationView] Form submitted with values:', JSON.stringify(values));
            
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
                if (values.image4) imageUrlArray.push(values.image4);
                if (values.image5) imageUrlArray.push(values.image5);
                
                console.log('[ChallengeCreationView] Collected images:', imageUrlArray.length);
                
                if (imageUrlArray.length < 2) {
                    context.ui.showToast('❌ Please upload at least 2 images');
                    return;
                }
                
                const tagArray = values.tags
                    ? values.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
                    : [];
                
                // Fixed scoring values for attempt-based system
                const maxScore = 30;
                const scoreDeductionPerHint = 2;
                
                const challenge = await challengeService.createChallenge({
                    creator_id: userId,
                    creator_username: username,
                    title: values.title.trim(),
                    description: values.description?.trim() || null,
                    image_url: imageUrlArray.join(','),
                    correct_answer: values.answer.trim(),
                    tags: tagArray,
                    max_score: maxScore,
                    score_deduction_per_hint: scoreDeductionPerHint,
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
                    onPress={() => context.ui.showForm(createForm)}
                    appearance="primary"
                    size="large"
                    width="100%"
                    disabled={!canCreateChallenge}
                >
                    {canCreateChallenge ? '📝 Open Create Form' : '⏳ Rate Limited'}
                </button>
                
                {!canCreateChallenge && (
                    <text size="small" color="#878a8c" alignment="center">
                        You can create a new challenge after the cooldown period
                    </text>
                )}
                
                <button 
                    onPress={onCancel}
                    appearance="secondary"
                    size="medium"
                    width="100%"
                >
                    ← Back to Menu
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
                    • Upload 2-5 images from your device
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Images should share a common theme
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Choose a clear, specific answer
                </text>
                <text style="body" size="xsmall" color="#666666">
                    • Add relevant tags for better discoverability
                </text>
            </vstack>
        </vstack>
    );
};
