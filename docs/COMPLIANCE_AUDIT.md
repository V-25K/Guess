# Devvit Compliance Audit Report

**Linkaroo**  
**Audit Date: December 26, 2025**  
**Last Updated: January 1, 2026**  
**Auditor: Automated Compliance Review**

---

## Executive Summary

This audit evaluates the Linkaroo application against Reddit's Devvit Rules and Developer Terms. The app uses several features that require Terms of Service and Privacy Policy documentation.

### Compliance Status: ✅ COMPLIANT

| Requirement | Status | Notes |
|-------------|--------|-------|
| Terms of Service | ✅ Created | TERMS_OF_SERVICE.md |
| Privacy Policy | ✅ Created | PRIVACY_POLICY.md |
| HTTP Fetch Documentation | ✅ Documented | Fetch domains section in README |
| Post Deletion Handling | ✅ Implemented | PostDelete trigger implemented |
| Account Deletion Handling | ✅ Implemented | 30-day auto-anonymization via scheduler |
| Data Retention Policy | ✅ Implemented | Redis TTL + Supabase scheduler |

---

## 1. Features Requiring Documentation

### 1.1 HTTP Fetch (REQUIRED: ToS + Privacy Policy)

**Status:** ✅ Documented

The app uses HTTP Fetch with the following domains:

| Domain | Purpose | Approval Status |
|--------|---------|-----------------|
| `generativelanguage.googleapis.com` | Google Gemini AI for answer variation generation | Approved LLM provider |
| `jqgithkiinvgcpskwado.supabase.co` | Supabase database storage | Approved cloud provider |

### 1.2 Generative AI/LLM Usage (REQUIRED: ToS + Privacy Policy)

**Status:** ✅ Documented

| Requirement | Compliance |
|-------------|------------|
| Uses approved LLM | ✅ Google Gemini (approved) |
| Provides significant benefit | ✅ Answer variation generation for flexible matching |
| Does not train models with Reddit data | ✅ Confirmed |
| Has ToS and Privacy Policy | ✅ Created |

**AI Usage Details:**
- Service: Google Gemini 2.5 Flash
- Purpose: Generate answer variations during challenge creation (once per challenge)
- Data Sent: Challenge answers, image descriptions, answer explanations (creator-provided only)
- Data NOT Sent: Player guesses, Reddit user IDs, usernames, or personal information
- Player guesses are validated locally against pre-generated answer sets (no AI calls during gameplay)

### 1.3 Redis Data Storage

**Status:** ✅ Implemented

| Aspect | Implementation |
|--------|----------------|
| Data Scope | Per-installation (subreddit-specific) |
| Usage | Cache warming, session data, temporary storage |
| Limits | Within 500MB quota |
| TTL/Expiration | ✅ 30-day max TTL via `capUserDataTTL()` |

**Implementation Details:**
- `CacheService.setUserData()` automatically caps TTL at 30 days
- `CacheService.setUserDataRetentionTTL()` helper for explicit TTL setting
- `TTL.USER_DATA_RETENTION_SECONDS` constant (2,592,000 seconds = 30 days)

### 1.4 External Database (Supabase)

**Status:** ✅ Implemented

| Requirement | Status |
|-------------|--------|
| Approved provider | ✅ Supabase is approved |
| Privacy guidelines followed | ✅ No PII beyond Reddit ID/username |
| Data governance | ✅ Daily scheduler anonymizes inactive users |

---

## 2. Data Handling Compliance

### 2.1 Data Collected

| Data Type | Source | Storage | Compliant |
|-----------|--------|---------|-----------|
| Reddit User ID (t2_*) | Reddit API | Supabase + Redis | ✅ TTL configured |
| Reddit Username | Reddit API | Supabase | ✅ Auto-anonymized |
| Avatar URL | Reddit API | Supabase + Redis | ✅ Auto-anonymized |
| User Role (player/mod) | Generated | Supabase | ✅ |
| Game Statistics | Generated | Supabase | ✅ |
| Challenge Content | User Input | Supabase | ✅ |
| Guesses | User Input | Supabase | ✅ |
| Hints Used | Generated | Supabase | ✅ |

### 2.2 Data NOT Collected (Compliant)

- ❌ Email addresses
- ❌ Real names
- ❌ Location data
- ❌ Financial information
- ❌ Health information
- ❌ Biometric data

### 2.3 Data Minimization

**Status:** ✅ Compliant

The app only collects data necessary for gameplay functionality.

---

## 3. Compliance Implementation

### 3.1 ✅ Implemented: Post Delete Trigger

**Requirement:** Devvit Rules state:
> "On PostDelete and CommentDelete event triggers, you must delete all content related to the post and/or comment from your app."

**Implementation:**
- PostDelete trigger registered in `devvit.json`
- Handler at `src/server/triggers/post-delete.ts`
- Deletes challenge and all related data when post is deleted
- Uses database CASCADE to clean up related records (attempts, guesses)

### 3.2 ✅ Implemented: Account Deletion Compliance

**Requirement:** Devvit Rules state:
> "When a user account is deleted, the related user ID (t2_*) must be completely removed from your hosted datastores."

**Devvit Recommendation:**
> "To best comply with this policy, we recommend deleting any stored user data within 30 days. For any data you are storing in Redis, you can use the expire function to ensure data gets deleted automatically."

