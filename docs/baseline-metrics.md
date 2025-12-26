# Frontend Audit Baseline Metrics

**Date:** December 10, 2025

## Environment

- **Framework:** React 19.2.1 with TypeScript 5.9.3
- **Build Tool:** Vite 7.2.6
- **Package Manager:** npm
- **Test Framework:** Vitest 4.0.15 with happy-dom
- **Property-Based Testing:** fast-check 4.3.0
- **Platform:** Reddit Devvit Web application

## npm install

```
up to date, audited 855 packages in 13s
221 packages are looking for funding
7 vulnerabilities (5 low, 2 high)
```

**Notes:**
- All dependencies are up to date
- 7 security vulnerabilities detected (5 low, 2 high) - recommend running `npm audit fix`

## Build Output

### Client Build (Vite)

| File | Size | Gzipped |
|------|------|---------|
| index.html | 0.60 kB | 0.36 kB |
| index.css | 17.49 kB | 3.36 kB |
| react-vendor.js | 11.37 kB | 4.10 kB |
| index.js (main bundle) | 208.96 kB | **64.14 kB** |

**Total Client Bundle (gzipped):** ~72 kB

**Build Time:** 1.45s

### Server Build (esbuild)

| File | Size |
|------|------|
| index.cjs | 7.2 MB |

**Build Time:** 382ms

## Test Results

```
Test Files  73 passed (73)
Tests       1250 passed (1250)
Duration    35.41s
```

**All 1250 tests pass** with no failures.

## Lint Status

- No lint script configured in package.json
- Recommend adding ESLint configuration for code quality enforcement

## Current CSS Analysis

- **global.css:** 1147 lines (monolithic stylesheet)
- No design token system in place
- CSS variables used but not organized into tokens

## Bundle Size Analysis

### Main Bundle Breakdown

| Chunk | Gzipped Size | Notes |
|-------|--------------|-------|
| Main bundle (index.js) | 64.14 kB | Exceeds 200KB target (pre-gzip) |
| React vendor | 4.10 kB | Properly split |
| CSS | 3.36 kB | Single stylesheet |

### Observations

1. **Main bundle size:** 208.96 kB (64.14 kB gzipped) - The main bundle is above the 200KB target mentioned in requirements (8.1)
2. **Vendor splitting:** React/React-DOM properly split into separate chunk (11.37 kB / 4.10 kB gzipped)
3. **CSS:** Single monolithic stylesheet at 17.49 kB (3.36 kB gzipped)

## Issues Identified

### Build Warnings
- None - build completes successfully

### Test Failures
- None - all 1250 tests pass

### Lint Errors
- No lint script configured

### Security Vulnerabilities
- 7 npm vulnerabilities (5 low, 2 high)

## Recommendations

1. **Add ESLint configuration** for code quality enforcement (Requirement 5.6)
2. **Address npm vulnerabilities** by running `npm audit fix`
3. **Implement code splitting** to reduce main bundle size below 200KB (Requirement 8.1)
4. **Create design token system** to replace monolithic CSS (Requirement 1.1-1.5)
5. **Add bundle analysis tooling** for ongoing monitoring

## Bundle Analysis - Largest Modules

### Client Components (by lines of code)

| File | Lines | Notes |
|------|-------|-------|
| PlayGameView.tsx | 877 | **Exceeds 300 line limit** - needs splitting |
| ChallengeCreationView.tsx | 437 | **Exceeds 300 line limit** - needs splitting |
| GameplayViewWrapper.tsx | 378 | **Exceeds 300 line limit** - needs splitting |
| GameplayWebview.tsx | 350 | **Exceeds 300 line limit** - needs splitting |
| CreateChallengeView.tsx | 334 | **Exceeds 300 line limit** - needs splitting |
| AwardsView.tsx | 333 | **Exceeds 300 line limit** - needs splitting |
| ChallengeCreationReview.tsx | 282 | Within limit |
| ViewRouter.tsx | 270 | Within limit |
| GameplayView.tsx | 270 | Within limit |
| RewardNotification.tsx | 263 | Within limit |
| client.ts (API) | 253 | Within limit |
| useChallenges.ts | 233 | Within limit |
| AnswerExplanationView.tsx | 233 | Within limit |
| App.tsx | 216 | Within limit |

### Shared Utilities (by lines of code)

| File | Lines | Notes |
|------|-------|-------|
| validation.ts | 303 | **Exceeds 300 line limit** |
| reward-calculator.ts | 208 | Within limit |
| request-deduplication.ts | 204 | Within limit |
| cache.ts | 204 | Within limit |
| parallel-fetch.ts | 183 | Within limit |
| theme.ts | 160 | Within limit |

### Code Splitting Opportunities

1. **PlayGameView.tsx (877 lines)** - Largest component, should be split into:
   - Game logic/state management
   - UI rendering components
   - Answer submission handling

2. **ChallengeCreationView.tsx (437 lines)** - Split into:
   - Form components
   - Image upload handling
   - Preview components

3. **GameplayViewWrapper.tsx (378 lines)** - Split into:
   - Loading states
   - Error handling
   - Main gameplay container

4. **GameplayWebview.tsx (350 lines)** - Split into:
   - Webview communication
   - Message handling
   - UI components

5. **CreateChallengeView.tsx (334 lines)** - Split into:
   - Form validation
   - Step components
   - Submission handling

6. **AwardsView.tsx (333 lines)** - Split into:
   - Award display components
   - Progress tracking
   - Animation components

### Bundle Optimization Recommendations

1. **Lazy Loading**: Implement React.lazy() for route-based code splitting:
   - Awards view (not immediately needed)
   - Create challenge view (only for creators)
   - Leaderboard view (secondary feature)

2. **Component Splitting**: Break down components exceeding 300 lines per Requirement 5.3

3. **Tree Shaking**: Ensure all imports are specific (not barrel imports) for better tree shaking

4. **Dynamic Imports**: Consider dynamic imports for:
   - Heavy utility functions
   - Feature-specific code

### Current Bundle Composition Estimate

Based on source analysis:

| Category | Estimated Size | % of Bundle |
|----------|---------------|-------------|
| React + React-DOM | 11.37 kB | ~5% |
| Gameplay components | ~80 kB | ~38% |
| Creation components | ~40 kB | ~19% |
| Shared components | ~30 kB | ~14% |
| Hooks & utilities | ~25 kB | ~12% |
| API client | ~15 kB | ~7% |
| Other | ~10 kB | ~5% |

## Next Steps

- Task 2: Create design token system foundation
- Task 4-10: Refactor shared components with design tokens
- Task 12-16: Refactor feature components (split large files)
- Task 23: Clean up codebase and remove dead code
