# Linkaroo

**Version 0.1.0** | A Reddit game where players guess the common link between images

Linkaroo is an interactive puzzle game built for Reddit communities using the Devvit platform. Players are presented with 2-3 images and must figure out what connects them - whether it's a theme, category, or shared characteristic. With smart answer matching powered by AI, multiple correct variations are accepted, making the game accessible while still challenging.

## 🎯 App Overview

### What is Linkaroo?

Linkaroo transforms any subreddit into an engaging puzzle community where members can:
- **Play Challenges**: Solve image-based puzzles with up to 10 attempts
- **Create Content**: Submit your own challenges for others to solve
- **Compete**: Climb leaderboards and earn achievements
- **Build Streaks**: Maintain solving streaks for bonus points
- **Level Up**: Gain experience and unlock new achievements

### Key Features

- **Smart Answer Matching**: AI-powered system accepts multiple correct answer variations
- **Rich Scoring System**: Points based on attempt number with various bonuses
- **Achievement System**: 10+ different badges and bonuses to unlock
- **Leaderboards**: Global rankings with personal progress tracking
- **Streak System**: Consecutive solve bonuses with streak tracking
- **Rate-Limited Creation**: Balanced content creation (1 challenge per 24 hours)
- **Multi-Theme Support**: 13 different categories from Anime to Technology
- **Accessibility**: Full keyboard navigation and screen reader support

### Technical Highlights

- Built on **Devvit** platform with React frontend
- **PostgreSQL** database via Supabase for persistent data
- **Google Gemini AI** for intelligent answer matching
- **Comprehensive testing** with Vitest and property-based testing
- **Privacy-focused** with automatic data anonymization

## 📦 Installation & Setup

### For Subreddit Moderators