**Implementation:**

#### Redis TTL (Automatic Expiration)
- `CacheService.setUserData()` caps all TTLs at 30 days maximum
- `capUserDataTTL()` function ensures compliance
- `TTL.USER_DATA_RETENTION_SECONDS = 2,592,000` (30 days)

#### Supabase Scheduler (Daily Anonymization)
- Scheduler task `user-data-cleanup` runs daily at 3:00 AM UTC
- Configured in `devvit.json` under `scheduler.tasks`
- Endpoint: `/internal/scheduler/user-data-cleanup`
- Handler: `src/server/routes/scheduler.routes.ts`
- Service: `src/server/services/data-cleanup.service.ts`

#### Database Function
- `anonymize_inactive_users(p_days_inactive)` in `schema.sql`
- Transforms `user_id` to `[deleted]:{uuid}` format
- Sets `username` to `[deleted]`
- Updates `creator_username` on challenges
- Idempotent: skips already-anonymized users

### 3.3 ✅ Implemented: Redis TTL for User Data

**Implementation:**
```typescript
// TTL constant in cache.service.ts
USER_DATA_RETENTION_SECONDS: 30 * 24 * 60 * 60, // 2,592,000 seconds

// Automatic TTL capping
export function capUserDataTTL(requestedTTL: number): number {
  return Math.min(requestedTTL, TTL.USER_DATA_RETENTION);
}

// Explicit TTL setting
async setUserDataRetentionTTL(key: string): Promise<void> {
  await redis.expire(key, TTL.USER_DATA_RETENTION_SECONDS);
}
```

### 3.4 ✅ Complete: Data Retention Policy Documentation

**Implementation:**
- Section 7 of `PRIVACY_POLICY.md` documents:
  - 30-day automatic anonymization for inactive users
  - Redis cache expiration (30-day maximum)
  - Challenge data persistence tied to Reddit post lifecycle
  - Statistics retention after anonymization
  - Manual deletion request process

---

## 4. Security Implementation Review

### 4.1 Security Headers ✅

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | Configured | ✅ |
| X-Frame-Options | SAMEORIGIN | ✅ |
| X-Content-Type-Options | nosniff | ✅ |
| Referrer-Policy | strict-origin-when-cross-origin | ✅ |
| Permissions-Policy | Configured | ✅ |

### 4.2 Rate Limiting ✅

| Limit | Implementation | Status |
|-------|----------------|--------|
| Challenge Creation | 24-hour cooldown | ✅ |
| API Rate Limits | Configured | ✅ |

### 4.3 Input Validation ✅

| Validation | Implementation | Status |
|------------|----------------|--------|
| Challenge Title | 3-200 characters | ✅ |
| Answer Length | 1-500 characters | ✅ |
| Image Count | 2-3 images | ✅ |
| Tags Required | At least 1 | ✅ |

---

## 5. Compliance Checklist

### Required for App Review

- [x] Terms of Service document
- [x] Privacy Policy document
- [x] Fetch Domains in README
- [x] PostDelete trigger handler
- [x] Account deletion compliance (via TTL + scheduler)
- [x] Redis TTL for user data
- [x] Data retention policy documented

### Best Practices (Recommended)

- [x] Security headers implemented
- [x] Rate limiting implemented
- [x] Input validation implemented
- [x] Error handling implemented
- [x] Data retention policy documented
- [ ] User data export capability
- [x] Audit logging

---

## 6. Remaining Recommendations

### 6.1 🟢 LOW: User Data Export Capability

**Status:** Not implemented (optional feature)

**Recommendation:** Consider adding a user data export feature for GDPR-style compliance, though not strictly required for Devvit apps.

### 6.2 🟢 LOW: Clean Up Legacy Account Delete Code

**Status:** Optional cleanup

The `src/server/triggers/account-delete.ts` file exists but cannot be triggered automatically (Devvit has no `onAccountDelete` trigger). Options:
1. Keep for documentation purposes
2. Repurpose as manual admin endpoint
3. Remove to reduce confusion

---

## 7. Conclusion

The Linkaroo application is **fully compliant** with Devvit Rules. All required documentation and data handling mechanisms are in place:

- ✅ Terms of Service and Privacy Policy created
- ✅ HTTP Fetch domains documented
- ✅ Post deletion properly handled
- ✅ Account deletion compliance via 30-day auto-anonymization
- ✅ Redis TTL configured for all user data
- ✅ Supabase cleanup scheduler running daily
- ✅ Data retention policy documented in Privacy Policy

**Status:** Ready for app review.

---

## Appendix: Implementation Files

| Component | File |
|-----------|------|
| Cache TTL | `src/server/services/cache.service.ts` |
| Data Cleanup Service | `src/server/services/data-cleanup.service.ts` |
| Scheduler Route | `src/server/routes/scheduler.routes.ts` |
| Database Function | `schema.sql` (`anonymize_inactive_users`) |
| Scheduler Config | `devvit.json` (`scheduler.tasks.user-data-cleanup`) |
| Privacy Policy | `PRIVACY_POLICY.md` (Section 7) |
| Post Delete Trigger | `src/server/triggers/post-delete.ts` |

---

*This audit was generated based on analysis of the codebase and Devvit documentation as of January 1, 2026.*
