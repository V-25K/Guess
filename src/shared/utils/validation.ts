/**
 * Validation Utility
 * 
 * Provides validation functions for challenge creation and user input.
 */

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validation constants
 */
export const VALIDATION_RULES = {
  IMAGE_COUNT_MIN: 2,
  IMAGE_COUNT_MAX: 5,
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 100,
  ANSWER_MIN_LENGTH: 2,
  ANSWER_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 500,
  TAG_MIN_COUNT: 1,
  TAG_MAX_COUNT: 5,
} as const;

/**
 * Predefined valid tags for challenges
 */
export const VALID_TAGS = [
  'anime',
  'general',
  'sport',
  'movies',
  'music',
  'gaming',
  'history',
  'science',
  'geography',
  'food',
  'art',
  'technology',
] as const;

export type ValidTag = typeof VALID_TAGS[number];

/**
 * Validate image count for a challenge.
 * Must be between 2 and 5 images (inclusive).
 * 
 * @param imageCount - Number of images
 * @returns Validation result
 * 
 * @example
 * validateImageCount(3) // { isValid: true }
 * validateImageCount(1) // { isValid: false, error: "..." }
 * validateImageCount(6) // { isValid: false, error: "..." }
 */
export function validateImageCount(imageCount: number): ValidationResult {
  if (imageCount < VALIDATION_RULES.IMAGE_COUNT_MIN) {
    return {
      isValid: false,
      error: `At least ${VALIDATION_RULES.IMAGE_COUNT_MIN} images are required`,
    };
  }
  
  if (imageCount > VALIDATION_RULES.IMAGE_COUNT_MAX) {
    return {
      isValid: false,
      error: `Maximum ${VALIDATION_RULES.IMAGE_COUNT_MAX} images allowed`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate challenge title.
 * Must be between 3 and 100 characters.
 * 
 * @param title - Challenge title
 * @returns Validation result
 * 
 * @example
 * validateTitle("My Challenge") // { isValid: true }
 * validateTitle("AB") // { isValid: false, error: "..." }
 */
export function validateTitle(title: string): ValidationResult {
  const trimmedTitle = title.trim();
  
  if (trimmedTitle.length < VALIDATION_RULES.TITLE_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Title must be at least ${VALIDATION_RULES.TITLE_MIN_LENGTH} characters`,
    };
  }
  
  if (trimmedTitle.length > VALIDATION_RULES.TITLE_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Title must not exceed ${VALIDATION_RULES.TITLE_MAX_LENGTH} characters`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate challenge answer.
 * Must be between 2 and 200 characters.
 * 
 * @param answer - Challenge answer
 * @returns Validation result
 * 
 * @example
 * validateAnswer("The answer") // { isValid: true }
 * validateAnswer("A") // { isValid: false, error: "..." }
 */
export function validateAnswer(answer: string): ValidationResult {
  const trimmedAnswer = answer.trim();
  
  if (trimmedAnswer.length < VALIDATION_RULES.ANSWER_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Answer must be at least ${VALIDATION_RULES.ANSWER_MIN_LENGTH} characters`,
    };
  }
  
  if (trimmedAnswer.length > VALIDATION_RULES.ANSWER_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Answer must not exceed ${VALIDATION_RULES.ANSWER_MAX_LENGTH} characters`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate challenge description (optional field).
 * If provided, must not exceed 500 characters.
 * 
 * @param description - Challenge description (optional)
 * @returns Validation result
 * 
 * @example
 * validateDescription("A description") // { isValid: true }
 * validateDescription("") // { isValid: true }
 * validateDescription(undefined) // { isValid: true }
 */
export function validateDescription(description?: string): ValidationResult {
  if (!description || description.trim().length === 0) {
    return { isValid: true };
  }
  
  if (description.trim().length > VALIDATION_RULES.DESCRIPTION_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Description must not exceed ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} characters`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate challenge tags.
 * Must have at least 1 tag and at most 5 tags.
 * All tags must be from the predefined list.
 * 
 * @param tags - Array of tag strings
 * @returns Validation result
 * 
 * @example
 * validateTags(["anime", "gaming"]) // { isValid: true }
 * validateTags([]) // { isValid: false, error: "..." }
 * validateTags(["invalid"]) // { isValid: false, error: "..." }
 */
export function validateTags(tags: string[]): ValidationResult {
  if (tags.length < VALIDATION_RULES.TAG_MIN_COUNT) {
    return {
      isValid: false,
      error: `At least ${VALIDATION_RULES.TAG_MIN_COUNT} tag is required`,
    };
  }
  
  if (tags.length > VALIDATION_RULES.TAG_MAX_COUNT) {
    return {
      isValid: false,
      error: `Maximum ${VALIDATION_RULES.TAG_MAX_COUNT} tags allowed`,
    };
  }
  
  const invalidTags = tags.filter(tag => !VALID_TAGS.includes(tag as ValidTag));
  
  if (invalidTags.length > 0) {
    return {
      isValid: false,
      error: `Invalid tags: ${invalidTags.join(', ')}. Valid tags are: ${VALID_TAGS.join(', ')}`,
    };
  }
  
  const uniqueTags = new Set(tags);
  if (uniqueTags.size !== tags.length) {
    return {
      isValid: false,
      error: 'Duplicate tags are not allowed',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate all challenge creation fields at once.
 * Returns the first validation error encountered, or success if all valid.
 * 
 * @param data - Challenge creation data
 * @returns Validation result
 * 
 * @example
 * validateChallengeCreation({
 *   title: "My Challenge",
 *   answer: "The answer",
 *   imageCount: 3,
 *   tags: ["anime"]
 * }) // { isValid: true }
 */
export function validateChallengeCreation(data: {
  title: string;
  answer: string;
  description?: string;
  imageCount: number;
  tags: string[];
}): ValidationResult {
  const titleResult = validateTitle(data.title);
  if (!titleResult.isValid) {
    return titleResult;
  }
  
  const answerResult = validateAnswer(data.answer);
  if (!answerResult.isValid) {
    return answerResult;
  }
  
  const descriptionResult = validateDescription(data.description);
  if (!descriptionResult.isValid) {
    return descriptionResult;
  }
  
  const imageCountResult = validateImageCount(data.imageCount);
  if (!imageCountResult.isValid) {
    return imageCountResult;
  }
  
  const tagsResult = validateTags(data.tags);
  if (!tagsResult.isValid) {
    return tagsResult;
  }
  
  return { isValid: true };
}

/**
 * Generate a user-friendly error message for validation failures.
 * 
 * @param field - The field that failed validation
 * @param error - The validation error message
 * @returns Formatted error message
 */
export function generateErrorMessage(field: string, error: string): string {
  return `${field}: ${error}`;
}

/**
 * Validate all fields and return a map of field-specific errors.
 * This allows for inline error display next to each form field.
 * 
 * @param data - Challenge creation data
 * @returns Map of field names to error messages
 * 
 * @example
 * const errors = validateAllFields({
 *   title: "AB",
 *   answer: "The answer",
 *   imageCount: 1,
 *   tags: []
 * });
 * // Returns: { title: "Title must be at least 3 characters", imageCount: "At least 2 images are required", tags: "At least 1 tag is required" }
 */
export function validateAllFields(data: {
  title: string;
  answer: string;
  description?: string;
  imageCount: number;
  tags: string[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  
  const titleResult = validateTitle(data.title);
  if (!titleResult.isValid && titleResult.error) {
    errors.title = titleResult.error;
  }
  
  const answerResult = validateAnswer(data.answer);
  if (!answerResult.isValid && answerResult.error) {
    errors.answer = answerResult.error;
  }
  
  const descriptionResult = validateDescription(data.description);
  if (!descriptionResult.isValid && descriptionResult.error) {
    errors.description = descriptionResult.error;
  }
  
  const imageCountResult = validateImageCount(data.imageCount);
  if (!imageCountResult.isValid && imageCountResult.error) {
    errors.images = imageCountResult.error;
  }
  
  const tagsResult = validateTags(data.tags);
  if (!tagsResult.isValid && tagsResult.error) {
    errors.tags = tagsResult.error;
  }
  
  return errors;
}

/**
 * Check if a validation errors object has any errors
 */
export function hasValidationErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Get all error messages as an array
 */
export function getErrorMessages(errors: Record<string, string>): string[] {
  return Object.values(errors);
}
