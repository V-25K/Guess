/**
 * Test suite for reward calculator functions
 * Run with: node --loader ts-node/esm src/shared/utils/reward-calculator.test.ts
 */

import { calculateAttemptReward, calculatePotentialScore } from './reward-calculator.js';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const condition = JSON.stringify(actual) === JSON.stringify(expected);
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    console.error(`❌ FAIL: ${message} (expected error but none was thrown)`);
    testsFailed++;
  } catch (error) {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  }
}

// Test Suite: calculateAttemptReward
console.log('\n=== Testing calculateAttemptReward ===\n');

// Test 1: Attempt 1 returns 30 points
const result1 = calculateAttemptReward(1, true);
assertEqual(result1, { points: 30, exp: 30 }, 'Attempt 1 returns 30 points (28 + 2 bonus)');

// Test 2: Attempt 2 returns 27 points
const result2 = calculateAttemptReward(2, true);
assertEqual(result2, { points: 27, exp: 27 }, 'Attempt 2 returns 27 points (28 - 2 + 1 bonus)');

// Test 3: Attempt 3 returns 24 points
const result3 = calculateAttemptReward(3, true);
assertEqual(result3, { points: 24, exp: 24 }, 'Attempt 3 returns 24 points (28 - 4)');

// Test 4: Attempt 4 returns 22 points
const result4 = calculateAttemptReward(4, true);
assertEqual(result4, { points: 22, exp: 22 }, 'Attempt 4 returns 22 points (28 - 6)');

// Test 5: Attempt 5 returns 20 points
const result5 = calculateAttemptReward(5, true);
assertEqual(result5, { points: 20, exp: 20 }, 'Attempt 5 returns 20 points (28 - 8)');

// Test 6: Attempt 10 returns 10 points
const result10 = calculateAttemptReward(10, true);
assertEqual(result10, { points: 10, exp: 10 }, 'Attempt 10 returns 10 points (28 - 18)');

// Test 7: Failed attempt returns 0 points
const resultFailed = calculateAttemptReward(5, false);
assertEqual(resultFailed, { points: 0, exp: 0 }, 'Failed attempt returns 0 points');

// Test 8: Invalid attempt < 1 throws error
assertThrows(
  () => calculateAttemptReward(0, true),
  'Attempt < 1 throws error'
);

// Test 9: Invalid attempt > 10 throws error
assertThrows(
  () => calculateAttemptReward(11, true),
  'Attempt > 10 throws error'
);

// Test 10: Negative attempt throws error
assertThrows(
  () => calculateAttemptReward(-1, true),
  'Negative attempt throws error'
);

// Test Suite: calculatePotentialScore
console.log('\n=== Testing calculatePotentialScore ===\n');

// Test 11: Current attempt 0 returns 30 (next is 1st)
const potential0 = calculatePotentialScore(0);
assertEqual(potential0, 30, 'Current attempt 0 returns 30 (next is 1st attempt)');

// Test 12: Current attempt 1 returns 27 (next is 2nd)
const potential1 = calculatePotentialScore(1);
assertEqual(potential1, 27, 'Current attempt 1 returns 27 (next is 2nd attempt)');

// Test 13: Current attempt 2 returns 24 (next is 3rd)
const potential2 = calculatePotentialScore(2);
assertEqual(potential2, 24, 'Current attempt 2 returns 24 (next is 3rd attempt)');

// Test 14: Current attempt 9 returns 10 (next is 10th)
const potential9 = calculatePotentialScore(9);
assertEqual(potential9, 10, 'Current attempt 9 returns 10 (next is 10th attempt)');

// Test 15: Current attempt 10 returns 0 (no more attempts)
const potential10 = calculatePotentialScore(10);
assertEqual(potential10, 0, 'Current attempt 10 returns 0 (no more attempts)');

// Test 16: Experience equals points (1:1 ratio)
const result6 = calculateAttemptReward(6, true);
assert(result6.points === result6.exp, 'Experience equals points (1:1 ratio)');

// Summary
console.log('\n=== Test Summary ===\n');
console.log(`Total tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed\n');
  process.exit(1);
}
