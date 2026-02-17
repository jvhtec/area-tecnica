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

## Known Vulnerabilities (Cannot Fix)

### react-quill/quill - Cross-site Scripting (MODERATE)
- **Status**: ⚠️ ACCEPTED RISK
- **CVE**: GHSA-4943-9vgg-gr5r
- **Severity**: Moderate (CVSS 4.2)
- **Affected**: react-quill@2.0.0 bundles quill@1.3.7
- **Mitigation**:
  - Application directly uses quill@2.0.3 (not vulnerable)
  - react-quill has not been updated since Aug 2022
  - XSS requires authenticated user with low privileges (AC:H - High Attack Complexity)
  - Consider replacing react-quill with alternative editor in future
- **Why not fixed**: No updated version of react-quill available that uses quill 2.x

### esbuild - Development Server Request Vulnerability (MODERATE)
- **Status**: ⚠️ ACCEPTED RISK (DEV ONLY)
- **CVE**: GHSA-67mh-4wv8-2f99
- **Severity**: Moderate (CVSS 5.3)
- **Affected**: esbuild@0.24.2 (via vitest@2.1.9)
- **Mitigation**:
  - Only affects development environment
  - Not present in production builds
  - Requires high attack complexity (AC:H)
  - Upgrading vitest to 4.x would require major changes and testing
- **Why not fixed**: Would require vitest major version upgrade (2.x → 4.x) which needs extensive testing

## Security Best Practices

### 1. Secrets Management
- **Environment Variables**: All sensitive credentials excluded via `.gitignore`
- **VAPID Keys**: Private keys removed from documentation, stored only in deployment secrets
- **Never Hardcode**: All API keys, tokens, and credentials must use environment variables
- **Secrets Rotation**: Rotate credentials immediately after exposure or on regular schedule (quarterly)

### 2. Dependency Security
- **Regular Audits**: Run `npm audit` before each release and weekly in development
- **Automated Updates**: Consider Dependabot or Renovate for automated dependency PRs
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
- [ ] Implement automated security scanning in CI/CD (npm audit, Snyk, or OWASP)
- [ ] Set up Dependabot or Renovate for automated dependency PRs
- [ ] Consider replacing react-quill with maintained alternative (TipTap, Lexical, Slate)
- [ ] Document security testing procedures in test suite

### Long-term (Next Quarter)
- [ ] Plan vitest upgrade to 4.x in dedicated testing sprint (fixes esbuild vulnerability)
- [ ] Security audit of authentication and authorization flows
- [ ] Implement automated vulnerability scanning in deployment pipeline
- [ ] Regular dependency updates (establish monthly cadence)
- [ ] Consider penetration testing by external security firm
- [ ] Evaluate and implement Content Security Policy (CSP) headers

## Security Contacts

- **Security Issues**: Report to development team lead
- **Data Privacy**: Compliance with GDPR for EU users
- **Vulnerability Disclosure**: Responsible disclosure accepted via private channels
