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
        this.logInfo(
          "AIValidationService",
          `Cache hit for guess "${guess}" on challenge ${challenge.id}`
        );
        return parsed;
      }
    } catch (error) {
      this.logError(
        "AIValidationService.validateAnswer",
        "Failed to read from cache, continuing without cache"
      );
    }

    try {
      // Try AI validation with retry logic
      const aiResult = await this.withRetry(
        () => this.validateWithAI(guess, challenge, attemptNumber, pastGuesses),
        {
          maxRetries: this.MAX_RETRIES,
          initialDelayMs: this.RETRY_DELAY_MS,
          exponentialBackoff: true,
        }
      );

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
        "AI validation failed, using fallback"
      );

      // Fall back to simple validation
      return this.fallbackValidation(guess, challenge, attemptNumber, pastGuesses);
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
      : `Judge guess vs answer. Accept typos, synonyms, plurals. Reply with JSON: { "judgment": "CORRECT"|"CLOSE"|"INCORRECT", "explanation": string }. Explanation must be 1-3 words, friendly, no answer reveal.`;

    const userPrompt = isAttempt7
      ? `Answer: "${challenge.correct_answer}"\nTags: ${challenge.tags.join(", ")}\nGuess: "${guess}"\nPast guesses: ${pastGuesses.join(", ")}`
      : `Answer: "${challenge.correct_answer}"\nGuess: "${guess}"`;

    // Build request payload
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        // Provide generous headroom so Gemini can finish structured outputs.
        maxOutputTokens: isAttempt7 ? 768 : 512,
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

    // Make API request
    const url = `${this.GEMINI_API_URL}?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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

    this.logInfo(
      "AIValidationService",
      `AI judgment: ${judgment} for guess "${guess}" vs answer "${challenge.correct_answer}" (attempt ${attemptNumber})`
    );

    const safeExplanation = explanation || this.getDefaultExplanation(isCorrect);

    return {
      isCorrect,
      explanation: safeExplanation,
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

    if (!normalizedGuess || !normalizedAnswer) {
      return {
        isCorrect: false,
        explanation: this.getShortResponse("incorrect", attemptNumber, challenge, pastGuesses),
        judgment: "INCORRECT",
      };
    }

    const similarity = this.computeSimilarity(normalizedGuess, normalizedAnswer);

    if (similarity >= 0.9 || normalizedGuess === normalizedAnswer) {
      return {
        isCorrect: true,
        explanation: this.getShortResponse("correct", attemptNumber, challenge, pastGuesses),
        judgment: "CORRECT",
      };
    }

    if (similarity >= 0.6 || this.hasTokenOverlap(normalizedGuess, normalizedAnswer)) {
      return {
        isCorrect: false,
        explanation: this.getShortResponse("close", attemptNumber, challenge, pastGuesses),
        judgment: "CLOSE",
      };
    }

    return {
      isCorrect: false,
      explanation: this.getShortResponse("incorrect", attemptNumber, challenge, pastGuesses),
      judgment: "INCORRECT",
    };
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

    const tokensA = a.split(" ");
    const tokensB = b.split(" ");

    const overlap = tokensA.filter((token) => tokensB.includes(token)).length;
    const maxLength = Math.max(tokensA.length, tokensB.length);

    return overlap / maxLength;
  }

  private hasTokenOverlap(a: string, b: string): boolean {
    const tokensA = new Set(a.split(" "));
    const tokensB = new Set(b.split(" "));
    let shared = 0;

    tokensA.forEach((token) => {
      if (tokensB.has(token)) {
        shared += 1;
      }
    });

    return shared > 0;
  }

  private getShortResponse(
    type: "correct" | "close" | "incorrect",
    attemptNumber: number,
    challenge: Challenge,
    pastGuesses: string[]
  ): string {
    const isHintAttempt = attemptNumber === 7;

    if (type === "correct") {
      return attemptNumber <= 6 ? "Correct!" : "Correct answer!";
    }

    if (type === "close") {
      if (isHintAttempt) {
        return this.buildHint(challenge, pastGuesses, "You're close!");
      }
      return "Close match";
    }

    // incorrect
    if (isHintAttempt) {
      return this.buildHint(challenge, pastGuesses, "Try again");
    }

    return attemptNumber <= 3 ? "Keep trying" : "Try again";
  }

  private buildHint(
    challenge: Challenge,
    pastGuesses: string[],
    prefix: string
  ): string {
    const tags = challenge.tags || [];
    if (tags.length > 0) {
      return `${prefix}: Think about ${tags.slice(0, 2).join(", ")}.`;
    }

    const answerTokens = this.normalizeText(challenge.correct_answer).split(" ");
    const firstToken = answerTokens[0] || "the theme";
    const maskedToken =
      firstToken.length <= 2
        ? `${firstToken.charAt(0)}...`
        : `${firstToken.charAt(0)}${"*".repeat(Math.max(firstToken.length - 2, 1))}${firstToken.charAt(firstToken.length - 1)}`;

    if (pastGuesses.length > 0) {
      return `${prefix}: Your last guess "${pastGuesses[pastGuesses.length - 1]}" was close. Focus on ${maskedToken}.`;
    }

    return `${prefix}: Focus on ${maskedToken}.`;
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

  /**
   * Test AI validation with a simple query
   * Useful for debugging and configuration verification
   */
  async testValidation(): Promise<{ success: boolean; message: string }> {
    try {
      const testChallenge: Challenge = {
        id: "test",
        creator_id: "test",
        creator_username: "test",
        title: "Test Challenge",
        description: "Test",
        image_url: "test", // Added missing property
        tags: ["test"],
        correct_answer: "apple",
        max_score: 20,
        score_deduction_per_hint: 5,
        reddit_post_id: null,
        created_at: new Date().toISOString(),
      };

      const result = await this.validateAnswer("apple", testChallenge, 1, []);

      if (result.isCorrect && result.judgment === "CORRECT") {
        return {
          success: true,
          message: "AI validation is working correctly",
        };
      } else {
        return {
          success: false,
          message: `AI validation returned unexpected result: ${result.judgment} - ${result.explanation}`,
        };
      }
    } catch (error) {
      this.logError("AIValidationService.testValidation", error);
      return {
        success: false,
        message: `AI validation test failed: ${error}`,
      };
    }
  }
}
