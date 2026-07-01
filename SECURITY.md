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

### Quill HTML export - Cross-site Scripting (LOW)
- **Status**: ⚠️ ACCEPTED RISK
- **CVE**: GHSA-v3m3-f69x-jf25
- **Severity**: Low
- **Affected**: quill@2.0.3
- **Mitigation**:
  - ReactQuill and its nested quill@1.3.7 copy have been removed.
  - Corporate email sanitizes editor HTML with DOMPurify before sending.
  - Do not render Quill HTML output outside a DOMPurify-sanitized flow.
- **Why not fixed**: No patched Quill 2.x release is available. `npm audit fix` suggests downgrading to quill@2.0.2, which should be treated as a planned dependency change with editor regression testing.

### ExcelJS/uuid - Buffer Bounds Check (MODERATE)
- **Status**: ⚠️ ACCEPTED RISK
- **CVE**: GHSA-w5hq-g745-h8pq
- **Severity**: Moderate
- **Affected**: exceljs@4.4.0 -> uuid@8.3.2
- **Mitigation**:
  - ExcelJS is used for generated spreadsheet exports.
  - The application does not pass caller-controlled buffers to uuid v3/v5/v6 through ExcelJS.
- **Why not fixed**: `npm audit fix` requires downgrading ExcelJS to 3.4.0, which would undo the SheetJS replacement and requires a dedicated export regression pass. Revisit when ExcelJS publishes a compatible uuid update.

### Capacitor assets toolchain - tar/minimatch/uuid (HIGH)
- **Status**: ⚠️ ACCEPTED RISK (BUILD TOOLING)
- **CVE**: GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w, GHSA-vmf3-w455-68vh, GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74, GHSA-w5hq-g745-h8pq
- **Severity**: High
- **Affected**: @capacitor/assets@3.0.5 -> @capacitor/cli/tar and @trapezedev/project/replace/minimatch/xcode/uuid
- **Mitigation**:
  - Build-time only; these packages are not part of the production browser bundle.
  - Capacitor asset generation runs on controlled repository assets, not on untrusted archives or glob patterns.
- **Why not fixed**: `npm audit` reports no compatible fix for @capacitor/assets. Revisit when @capacitor/assets or @trapezedev/project publishes a patched dependency chain.

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
- [ ] Track a patched Quill 2.x release or schedule a tested downgrade from quill@2.0.3 to quill@2.0.2
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
