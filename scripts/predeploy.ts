#!/usr/bin/env npx ts-node

/**
 * Pre-deployment validation script
 * Run before `npm run deploy` to ensure code quality
 */

import { execSync } from 'child_process';

const steps = [
    { name: 'Type Check', cmd: 'npx tsc --noEmit' },
    { name: 'Unit Tests', cmd: 'npm run test' },
];

console.log('🚀 Pre-deploy validation starting...\n');

for (const step of steps) {
    console.log(`⏳ Running ${step.name}...`);
    try {
        execSync(step.cmd, { stdio: 'inherit' });
        console.log(`✅ ${step.name} passed\n`);
    } catch {
        console.error(`❌ ${step.name} failed. Fix issues before deploying.`);
        process.exit(1);
    }
}

console.log('✅ All checks passed! Safe to deploy.');
