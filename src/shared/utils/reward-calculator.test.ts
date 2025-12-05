
import { describe, it, expect } from 'vitest';
import { calculatePotentialScore } from './reward-calculator.js';

describe('Hint System Verification', () => {
    it('should calculate penalties for 3-image challenge correctly', () => {
        // 0 hints
        expect(calculatePotentialScore(0, 0, 3)).toBe(28);
        // 1 hint (-7)
        expect(calculatePotentialScore(0, 1, 3)).toBe(21);
        // 2 hints (-7, -6) -> 21 - 6 = 15
        expect(calculatePotentialScore(0, 2, 3)).toBe(15);
        // 3 hints (-7, -6, -5) -> 15 - 5 = 10
        expect(calculatePotentialScore(0, 3, 3)).toBe(10);
    });

    it('should calculate penalties for 2-image challenge correctly', () => {
        // 0 hints
        expect(calculatePotentialScore(0, 0, 2)).toBe(28);
        // 1 hint (-10)
        expect(calculatePotentialScore(0, 1, 2)).toBe(18);
        // 2 hints (-10, -8) -> 18 - 8 = 10
        expect(calculatePotentialScore(0, 2, 2)).toBe(10);
    });

    it('should cap score at 0 (non-negative)', () => {
        // Attempt 9 (1 attempt remaining) -> -18 penalty from attempts
        // Base 28 - 18 = 10.
        // 3 hints penalty is -18 (for 3 images: 7+6+5).
        // 10 - 18 = -8 => Should be 0.
        expect(calculatePotentialScore(9, 3, 3)).toBe(0);
    });
});
