# Test Utilities

This directory contains reusable test utilities for repository testing. These utilities help create consistent, maintainable tests by providing factory functions, mock objects, custom assertions, and setup/teardown helpers.

## Overview

The test utilities are organized into four main modules:

- **factories.ts** - Factory functions for creating test data
- **mocks.ts** - Mock objects and helpers for external dependencies
- **assertions.ts** - Custom assertion helpers for Result pattern
- **setup.ts** - Shared setup and teardown utilities

## Factory Functions

Factory functions create realistic test data using [@faker-js/faker](https://fakerjs.dev/). Each factory accepts optional overrides to customize specific fields.

### `createMockUser(overrides?)`

Creates a mock UserProfile object with realistic test data.

**Parameters:**
- `overrides` (optional): Partial<UserProfile> - Override specific fields

**Returns:** UserProfile

**Example:**
```typescript
import { createMockUser } from '../test-utils';

// Create a user with default values
const user = createMockUser();

// Create a user with specific values
const adminUser = createMockUser({
  username: 'admin',
  role: 'mod',
  total_points: 10000
});

// Create a new user with no activity
const newUser = createMockUser({
  challenges_solved: 0,
  challenges_created: 0,
  total_points: 0
});
```

### `createMockChallenge(overrides?)`

Creates a mock Challenge object with realistic test data.

**Parameters:**
- `overrides` (optional): Partial<Challenge> - Override specific fields

**Returns:** Challenge

**Example:**
```typescript
import { createMockChallenge } from '../test-utils';

// Create a challenge with default values
const challenge = createMockChallenge();

// Create a challenge with specific creator
const userChallenge = createMockChallenge({
  creator_id: 'user-123',
  creator_username: 'testuser'
});

// Create a popular challenge
const popularChallenge = createMockChallenge({
  players_played: 1000,
  players_completed: 750,
  max_score: 200
});
```

### `createMockAttempt(overrides?)`

Creates a mock ChallengeAttempt object with realistic test data.

**Parameters:**
- `overrides` (optional): Partial<ChallengeAttempt> - Override specific fields

**Returns:** ChallengeAttempt

**Example:**
```typescript
import { createMockAttempt } from '../test-utils';

// Create an attempt with default values
const attempt = createMockAttempt();

// Create a successful attempt
const successfulAttempt = createMockAttempt({
  is_solved: true,
  game_over: true,
  points_earned: 100,
  attempts_made: 2
});

// Create a failed attempt
const failedAttempt = createMockAttempt({
  is_solved: false,
  game_over: true,
  points_earned: 0,
  attempts_made: 10
});
```

### `createMockContext(overrides?)`

Creates a mock Devvit Context object for testing.

**Parameters:**
- `overrides` (optional): Partial<Context> - Override specific fields

**Returns:** Context

**Example:**
```typescript
import { createMockContext } from '../test-utils';

// Create a context with default values
const context = createMockContext();

// Create a context for a specific user
const userContext = createMockContext({
  userId: 't2_testuser123',
  subredditName: 'testsubreddit'
});
```

## Mock Objects

Mock objects simulate external dependencies like fetch responses and settings.

### `createMockFetchSuccess<T>(data, headers?)`

Creates a mock fetch response for successful database queries.

**Parameters:**
- `data`: T - The data to return in the response
- `headers` (optional): Record<string, string> - HTTP headers

**Returns:** Promise<Response>

**Example:**
```typescript
import { createMockFetchSuccess, createMockUser } from '../test-utils';

// Mock a successful user fetch
const mockUser = createMockUser();
mockFetch.mockReturnValueOnce(
  createMockFetchSuccess([mockUser])
);

// Mock with custom headers
mockFetch.mockReturnValueOnce(
  createMockFetchSuccess([mockUser], {
    'content-range': '0-9/100'
  })
);
```

### `createMockFetchError(status, statusText)`

Creates a mock fetch response for database errors.

**Parameters:**
- `status`: number - HTTP status code (e.g., 404, 500)
- `statusText`: string - HTTP status text (e.g., "Not Found")

**Returns:** Promise<Response>

**Example:**
```typescript
import { createMockFetchError } from '../test-utils';

// Mock a 404 error
mockFetch.mockReturnValueOnce(
  createMockFetchError(404, 'Not Found')
);

// Mock a 500 error
mockFetch.mockReturnValueOnce(
  createMockFetchError(500, 'Internal Server Error')
);
```

### `createMockSettings()`

Creates a mock settings object for Devvit configuration.

**Returns:** Object with `get` method

**Example:**
```typescript
import { createMockSettings } from '../test-utils';
import { vi } from 'vitest';

// Mock settings in beforeEach
beforeEach(() => {
  const mockSettings = createMockSettings();
  vi.mocked(settings.get).mockImplementation(mockSettings.get);
});

// The mock automatically returns:
// - 'https://test.supabase.co' for 'SUPABASE_URL'
// - 'test-anon-key' for 'SUPABASE_ANON_KEY'
// - null for other keys
```

## Custom Assertions

Custom assertions help verify Result pattern integration in tests.

### `expectOk<T, E>(result)`

Asserts that a Result is in the Ok state and returns the value.

**Parameters:**
- `result`: Result<T, E> - The Result to check

**Returns:** T - The value from the Ok Result

**Throws:** Error if the Result is Err

**Example:**
```typescript
import { expectOk } from '../test-utils';

const result = await repository.findById('user-123');
const user = expectOk(result); // Asserts Ok and returns the user
expect(user.id).toBe('user-123');
```

### `expectErr<T, E>(result)`

Asserts that a Result is in the Err state and returns the error.

**Parameters:**
- `result`: Result<T, E> - The Result to check

**Returns:** E - The error from the Err Result

**Throws:** Error if the Result is Ok

**Example:**
```typescript
import { expectErr } from '../test-utils';

const result = await repository.findById('invalid-id');
const error = expectErr(result); // Asserts Err and returns the error
expect(error.type).toBe('database');
```

### `expectOkValue<T, E>(result, expected)`

Asserts that a Result is Ok and the value matches the expected value.

**Parameters:**
- `result`: Result<T, E> - The Result to check
- `expected`: T - The expected value

**Example:**
```typescript
import { expectOkValue, createMockUser } from '../test-utils';

const mockUser = createMockUser({ id: 'user-123' });
const result = await repository.findById('user-123');
expectOkValue(result, mockUser); // Asserts Ok and value equals mockUser
```

### `expectDatabaseError<T>(result)`

Asserts that a Result is Err with a DatabaseError.

**Parameters:**
- `result`: Result<T, AppError> - The Result to check

**Returns:** DatabaseError - The database error

**Example:**
```typescript
import { expectDatabaseError } from '../test-utils';

mockFetch.mockReturnValueOnce(
  createMockFetchError(500, 'Internal Server Error')
);

const result = await repository.findById('user-123');
const error = expectDatabaseError(result); // Asserts Err with DatabaseError
expect(error.operation).toBe('findById');
expect(error.message).toContain('Internal Server Error');
```

## Setup and Teardown

Shared setup and teardown utilities reduce boilerplate in repository tests.

### `setupRepositoryTest()`

Sets up a repository test with mocked dependencies.

**Returns:** RepositoryTestContext
- `mockContext`: Context - Mock Devvit context
- `mockFetch`: MockedFunction - Mock fetch function
- `mockSettings`: Object - Mock settings object

**Example:**
```typescript
import { setupRepositoryTest, teardownRepositoryTest } from '../test-utils';
import { UserRepository } from '../user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;
  let testContext: ReturnType<typeof setupRepositoryTest>;

  beforeEach(() => {
    testContext = setupRepositoryTest();
    repository = new UserRepository(testContext.mockContext);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });

  it('should find user by id', async () => {
    const mockUser = createMockUser();
    testContext.mockFetch.mockReturnValueOnce(
      createMockFetchSuccess([mockUser])
    );

    const result = await repository.findById(mockUser.id);
    expectOkValue(result, mockUser);
  });
});
```

### `teardownRepositoryTest()`

Tears down a repository test by cleaning up mocks.

**Example:**
```typescript
afterEach(() => {
  teardownRepositoryTest(); // Clears and restores all mocks
});
```

## Complete Test Example

Here's a complete example showing how to use all the test utilities together:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupRepositoryTest,
  teardownRepositoryTest,
  createMockUser,
  createMockFetchSuccess,
  createMockFetchError,
  expectOk,
  expectOkValue,
  expectDatabaseError
} from '../test-utils';
import { UserRepository } from '../user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;
  let testContext: ReturnType<typeof setupRepositoryTest>;

  beforeEach(() => {
    // Setup mocks and create repository
    testContext = setupRepositoryTest();
    repository = new UserRepository(testContext.mockContext);
  });

  afterEach(() => {
    // Clean up mocks
    teardownRepositoryTest();
  });

  describe('findById', () => {
    it('should return Ok with user when exists', async () => {
      // Arrange: Create mock data and setup fetch response
      const mockUser = createMockUser({ id: 'user-123' });
      testContext.mockFetch.mockReturnValueOnce(
        createMockFetchSuccess([mockUser])
      );

      // Act: Call repository method
      const result = await repository.findById('user-123');

      // Assert: Verify Result is Ok with correct value
      expectOkValue(result, mockUser);
    });

    it('should return Ok with null when not found', async () => {
      // Arrange: Setup empty response
      testContext.mockFetch.mockReturnValueOnce(
        createMockFetchSuccess([])
      );

      // Act: Call repository method
      const result = await repository.findById('nonexistent');

      // Assert: Verify Result is Ok with null
      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('should return Err on database error', async () => {
      // Arrange: Setup error response
      testContext.mockFetch.mockReturnValueOnce(
        createMockFetchError(500, 'Internal Server Error')
      );

      // Act: Call repository method
      const result = await repository.findById('user-123');

      // Assert: Verify Result is Err with DatabaseError
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('findById');
      expect(error.message).toContain('Internal Server Error');
    });
  });

  describe('create', () => {
    it('should return Ok with created user', async () => {
      // Arrange: Create mock user and setup response
      const mockUser = createMockUser();
      testContext.mockFetch.mockReturnValueOnce(
        createMockFetchSuccess([mockUser])
      );

      // Act: Call repository method
      const result = await repository.create({
        user_id: mockUser.user_id,
        username: mockUser.username
      });

      // Assert: Verify Result is Ok with created user
      const user = expectOk(result);
      expect(user.id).toBe(mockUser.id);
      expect(user.username).toBe(mockUser.username);
    });
  });
});
```

## Best Practices

### 1. Use Factory Functions for Test Data

Always use factory functions instead of manually creating test objects:

```typescript
// ✅ Good: Use factory functions
const user = createMockUser({ username: 'testuser' });

