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
  private readonly GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(context: Context) {
    super(context);
  }

  /**
   * Validate a player's guess against the correct answer using AI
   * Falls back to simple string matching if AI fails
   */
  async validateAnswer(
    guess: string,
    challenge: Challenge
  ): Promise<ValidationResult> {
    try {
      // Try AI validation with retry logic
      const aiResult = await this.withRetry(
        () => this.validateWithAI(guess, challenge),
        {
          maxRetries: this.MAX_RETRIES,
          initialDelayMs: this.RETRY_DELAY_MS,
          exponentialBackoff: true,
        }
      );

      // Ensure explanation is never null or undefined
      return {
        ...aiResult,
        explanation:
          aiResult.explanation ||
          this.getDefaultExplanation(aiResult.isCorrect),
      };
    } catch (error) {
      this.logError(
        "AIValidationService.validateAnswer",
        "AI validation failed, using fallback"
      );

      // Fall back to simple validation
      return this.fallbackValidation(guess, challenge);
    }
  }

  /**
   * Validate answer using Google Gemini API
   */
  private async validateWithAI(
    guess: string,
    challenge: Challenge
  ): Promise<ValidationResult> {
    // Get Gemini API key from settings
    const settings = await this.context.settings.getAll();
    const apiKey = settings["GEMINI_API_KEY"] as string;

    if (!apiKey) {
      this.logError("AIValidationService", "GEMINI_API_KEY not configured");
      throw new Error("AI validation not configured");
    }

    const systemPrompt = `You are a strict game judge for a 'guess the link' game. You will receive a player's guess, the correct answer, and guiding tags.
Your task is to judge the guess and provide a brief, one-sentence explanation.
Do NOT reveal the correct answer or any part of it in your explanation.

**JUDGMENT RULES:**
- 'CORRECT': The guess is an exact match or an equally specific, common synonym.
- 'CLOSE': The guess is relevant but **too broad or over-generalized** (e.g., "Parts of a computer" instead of "Computer Peripherals") or has a minor inaccuracy. Give a small, subtle hint about the level of specificity needed.
- 'INCORRECT': The guess is completely off-topic. Encourage them to try again.

Respond ONLY with the JSON object defined in the schema.`;

    const userPrompt = `
      Correct Answer: "${challenge.correct_answer}"
      Tags: [${challenge.tags.join(", ")}]
      Player's Guess: "${guess}"
    `;

    // Build request payload
    const payload = {
      // Pass the dynamic data here
      contents: [{ parts: [{ text: userPrompt }] }],
      // Pass the static instructions here
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
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
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      this.logError("AIValidationService", "No response text from API");
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
      `AI judgment: ${judgment} for guess "${guess}" vs answer "${challenge.correct_answer}"`
    );

    const safeExplanation = explanation || this.getDefaultExplanation(isCorrect);

    return {
      isCorrect,
      explanation: safeExplanation,
      judgment,
    };
  }

  /**
   * Get default explanation message based on correctness
   * Used when AI doesn't provide an explanation
   */
  private getDefaultExplanation(isCorrect: boolean): string {
    return isCorrect ? "Correct answer!" : "Not quite right. Try again!";
  }

  /**
   * Fallback validation using simple string matching
   * Used when AI validation fails
   */
  private fallbackValidation(
    guess: string,
    challenge: Challenge
  ): ValidationResult {
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedAnswer = challenge.correct_answer.toLowerCase().trim();

    // 1. Check for Exact Match (most conservative CORRECT)
    if (normalizedGuess === normalizedAnswer) {
      return {
        isCorrect: true,
        explanation: "[Fallback Judge]: Correct answer!",
        judgment: "CORRECT",
      };
    }

    if (normalizedGuess.length > 5 && normalizedAnswer.includes(normalizedGuess)) {
      return {
        isCorrect: false,
        explanation: "[Fallback Judge]: Close, you've identified a key word. The full answer is more specific.",
        judgment: "CLOSE",
      };
    }

    return {
      isCorrect: false,
      explanation: "[Fallback Judge]: Incorrect. Try revealing more hints.",
      judgment: "INCORRECT",
    };
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

      const result = await this.validateAnswer("apple", testChallenge);

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
