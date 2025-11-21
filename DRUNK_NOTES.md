# Drunk Notes to Future Me: GuessTheLink Explained

*Hey future me, it's 3am and I just finished this thing. Here's what I was thinking... I think.*

---

## 🍺 The Big Picture (What The Hell Did I Build?)

Okay so... it's like Wordle but with pictures instead of letters. People see a bunch of images and gotta figure out what connects them. Like if you show someone pics of Batman, Spider-Man, and Superman - the link is "superheroes" or whatever.

But here's the genius part (drunk me is so smart): we use **Google's Gemini AI** to validate answers because people are creative weirdos who say things like "cape wearers" when you're expecting "superheroes" and both should work, right?

Built on Reddit's Devvit platform which is like... React but for Reddit posts? Idk man, it works.

---

## 🎮 The Core Game Loop (How This Madness Works)

### 1. **Player Picks a Challenge**
- They see a list of challenges (created by other players)
- Each challenge has 2-5 images
- All images show up immediately (no stupid reveal mechanics like I originally planned)

### 2. **Player Makes Guesses**
- They get **10 attempts** to guess the link
- Each wrong guess = less points when they finally get it
- If they blow all 10 attempts = game over, loser, zero points

### 3. **AI Validation Magic** ✨
This is where it gets spicy. When someone submits a guess:

```typescript
// In ai-validation.service.ts
validateAnswer(guess, challenge, attemptNumber, pastGuesses)
```

**What's happening:**
- Takes their guess to Gemini AI
- AI compares it to the correct answer
- AI returns: CORRECT, CLOSE, or INCORRECT
- CORRECT = you win!
- CLOSE = "you're warm but too vague" (like saying "people" when answer is "actors")
- INCORRECT = try again champ

**Why I did it this way:**
Because exact string matching is dumb. If the answer is "dogs" and someone says "canines" or "puppers" or "doggos" they should get credit. AI handles all that fuzzy matching.

**The fallback:** If AI is dead (API key expired, rate limited, whatever), it falls back to basic string matching. Not ideal but keeps the game playable.

---

## 💰 Scoring System (The Point Grind)

Oh man, I spent way too long balancing this...

### How Scoring Works:
```typescript
// From reward-calculator.ts
function calculateAttemptReward(attemptsMade, isSolved) {
  // Base formula: 28 - ((attempts - 1) × 2)
  let points = 28 - ((attemptsMade - 1) * 2);
  
  // Bonuses for being smart on first tries
  if (attemptsMade === 1) points += 2;  // Total: 30 points
  if (attemptsMade === 2) points += 1;  // Total: 27 points
  
  return { points, exp: points };  // 1:1 ratio, exp = points
}
```

