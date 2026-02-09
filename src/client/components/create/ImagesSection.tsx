/**
 * ImagesSection Component
 * Section for adding challenge images with previews
 */

import React from 'react';
import { ImageInput } from './ImageInput';

export interface ImagesSectionProps {
  image1: string;
  image2: string;
  image3: string;
  desc1: string;
  desc2: string;
  desc3: string;
  onImage1Change: (url: string) => void;
  onImage2Change: (url: string) => void;
  onImage3Change: (url: string) => void;
  onDesc1Change: (desc: string) => void;
  onDesc2Change: (desc: string) => void;
  onDesc3Change: (desc: string) => void;
}

export const ImagesSection: React.FC<ImagesSectionProps> = ({
  image1, image2, image3,
  desc1, desc2, desc3,
  onImage1Change, onImage2Change, onImage3Change,
  onDesc1Change, onDesc2Change, onDesc3Change,
}) => {
  return (
    <div className="bg-white dark:bg-[#1a2332] rounded-xl p-4 flex flex-col gap-3 border border-neutral-200 dark:border-white/[0.08]">
      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white/95 m-0">Images (Min 2)</h3>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Image Tips:</p>
              <ul className="space-y-0.5 text-blue-700 dark:text-blue-300">
                <li>• Square (1:1) images display best in the game</li>
                <li>• Descriptions become hints - make them helpful but not obvious</li>
                <li>• Use clear, high-quality images that show the connection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <ImageInput
        inputId="challenge-image-1"
        imageUrl={image1}
        description={desc1}
        onImageChange={onImage1Change}
        onDescriptionChange={onDesc1Change}
        placeholder="Image 1 URL"
        descriptionPlaceholder="Description (Required)"
        previewAlt="Challenge image 1 preview"
        imageLabel="Image 1"
      />

      <ImageInput
        inputId="challenge-image-2"
        imageUrl={image2}
        description={desc2}
        onImageChange={onImage2Change}
        onDescriptionChange={onDesc2Change}
        placeholder="Image 2 URL"
        descriptionPlaceholder="Description (Required)"
        previewAlt="Challenge image 2 preview"
        imageLabel="Image 2"
      />

      <ImageInput
        inputId="challenge-image-3"
        imageUrl={image3}
        description={desc3}
        onImageChange={onImage3Change}
        onDescriptionChange={onDesc3Change}
        placeholder="Image 3 URL (Optional)"
        descriptionPlaceholder="Description (Required if image added)"
        previewAlt="Challenge image 3 preview"
        imageLabel="Image 3 (Optional)"
      />
    </div>
  );
};
