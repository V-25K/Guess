/**
 * Local Validation Service
 * Validates player guesses against pre-generated answer sets
 * No AI calls - all validation happens locally in microseconds
 * 
 * Fixes Applied:
 * 1. "Spider-Man" Problem: Handles hyphenated words by checking both spaced and condensed versions
 * 2. "Blue Whale" Problem: Removed aggressive keyword overlap (relies on AI-generated answer sets)
 * 3. "Pear vs Bear" Problem: Higher threshold (0.80) and skips fuzzy for short words (<4 chars)
 */

import { BaseService } from "./base.service.js";
import type { Challenge } from "../../shared/models/challenge.types.js";
import type { Context } from "@devvit/public-api";

/**
 * LocalValidationResult Type
 * Same structure as AI validation but generated locally
 */
export type LocalValidationResult = {
    isCorrect: boolean;
    explanation: string;
    judgment: "CORRECT" | "CLOSE" | "INCORRECT";
};

/**
 * Service for validating guesses against pre-generated answer sets
 * Fast, local validation with no AI API calls
 */
export class LocalValidationService extends BaseService {
    // Stricter threshold to prevent "Pear" matching "Bear"
    private readonly FUZZY_THRESHOLD = 0.80;
    // Slightly more lenient for close matches
    private readonly FUZZY_CLOSE_THRESHOLD = 0.75;

    constructor(context: Context) {
        super(context);
    }

    /**
     * Validate a player's guess against the challenge's answer set
     * @param guess - The player's guess
     * @param challenge - The challenge with answer_set
     * @returns LocalValidationResult with judgment and explanation
     */
    validateGuess(guess: string, challenge: Challenge): LocalValidationResult {
        // Ensure answer set exists
        if (!challenge.answer_set) {
            this.logError(
                "LocalValidation",
                `Challenge ${challenge.id} missing answer_set`
            );
            throw new Error("Challenge missing answer set");
        }

        // Normalize the guess in two ways to handle "Spider-Man" vs "Spiderman"
        const normGuess = this.normalizeText(guess);           // "spider man"
        const condensedGuess = normGuess.replace(/\s/g, "");   // "spiderman"

        if (!normGuess) {
            return {
                isCorrect: false,
                explanation: "Please enter a valid guess.",
                judgment: "INCORRECT",
            };
        }

        this.logInfo(
            "LocalValidation",
            `Validating: "${normGuess}" / "${condensedGuess}"`
        );

        const { correct, close } = challenge.answer_set;

        // --- PHASE 1: EXACT MATCHES (Priority) ---

        // Check Correct (Try both normal and condensed)
        if (this.checkExact(normGuess, condensedGuess, correct)) {
            this.logInfo("LocalValidation", "Exact match found in correct answers");
            return this.buildResult(true, "CORRECT");
        }

        // Check Close (Priority over Fuzzy Correct to prevent false wins)
        if (this.checkExact(normGuess, condensedGuess, close)) {
            this.logInfo("LocalValidation", "Exact match found in close answers");
            return this.buildResult(false, "CLOSE");
        }

        // --- PHASE 2: FUZZY MATCHES (Fallback) ---

        // Fuzzy Correct
        if (this.checkFuzzy(normGuess, correct, this.FUZZY_THRESHOLD)) {
            this.logInfo("LocalValidation", "Fuzzy match found in correct answers");
            return this.buildResult(true, "CORRECT");
        }

        // Fuzzy Close (Slightly more lenient)
        if (this.checkFuzzy(normGuess, close, this.FUZZY_CLOSE_THRESHOLD)) {
            this.logInfo("LocalValidation", "Fuzzy match found in close answers");
            return this.buildResult(false, "CLOSE");
        }

        this.logInfo("LocalValidation", "No match found");
        return this.buildResult(false, "INCORRECT");
    }

    /**
     * Checks if either normalized variation matches exactly
     * Handles "Spider-Man" vs "Spiderman" by checking both forms
     */
    private checkExact(norm: string, condensed: string, answers: string[]): boolean {
        return answers.some(ans => {
            const normAns = this.normalizeText(ans);
            const condensedAns = normAns.replace(/\s/g, "");
            return norm === normAns || condensed === condensedAns;
        });
    }

    /**
     * Checks similarity using Levenshtein distance
     * Skips very short words to prevent "Bear/Pear" false positives
     */
    private checkFuzzy(guess: string, answers: string[], threshold: number): boolean {
        // Don't fuzzy match words shorter than 4 chars (too many false positives)
        if (guess.length < 4) return false;

        return answers.some(ans => {
            const normAns = this.normalizeText(ans);
            // Also skip if the answer is too short
            if (normAns.length < 4) return false;
            return this.calculateSimilarity(guess, normAns) >= threshold;
        });
    }

    /**
     * Standard Levenshtein Similarity (0-1)
     */
    private calculateSimilarity(a: string, b: string): number {
        if (a === b) return 1.0;
        if (a.length === 0 || b.length === 0) return 0.0;

        const distance = this.levenshteinDistance(a, b);
        const maxLength = Math.max(a.length, b.length);

        return 1.0 - (distance / maxLength);
    }

    /**
     * Standard text normalization
     * "Spider-Man" -> "spider man"
     */
    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ") // Punctuation to space
            .replace(/\s+/g, " ")         // Collapse spaces
            .trim();
    }

    /**
     * Helper to build result objects consistently
     */
    private buildResult(isCorrect: boolean, judgment: "CORRECT" | "CLOSE" | "INCORRECT"): LocalValidationResult {
        let explanation: string;
        switch (judgment) {
            case "CORRECT":
                explanation = this.getCorrectExplanation();
                break;
            case "CLOSE":
                explanation = this.getCloseExplanation();
                break;
            default:
                explanation = this.getIncorrectExplanation();
        }
        return { isCorrect, judgment, explanation };
    }

    /**
     * Calculate Levenshtein distance between two strings
     * (Number of single-character edits required to transform a to b)
     */
    private levenshteinDistance(a: string, b: string): number {
        const matrix: number[][] = Array(b.length + 1)
            .fill(null)
            .map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const indicator = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,     // deletion
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j - 1] + indicator // substitution
                );
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * Get a random correct explanation message
     */
    private getCorrectExplanation(): string {
        const messages = [
            "🎉 You got it!",
            "✨ Correct!",
            "🎯 Spot on!",
            "💯 That's the answer!",
            "🏆 Perfect!",
            "⭐ Nailed it!",
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Get a random close explanation message
     */
    private getCloseExplanation(): string {
        const messages = [
            "🔥 Getting warmer...",
            "🤔 You're on the right track!",
            "💭 Very close!",
            "🎯 Almost there!",
            "✨ So close, be more specific.",
            "💡 Think more specifically!",
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Get a random incorrect explanation message
     */
    private getIncorrectExplanation(): string {
        const messages = [
            "❄️ Cold.",
            "❌ Not quite.",
            "🤔 Keep thinking!",
            "💭 Give it another shot.",
            "🎯 Nope, try again.",
            "🔍 Not what we're looking for.",
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }
}
