
import { describe, it, expect } from 'vitest';
import { calculatePotentialScore } from './reward-calculator.js';

describe('Hint System Verification', () => {
    it('should calculate penalties for 3-image challenge correctly', () => {
        // 0 hints - base score 30
        expect(calculatePotentialScore(0, 0, 3)).toBe(30);
        // 1 hint (-4)
        expect(calculatePotentialScore(0, 1, 3)).toBe(26);
        // 2 hints (-4, -4) -> 26 - 4 = 22
        expect(calculatePotentialScore(0, 2, 3)).toBe(22);
        // 3 hints (-4, -4, -4) -> 22 - 4 = 18
        expect(calculatePotentialScore(0, 3, 3)).toBe(18);
    });

    it('should calculate penalties for 2-image challenge correctly', () => {
        // 0 hints - base score 30
        expect(calculatePotentialScore(0, 0, 2)).toBe(30);
        // 1 hint (-6)
        expect(calculatePotentialScore(0, 1, 2)).toBe(24);
        // 2 hints (-6, -6) -> 24 - 6 = 18
        expect(calculatePotentialScore(0, 2, 2)).toBe(18);
    });

    it('should cap score at 0 (non-negative)', () => {
        // Attempt 9 (1 attempt remaining) -> -18 penalty from attempts
        // Base 30 - 18 = 12.
        // 3 hints penalty is -12 (for 3 images: 4+4+4).
        // 12 - 12 = 0.
        expect(calculatePotentialScore(9, 3, 3)).toBe(0);
    });

    it('should return minimum score of 12 at 10th attempt with no hints', () => {
        // At attempt 10: 30 - ((10-1) * 2) = 30 - 18 = 12
        expect(calculatePotentialScore(9, 0, 3)).toBe(12);
        expect(calculatePotentialScore(9, 0, 2)).toBe(12);
    });
});
