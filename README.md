# Linkaroo

A bite-sized puzzle game built for Reddit, where players guess the common link between images and compete for points. Your intro should clearly say it's a Reddit game, quick to play, and works in the feed.

## Overview

Linkaroo is an asynchronous puzzle game built with Devvit Web. Each challenge is a Reddit post; you launch the app, view 2-3 images, guess what connects them, and level up over time.

- **Session length:** 30–60 seconds per challenge
- **Platforms:** Reddit mobile apps and web  
- **Progress:** Your character persists across challenges

## How to Play

1. Open any **Linkaroo** challenge post
2. Tap **Launch App**
3. View the images and guess what connects them
4. Get instant feedback and earn points
5. Return later to play new challenges and level up

## Features

- Puzzle challenges you can complete in under a minute
- Persistent character with XP, streaks, and achievements
- Designed for Reddit's feed (no inline scrolling)
- Works on web, iOS, and Android

## Fetch Domains

The following domains are requested for this app:

- `jqgithkiinvgcpskwado.supabase.co` – Used as a relational database to store player profiles, challenge data, and game progress. Devvit KV storage does not support the complex queries needed for leaderboards and progression.
- `generativelanguage.googleapis.com` – Used to generate acceptable answer variations during challenge creation (e.g., "dog", "puppy", "canine" for dog images) to make gameplay fair and accessible. This matches the required "Fetch Domains" section pattern.

## Data & Privacy

- We store a Reddit user's ID, username, game stats, and challenge history in Supabase
- We do **not** store post contents or private messages
- We send short, non-identifying prompts to Google Gemini (via `generativelanguage.googleapis.com`) to generate answer variations; we do not send Reddit usernames or raw Reddit content
- Full details are in our Terms of Service and Privacy Policy (linked in the app configuration)

## Tech Stack

- Devvit Web (client/server)
- React frontend
- Supabase (Postgres) for game state
- Google Gemini for answer variation generation

## Changelog

### v0.2.0 - Enhanced User Experience & Community Features

- **Next Button**: Added navigation to move between challenges seamlessly
- **Give Up Button**: Players can now surrender a challenge and see the answer
- **Community Status**: Dynamic join/leave community button that updates based on player's subscription status
- **Auto Image Formatting**: All images now automatically adjust to 1:1 aspect ratio for consistent display

### v0.1.0 - Initial launch with core puzzle gameplay, XP system, and achievements