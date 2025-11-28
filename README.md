# Guess The Link

A Reddit game where players guess the common link between progressively revealed images. Built on Devvit with AI-powered validation using Google Gemini.

## Overview

Guess The Link is an interactive puzzle game where players are presented with multiple images displayed immediately. The goal is to identify the common theme or connection between all images. You have up to 10 attempts to guess correctly, with your score decreasing with each attempt, so the challenge is to deduce the answer quickly and accurately.

## Gameplay

### How to Play

1. **Start a Challenge**: Select a challenge from the available list
2. **View All Images**: All images are displayed immediately - no need to reveal them
3. **Guess the Link**: Submit your answer for what connects all the images (up to 10 attempts)
4. **AI Validation**: Google Gemini AI judges if your answer is correct
5. **Earn Rewards**: Get points and experience based on how many attempts you needed

### Scoring System

- **Maximum Base Score**: 28 points (correct on 1st attempt)
- **Minimum Base Score**: 10 points (correct on 10th attempt)
- **Deduction**: 2 points per attempt
- **Attempt Limit**: 10 attempts maximum per challenge
- **Experience**: Points earned = Experience gained (1:1 ratio)

**Base Scoring Formula:**
- Base Score: 28 - ((attempts - 1) × 2) points

**Example Base Scoring:**
- 1st attempt: 28 points + 28 exp
- 2nd attempt: 26 points + 26 exp
- 3rd attempt: 24 points + 24 exp
- 5th attempt: 20 points + 20 exp
- 10th attempt: 10 points + 10 exp
- Failed (10 incorrect): 0 points + 0 exp

### Bonus System 🎁

On top of base rewards, players can earn special bonuses:

| Bonus | Points/Exp | Trigger |
|-------|------------|---------|
| 🎉 **First Clear!** | +50 | Solving your very first challenge ever |
| ✨ **Perfect!** | +20 | Solving on the 1st attempt |
| ⚡ **Speed Demon!** | +5 | Solving within attempts 2-3 |
| 👑 **Comeback King!** | +3 | Clutch solve on the 10th (last) attempt |
| 🔥 **Streak Bonus!** | +3 | Consecutive solves without failing |
| 🎨 **Creator Bonus!** | +2 | Someone else solves your challenge |

**Example with Bonuses:**
- First ever challenge, solved on 1st attempt: 28 + 50 (first clear) + 20 (perfect) = **98 points!**
- 2nd challenge, solved on 1st attempt with streak: 28 + 20 (perfect) + 3 (streak) = **51 points**
- Clutch 10th attempt solve: 10 + 3 (comeback king) = **13 points**

### Streak System 🔥

- Your streak increases each time you solve a challenge
- Failing a challenge (using all 10 attempts without solving) resets your streak to 0
- Your current streak and best streak are tracked on your profile

### AI Answer Validation

The game uses Google Gemini AI to validate answers with intelligent matching:
- Accepts semantically similar answers (e.g., "dogs" and "canines")
- Understands context from challenge title and description
- Flexible with alternative phrasings and synonyms
- Falls back to exact matching if AI is unavailable

## Progression System

### Points & Experience

**Points** are earned from:
- Solving challenges (10-28 base points + bonuses)
- Creating challenges (+5 points)
- Receiving comments on your challenges (+1 point per comment)
- Bonus rewards (First Clear, Perfect, Streak, etc.)

**Experience (EXP)** is gained at a 1:1 ratio with points:
- Solving challenges (10-28 base exp + bonuses)
- Creating challenges (+5 exp)
- Receiving comments on your challenges (+1 exp per comment)
- Bonus rewards (First Clear, Perfect, Streak, etc.)

### Leveling Up

Levels are calculated using an exponential curve based on total experience:

```
Level 1: 0 exp
Level 2: 100 exp
Level 3: 250 exp
Level 4: 475 exp
Level 5: 812 exp
Level 10: 3,162 exp
```

Formula: `exp_required = 100 × (level - 1)^1.5`

### Leaderboard

Players are ranked by total points earned. The leaderboard shows:
- Top 10 players globally
- Your current rank and stats
- Level, points, and experience for each player

## Creating Challenges

### Challenge Creation

Players can create their own challenges with:
- **Title**: Descriptive name for the challenge (3-100 characters)
- **Answer**: The correct link between images (2-200 characters)
- **Description**: Optional hint or context (max 500 characters)
- **Images**: 2-5 image URLs
- **Tags**: 1-5 category tags

### Rate Limiting

To maintain quality, users can create **1 challenge per 24 hours**.

### Creator Rewards

Challenge creators earn rewards when:
- Creating a challenge: +5 points, +5 exp
- Players comment on their challenge: +1 point, +1 exp per comment

### Available Tags

🎌 Anime • 🌐 General • ⚽ Sport • 🎬 Movies • 🎵 Music • 🎮 Gaming • 📜 History • 🔬 Science • 🗺️ Geography • 🍕 Food • 🎨 Art • 💻 Technology

## Game Features

### User Profiles

Track your progress with detailed statistics:
- Total points and experience
- Current level and progress to next level
- Challenges completed
- Win rate percentage
- Challenges created

### Challenge Variety

Challenges can cover any topic:
- Pop culture and entertainment
- Sports and athletes
- Geography and landmarks
- Food and cuisine
- Technology and brands
- History and science
- And much more!

