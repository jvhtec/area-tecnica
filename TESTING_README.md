# Testing Guide for PR Changes

This document provides a guide to the comprehensive test suite generated for the pull request changes.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test src/components/festival/mobile/__tests__/MobileArtistCard.helpers.test.ts
```

## Test Files Created

### 1. Mobile Festival Components

#### MobileArtistCard Helper Functions
**File**: `src/components/festival/mobile/__tests__/MobileArtistCard.helpers.test.ts`

Tests all pure helper functions used in MobileArtistCard component:
- Console configuration summary formatting
- Wireless/IEM system summary generation
- Microphone kit summarization
- Monitor and extras summary
- Infrastructure requirements formatting
- Time formatting utilities

**Run**: `npm test MobileArtistCard.helpers.test.ts`

#### MobileArtistConfigEditor Helper Functions
**File**: `src/components/festival/mobile/__tests__/MobileArtistConfigEditor.helpers.test.ts`

Tests formatting and transformation helpers:
- Provider label formatting (Festival/Artista/Mixto)
- Wired microphone formatting with exclusive use flags
- System formatting (RF/IEM)
- Infrastructure formatting
- Category labels validation
- Form data initialization

**Run**: `npm test MobileArtistConfigEditor.helpers.test.ts`

### 2. Technician Components

#### TechJobCard Component
**File**: `src/components/technician/__tests__/TechJobCard.test.tsx`

Comprehensive component tests covering:
- Rendering of job information
- Conditional button display based on job type
- User interaction callbacks
- Role-based feature visibility
- Edge case handling (missing data)
- Time formatting display

**Run**: `npm test TechJobCard.test.tsx`

### 3. Library Utilities

#### Optimized React Query
**File**: `src/lib/__tests__/optimized-react-query.test.ts`

Tests the optimized React Query configuration:
- Query client creation for leader/follower modes
- Query deduplication logic
- Query key factory functions
- Invalidation strategies
- Retry logic and exponential backoff
- Multi-tab coordination

**Run**: `npm test optimized-react-query.test.ts`

### 4. Utility Functions

#### RF/IEM Table PDF Export (Enhanced)
**File**: `src/utils/__tests__/rfIemTablePdfExport.test.ts`

Extended test coverage for PDF export utilities:
- Data normalization and transformation
- Festival day computation with rollover logic
- Artist grouping and sorting
- Provider-based formatting
- Band frequency formatting
- Mixed provider scenarios
- Edge cases and error handling

**Run**: `npm test rfIemTablePdfExport.test.ts`

## Test Coverage by File Type

### Pure Functions & Utilities (High Priority)
These have the most comprehensive test coverage:
- ✅ `MobileArtistCard` helpers - 29 tests
- ✅ `MobileArtistConfigEditor` helpers - 24 tests
- ✅ `optimized-react-query` - 25+ tests
- ✅ `rfIemTablePdfExport` - 33+ tests

### React Components (Component Tests)
- ✅ `TechJobCard` - 16 tests
- ⚠️ Complex modals - Business logic tested in utilities

### Orchestration Components (Lower Priority)
These components primarily coordinate other components:
- `TechnicianDashboard` - Focus on child components
- `TechnicianSuperApp` - Focus on child components
- `MobileArtistList` - State management wrapper

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Recommended for Development)
```bash
npm test -- --watch
```

### Coverage Report
```bash
npm test -- --coverage
```

This will generate a coverage report showing:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

### Specific Test Patterns
```bash
# Run all festival component tests
npm test festival

# Run all technician component tests
npm test technician

# Run all helper function tests
npm test helpers

# Run all utility tests
npm test utils
```

## Test Structure

All tests follow the project's established patterns:

### Unit Test Structure
```typescript
import { describe, expect, it } from 'vitest';

describe('Component/Function Name', () => {
  describe('specific function or behavior', () => {
    it('describes what is being tested', () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Component Test Structure
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock setup
vi.mock('@/hooks/...', () => ({
  useHook: () => ({ data: ..., isLoading: false }),
}));

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component correctly', () => {
    render(<Component {...props} />, { wrapper: createWrapper() });
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(<Component onAction={onAction} />, { wrapper: createWrapper() });
    await user.click(screen.getByText('Click Me'));

    expect(onAction).toHaveBeenCalledWith(expectedArgs);
  });
});
```

## Mocking Strategy

### Supabase Client
All tests mock the Supabase client to avoid real database calls:
```typescript
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));
```

### React Query
Tests use a test-specific QueryClient:
```typescript
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
```

### Toast Notifications
```typescript
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
```

## Best Practices Applied

1. **Arrange-Act-Assert Pattern**: Clear separation of test phases
2. **Descriptive Test Names**: Tests describe what they verify
3. **Edge Case Coverage**: Null/undefined, empty arrays, invalid inputs
4. **Mock Isolation**: Each test is independent with proper mock cleanup
5. **Type Safety**: Full TypeScript support in tests
6. **Accessibility**: Component tests check for proper rendering

## Debugging Tests

### Run Single Test
```bash
npm test -- --run <test-name>
```

### Debug with VSCode
Add this to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["--run", "${file}"],
  "console": "integratedTerminal"
}
```

### View Test Output
```bash
npm test -- --reporter=verbose
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test -- --run --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Maintenance

### Adding New Tests
1. Create test file in `__tests__` directory next to source
2. Follow naming convention: `FileName.test.ts` or `FileName.test.tsx`
3. Import from vitest: `describe`, `it`, `expect`, `vi`, `beforeEach`
4. Mock external dependencies
5. Write clear, descriptive test names

### Updating Tests
When changing functionality:
1. Update corresponding tests first (TDD)
2. Ensure tests fail with old implementation
3. Update implementation
4. Verify tests pass

## Troubleshooting

### "Cannot find module 'vitest'"
```bash
npm install
```

### "Module not found" errors in tests
Check that `vitest.config.ts` has correct path aliases:
```typescript
resolve: {
  alias: {
    "@": resolve(__dirname, "./src"),
  },
}
```

### Tests timeout
Increase timeout in test:
```typescript
it('long running test', async () => {
  // test code
}, { timeout: 10000 }); // 10 seconds
```

### Mock not working
Ensure mock is defined before imports:
```typescript
vi.mock('@/module', () => ({
  export: mockImplementation,
}));

import { Component } from '@/component'; // After mock
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Vitest Mocking](https://vitest.dev/guide/mocking.html)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Summary

The test suite provides comprehensive coverage for:
- ✅ **117+ unit tests** across 5 test files
- ✅ **All helper/utility functions** have thorough coverage
- ✅ **Critical components** have behavior tests
- ✅ **Edge cases** are well-covered
- ✅ **Regression prevention** through boundary testing

Focus areas:
1. Pure functions (formatters, calculators, transformers)
2. Business logic (query management, invalidation)
3. Component rendering and user interactions
4. Error handling and edge cases

This ensures code reliability while maintaining fast test execution.