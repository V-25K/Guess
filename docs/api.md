# API Documentation

This document provides an overview of the service layer API for the "Guess The Link" application.

## Service Layer

The application uses a service-oriented architecture with dependency injection. All services are initialized in `main.tsx` and passed to components.

### UserService

Handles user profiles and metadata.

| Method | Description |
| :--- | :--- |
| `getUser(userId: string): Promise<User | null>` | Retrieves a user by ID. |
| `createUser(user: User): Promise<void>` | Creates a new user record. |
| `updateUser(userId: string, data: Partial<User>): Promise<void>` | Updates user information. |
| `getUserProfile(userId: string, username?: string): Promise<UserProfile | null>` | Retrieves a full user profile including stats. |

### ChallengeService

Manages game challenges.

| Method | Description |
| :--- | :--- |
| `getChallenge(challengeId: string): Promise<GameChallenge | null>` | Retrieves a specific challenge. |
| `getAllChallenges(): Promise<GameChallenge[]>` | Retrieves all active challenges. |
| `createChallenge(data: CreateChallengeData): Promise<GameChallenge>` | Creates a new challenge. |
| `getChallengeByPostId(postId: string): Promise<GameChallenge | null>` | Finds a challenge associated with a Reddit post. |

### AttemptService

Tracks user attempts and guesses.

| Method | Description |
| :--- | :--- |
| `recordAttempt(userId: string, challengeId: string, guess: string): Promise<AttemptResult>` | Records a user's guess for a challenge. |
| `getUserAttempts(userId: string): Promise<UserAttempt[]>` | Retrieves all attempts made by a user. |
| `hasAttempted(userId: string, challengeId: string): Promise<boolean>` | Checks if a user has already attempted a challenge. |

### LeaderboardService

Manages game leaderboards.

| Method | Description |
| :--- | :--- |
| `getLeaderboard(limit?: number, offset?: number): Promise<PaginatedLeaderboardResult>` | Retrieves the global leaderboard. |
| `updateScore(userId: string, score: number): Promise<void>` | Updates a user's score on the leaderboard. |

### CommentService

Handles Reddit comment interactions.

| Method | Description |
| :--- | :--- |
| `trackComment(challengeId: string, commentId: string, authorId: string, creatorId: string): Promise<void>` | Tracks a comment on a challenge post. |
| `processGuess(commentId: string): Promise<void>` | Processes a comment as a potential guess (if applicable). |

## Error Handling

The application uses a standardized `AppError` class for error handling.

```typescript
interface AppError {
    code: AppErrorCode;
    message: string;
    details?: Record<string, any>;
}
```

Common error codes:
- `NOT_FOUND`: Resource not found.
- `PERMISSION_DENIED`: User does not have permission.
- `INVALID_INPUT`: Input validation failed.
- `RATE_LIMIT`: Rate limit exceeded.
- `INTERNAL_ERROR`: Unexpected server error.