### Social Engagement

- Comment on challenges to discuss answers
- Creators earn rewards from engagement
- Share your favorite challenges
- Compete on the global leaderboard

## Tech Stack

- **Platform**: Devvit (Reddit's app development platform)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API
- **UI**: Devvit Blocks (declarative components)

## Architecture

The game follows a client-server-shared layered architecture:

```
src/
├── client/                     # UI layer (Devvit Blocks)
│   ├── main.tsx               # App entry point
│   ├── components/            # UI components
│   └── hooks/                 # Custom hooks
├── server/                     # Business logic layer
│   ├── services/              # Business logic
│   ├── repositories/          # Data access
│   └── utils/                 # Server utilities
└── shared/                     # Common code
    ├── models/                # Type definitions
    ├── constants/             # App constants
    └── utils/                 # Pure utilities
```

### Key Components

**Services**: Handle business logic and orchestration
- User management and progression
- Challenge CRUD operations
- AI answer validation
- Leaderboard rankings
- Comment reward tracking

**Repositories**: Manage database operations
- User profiles
- Challenges
- Attempts
- Comment rewards

**Components**: Render UI using Devvit Blocks
- Gameplay view with image grid
- Profile statistics
- Leaderboard rankings
- Challenge creation form
- Navigation and menus

## Game Logic

### Challenge Flow

1. User selects a challenge from the list
2. All images are displayed immediately
3. User submits a guess (up to 10 attempts allowed)
4. AI validates the answer and provides feedback
5. If incorrect, user can try again (score decreases with each attempt)
6. If correct, points and experience awarded based on attempts needed
7. If 10 incorrect attempts, game over with 0 points
8. User can move to next challenge

### Reward Calculation

```typescript
// Calculate base points based on attempts made
function calculateAttemptReward(attemptsMade: number, isSolved: boolean): Reward {
  if (!isSolved) return { points: 0, exp: 0 };
  
  // Base calculation: 28 - ((attempts - 1) × 2)
  const points = 28 - ((attemptsMade - 1) * 2);
  const exp = points; // 1:1 ratio
  return { points, exp };
}

// Calculate bonuses based on context
function calculateBonuses(context: BonusContext): Bonus[] {
  const bonuses = [];
  if (context.isFirstClear) bonuses.push({ type: 'first_clear', points: 50 });
  if (context.attemptsMade === 1) bonuses.push({ type: 'perfect_solve', points: 20 });
  if (context.attemptsMade >= 2 && context.attemptsMade <= 3) bonuses.push({ type: 'speed_demon', points: 5 });
  if (context.attemptsMade === 10) bonuses.push({ type: 'comeback_king', points: 3 });
  if (context.currentStreak > 0) bonuses.push({ type: 'streak', points: 3 });
  return bonuses;
}

// Base Examples:
// 1st attempt: 28 points + bonuses
// 2nd attempt: 26 points + bonuses
// 3rd attempt: 24 points + bonuses
// 10th attempt: 10 points + bonuses
// Failed (10 incorrect): 0 points, 0 exp
```

### Level Progression

```typescript
function calculateLevel(totalExp: number): number {
  let level = 1;
  while (getExpForLevel(level) <= totalExp) {
    level++;
  }
  return level;
}

function getExpForLevel(level: number): number {
  return Math.floor(100 × Math.pow(level - 1, 1.5));
}
```

## Data Models

### User Profile
```typescript
{
  user_id: string
  username: string
  total_points: number
  total_experience: number
  level: number
  challenges_solved: number
  challenges_created: number
  current_streak: number        // Consecutive solves without failing
  best_streak: number           // Highest streak achieved
  last_challenge_created_at: timestamp
}
```

### Challenge
```typescript
{
  id: string
  creator_id: string
  title: string
  answer: string
  description?: string
  image_urls: string[]
  tags: string[]
  max_score: number
  score_deduction_per_hint: number
  created_at: timestamp
}
```

### Challenge Attempt
```typescript
{
  id: string
  user_id: string
  challenge_id: string
  is_solved: boolean
  attempts_made: number
  game_over: boolean
  points_earned: number
  experience_earned: number
  attempted_at: timestamp
  completed_at: timestamp
}
```

## Deployment

### Prerequisites
- Reddit account with developer access
- Supabase project with PostgreSQL database
- Google Gemini API key

### Configuration
Set the following in Devvit app settings:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `GEMINI_API_KEY`: Your Google Gemini API key

### Deployment Commands
```bash
# Login to Devvit
npm run login

# Test locally
npm run dev

# Upload to Reddit
npm run deploy

# Publish to production
npm run launch
```

### Production Checklist
- ✅ Rate limiting set to 24 hours (production mode)
- ✅ All API keys configured
- ✅ Database schema deployed
- ✅ Error handling tested
- ✅ Caching verified
- ✅ AI fallback tested

## Performance Optimizations

The codebase includes several key optimizations:

1. **Batch Fetching**: User attempts are fetched once per operation instead of N+1 queries
2. **Redis Caching**: User profiles (5min), leaderboard (60s), feed (30s), AI validations (indefinite)
3. **Request Deduplication**: Simultaneous requests for the same data share results
4. **Atomic Operations**: Database updates use atomic functions to prevent race conditions

## License

BSD-3-Clause - Copyright (c) 2025 Reddit Inc.
