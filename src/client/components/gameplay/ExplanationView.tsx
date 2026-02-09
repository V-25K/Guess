/**
 * ExplanationView Component
 * Displays the answer explanation after game completion
 * Features a swipeable image carousel with side-by-side layout
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../shared/Button';
import type { GameChallenge } from '../../../shared/models/challenge.types';

export interface ExplanationViewProps {
  challenge: GameChallenge;
  onClose: () => void;
}

export const ExplanationView: React.FC<ExplanationViewProps> = ({
  challenge,
  onClose,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = challenge.images || [];
  const currentImage = images[currentImageIndex];
  const explanationRef = useRef<HTMLDivElement>(null);

  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const goToPrevious = useCallback(() => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1);
    }
  }, [currentImageIndex]);

  const goToNext = useCallback(() => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex((prev) => prev + 1);
    }
  }, [currentImageIndex, images.length]);

  const scrollExplanation = useCallback(() => {
    explanationRef.current?.scrollBy({ top: 60, behavior: 'smooth' });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe) {
      if (distance > 0 && currentImageIndex < images.length - 1) {
        // Swipe left - go to next
        setCurrentImageIndex((prev) => prev + 1);
      } else if (distance < 0 && currentImageIndex > 0) {
        // Swipe right - go to previous
        setCurrentImageIndex((prev) => prev - 1);
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [currentImageIndex, images.length]);

  return (
    <div 
      className="h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col text-neutral-900 dark:text-white/95 overflow-hidden" 
      role="region" 
      aria-label="Answer explanation"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#1a2332] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-500 dark:text-white/50">Answer:</span>
          <span className="text-base font-bold text-game-primary dark:text-[#f0d078]">{challenge.correct_answer}</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/20 transition-colors text-neutral-600 dark:text-white/70"
          aria-label="Close explanation"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Main content - responsive layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden p-4 gap-4">
        {/* Answer Explanation Section - left side on larger screens */}
        {challenge.answer_explanation && (
          <div className="flex-shrink-0 md:flex-1 md:flex md:flex-col md:min-h-0">
            <div className="relative rounded-xl border border-game-primary/20 dark:border-[#f0d078]/20 overflow-hidden h-full flex flex-col">
              {/* Sticky opaque header */}
              <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-[#2a2518] border-b border-game-primary/10 dark:border-[#f0d078]/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-game-primary dark:text-[#f0d078] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <h4 className="text-xs font-semibold text-game-primary dark:text-[#f0d078] uppercase tracking-wide">
                    Why this answer?
                  </h4>
                </div>
                {/* Scroll down button */}
                <button
                  onClick={scrollExplanation}
                  className="w-6 h-6 rounded-full bg-game-primary/10 dark:bg-[#f0d078]/10 hover:bg-game-primary/20 dark:hover:bg-[#f0d078]/20 flex items-center justify-center transition-colors"
                  aria-label="Scroll down"
                >
                  <svg className="w-3.5 h-3.5 text-game-primary dark:text-[#f0d078]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {/* Scrollable content */}
              <div 
                ref={explanationRef}
                className="max-h-24 md:max-h-none md:flex-1 overflow-y-auto bg-gradient-to-br from-game-primary/5 to-amber-50 dark:from-[#f0d078]/5 dark:to-[#1a1508] px-4 py-3"
              >
                <p className="text-sm text-neutral-700 dark:text-white/80 leading-relaxed whitespace-pre-line">
                  {challenge.answer_explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Image Carousel Section - right side on larger screens */}
        {images.length > 0 && (
          <div 
            className="flex-shrink-0 md:flex-1 md:flex md:flex-col md:min-h-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Side-by-side: Image left, Description right */}
            <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-neutral-200 dark:border-white/[0.12] overflow-hidden h-full flex flex-col">
              <div className="flex flex-row relative flex-1 min-h-0">
                {/* Image - Left side */}
                <div className="w-1/2 bg-neutral-100 dark:bg-[#243044] flex-shrink-0 relative">
                  <img
                    src={currentImage?.url}
                    alt={currentImage?.description || `Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Navigation Arrows overlayed on image */}
                  {images.length > 1 && (
                    <>
                      {/* Left Arrow */}
                      <button
                        onClick={goToPrevious}
                        disabled={currentImageIndex === 0}
                        className={`absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          currentImageIndex === 0
                            ? 'bg-black/20 text-white/40 cursor-not-allowed'
                            : 'bg-black/50 hover:bg-black/70 text-white cursor-pointer'
                        }`}
                        aria-label="Previous image"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {/* Right Arrow */}
                      <button
                        onClick={goToNext}
                        disabled={currentImageIndex === images.length - 1}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          currentImageIndex === images.length - 1
                            ? 'bg-black/20 text-white/40 cursor-not-allowed'
                            : 'bg-black/50 hover:bg-black/70 text-white cursor-pointer'
                        }`}
                        aria-label="Next image"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* Description - Right side */}
                <div className="w-1/2 p-3 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-game-primary/10 dark:bg-[#f0d078]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-game-primary dark:text-[#f0d078]">
                        {currentImageIndex + 1}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-white/50">
                      of {images.length}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-white/80 leading-relaxed line-clamp-4 md:line-clamp-none md:overflow-y-auto">
                    {currentImage?.description || 'No description available.'}
                  </p>
                </div>
              </div>

              {/* Dot indicators & swipe hint */}
              {images.length > 1 && (
                <div className="px-3 py-2 border-t border-neutral-100 dark:border-white/[0.06] flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] text-neutral-400 dark:text-white/40">
                    Swipe to navigate
                  </span>
                  <div className="flex gap-1.5">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentImageIndex
                            ? 'bg-game-primary dark:bg-[#f0d078] scale-110'
                            : 'bg-neutral-300 dark:bg-white/30'
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#1a2332] flex-shrink-0">
        <Button variant="primary" fullWidth onClick={onClose}>
          Back to Challenge
        </Button>
      </div>
    </div>
  );
};