// ❌ Bad: Manually create objects
const user = {
  id: '123',
  user_id: '456',
  username: 'testuser',
  // ... many more fields
};
```

### 2. Use Custom Assertions for Results

Use custom assertions to verify Result pattern integration:

```typescript
// ✅ Good: Use custom assertions
const user = expectOk(result);
expect(user.id).toBe('123');

// ❌ Bad: Manual Result checking
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.value.id).toBe('123');
}
```

### 3. Use Setup/Teardown Utilities

Use setup and teardown utilities to reduce boilerplate:

```typescript
// ✅ Good: Use utilities
beforeEach(() => {
  testContext = setupRepositoryTest();
  repository = new UserRepository(testContext.mockContext);
});

afterEach(() => {
  teardownRepositoryTest();
});

// ❌ Bad: Manual setup
beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
  mockContext = { /* ... */ };
  // ... more setup
});
```

### 4. Mock at the Right Level

Mock external dependencies (fetch, settings) but test real repository code:

```typescript
// ✅ Good: Mock fetch, test repository
testContext.mockFetch.mockReturnValueOnce(
  createMockFetchSuccess([mockUser])
);
const result = await repository.findById('123');

// ❌ Bad: Mock repository methods
vi.spyOn(repository, 'findById').mockResolvedValue(Ok(mockUser));
```

### 5. Clean Up After Tests

Always clean up mocks to prevent test pollution:

```typescript
// ✅ Good: Clean up in afterEach
afterEach(() => {
  teardownRepositoryTest();
});

// ❌ Bad: No cleanup
// Tests may interfere with each other
```

## Troubleshooting

### Mock Not Working

If mocks aren't working, ensure you're setting them up before creating the repository:

```typescript
beforeEach(() => {
  testContext = setupRepositoryTest(); // Setup mocks first
  repository = new UserRepository(testContext.mockContext); // Then create repository
});
```

### Type Errors with Mocks

If you get type errors with mocks, ensure you're using the correct types:

```typescript
// Use ReturnType to get the correct type
let testContext: ReturnType<typeof setupRepositoryTest>;
```

### Tests Interfering with Each Other

If tests interfere with each other, ensure you're cleaning up mocks:

```typescript
afterEach(() => {
  teardownRepositoryTest(); // This clears all mocks
});
```

## Related Documentation

- [Testing Guide](../../../docs/testing-guide.md) - Best practices for writing tests
- [Result Pattern](../../../docs/result-pattern.md) - Understanding the Result pattern
- [Repository Pattern](../../../docs/database/repository-pattern.md) - Understanding repositories
