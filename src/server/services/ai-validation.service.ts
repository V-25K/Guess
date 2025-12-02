/**
 * AI Validation Service
 * Handles answer validation using Google Gemini API with fallback logic
 */

import type { Context } from "@devvit/public-api";
import { BaseService } from "./base.service.js";
import type { Challenge } from "../../shared/models/challenge.types.js";

/**
 * ValidationResult Type
 * 
 * Represents the result of AI validation for a player's guess.
 * 
 * @property isCorrect - TRUE only if the player has officially won the round (judgment is 'CORRECT').
 *                       'CLOSE' guesses are NOT considered correct - they are hints, not solutions.
 * @property explanation - A brief, one-sentence explanation from the AI judge.
 *                         Never reveals the correct answer.
 * @property judgment - The AI's internal classification of the guess:
 *                      - 'CORRECT': Exact match or equally specific synonym (player wins)
 *                      - 'CLOSE': Relevant but too broad/generalized (hint, not a win)
 *                      - 'INCORRECT': Completely off-topic (try again)
 */
export type ValidationResult = {
  isCorrect: boolean;
  explanation: string;
  judgment: "CORRECT" | "CLOSE" | "INCORRECT";
};

export class AIValidationService extends BaseService {
  // Use Gemini 2.5 Flash model
  private readonly GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;
  // Cache TTL for validation results (1 hour)
  private readonly CACHE_TTL_SECONDS = 3600;

  constructor(context: Context) {
    super(context);
  }

  /**
   * Validate a player's guess against the correct answer using AI.
   * - Uses Redis caching to avoid repeated validations for the same guess/answer.
   * - Uses attempt-based prompts: short responses for attempts 1-6, richer hint on attempt 7.
   * - Falls back to simple string matching if AI fails.
   */
  async validateAnswer(
    guess: string,
    challenge: Challenge,
    attemptNumber: number = 1,
    pastGuesses: string[] = []
  ): Promise<ValidationResult> {
    // Normalized guess for cache key
    const normalizedGuess = guess.toLowerCase().trim();
    const cacheKey = `validation:${challenge.id}:${normalizedGuess}`;

    // 1) Try cache first (cheap, token-free)
    try {
      const cached = await this.context.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ValidationResult;
        return parsed;
      }
    } catch (error) {
      this.logError(
        "AIValidationService.validateAnswer",
        "Failed to read from cache, continuing without cache"
      );
    }

