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
      <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white/95 m-0">Images (Min 2)</h3>

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
