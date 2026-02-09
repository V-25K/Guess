/**
 * HintDescriptionOverlay Component
 * Overlay showing the revealed hint description for an image
 */

import React from 'react';
import type { ImageItem } from '../../../shared/models/challenge.types';

export interface HintDescriptionOverlayProps {
  image: ImageItem;
  imageIndex: number;
  onClose: () => void;
}

export function HintDescriptionOverlay({
  image,
  imageIndex,
  onClose,
}: HintDescriptionOverlayProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={`Hint for image ${imageIndex + 1}`}
      tabIndex={0}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '300px',
          maxHeight: '85%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="dark:!bg-[#1a2332]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image - 1:1 aspect ratio container for consistency */}
        <div 
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          className="dark:!bg-[#243044]"
        >
          <img
            src={image.url}
            alt={`Challenge image ${imageIndex + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Description */}
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span 
              style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              className="text-game-primary dark:text-[#f0d078]"
            >
              Hint
            </span>
            <span 
              style={{ fontSize: '12px' }}
              className="text-neutral-500 dark:text-white/50"
            >
              Image {imageIndex + 1}
            </span>
          </div>
          <p 
            style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}
            className="text-neutral-800 dark:text-white/90"
          >
            {image.description || 'No description available.'}
          </p>
        </div>

        {/* Close button */}
        <button
          type="button"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={onClose}
          aria-label="Close hint"
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
