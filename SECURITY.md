# Security Status

## Fixed Vulnerabilities

### xlsx (SheetJS) - Prototype Pollution (HIGH)
- **Status**: ✅ FIXED
- **CVE**: CVE-2023-30533 (GHSA-4r6h-8v6p-xvw6)
- **Severity**: High (CVSS 7.8)
- **Fixed by**: Replaced xlsx@0.18.5 with exceljs@4.4.0
- **Date**: 2026-02-17
- **Details**: SheetJS stopped publishing fixes to npm; migrated all Excel export code to ExcelJS which is actively maintained. Also removed unused @supabase/auth-ui-react and @supabase/auth-ui-shared packages.

### jsPDF - Local File Inclusion/Path Traversal (CRITICAL)
- **Status**: ✅ FIXED
- **CVE**: GHSA-f8cm-6447-x5h2
- **Severity**: Critical
- **Fixed in**: jspdf@4.0.0 (upgraded from 3.0.0)
- **Date**: 2026-01-11
- **Also upgraded**: jspdf-autotable@5.0.7 (for compatibility with jspdf 4.x)

### Dependency audit backlog cleared
- **Status**: ✅ FIXED
- **Date**: 2026-08-28
- Removed the unused `@capacitor/assets` generator and its vulnerable `tar`, `minimatch`, `sharp`, and legacy Capacitor dependency chain.
- Pinned Quill to the non-advisory `2.0.2` release and retained DOMPurify sanitization around editor output.
- Overrode transitive `uuid` consumers to `^11.1.1`, covering ExcelJS and Capacitor CLI without downgrading ExcelJS.
- Removed the GitHub dependency-review allowlist and reset the governance audit baseline to zero vulnerabilities and zero exceptions.

## Security Best Practices

### 1. Secrets Management
- **Environment Variables**: All sensitive credentials excluded via `.gitignore`
- **VAPID Keys**: Private keys removed from documentation, stored only in deployment secrets
- **Never Hardcode**: All API keys, tokens, and credentials must use environment variables
- **Secrets Rotation**: Rotate credentials immediately after exposure or on regular schedule (quarterly)

### 2. Dependency Security
- **Regular Audits**: Run `npm audit` before each release and weekly in development
- **Automated Updates**: Dependabot opens dependency PRs and the governance audit gate rejects new advisories
- **Review Updates**: Always review changelogs for security-related updates
- **Lock Critical Versions**: Document and lock versions with known security issues until patches available

### 3. Access Control & Permissions
- **Least Privilege**: Ensure Supabase API keys have minimal required permissions
  - Anon key should only access public data and RLS-protected resources
  - Service role key (if used) should never be exposed to client
- **Row Level Security (RLS)**: All Supabase tables must have RLS policies enabled
- **Role-Based Access**: Use application roles (super_admin, admin, jefe, tech) consistently

### 4. Application Security
- **Input Validation**: Validate and sanitize all user inputs (use Zod schemas)
- **XSS Prevention**: Use DOMPurify for rendering user-generated HTML content
- **CSRF Protection**: Supabase auth handles CSRF via PKCE flow
- **Security Headers**: Verify proper CSP, HSTS, X-Frame-Options in production (Cloudflare Pages)

### 5. Development Security
- **Pre-commit Hooks**: Consider git-secrets or detect-secrets to prevent committing secrets
- **Code Review**: All security-related changes require peer review
- **Testing**: Include security test cases for authentication and authorization flows
- **Secure Development**: Never disable security features in production builds

### 6. Monitoring & Response
- **Activity Logging**: Monitor suspicious activity via Supabase auth logs
- **Error Tracking**: Use production error monitoring (avoid logging sensitive data)
- **Incident Response**: Document and follow incident response plan (see below)
- **Security Updates**: Subscribe to security advisories for all critical dependencies

## Incident Response Plan

### When a Security Issue is Discovered

1. **Assess Severity**
   - Critical: Exposed credentials, data breach, RCE vulnerability
   - High: Authentication bypass, privilege escalation
   - Medium: XSS, CSRF, information disclosure
   - Low: Outdated dependency with no known exploits

2. **Immediate Actions (Critical/High)**
   - Rotate all potentially compromised credentials immediately
   - Deploy patches or mitigations ASAP
   - Notify team leads and stakeholders
   - Document timeline and actions taken

3. **Follow-up Actions**
   - Conduct post-mortem to identify root cause
   - Update security practices to prevent recurrence
   - Document lessons learned
   - Consider security audit if breach occurred

4. **Communication**
   - Internal: Notify development team and management
   - External: If user data affected, follow GDPR/privacy law requirements
   - Transparency: Document incident in security log (sanitized)

## Future Actions

### High Priority (Next Sprint)
- [ ] **CRITICAL**: Rotate exposed Supabase anon key and VAPID keys from git history
  - Generate new Supabase anon key in project settings
  - Generate new VAPID key pair for push notifications
  - Update Cloudflare Pages environment variables
  - Update Supabase Edge Function secrets
  - Test push notifications and authentication after rotation
- [ ] Set up pre-commit hooks to prevent committing secrets (git-secrets, detect-secrets)
- [ ] Audit all Supabase RLS policies for proper access control

### Medium Priority (Next Month)
- [ ] Document security testing procedures in test suite

### Long-term (Next Quarter)
- [ ] Evaluate the Vitest 4 migration in a dedicated testing sprint
- [ ] Security audit of authentication and authorization flows
- [ ] Regular dependency updates (establish monthly cadence)
- [ ] Consider penetration testing by external security firm

## Security Contacts

- **Security Issues**: Report to development team lead
- **Data Privacy**: Compliance with GDPR for EU users
- **Vulnerability Disclosure**: Responsible disclosure accepted via private channels
