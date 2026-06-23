## Summary
- [ ] I described what changed and why.
- Affected route/feature:

## Risk Assessment
- [ ] I assessed functional, data, and deployment risk.
- Risk level: <!-- low | medium | high -->
- Main risks:
- [ ] If this touches database, auth, CI/CD, dependency, security, or production-header paths, I requested CODEOWNER review.
- [ ] If risk level is high, I requested two independent approvals before merge.

## Impact Checklist
- [ ] Migration impact assessed.
- [ ] Realtime/subscription impact assessed.
- [ ] RLS/security impact assessed.
- [ ] Performance impact assessed.

## Test Evidence
- [ ] I ran relevant tests and confirmed expected results.
- Commands executed:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run governance`
  - `npm run test:critical`
  - `npm run test:run`
  - `npm run build`
  - `npm run budget:bundle`
  - `npm run test:e2e`
  - `npm run ci:db:migrations`
- Results:

## Rollback Plan
- [ ] I documented how to safely revert this change.
- [ ] I checked the production release checklist for rollback and post-deploy verification.
- Rollback steps:

## Migration Impact
- [ ] I confirmed whether this PR changes schema/functions.
- Migration required: <!-- yes | no -->
- If yes, describe migration, impact, and backout plan:
