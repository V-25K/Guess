# Guess The Link

A Reddit game where players guess the common link between progressively revealed images. Built on Devvit with AI-powered validation using Google Gemini.

## Overview

Guess The Link is an interactive puzzle game where players are presented with multiple hidden images. The goal is to identify the common theme or connection between all images before revealing them all. Each image revealed deducts points from your score, so the challenge is to guess correctly with as few hints as possible.

## Gameplay

### How to Play

1. **Start a Challenge**: Select a challenge from the available list
2. **Reveal Images**: Click on hidden images to reveal them one by one
3. **Guess the Link**: Submit your answer for what connects all the images
4. **AI Validation**: Google Gemini AI judges if your answer is correct
5. **Earn Rewards**: Get points and experience based on your performance

### Scoring System

- **Starting Score**: 25 points per challenge
- **Deduction**: 5 points per image revealed (after the first)
- **Minimum Score**: 0 points (can't go negative)
- **Experience**: Points earned = Experience gained (1:1 ratio)

**Example Scoring:**
- 1 image revealed: 25 points + 25 exp
- 2 images revealed: 20 points + 20 exp
- 3 images revealed: 15 points + 15 exp
- 4 images revealed: 10 points + 10 exp
- 5 images revealed: 5 points + 5 exp

### AI Answer Validation

The game uses Google Gemini AI to validate answers with intelligent matching:
- Accepts semantically similar answers (e.g., "dogs" and "canines")
- Understands context from challenge title and description
- Flexible with alternative phrasings and synonyms
- Falls back to exact matching if AI is unavailable

## Progression System

### Points & Experience

**Points** are earned from:
- Solving challenges (5-25 points based on images revealed)
- Creating challenges (+5 points)
- Receiving comments on your challenges (+1 point per comment)

**Experience (EXP)** is gained at a 1:1 ratio with points:
- Solving challenges (5-25 exp based on images revealed)
- Creating challenges (+5 exp)
- Receiving comments on your challenges (+1 exp per comment)

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
2. First image is revealed automatically (no point deduction)
3. User can reveal additional images (5 points deducted each)
4. User submits a guess
5. AI validates the answer
6. Points and experience awarded based on performance
7. User can move to next challenge

### Reward Calculation

```typescript
// Calculate points based on images revealed
const points = Math.max(0, 25 - (images_revealed - 1) × 5);

// Experience equals points (1:1 ratio)
const exp = points;

// Examples:
// 1 image revealed: 25 points, 25 exp
// 2 images revealed: 20 points, 20 exp
// 3 images revealed: 15 points, 15 exp
// 4 images revealed: 10 points, 10 exp
// 5 images revealed: 5 points, 5 exp
// Failed attempt: 0 points, 0 exp
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
  images_revealed: number
  points_earned: number
  exp_earned: number
  completed_at: timestamp
}
```

## License

BSD-3-Clause - Copyright (c) 2025 Reddit Inc.
