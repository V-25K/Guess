# Guess The Link

A Reddit game where players guess the common link between images. Built on Devvit with AI-powered answer validation.

## How to Play

1. Select a challenge from the list
2. View all images displayed
3. Guess what connects them (up to 10 attempts)
4. AI validates your answer
5. Earn points based on how quickly you solve it

## Scoring

| Attempt | Points |
|---------|--------|
| 1st | 30 |
| 2nd | 28 |
| 3rd | 26 |
| ... | -2 per attempt |
| 10th | 12 |
| Failed | 0 |

Formula: `30 - ((attempts - 1) × 2)`

### Hints

Reveal image descriptions to help solve challenges. Hints cost points from your potential score:

| Challenge Type | Hint Cost |
|----------------|-----------|
| 3 images | 4 pts each |
| 2 images | 6 pts each |

## Bonuses

| Bonus | Points | Trigger |
|-------|--------|---------|
| 🎉 First Clear | +50 | First ever solve |
| ✨ Perfect | +20 | 1st attempt solve |
| ⚡ Speed Demon | +5 | Solve in 2-3 attempts |
| 👑 Comeback King | +3 | Clutch 10th attempt solve |
| 🔥 Streak | +3 | Consecutive solves |
| 🎨 Creator | +2 | Someone solves your challenge |

## Streaks

- Streak increases with each solve
- Failing a challenge (10 wrong guesses) resets your streak
- Best streak is tracked on your profile

## Leveling

Experience = Points earned (1:1 ratio)

Level thresholds use linear growth: `50 × level` per level increment

| Level | EXP Required |
|-------|--------------|
| 2 | 100 |
| 3 | 250 |
| 4 | 450 |
| 5 | 700 |
| 10 | 2,750 |

## Creating Challenges

- Add 2-3 images with a common theme
- Set the correct answer
- Earn +5 points for creating
- Earn +1 point when others comment

Rate limit: 1 challenge per 24 hours

## Themes

🎌 Anime • 🌐 General • ⚽ Sport • 🎬 Movies • 🎵 Music • 🎮 Gaming • 📜 History • 🔬 Science • 🗺️ Geography • 🍕 Food • 🎨 Art • 💻 Technology • 🌿 Nature • ⭐ Celebrities • 🏷️ Brands

## Leaderboard

Players ranked by total points. Shows top 10 globally plus your current rank.

## Architecture

The application is built on the Devvit platform with a React frontend and Node.js backend.

### Frontend (React)

```
src/client/
├── api/           # API client and error handling
├── components/    # React components
│   ├── shared/    # Reusable UI components (Button, Card, Modal, Toast, Badge)
│   ├── gameplay/  # Game-related components
│   ├── menu/      # Navigation components
│   └── ...        # Feature-specific components
├── hooks/         # Custom React hooks (useGameReducer, useViewMode)
├── types/         # TypeScript type definitions
└── utils/         # Utility functions (accessibility, etc.)
```

### Backend (Devvit Server)

```
src/server/
├── routes/        # API route handlers
├── services/      # Business logic
├── repositories/  # Data access layer
└── utils/         # Server utilities
```

### Key Technologies

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Devvit, Redis (KV store)
- **Testing**: Vitest, React Testing Library, fast-check (property testing)
- **Styling**: Tailwind CSS

### Design System

The app uses Tailwind CSS for styling with a comprehensive configuration in `src/client/tailwind.config.ts`.

See `docs/diagrams/` for architecture diagrams.

## License

BSD-3-Clause
