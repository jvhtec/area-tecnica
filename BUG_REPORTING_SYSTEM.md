# Bug Reporting System

## Overview

The bug reporting system allows users to report errors and issues directly from the application, with automatic collection of environment information.

## Components

### Database Schema

**Table: `system_errors`**
- `id`: UUID primary key
- `created_at`: Timestamp
- `user_id`: UUID (references auth.users, nullable for anonymous reports)
- `system`: Text (required) - The system/component where the error occurred
- `error_type`: Text (required) - Type of error (bug, exception, etc.)
- `error_message`: Text (optional) - Detailed error message
- `context`: JSONB - Additional context including:
  - `severity`: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  - `appVersion`: Application version/timestamp
  - `browser`: Browser information
  - `os`: Operating system
  - `screenWidth`: Screen width in pixels
  - `url`: URL where error occurred
  - `userAgent`: Full user agent string
  - `stack`: Stack trace (for exceptions)
  - Any additional custom context

### Migration

Location: `supabase/migrations/20251215000000_create_system_errors_table.sql`

Features:
- Row-level security (RLS) enabled
- Users can insert and read their own reports
- Admins can read all reports
- Anonymous error reporting allowed (for unhandled errors)
- Indexed on common query fields (created_at, user_id, system, error_type)

### Error Reporting Service

Location: `src/services/errorReporting.ts`

Functions:
- `reportError(report: ErrorReport)`: Low-level function to report any error
- `reportBug(description, severity, context)`: Report a user-submitted bug
- `reportException(error, context)`: Report an unhandled exception

All functions automatically enrich context with:
- Current app version (timestamp)
- Browser information
- Operating system
- Screen dimensions
- Current URL
- User agent string

### UI Components

#### BugReportDialog
Location: `src/components/BugReportDialog.tsx`

A dialog component that provides a user-friendly form for reporting bugs:
- Severity selection (LOW, MEDIUM, HIGH, CRITICAL)
- Description text area
- Automatic environment info display
- Can be triggered via a button or programmatically

Usage:
```tsx
import { BugReportDialog } from '@/components/BugReportDialog';

// Default button trigger
<BugReportDialog />

// Custom trigger
<BugReportDialog 
  trigger={<Button>Report Issue</Button>}
/>

// Programmatically controlled
<BugReportDialog 
  defaultOpen={true}
  onOpenChange={(open) => console.log('Dialog open state:', open)}
/>
```

#### SystemErrors Page
Location: `src/pages/SystemErrors.tsx`

Admin-only page to view all reported errors:
- Lists last 100 error reports
- Expandable rows showing full context
- Filterable by severity
- Real-time refresh capability

Access: `/management/system-errors` (Admin role only)

### Integration Points

#### ErrorBoundary
The global ErrorBoundary (`src/components/ErrorBoundary.tsx`) automatically reports all unhandled React errors to the database using `reportException()`.

#### Settings Page
Added a "Reportar error" card in Settings (`src/pages/Settings.tsx`) where users can manually submit bug reports.

## Usage Examples

### Manual Bug Report
```typescript
import { reportBug } from '@/services/errorReporting';

await reportBug(
  'The submit button does not work on the form',
  'MEDIUM',
  { formId: 'contact-form', action: 'submit' }
);
```

### Report Exception
```typescript
import { reportException } from '@/services/errorReporting';

try {
  // ... some code
} catch (error) {
  await reportException(error as Error, {
    component: 'DataFetcher',
    userId: currentUserId
  });
}
```

### Custom Error Report
```typescript
import { reportError } from '@/services/errorReporting';

await reportError({
  system: 'payment_gateway',
  errorType: 'timeout',
  errorMessage: 'Payment gateway request timed out after 30s',
  context: {
    severity: 'HIGH',
    gatewayId: 'stripe-123',
    amount: 100.00,
    currency: 'EUR'
  }
});
```

## Security

- Row-level security (RLS) ensures users can only view their own reports (except admins)
- Anonymous reporting is allowed to capture errors before authentication
- All database operations are server-side validated by Supabase

## Testing

Unit tests are available at `src/test/errorReporting.test.ts`

Run tests with:
```bash
npm test
```

## Future Enhancements

- Email notifications to admins for CRITICAL errors
- Error grouping and deduplication
- Charts and analytics on error trends
- Export functionality for error reports
- Automatic screenshot capture on error
- Integration with external error tracking services (Sentry, etc.)
