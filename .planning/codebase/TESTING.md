# Testing Patterns

**Analysis Date:** 2026-04-04

## Test Framework

**Runner:**
- Jest 30.x
- Config: `jest.config.js` (project root)
- Preset: `ts-jest` — TypeScript files compiled by ts-jest, not Babel

**Assertion Library:**
- Jest built-in (`expect`)
- `@testing-library/react-native` 12.x for component rendering/interaction

**Transform:**
- `ts-jest` handles `.ts` and `.tsx` files via `^.+\\.(ts|tsx)$` transform rule

**Run Commands:**
```bash
# No test scripts defined in package.json scripts — run directly:
npx jest                          # Run all tests
npx jest --watch                  # Watch mode
npx jest --coverage               # Coverage report
npx jest src/utils/streakUtils    # Run specific file/pattern
```

Note: The `package.json` `scripts` block does not include a `test` script yet. Add one when writing the first tests:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

## Test File Organization

**Location:** No test files exist yet. Based on jest config and project structure, tests should be co-located with source files or in a `__tests__` directory alongside the module being tested.

**Recommended naming (per jest.config.js `testPathPattern`):**
- `*.test.ts` or `*.test.tsx`
- `*.spec.ts` or `*.spec.tsx`

**Recommended structure:**
```
src/
├── utils/
│   ├── streakUtils.ts
│   └── streakUtils.test.ts        # Co-located unit test
├── services/firebase/
│   ├── authService.ts
│   └── authService.test.ts
└── hooks/
    ├── useAuth.ts
    └── useAuth.test.ts
```

## Test Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterFramework: ['@testing-library/react-native/extend-expect'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testPathPattern: '.*\\.(test|spec)\\.(ts|tsx|js)$',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

**Note:** `setupFilesAfterFramework` is a typo — the correct key is `setupFilesAfterFramework` should be `setupFilesAfterFramework`. The correct Jest config key is `setupFilesAfterFramework` — verify this resolves; the correct Jest option is `setupFilesAfterFramework`. The actual Jest option name is `setupFilesAfterFramework`. **Correct key is `setupFilesAfterEnv`** — this is a bug in the current config (see CONCERNS.md).

**Path alias resolution:** `@/` maps to `<rootDir>/src/` in tests, matching the TypeScript `paths` config.

## Test Environment

**`testEnvironment: 'node'`** — tests run in a Node.js environment, not jsdom.

For React Native component tests using `@testing-library/react-native`, the `node` environment is appropriate since React Native Testing Library does not require a browser DOM.

## What to Test

**Priority order based on architecture:**

1. **Utils** (`src/utils/`) — pure functions, highest value tests
   - `streakUtils.ts` — grace/freeze/finalization business logic (most critical)
   - `dateUtils.ts` — timezone-aware date helpers
   - `inviteLink.ts` — generate and parse invite codes
   - `permissions.ts` — permission helper logic

2. **Services** (`src/services/firebase/`) — Firebase interaction logic
   - Mock Firebase SDK; test service function logic, not Firebase internals
   - `authService.ts`, `groupService.ts`, `submissionService.ts`, `streakService.ts`

3. **Hooks** (`src/hooks/`) — state management logic
   - Use `@testing-library/react-native`'s `renderHook`
   - Mock context providers as needed

4. **Components** (`src/components/`) — UI rendering and interaction
   - Use `@testing-library/react-native`'s `render`
   - Focus on common components: `Button.tsx`, `Input.tsx`, `ErrorBanner.tsx`

## Mocking

**Framework:** Jest built-in mocking (`jest.mock`, `jest.fn`, `jest.spyOn`)

**Mocking Firebase (pattern to follow):**
```typescript
// At top of test file
jest.mock('@/services/firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(),
}));
```

**Mocking React Navigation:**
```typescript
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
```

**Mocking AsyncStorage:**
```typescript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

**What to mock:**
- Firebase SDK (`firebase/auth`, `firebase/firestore`, `firebase/storage`)
- `@/services/firebase/config` (the initialized instances)
- `@react-native-async-storage/async-storage`
- `@react-native-community/netinfo`
- `expo-notifications`, `expo-camera`, `expo-image-picker`
- React Navigation hooks when testing screens

**What NOT to mock:**
- Pure utility functions in `src/utils/` — test these directly
- `src/types/` — no logic, never needs mocking

## Test Structure Pattern

```typescript
import { functionUnderTest } from '@/utils/streakUtils';

describe('functionUnderTest', () => {
  describe('when condition A', () => {
    it('should return expected result', () => {
      // Arrange
      const input = { ... };
      // Act
      const result = functionUnderTest(input);
      // Assert
      expect(result).toBe(expectedValue);
    });
  });

  describe('when condition B', () => {
    it('should handle edge case', () => {
      expect(functionUnderTest(edgeCaseInput)).toEqual(expectedEdgeResult);
    });
  });
});
```

## Fixtures and Factories

**No test fixtures exist yet.** When creating test data:

```typescript
// Pattern: factory functions returning typed objects
import { UserProfile } from '@/types/user';

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'test-uid',
    displayName: 'Test User',
    email: 'test@example.com',
    timezone: 'America/New_York',
    timezoneAutoDetected: true,
    fcmToken: null,
    notificationIntensity: 'gentle',
    createdAt: null as any,
    updatedAt: null as any,
    ...overrides,
  };
}
```

**Location:** Place shared factories in `src/__tests__/factories/` when multiple test files need them.

## Coverage

**Requirements:** No coverage thresholds configured.

**View Coverage:**
```bash
npx jest --coverage
```

**Priority coverage targets (when enforced):**
- `src/utils/streakUtils.ts` — 100% (core business logic)
- `src/utils/dateUtils.ts` — 100% (timezone correctness is critical)
- `src/services/firebase/` — 80%+ (Firebase interaction logic)

## Test Types

**Unit Tests:**
- Scope: Single functions or small modules in isolation
- Location: Co-located `*.test.ts` files
- Primary targets: `src/utils/`, `src/services/firebase/`

**Integration Tests:**
- Scope: Hook + context interaction, component + hook wiring
- Use `renderHook` with real context providers where feasible
- Not yet established in the project

**E2E Tests:**
- Not configured — no Detox, Maestro, or similar tool present

## Async Testing

```typescript
it('should upload media and update submission', async () => {
  // Arrange
  const mockUploadMedia = jest.fn().mockResolvedValue({ mediaUrl: 'https://...' });

  // Act
  await uploadMedia('submission-id', 'file://local.mp4', 'video');

  // Assert
  expect(mockUploadMedia).toHaveBeenCalledWith('submission-id', 'file://local.mp4', 'video');
});
```

## Error Testing

```typescript
it('should throw when Firebase write fails', async () => {
  const mockSetDoc = jest.fn().mockRejectedValue(new Error('Firestore unavailable'));

  await expect(createGroup({ name: 'Test', mode: 'competitive' }))
    .rejects.toThrow('Firestore unavailable');
});
```

## Known Issues in Test Setup

- `jest.config.js` uses `setupFilesAfterFramework` (invalid key) — should be `setupFilesAfterEnv`. The `@testing-library/react-native/extend-expect` setup is not loading. Fix before writing component tests.
- No `test` script in `package.json` — add before CI integration.

---

*Testing analysis: 2026-04-04*
