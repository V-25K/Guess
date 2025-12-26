/**
 * EnlargedImageOverlay Component
 * Full-screen overlay for viewing enlarged challenge images
 * Note: Description is NOT shown here - use HintDescriptionOverlay for revealed hints
 */

import React, { useCallback } from 'react';
import type { ImageItem } from '../../../shared/models/challenge.types';

export interface EnlargedImageOverlayProps {
  image: ImageItem;
  onClose: () => void;
}

export const EnlargedImageOverlay: React.FC<EnlargedImageOverlayProps> = ({
  image,
  onClose,
}) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Enlarged image view"
    >
      <button
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '44px',
          height: '44px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
        aria-label="Close enlarged image"
      >
        ✕
      </button>
      <img
        src={image.url}
        style={{
          maxWidth: '100%',
          maxHeight: '70%',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
        alt="Enlarged challenge image"
      />
      <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '16px', fontSize: '14px' }}>
        Tap anywhere to close
      </p>
    </div>
  );
};
