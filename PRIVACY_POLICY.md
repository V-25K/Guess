# Privacy Policy

**Linkaroo**
**Last Updated:** January 1, 2026
**Effective Date:** January 1, 2026

---

## 1. Introduction

This Privacy Policy explains how **Linkaroo** ("the Game," "we," "us") collects, uses, stores, and protects information when you interact with the game on Reddit using Reddit's Developer Platform (Devvit).

This policy supplements Reddit's own Privacy Policy and applies **only** to Linkaroo. Reddit's policies continue to govern your broader Reddit account and activity.

---

## 2. Information We Collect

### 2.1 Information Provided by Reddit

When you play Linkaroo, Reddit automatically provides limited account context required for gameplay:

| Data                      | Purpose                                 |
| ------------------------- | --------------------------------------- |
| Reddit User ID            | Unique identification for game progress |
| Reddit Username           | Display on leaderboards and challenges  |
| Avatar URL (if available) | Profile display                         |
| Subreddit Context         | Determine game instance                 |

We do not receive your email address, IP address, or private Reddit account details.

---

### 2.2 Gameplay Data

We generate and store game-related data based on your actions:

| Data                         | Purpose                     |
| ---------------------------- | --------------------------- |
| Points, XP, Levels           | Progress tracking           |
| Streaks (current and best)   | Gameplay mechanics          |
| Challenges Created/Attempted/Solved | Statistics and attribution |
| Challenge Attempts & Guesses | Scoring and feedback        |
| Hints Used                   | Score calculation           |
| Role (player/mod)            | Access control              |
| Timestamps                   | Rate limiting and analytics |

---

### 2.3 Challenge Content

If you create challenges, we store:

* Titles and themes
* Image URLs and descriptions
* Correct answers and explanations
* AI-generated acceptable answer variations

This data exists only to operate the game.

---

## 3. How We Use Information

We use collected data strictly to:

* Operate and display the game
* Validate guesses and calculate scores
* Generate leaderboards
* Prevent abuse and cheating
* Improve gameplay quality and stability

We do **not** use data for advertising or profiling.

---

## 4. AI and Automated Processing

Linkaroo uses **Google Gemini 2.5 Flash** for generating answer variations during challenge creation.

**When AI is used:**

* Only during challenge creation (once per challenge)
* To generate acceptable answer variations (synonyms, alternate phrasings, common misspellings)
* To generate "close" answers (related concepts that earn partial feedback)

**Data sent to AI services (creator-provided content only):**

* Challenge correct answers
* Image descriptions
* Answer explanations

**Data NOT sent to AI:**

* Player guesses (validated locally against pre-generated answer sets)
* Player usernames, user IDs, or any personal information
* Gameplay activity or statistics
* Avatar URLs

Player guesses are validated entirely locally using pre-generated answer sets. No AI API calls occur during gameplay. This processing is not used to train AI models.

---

## 5. Data Sharing

### 5.1 Third Parties

| Service       | Purpose                                      | Data Shared |
| ------------- | -------------------------------------------- | ----------- |
| Google Gemini | Answer variation generation (creation only)  | Challenge answers, image descriptions, explanations |
| Supabase      | Persistent database storage                  | User profiles, challenges, attempts, guesses |

We do **not** sell or rent your data.

---

## 6. Data Storage and Security

* Temporary data is cached within Reddit's infrastructure (Redis)
* Persistent data is stored in Supabase PostgreSQL databases
* All communication uses encrypted HTTPS
* Input validation and rate limits are enforced
* Redis data has automatic TTL expiration (max 30 days)
* Database access uses Row Level Security (RLS) policies

---

## 7. Data Retention

### 7.1 Automatic Data Anonymization

User profile data is automatically anonymized after **30 days of inactivity**. Inactivity is measured from the last time your profile was updated (e.g., playing a challenge, earning points, or creating content).

When anonymization occurs:
* Your Reddit User ID is replaced with a non-identifiable marker (`[deleted]`)
* Your username is replaced with `[deleted]`
* Your profile can no longer be linked to your Reddit account

### 7.2 Cache Expiration

Temporary cached data stored in Redis expires automatically with a **maximum retention of 30 days**. Most cached data expires much sooner (within minutes to hours) depending on the data type.

### 7.3 Challenge Data Persistence

Challenge content (titles, images, answers, explanations) persists until the associated Reddit post is deleted. When a Reddit post containing a challenge is deleted:
* The challenge and all associated data are permanently removed
* Creator attribution is removed

### 7.4 Statistics After Anonymization

After anonymization, your gameplay statistics (points, levels, achievements) are retained for leaderboard integrity but are **no longer linked to your identity**. These statistics appear under the `[deleted]` marker and cannot be traced back to your Reddit account.

### 7.5 Requesting Immediate Deletion

You may request immediate deletion of your data at any time by contacting the moderators of the subreddit hosting Linkaroo. Upon request:
* Your profile data will be anonymized immediately
* Challenges you created will have creator attribution removed
* The deletion is permanent and cannot be undone

Deletion requests are typically processed within 7 days.

---

## 8. Your Rights

You may:

* View your data in-game
* Request data export
* Request deletion of your data (see Section 7.5)

For deletion requests, contact the subreddit moderators. Your data will be anonymized as described in Section 7.

---

## 9. Children's Privacy

Linkaroo is not intended for users under 13. We do not knowingly collect data from children.

---

## 10. International Use

Your data may be processed in countries outside your residence. By playing, you consent to this transfer.

---

## 11. Policy Updates

We may update this policy. Changes take effect when posted.

---

## 12. Contact

For privacy concerns:

* Contact the moderators of the subreddit hosting Linkaroo
* Open an issue in the project repository

---
