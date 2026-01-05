/**
 * ImageInput Component
 * Input field for image upload with preview and description
 */

import React, { useState } from 'react';
// @ts-expect-error - showForm is exported from @devvit/client but TypeScript can't resolve it
import { showForm } from '@devvit/client';

export interface ImageInputProps {
  imageUrl: string;
  description: string;
  onImageChange: (url: string) => void;
  onDescriptionChange: (desc: string) => void;
  placeholder: string;
  descriptionPlaceholder: string;
  previewAlt: string;
  /** Unique identifier for accessibility */
  inputId?: string;
  /** Label for the image (e.g., "Image 1") */
  imageLabel?: string;
}

export const ImageInput: React.FC<ImageInputProps> = ({
  imageUrl,
  description,
  onImageChange,
  onDescriptionChange,
  placeholder,
  descriptionPlaceholder,
  previewAlt,
  inputId = `image-input-${Math.random().toString(36).substr(2, 9)}`,
  imageLabel = 'Image',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const descInputId = `${inputId}-desc`;

  const handleUploadClick = async () => {
    try {
      setIsUploading(true);

      // Use Devvit's showForm API for image upload
      // showForm takes a Form object directly (not wrapped in { form: ... })
      const result = await showForm({
        title: `Upload ${imageLabel}`,
        fields: [
          {
            name: 'uploadedImage',
            type: 'image',
            label: 'Choose an image (PNG, JPEG, or GIF)',
            required: true,
          },
        ] as const,
      });

      if (result.action === 'SUBMITTED' && result.values.uploadedImage) {
        // The result contains an i.redd.it URL
        onImageChange(result.values.uploadedImage);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    onImageChange('');
  };

  return (
    <div className="flex flex-col gap-2 bg-neutral-50 dark:bg-[#243044] p-3 rounded-lg border border-neutral-200 dark:border-white/[0.08]">
      {/* Upload Button / Preview Area */}
      {!imageUrl ? (
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading}
          className="w-full h-[140px] bg-white dark:bg-[#2d3a4f] rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-300 dark:border-white/20 hover:border-game-primary dark:hover:border-[#f0d078] hover:bg-neutral-50 dark:hover:bg-[#3a4a62] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Upload ${imageLabel}`}
        >
          {isUploading ? (
            <>
              <div className="w-8 h-8 border-3 border-neutral-300 dark:border-white/20 border-t-game-primary dark:border-t-[#f0d078] rounded-full animate-spin" />
              <span className="text-sm text-neutral-500 dark:text-white/50">Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 text-neutral-400 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-neutral-600 dark:text-white/70">Tap to upload {imageLabel.toLowerCase()}</span>
              <span className="text-xs text-neutral-400 dark:text-white/30">PNG, JPEG, GIF (max 20MB)</span>
            </>
          )}
        </button>
      ) : (
        <div className="relative w-full h-[140px] bg-neutral-100 dark:bg-[#2d3a4f] rounded-lg overflow-hidden border border-neutral-200 dark:border-white/[0.12]">
          <img
            src={imageUrl}
            alt={previewAlt}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Remove button */}
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
            aria-label={`Remove ${imageLabel}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Replace button */}
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 dark:bg-[#1a2332]/90 text-neutral-700 dark:text-white/90 text-xs font-medium rounded-lg shadow-md hover:bg-white dark:hover:bg-[#1a2332] transition-colors disabled:opacity-50"
            aria-label={`Replace ${imageLabel}`}
          >
            {isUploading ? 'Uploading...' : 'Replace'}
          </button>
        </div>
      )}

      {/* Description input */}
      <label htmlFor={descInputId} className="sr-only">
        {descriptionPlaceholder}
      </label>
      <input
        id={descInputId}
        type="text"
        className="py-2 px-3 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-white dark:bg-[#2d3a4f] text-neutral-900 dark:text-white/95 text-xs w-full font-sans transition-colors duration-200 min-h-touch focus:outline-none focus:border-game-primary dark:focus:border-[#f0d078] focus:ring-2 focus:ring-game-primary/20 dark:focus:ring-[#f0d078]/20 placeholder:text-neutral-400 dark:placeholder:text-white/30"
        placeholder={descriptionPlaceholder}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        aria-label={descriptionPlaceholder}
      />
    </div>
  );
};