**Translation for drunk future me:**
- 1st attempt correct: **30 points** (you're a genius)
- 2nd attempt: **27 points** (still pretty good)
- 3rd attempt: **24 points** (meh)
- 4th: **22**, 5th: **20**, etc...
- 10th attempt: **10 points** (you barely made it buddy)
- Failed all 10: **0 points** (sad trombone)

**Why this formula?**
I wanted to reward quick thinking but not punish people too hard for 2-3 attempts. The bonuses on attempts 1-2 make first-guess players feel special.

---

## 📊 Leveling System (RPG Elements Because Why Not)

### The Math:
```typescript
// From level-calculator.ts
function getExpForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}
```

**What this means:**
- Level 1 → 2: need 100 exp
- Level 2 → 3: need 150 exp (100 × 1.5¹)
- Level 3 → 4: need 225 exp (100 × 1.5²)
- Level 4 → 5: need 337 exp (100 × 1.5³)

It's **exponential growth** with base 100 and growth factor 1.5.

**Why exponential?**
Because early levels should feel fast (instant gratification) but late levels should feel like achievements. Nobody cares about leveling from 47 to 48 unless it took effort.

### Cumulative EXP needed:
- Level 2: 100 total exp
- Level 3: 250 total exp
- Level 4: 475 total exp
- Level 5: 812 total exp
- Level 10: 3,162 total exp

**How to earn EXP:**
- Solve challenge: 10-30 exp (based on attempts)
- Create challenge: +5 exp
- Someone comments on your challenge: +1 exp per comment

Points and EXP are 1:1 ratio. Simple. Drunk me likes simple.

---

## 🎯 The AI Validation (The Smart Part)

### Why This Was Hard:

**Attempt #1-6:** AI gives short responses
```
"Not quite. Think about the theme connecting these images."
```

**Attempt #7:** AI gives a RICH HINT
```
"You're on the right track but think more specifically. 
All these images relate to [helpful context]. 
Consider what specific category they all belong to."
```

**Why attempt 7?**
Because by attempt 7, the player is probably frustrated. Give 'em a bone. But not too early or the game is too easy.

### The Three Judgments:

1. **CORRECT** = "Dogs" when answer is "Dogs" OR "Canines" OR "Puppers" (exact or good synonym)
2. **CLOSE** = "Animals" when answer is "Dogs" (too broad, encourages narrowing down)
3. **INCORRECT** = "Cars" when answer is "Dogs" (completely wrong)

### Caching:
```typescript
// Check Redis cache first to avoid duplicate AI calls
const cacheKey = `validation:${challengeId}:${normalizedGuess}`;
```

**Why cache?**
- AI calls cost money
- AI calls are slow
- If 10 people guess "dogs" on the same challenge, only call AI once

---

## 🏆 Leaderboard (Flexing Rights)

Super straightforward:
- Sort all players by `total_points` (descending)
- Show top 10
- Cache results for 60 seconds

```typescript
// leaderboard.service.ts
async getTopPlayers(limit = 10, offset = 0) {
  // Check cache first
  // If miss: query DB, cache for 60 seconds
  // Return sorted by total_points DESC
}
```

**Why 60 second cache?**
Points don't change THAT often. No need to hammer the database every time someone opens leaderboard. But 60 seconds is short enough that new high scores show up quickly.

**User rank calculation:**
Uses SQL to count how many players have more points than you. Your rank = (count + 1).

---

## 🛠️ Creating Challenges (User Generated Content FTW)

Players can create their own challenges! But with limits...

### Rate Limiting:
```typescript
// user.service.ts
async canCreateChallenge(userId) {
  // Check last_challenge_created_at
  // If < 24 hours ago: NOPE
  // If >= 24 hours: YEP
}
```

**Why 24 hours?**
To prevent spam. Without this, some joker would create 1000 challenges of the same thing. Quality > Quantity.

### Creator Rewards:
- +5 points/exp for creating a challenge
- +1 point/exp for EACH comment someone leaves

**Why comment rewards?**
Encourages people to create engaging challenges that spark discussion. Social engagement = good.

---

## 🎣 Custom Hooks (React Patterns I'm Proud Of)

### useAttemptTracking
Tracks the player's current attempt session:
```typescript
{
  attemptNumber: 3,
  pastGuesses: ["superheroes", "heroes", "marvel characters"],
  isGameOver: false,
  isSolved: false
}
```

### useChallenges
Manages challenge list, filtering, pagination. Basically "give me challenges I haven't solved yet."

### useRetry
Generic retry logic with exponential backoff. Because network requests fail sometimes and I'm not a monster.

```typescript
useRetry(
  async () => { /* do something */ },
  { maxAttempts: 3, delay: 1000, onRetry: (attempt) => { /* log it */ } }
);
```

### useRewards
Calculates and displays rewards. Shows the "You earned X points!" animations.

---

## 🗄️ Database Schema (Supabase/PostgreSQL)

### `user_profiles` Table
```sql
{
  user_id: STRING (Reddit user ID)
  username: STRING
  total_points: NUMBER
  total_experience: NUMBER
  level: NUMBER
  challenges_solved: NUMBER
  challenges_created: NUMBER
  last_challenge_created_at: TIMESTAMP
}
```

### `challenges` Table
```sql
{
  id: UUID
  creator_id: STRING
  title: STRING
  answer: STRING (the correct link)
  description: STRING (optional hint)
  image_urls: ARRAY<STRING>
  tags: ARRAY<STRING>
  created_at: TIMESTAMP
}
```

### `challenge_attempts` Table
```sql
{
  id: UUID
  user_id: STRING
  challenge_id: UUID
  is_solved: BOOLEAN
  attempts_made: NUMBER
  game_over: BOOLEAN
  points_earned: NUMBER
  experience_earned: NUMBER
  attempted_at: TIMESTAMP
  completed_at: TIMESTAMP
}
```

**Why separate attempts table?**
So we can track:
- Who attempted what
- How many tries it took
- When they started/finished
- Prevents re-attempting completed challenges

---

## 🧩 Architecture Decisions (Why I Did It This Way)

### Client-Server-Shared Split

```
src/
├── client/    # UI components, hooks (React-ish Devvit Blocks)
├── server/    # Business logic, DB access (runs on Reddit servers)
└── shared/    # Types, constants, pure utilities (used by both)
```

**Why this split?**
- **Client** code runs in the Reddit app (limited capabilities)
- **Server** code runs on Reddit's servers (can access DB, APIs)
- **Shared** code needs to work in both environments

### Service Layer Pattern

```
AttemptService      → handles game logic
UserService         → handles progression 
AIValidationService → handles AI calls
LeaderboardService  → handles rankings
```

**Why services?**
- Keeps business logic separate from DB queries (Repository pattern)
- Easy to test
- Easy to swap out implementations (e.g., mock AI for testing)

### Repository Pattern

```
UserRepository      → DB queries for users
ChallengeRepository → DB queries for challenges
AttemptRepository   → DB queries for attempts
```

**Why repositories?**
- All SQL in one place
- Services don't care HOW data is stored
- Could swap PostgreSQL for MongoDB if I wanted (I won't, but I COULD)

---

## 🔧 Error Handling (Because Shit Breaks)

Every service extends `BaseService` which has:

```typescript
async withErrorHandling(fn, errorMessage) {
  try {
    return await fn();
  } catch (error) {
    this.logError(errorMessage, error);
    return null; // Fail gracefully
  }
}
```

**Philosophy:**
- Log errors but don't crash
- Return null/empty arrays on failure
- Let the UI handle missing data gracefully

**Example:**
If leaderboard fails to load, show empty list instead of error screen. Users don't care about your database problems, they just want to play.

---

## 🎨 UI Components (Devvit Blocks)

Devvit uses a declarative component system like React:

```tsx
<vstack>
  <text>Guess the link!</text>
  <hstack>
    <image url={image1} />
    <image url={image2} />
  </hstack>
  <button onPress={() => submitGuess()}>Submit</button>
</vstack>
```

**Key components:**
- **Menu**: Main navigation
- **Gameplay**: Shows images, guess input, feedback
- **Profile**: User stats, level progress
- **Leaderboard**: Rankings
- **Creation**: Form to create challenges

---

## 🚀 Performance Optimizations (Speed Hacks)

### 1. Redis Caching
```typescript
RedisCache.set(key, value, ttlMs);
```
- User profiles: cached 5 minutes
- Leaderboard: cached 60 seconds
- AI validations: cached indefinitely (deterministic)

### 2. Request Deduplication
```typescript
deduplicateRequest(uniqueKey, fn);
```
If 10 requests come in simultaneously for same user profile, only execute 1 DB query and share the result.

### 3. Pagination
```typescript
getTopPlayers(limit, offset);
```
Don't load all 10,000 users at once. Load 10-20 at a time.

### 4. Atomic Operations
```sql
-- Update user stats in ONE query instead of multiple
UPDATE user_profiles 
SET total_points = total_points + $1,
    total_experience = total_experience + $2,
    level = calculate_level(total_experience + $2)
WHERE user_id = $3;
```

---

## 🐛 Known Issues (TODOs for Future Me)

1. **Cache invalidation is hard**
   - When user gains points, their leaderboard rank changes
   - But cache doesn't know to invalidate
   - Temporary fix: 60 second TTL
   - Better fix: Event-based invalidation

2. **AI calls can be slow**
   - Gemini sometimes takes 2-3 seconds
   - Using retries helps but adds latency
   - Could add loading states or optimistic UI

3. **No duplicate guess prevention**
   - User can guess "dogs" 10 times
   - Wastes attempts
   - Should validate client-side

4. **Challenge difficulty is all over the place**
   - Some challenges are too easy (1 attempt avg)
   - Some are impossible (nobody solves)
   - Could add difficulty rating system

---

## 🎓 What I Learned (Wisdom From Making This)

### 1. AI Validation is Both Amazing and Frustrating
**Good:**
- Handles synonyms perfectly
- Understands context
- Makes the game feel smart

**Bad:**
- Sometimes too lenient ("things" is accepted when answer is "planets")
- Sometimes too strict ("pups" rejected when answer is "dogs")
- Inconsistent (same guess gets different results occasionally)

**Solution:** Crafted specific prompts for each attempt number. More guidance = better results.

### 2. Exponential Leveling is Addictive
Players LOVE seeing progress bars fill up. The early levels (1-5) happen fast and feel rewarding. Late levels (20+) take forever but feel prestigious.

### 3. User-Generated Content is a Force Multiplier
I created ~20 sample challenges. Users created 100+ in the first week. But you NEED rate limiting or you get garbage.

### 4. Caching is Mandatory at Scale
Without caching:
- Every page load = 5-10 DB queries
- Leaderboard view = expensive sort query every time
- AI validation = slow + expensive

With caching:
- Most requests = instant (Redis is FAST)
- DB barely breaks a sweat
- AI calls are reused

### 5. Retry Logic Saves Your Ass
Networks are unreliable. Databases hiccup. APIs timeout. Retry with exponential backoff turns a 5% failure rate into a 0.1% failure rate.

---

## 🔮 Future Ideas (If I Ever Touch This Again)

1. **Difficulty Ratings**
   - Track solve rate per challenge
   - Easy = 80%+ solve rate
   - Hard = <30% solve rate
   - Filter challenges by difficulty

2. **Timed Challenges**
   - Speed bonus for fast solves
   - "Guess in under 60 seconds for 2x points"

3. **Multiplayer**
   - Race against friends
   - First to solve wins

4. **Daily Challenges**
   - One new challenge per day
   - Everyone plays the same one
   - Special daily leaderboard

5. **Achievements/Badges**
   - "Solved 100 challenges"
   - "Created 10 challenges"
   - "On a 7-day streak"

6. **Power-ups** (inspired by the StackIt conversation)
   - Reveal answer length
   - Remove wrong letter options
   - Get AI hint for free

---

## 💭 Final Drunk Thoughts

This project taught me:
- AI integration is easier than I thought
- Devvit is weird but powerful
- Users are creative (in good and bad ways)
- Caching is not optional
- Exponential formulas make everything feel better

The core loop is solid. The AI validation works (mostly). The progression system is addictive. People seem to like it.

Future me: if you're reading this 6 months from now and wondering "wtf was I thinking?"... this is what you were thinking. Now go fix those TODOs.

Also, the formula for attempt rewards is: `28 - ((attempts - 1) × 2) + bonus`

Don't forget that. You WILL forget that.

Good luck,
Drunk Past You 🍺

P.S. - The reason `calculateLevel()` uses a while loop instead of a formula is because the exp curve is cumulative and there's no inverse function for sum of geometric series that I could remember at 3am. Math is hard. Loops work fine.

P.P.S - If the AI starts accepting obviously wrong answers, check the prompt in `ai-validation.service.ts`. You probably need to be more specific about what "CORRECT" means.

P.P.P.S - Remember: `exp = points` (1:1 ratio). Don't overcomplicate it.