    try {
      this.logInfo("AIValidationService", `Attempting AI validation for guess: "${guess}"`);

      // Try AI validation with retry logic
      const aiResult = await this.withRetry(
        () => this.validateWithAI(guess, challenge, attemptNumber, pastGuesses),
        {
          maxRetries: this.MAX_RETRIES,
          initialDelayMs: this.RETRY_DELAY_MS,
          exponentialBackoff: true,
        }
      );

      this.logInfo("AIValidationService", `AI Validation Successful: ${JSON.stringify(aiResult)}`);

      // Ensure explanation is never null or undefined
      const result: ValidationResult = {
        ...aiResult,
        explanation:
          aiResult.explanation ||
          this.getDefaultExplanation(aiResult.isCorrect),
      };

      // 2) Store in cache (fire-and-forget)
      try {
        await this.context.redis.set(
          cacheKey,
          JSON.stringify(result),
          { expiration: new Date(Date.now() + this.CACHE_TTL_SECONDS * 1000) }
        );
      } catch (error) {
        this.logError(
          "AIValidationService.validateAnswer",
          "Failed to write to cache, continuing without cache"
        );
      }

      return result;
    } catch (error) {
      this.logError(
        "AIValidationService.validateAnswer",
        `AI validation failed: ${error instanceof Error ? error.message : String(error)}. Switching to FALLBACK.`
      );

      // Fall back to simple validation
      const fallbackResult = this.fallbackValidation(guess, challenge, attemptNumber, pastGuesses);
      this.logInfo("AIValidationService", `Fallback Validation Result: ${JSON.stringify(fallbackResult)}`);
      return fallbackResult;
    }
  }

  /**
   * Validate answer using Google Gemini API
   */
  private async validateWithAI(
    guess: string,
    challenge: Challenge,
    attemptNumber: number,
    pastGuesses: string[]
  ): Promise<ValidationResult> {
    // Get Gemini API key from settings
    const settings = await this.context.settings.getAll();
    const apiKey = settings["GEMINI_API_KEY"] as string;

    if (!apiKey) {
      this.logError("AIValidationService", "GEMINI_API_KEY not configured");
      throw new Error("AI validation not configured");
    }

    // Attempt 7: richer hint based on past guesses
    const isAttempt7 = attemptNumber === 7;

    // Short, token-efficient instructions for attempts 1-6.
    // Still tells the model to accept typos/synonyms/plurals.
    const systemPrompt = isAttempt7
      ? `Judge guess vs answer. Accept typos, synonyms, plurals. Reply with JSON: { "judgment": "CORRECT"|"CLOSE"|"INCORRECT", "explanation": string }. On attempt 7, explanation should be a helpful hint (1-2 sentences) using past guesses to guide player without revealing answer.`
      : `Judge guess vs answer. Accept typos, synonyms, plurals. Reply with JSON: { "judgment": "CORRECT"|"CLOSE"|"INCORRECT", "explanation": string }. Explanation must be 3-6 words, friendly, no answer reveal, must add "close", "nope", "correct" according to the answer.`;

    const userPrompt = isAttempt7
      ? `Answer: "${challenge.correct_answer}"\nTags: ${challenge.tags.join(", ")}\nGuess: "${guess}"\nPast guesses: ${pastGuesses.join(", ")}`
      : `Answer: "${challenge.correct_answer}"\nGuess: "${guess}"`;

    // Build request payload
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        // Provide generous headroom so Gemini can finish structured outputs, especially with thinking models
        maxOutputTokens: 2048,
        responseSchema: {
          type: "OBJECT",
          properties: {
            judgment: {
              type: "STRING",
              enum: ["CORRECT", "CLOSE", "INCORRECT"],
            },
            explanation: { type: "STRING" },
          },
          required: ["judgment", "explanation"],
        },
      },
    };

    // Make API request with timeout
    const url = `${this.GEMINI_API_URL}?key=${apiKey}`;

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        this.logError("AIValidationService", "API request timed out after 15 seconds");
        throw new Error("API request timed out");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      this.logError(
        "AIValidationService",
        `API request failed with status ${response.status}: ${errorBody}`
      );
      throw new Error(`API request failed: ${response.status}`);
    }

    // Parse response
    const result = await response.json();
    const candidate = result?.candidates?.[0];

    if (!candidate) {
      this.logError("AIValidationService", "No candidates returned from API");
      throw new Error("Invalid API response");
    }

    if (
      candidate.finishReason &&
      candidate.finishReason !== "STOP" &&
      candidate.finishReason !== "FINISH_REASON_UNSPECIFIED"
    ) {
      this.logError(
        "AIValidationService",
        `Generation stopped early with reason ${candidate.finishReason}. Full response: ${JSON.stringify(
          result
        ).slice(0, 500)}...`
      );
      throw new Error(`Generation stopped early: ${candidate.finishReason}`);
    }

    const jsonText = this.extractJsonPayload(result);

    if (!jsonText) {
      this.logError(
        "AIValidationService",
        `No response text from API. Raw response: ${JSON.stringify(result).slice(0, 500)}...`
      );
      throw new Error("Invalid API response");
    }

    // Parse and validate JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      this.logError(
        "AIValidationService",
        "Failed to parse JSON response from Gemini API"
      );
      throw new Error("Invalid JSON response from API");
    }

    // Validate required fields exist
    if (!parsed || typeof parsed !== "object") {
      this.logError("AIValidationService", "Parsed response is not an object");
      throw new Error("Invalid response structure from API");
    }

    const judgment = parsed.judgment as "CORRECT" | "CLOSE" | "INCORRECT";

    // Validate judgment field
    if (!judgment || !["CORRECT", "CLOSE", "INCORRECT"].includes(judgment)) {
      this.logError(
        "AIValidationService",
        `Invalid judgment value: ${judgment}`
      );
      throw new Error("Invalid judgment from API");
    }

    const explanation = parsed.explanation as string | null | undefined;

    const isCorrect = judgment === "CORRECT";

    const safeExplanation = explanation || this.getDefaultExplanation(isCorrect);
    const censoredExplanation = this.censorResponse(safeExplanation, challenge.correct_answer);

    return {
      isCorrect,
      explanation: censoredExplanation,
      judgment,
    };
  }

  /**
   * Extract JSON payload from Gemini response.
   * Supports both plain text and functionCall outputs (used when responseSchema is set).
   */
  private extractJsonPayload(result: any): string | undefined {
    const candidate = result?.candidates?.[0];
    const parts = candidate?.content?.parts;

    if (!Array.isArray(parts)) {
      return undefined;
    }

    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim().length > 0) {
        return part.text;
      }

      const functionCall = part?.functionCall;
      if (functionCall?.args) {
        if (typeof functionCall.args === "string") {
          return functionCall.args;
        }
        try {
          return JSON.stringify(functionCall.args);
        } catch {
          // Ignore and continue
        }
      }

    }

    return undefined;
  }

  /**
   * Get default explanation message based on correctness
   * Used when AI doesn't provide an explanation
   */
  private getDefaultExplanation(isCorrect: boolean): string {
    return isCorrect ? "Correct!" : "Try again";
  }

  /**
   * Fallback validation using simple string matching
   * Used when AI validation fails
   */
  private fallbackValidation(
    guess: string,
    challenge: Challenge,
    attemptNumber: number,
    pastGuesses: string[]
  ): ValidationResult {
    const normalizedGuess = this.normalizeText(guess);
    const normalizedAnswer = this.normalizeText(challenge.correct_answer);

    let result: ValidationResult;

    if (!normalizedGuess || !normalizedAnswer) {
      result = {
        isCorrect: false,
        explanation: this.getShortResponse("incorrect", attemptNumber, challenge, pastGuesses),
        judgment: "INCORRECT",
      };
    } else {
      const similarity = this.computeSimilarity(normalizedGuess, normalizedAnswer);

      if (similarity >= 0.9 || normalizedGuess === normalizedAnswer) {
        result = {
          isCorrect: true,
          explanation: this.getShortResponse("correct", attemptNumber, challenge, pastGuesses),
          judgment: "CORRECT",
        };
      } else if (similarity >= 0.6 || this.hasTokenOverlap(normalizedGuess, normalizedAnswer)) {
        result = {
          isCorrect: false,
          explanation: this.getShortResponse("close", attemptNumber, challenge, pastGuesses),
          judgment: "CLOSE",
        };
      } else {
        result = {
          isCorrect: false,
          explanation: this.getShortResponse("incorrect", attemptNumber, challenge, pastGuesses),
          judgment: "INCORRECT",
        };
      }
    }

    // Censor the explanation in fallback result too
    result.explanation = this.censorResponse(result.explanation, challenge.correct_answer);
    return result;
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private computeSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    // 1. Token Similarity (Jaccard Index) ignoring stop words
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with"]);

    const tokensA = a.split(" ").filter(t => !stopWords.has(t));
    const tokensB = b.split(" ").filter(t => !stopWords.has(t));

    // If all words were stop words (e.g. "The The"), fall back to original tokens
    const finalA = tokensA.length > 0 ? tokensA : a.split(" ");
    const finalB = tokensB.length > 0 ? tokensB : b.split(" ");

    const setA = new Set(finalA);
    const setB = new Set(finalB);

    let intersection = 0;
    setA.forEach(token => {
      if (setB.has(token)) intersection++;
    });

    const union = new Set([...finalA, ...finalB]).size;
    const jaccardScore = union === 0 ? 0 : intersection / union;

    // 2. Levenshtein Similarity (for typos)
    // Only calculate if strings are reasonably close in length
    let levenshteinScore = 0;
    if (Math.abs(a.length - b.length) < 5) {
      const distance = this.levenshteinDistance(a, b);
      const maxLength = Math.max(a.length, b.length);
      levenshteinScore = 1 - (distance / maxLength);
    }

    // Return the better of the two scores
    return Math.max(jaccardScore, levenshteinScore);
  }

  private hasTokenOverlap(a: string, b: string): boolean {
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with"]);

    const tokensA = a.split(" ").filter(t => !stopWords.has(t));
    const tokensB = b.split(" ").filter(t => !stopWords.has(t));

    // If all words were stop words, use original
    const finalA = tokensA.length > 0 ? tokensA : a.split(" ");
    const finalB = tokensB.length > 0 ? tokensB : b.split(" ");

    return finalA.some(token => finalB.includes(token));
  }

  /**
   * Calculate Levenshtein distance between two strings
   * (Number of edits required to transform a to b)
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1 // deletion
            )
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private getShortResponse(
    type: "correct" | "close" | "incorrect",
    attemptNumber: number,
    challenge: Challenge,
    pastGuesses: string[]
  ): string {
    const isHintAttempt = attemptNumber === 7;

    if (type === "correct") {
      const responses = ["Correct!", "You got it!", "Spot on!", "That's the answer!"];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    if (type === "close") {
      if (isHintAttempt) {
        return this.buildHint(challenge, pastGuesses, "You're very close!");
      }
      const responses = [
        "You're on the right track!",
        "Very close!",
        "Almost there!",
        "Getting warmer...",
        "So close, be more specific."
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    // incorrect
    if (isHintAttempt) {
      return this.buildHint(challenge, pastGuesses, "Here's a hint");
    }

    const responses = [
      "Not quite.",
      "Keep thinking!",
      "Give it another shot.",
      "Nope, try again.",
      "Cold.",
      "Not what we're looking for."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private buildHint(
    challenge: Challenge,
    pastGuesses: string[],
    prefix: string
  ): string {
    // 1. Try to use tags first
    const tags = challenge.tags || [];
    if (tags.length > 0) {
      return `${prefix}: Think about ${tags.slice(0, 2).join(", ")}.`;
    }

    // 2. Fallback to a "Hangman-style" mask of the answer
    const answer = this.normalizeText(challenge.correct_answer);
    const words = answer.split(" ");

    const maskedWords = words.map(word => {
      if (word.length <= 2) return word; // Don't mask short words
      // Show first letter, mask rest with underscores
      return word.charAt(0).toUpperCase() + "_".repeat(word.length - 1);
    });

    const hint = maskedWords.join(" ");

    if (pastGuesses.length > 0) {
      return `${prefix}. Hint: ${hint}`;
    }

    return `${prefix}. Hint: ${hint}`;
  }

  /**
   * Censor the answer from the text by replacing it with a block character
   */
  private censorResponse(text: string, answer: string): string {
    if (!text || !answer) return text;

    // Normalize answer for matching
    const normalizedAnswer = answer.trim();
    if (normalizedAnswer.length === 0) return text;

    // Escape special regex characters in the answer
    const escapedAnswer = normalizedAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a case-insensitive regex to find the answer
    const regex = new RegExp(escapedAnswer, 'gi');

    // Replace with block characters
    return text.replace(regex, '████');
  }

  /**
   * Check if AI validation is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const settings = await this.context.settings.getAll();
      const apiKey = settings["GEMINI_API_KEY"] as string;
      return !!apiKey;
    } catch (error) {
      this.logError("AIValidationService.isConfigured", error);
      return false;
    }
  }
}
