# Migration Plan & Rollback Instructions

## Overview

This document provides instructions for migrating to the refactored frontend and rolling back if issues arise.

## Pre-Migration Checklist

- [ ] All tests pass (`npm test -- --run`)
- [ ] Build succeeds (`npm run build`)
- [ ] Review changes in staging environment
- [ ] Backup current production deployment
- [ ] Notify team of planned migration window

## Migration Steps

### 1. Update Dependencies

```bash
npm install
```

### 2. Run Tests

```bash
npm test -- --run
```

All 1457 tests should pass.

### 3. Build for Production

```bash
npm run build
```

Verify output:
- `dist/client/` contains built React app
- `dist/server/` contains server bundle
- No build errors or warnings (except chunk size info)

### 4. Deploy

Follow standard Devvit deployment:

```bash
devvit upload
devvit publish
```

### 5. Verify Deployment

- [ ] App loads without errors
- [ ] Navigation works between all views
- [ ] Challenge gameplay functions correctly
- [ ] Profile and leaderboard load data
- [ ] Challenge creation works
- [ ] Accessibility features work (keyboard nav, screen reader)

## Rollback Instructions

### Quick Rollback

If issues are detected immediately after deployment:

```bash
# Revert to previous version in Devvit
devvit publish --version <previous-version>
```

### Code Rollback

If code changes need to be reverted:

```bash
# Create rollback branch
git checkout -b rollback/pre-refactor

# Revert to commit before refactor
git revert --no-commit HEAD~<number-of-commits>..HEAD
git commit -m "Rollback: Revert frontend refactor"

# Deploy rollback
npm run build
devvit upload
devvit publish
```

### Partial Rollback

If only specific features need rollback:

#### Rollback State Management
Replace `useGameReducer` usage in `App.tsx` with previous `useState` calls.

#### Rollback API Error Handling
In `src/client/api/client.ts`, replace `ApiError` throws with simple `Error` throws.

## Feature Flags

For gradual rollout, consider implementing feature flags:

```typescript
// src/client/config/features.ts
export const FEATURES = {
  USE_NEW_STATE_MANAGEMENT: true,
  USE_DESIGN_TOKENS: true,
  USE_ACCESSIBILITY_FEATURES: true,
};
```

## Monitoring

After migration, monitor:

1. **Error rates** - Check for increased errors in logs
2. **Performance** - Monitor load times and interactions
3. **User feedback** - Watch for reports of issues

## Support

If issues arise:
1. Check browser console for errors
2. Review server logs: `devvit logs -s <subreddit>`
3. Run local tests to reproduce
4. Contact team for assistance

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Testing | 1 day | Run full test suite, manual QA |
| Staging | 1-2 days | Deploy to test subreddit |
| Production | 1 day | Deploy to production |
| Monitoring | 1 week | Watch for issues |
