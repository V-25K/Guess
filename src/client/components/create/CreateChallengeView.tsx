/**
 * Create Challenge View Component (React)
 * Form for creating new challenges with answer set preview flow
 * Uses Tailwind CSS for styling
 * Requirements: 1.2
 * 
 * Flow: Form → AI generates answers → Review page → Edit/Confirm → Submit
 */

import React, { useState, FormEvent } from 'react';
import { apiClient } from '../../api/client';
import type { ChallengeCreate } from '../../../shared/models/challenge.types';
import type { AnswerSetPreview } from '../../api/types';
import { ThemeSelector } from './ThemeSelector';
import { ChallengeDetailsForm } from './ChallengeDetailsForm';
import { CreateFormHeader } from './CreateFormHeader';
import { ImagesSection } from './ImagesSection';
import { AnswerSetEditor } from './AnswerSetEditor';
import { calculateHintPenalty } from '../../../shared/utils/reward-calculator';
import { useToast } from '../shared/Toast';

export interface CreateChallengeViewProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type CreateStep = 'form' | 'preview' | 'submitting';

export function CreateChallengeView({ onSuccess, onCancel }: CreateChallengeViewProps) {
  const { showToast } = useToast();
  
  // Form state
  const [title, setTitle] = useState('');
  const [answer, setAnswer] = useState('');
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [image3, setImage3] = useState('');
  const [desc1, setDesc1] = useState('');
  const [desc2, setDesc2] = useState('');
  const [desc3, setDesc3] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [answerExplanation, setAnswerExplanation] = useState('');

  // Flow state
  const [currentStep, setCurrentStep] = useState<CreateStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Answer set preview state
  const [answerSet, setAnswerSet] = useState<AnswerSetPreview | null>(null);
  const [editedCorrectAnswers, setEditedCorrectAnswers] = useState<string[]>([]);
  const [editedCloseAnswers, setEditedCloseAnswers] = useState<string[]>([]);

  // Custom themes state
  const [customThemes, setCustomThemes] = useState<string[]>([]);

  const toggleTheme = (theme: string) => {
    if (selectedTags.includes(theme)) {
      setSelectedTags(selectedTags.filter(t => t !== theme));
    } else {
      if (selectedTags.length < 3) {
        setSelectedTags([...selectedTags, theme]);
      }
    }
  };

  // Collect form data into ChallengeCreate object
  const collectFormData = (): { data: ChallengeCreate; imageUrls: string[] } | null => {
    if (!title.trim() || !answer.trim()) {
      setMessage('Please fill in title and correct answer');
      return null;
    }

    if (!answerExplanation.trim()) {
      setMessage('Please provide an answer explanation');
      return null;
    }

    const imageUrls: string[] = [];
    const imageDescriptions: string[] = [];

    if (image1.trim()) {
      imageUrls.push(image1.trim());
      if (!desc1.trim()) {
        setMessage('Please describe Image 1');
        return null;
      }
      imageDescriptions.push(desc1.trim());
    }

    if (image2.trim()) {
      imageUrls.push(image2.trim());
      if (!desc2.trim()) {
        setMessage('Please describe Image 2');
        return null;
      }
      imageDescriptions.push(desc2.trim());
    }

    if (image3.trim()) {
      imageUrls.push(image3.trim());
      if (!desc3.trim()) {
        setMessage('Please describe Image 3');
        return null;
      }
      imageDescriptions.push(desc3.trim());
    }

    if (imageUrls.length < 2) {
      setMessage('Please add at least 2 images');
      return null;
    }

    if (selectedTags.length === 0) {
      setMessage('Please select at least one theme');
      return null;
    }

    const firstHintCost = calculateHintPenalty(imageUrls.length, 1);

    return {
      data: {
        creator_id: '',
        creator_username: '',
        title: title.trim(),
        image_url: imageUrls.join(','),
        image_descriptions: imageDescriptions,
        tags: selectedTags,
        correct_answer: answer.trim(),
        answer_explanation: answerExplanation.trim(),
        max_score: 30,
        score_deduction_per_hint: firstHintCost,
      },
      imageUrls,
    };
  };

  // Step 1: Generate answer set preview
  const handleGeneratePreview = async (e?: FormEvent | React.MouseEvent) => {
    e?.preventDefault();

    const formResult = collectFormData();
    if (!formResult) return;

    setIsLoading(true);
    showToast('Generating answer variations...', 'info');

    try {
      const preview = await apiClient.previewAnswerSet(formResult.data);

      setAnswerSet(preview);
      setEditedCorrectAnswers([...preview.correct]);
      setEditedCloseAnswers([...preview.close]);
      setCurrentStep('preview');
      setMessage('');
    } catch (error) {
      console.error('Error generating preview:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate answer preview';
      showToast(errorMsg, 'error');
      setMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit final challenge with edited answer set
  const handleFinalSubmit = async () => {
    const formResult = collectFormData();
    if (!formResult) return;

    setCurrentStep('submitting');
    setIsLoading(true);
    showToast('Creating challenge...', 'info');

    try {
      const challengeData: ChallengeCreate = {
        ...formResult.data,
        answer_set: {
          correct: editedCorrectAnswers,
          close: editedCloseAnswers,
        },
      };

      const createdChallenge = await apiClient.createChallenge(challengeData);

      // Create Reddit post for the challenge
      try {
        const postResult = await apiClient.createChallengePost(createdChallenge.id);
        if (postResult.posted) {
          showToast('Challenge posted to Reddit!', 'success');
        } else {
          showToast('Challenge created successfully!', 'success');
        }
      } catch (postError) {
        console.error('Error creating Reddit post:', postError);
        showToast('Challenge created successfully!', 'success');
      }

      // Redirect to menu immediately
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to create challenge';
      showToast(errorMsg, 'error');
      setMessage(errorMsg);
      setCurrentStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToForm = () => {
    setCurrentStep('form');
    setMessage('');
  };

  const handleAddCustomTheme = (theme: string) => {
    if (!customThemes.includes(theme)) {
      setCustomThemes(prev => [...prev, theme]);
    }
  };

  // Render preview/review step
  if (currentStep === 'preview' || currentStep === 'submitting') {
    return (
      <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col overflow-hidden text-neutral-900 dark:text-white/95">
        {/* Header */}
        <div className="p-4 bg-white dark:bg-[#1a2332] border-b border-neutral-200 dark:border-white/[0.08] flex items-center gap-3">
          <button
            onClick={handleBackToForm}
            disabled={isLoading}
            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Back to form"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Review Answer Set</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[180px] flex flex-col gap-4">
          {message && (
            <div
              className={`p-3 rounded-lg text-center text-sm font-semibold ${
                message.includes('success')
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : message.includes('Creating') || message.includes('Generating')
                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                  : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
              }`}
            >
              {message}
            </div>
          )}

          {/* Challenge Summary */}
          <div className="bg-white dark:bg-[#1a2332] rounded-xl p-4 border border-neutral-200 dark:border-white/[0.08]">
            <h3 className="text-xs font-bold text-neutral-500 dark:text-white/50 uppercase tracking-wide mb-2">Challenge</h3>
            <p className="font-semibold text-base">{title}</p>
            <p className="text-sm text-neutral-600 dark:text-white/70 mt-1">Answer: <span className="font-medium">{answer}</span></p>
          </div>

          {/* Answer Set Editor */}
          <div className="bg-white dark:bg-[#1a2332] rounded-xl p-4 border border-neutral-200 dark:border-white/[0.08]">
            <h3 className="text-xs font-bold text-neutral-500 dark:text-white/50 uppercase tracking-wide mb-3">Answer Variations</h3>
            <AnswerSetEditor
              correctAnswers={editedCorrectAnswers}
              closeAnswers={editedCloseAnswers}
              onCorrectChange={setEditedCorrectAnswers}
              onCloseChange={setEditedCloseAnswers}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-[#1a2332] border-t border-neutral-200 dark:border-white/[0.08] flex gap-3 fixed bottom-[60px] left-0 right-0 z-10 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            className="flex-1 bg-transparent text-neutral-700 dark:text-white/70 border border-neutral-200 dark:border-white/[0.12] rounded-full py-3 font-semibold text-[15px] cursor-pointer flex items-center justify-center min-h-touch hover:bg-neutral-50 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={handleBackToForm}
            disabled={isLoading}
          >
            Back
          </button>
          <button
            className="flex-1 bg-game-primary dark:bg-gradient-to-r dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#0f1419] border-none rounded-full py-3 font-bold text-[15px] cursor-pointer flex items-center justify-center min-h-touch hover:bg-game-primary-hover dark:hover:from-[#e4b85b] dark:hover:to-[#f5dc8c] focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            onClick={handleFinalSubmit}
            disabled={isLoading || editedCorrectAnswers.length === 0}
          >
            {isLoading ? 'Posting...' : 'Post Challenge'}
          </button>
        </div>
      </div>
    );
  }

  // Render form step
  return (
    <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col overflow-hidden text-neutral-900 dark:text-white/95">
      {/* Header */}
      <CreateFormHeader onCancel={onCancel} />

      {/* Form Content */}
      <form className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[180px] flex flex-col gap-4">
        {message && (
          <div
            className={`p-3 rounded-lg text-center text-sm font-semibold ${
              message.includes('success')
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : message.includes('Generating')
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        {/* Basic Info */}
        <ChallengeDetailsForm
          title={title}
          answer={answer}
          answerExplanation={answerExplanation}
          onTitleChange={setTitle}
          onAnswerChange={setAnswer}
          onExplanationChange={setAnswerExplanation}
        />

        {/* Images */}
        <ImagesSection
          image1={image1}
          image2={image2}
          image3={image3}
          desc1={desc1}
          desc2={desc2}
          desc3={desc3}
          onImage1Change={setImage1}
          onImage2Change={setImage2}
          onImage3Change={setImage3}
          onDesc1Change={setDesc1}
          onDesc2Change={setDesc2}
          onDesc3Change={setDesc3}
        />

        {/* Themes */}
        <div className="bg-white dark:bg-[#1a2332] rounded-xl p-4 flex flex-col gap-3 border border-neutral-200 dark:border-white/[0.08]">
          <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white/95 m-0">
            Themes <span className="text-red-500">*</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-white/50 m-0">Select at least 1 theme (max 3) or create your own</p>
          <ThemeSelector
            selectedThemes={selectedTags}
            onToggleTheme={toggleTheme}
            maxThemes={3}
            customThemes={customThemes}
            onAddCustomTheme={handleAddCustomTheme}
          />
        </div>
      </form>

      {/* Sticky Footer - Generate Preview */}
      <div className="p-4 bg-white dark:bg-[#1a2332] border-t border-neutral-200 dark:border-white/[0.08] flex gap-3 fixed bottom-[60px] left-0 right-0 z-10 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          className="flex-1 bg-transparent text-neutral-700 dark:text-white/70 border border-neutral-200 dark:border-white/[0.12] rounded-full py-3 font-semibold text-[15px] cursor-pointer flex items-center justify-center min-h-touch hover:bg-neutral-50 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          className="flex-1 bg-game-primary dark:bg-gradient-to-r dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#0f1419] border-none rounded-full py-3 font-bold text-[15px] cursor-pointer flex items-center justify-center min-h-touch hover:bg-game-primary-hover dark:hover:from-[#e4b85b] dark:hover:to-[#f5dc8c] focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          onClick={handleGeneratePreview}
          disabled={isLoading}
        >
          {isLoading ? 'Generating...' : 'Preview Answers'}
        </button>
      </div>
    </div>
  );
}