1. **Install the App**
   - Visit the [Devvit App Directory](https://developers.reddit.com/apps) (when published)
   - Search for "Linkaroo" or "guess-the-1ink"
   - Click "Install" and select your subreddit

2. **Configure Settings** (Optional)
   - The app works out-of-the-box with default settings
   - Advanced configuration available through mod tools if needed

3. **Create Your First Post**
   - Use the "Create Test Post" option in subreddit mod menu
   - Or create a regular post - the game will automatically appear

### For Players

No installation required! Simply:
1. Find a Linkaroo post in your subreddit
2. Click to start playing immediately
3. Use the menu options to access different game modes

### System Requirements

- **Reddit Account**: Required for playing and creating challenges
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **JavaScript**: Must be enabled
- **Internet Connection**: Required for real-time gameplay

## 🎮 How to Play

1. Select a challenge from the list
2. View all images displayed
3. Guess what connects them (up to 10 attempts)
4. Get instant feedback on your guess
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

| Level | Total EXP Required |
|-------|-------------------|
| 2 | 100 |
| 3 | 250 |
| 4 | 450 |
| 5 | 700 |
| 10 | 2,700 |

## Creating Challenges

- Add 2-3 images with a common theme
- Set the correct answer
- Earn +5 points for creating
- Earn +2 points when someone solves your challenge (Creator Bonus)

Rate limit: 1 challenge per 24 hours

📋 **[Creator Guidelines](https://github.com/V-25K/Guess/blob/main/docs/CREATOR_GUIDELINES.md)** - Best practices for creating engaging, fair challenges

## Themes

🎌 Anime • 🌐 General • ⚽ Sport • 🎬 Movies • 🎵 Music • 🎮 Gaming • 📜 History • 🔬 Science • 🗺️ Geography • 🍕 Food • 🎨 Art • 💻 Technology

## Leaderboard

Players ranked by total points. Shows top 10 globally plus your current rank.

## Fetch Domains

This app requests the following external domains:

### generativelanguage.googleapis.com
- **Purpose:** Google Gemini AI for generating acceptable answer variations during challenge creation
- **Data Sent:** Challenge correct answers, image descriptions, answer explanations (creator-provided content only)
- **Data NOT Sent:** Player guesses, usernames, user IDs, or any personal information
- **When Used:** Once per challenge at creation time only
- **Compliance:** Approved LLM provider per Devvit Rules

### jqgithkiinvgcpskwado.supabase.co
- **Purpose:** PostgreSQL database for persistent game data storage
- **Data Sent:** User profiles (Reddit ID, username, avatar URL), challenges, attempts, guesses
- **Data Retention:** User data auto-anonymized after 30 days of inactivity
- **Compliance:** Approved cloud provider (Supabase) per Devvit HTTP Fetch Policy

## 📋 Changelog

### Version 0.1.0 - Initial Release (January 2026)

**🎉 First Public Release**

This is the inaugural version of Linkaroo, bringing image-based puzzle gaming to Reddit communities.

#### ✨ Core Features
- **Game Engine**: Complete puzzle gameplay with 2-3 image challenges
- **Smart Matching**: AI-powered answer validation using Google Gemini
- **Scoring System**: Dynamic point system (30-12 points based on attempts)
- **Hint System**: Optional image descriptions with point costs
- **User Profiles**: Personal stats, streaks, and achievement tracking

#### 🏆 Achievement System
- 10+ different bonuses and achievements
- Streak tracking with reset mechanics
- Experience-based leveling system (linear growth: 50 × level)
- Creator rewards for challenge submissions

#### 🎨 User Experience
- **Responsive Design**: Works on desktop and mobile
- **Accessibility**: Full keyboard navigation and screen reader support
- **Theme Support**: 13 different challenge categories
- **Real-time Feedback**: Instant validation and scoring

#### 🔧 Technical Foundation
- **Frontend**: React 19 with TypeScript and Tailwind CSS
- **Backend**: Devvit platform with Redis caching
- **Database**: PostgreSQL via Supabase for persistence
- **Testing**: Comprehensive test suite with 90%+ coverage
- **Privacy**: GDPR-compliant with automatic data anonymization

#### 🛡️ Security & Compliance
- Rate limiting (1 challenge per 24 hours)
- Input validation and sanitization
- Privacy policy and terms of service
- Compliance audit documentation
- Secure API key management

#### 📊 Content Management
- **Leaderboards**: Global rankings with top 10 display
- **Moderation**: Built-in content guidelines
- **Data Retention**: 30-day auto-cleanup for inactive users
- **Performance**: Optimized caching and lazy loading

---

*Future versions will include enhanced moderation tools, additional themes, and community-requested features.*

## 📄 Legal

- [Terms of Service](https://github.com/V-25K/Guess/blob/main/TERMS_OF_SERVICE.md)
- [Privacy Policy](https://github.com/V-25K/Guess/blob/main/PRIVACY_POLICY.md)
- [Compliance Audit](https://github.com/V-25K/Guess/blob/main/docs/COMPLIANCE_AUDIT.md)

## 🏗️ Architecture & Development

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

See [architecture diagrams](https://github.com/V-25K/Guess/tree/main/docs/diagrams) for detailed system design.

### Performance & Scalability

- **Caching Strategy**: Redis-based caching with 5-minute refresh cycles
- **Database Optimization**: Indexed queries and connection pooling
- **Asset Optimization**: Vite-based bundling with code splitting
- **Memory Management**: Automatic cleanup of inactive user data
- **Rate Limiting**: Built-in protection against spam and abuse

### Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |
| Mobile Safari | 14+ | Responsive design |
| Chrome Mobile | 90+ | Touch optimized |

## 📜 License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](https://github.com/V-25K/Guess/blob/main/LICENSE) file for details.

### Third-Party Licenses

- React: MIT License
- Tailwind CSS: MIT License
- Devvit Platform: Reddit Developer Terms
- Supabase: Apache 2.0 License

---
**Made with ❤️ for Reddit communities**