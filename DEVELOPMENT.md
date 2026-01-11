# Development Guide

This document provides essential information for developers working on Area Tecnica (Sector Pro).

## Quick Start

```bash
# Install dependencies (ALWAYS use --legacy-peer-deps)
npm install --legacy-peer-deps

# Start development server (runs on localhost:8080)
npm run dev

# Build for production
npm run build
```

For complete command reference, see [CLAUDE.md](./CLAUDE.md).

## Critical: Lock File Strategy

### ⚠️ Why package-lock.json is Excluded

This project **intentionally excludes** `package-lock.json` from version control, which is **non-standard** for applications. Here's why:

#### 1. Peer Dependency Conflicts
The project requires `--legacy-peer-deps` due to known peer dependency conflicts:
- **vite 6.x** with **vitest 2.x** (vitest expects vite <6)
- **date-fns 3.x** with **react-day-picker** dependencies
- Various @radix-ui packages with React 18

When package-lock.json is committed, it can cause `npm ci` to fail on Cloudflare Pages deployment because:
- `npm ci` strictly enforces lockfile integrity
- `npm ci` does not support the `--legacy-peer-deps` flag in all environments
- Cloudflare Pages may use different npm versions that interpret the lockfile differently

#### 2. Cloudflare Pages Compatibility
Cloudflare Pages build environment requirements:
- Build command: `npm install --legacy-peer-deps && npm run build`
- Without package-lock.json, npm defaults to `npm install` which respects `--legacy-peer-deps`
- With package-lock.json present, build systems may attempt `npm ci`, which fails

### ⚠️ Trade-offs and Risks

**Disadvantages of excluding package-lock.json:**
- ❌ Non-deterministic builds (different developers may get slightly different sub-dependency versions)
- ❌ Harder to reproduce bugs caused by specific dependency versions
- ❌ No guarantee of identical production vs development environments
- ❌ More difficult to audit exact dependency tree for security vulnerabilities

**Mitigations:**
- ✅ All developers must use compatible Node.js and npm versions
- ✅ Document exact dependency versions in package.json (use `^` sparingly)
- ✅ Regular dependency audits with `npm audit`
- ✅ Extensive testing before deployments
- ✅ Cloudflare Pages uses consistent build environment

### 📋 Required Tooling Versions

To maintain consistency across development environments:

```bash
# Node.js (use one of these)
node --version  # Should be v18.x, v20.x, or v22.x

# npm (minimum version 7.0+, recommended 9.x+)
npm --version
```

**Recommendation**: Use [nvm](https://github.com/nvm-sh/nvm) or [volta](https://volta.sh/) to manage Node.js versions.

### 🔄 Dependency Management Workflow

#### Adding New Dependencies

```bash
# Install and save to package.json
npm install --legacy-peer-deps <package-name>

# Always commit package.json changes
git add package.json
git commit -m "chore: add <package-name> dependency"
```

#### Updating Dependencies

```bash
# Update specific package
npm update --legacy-peer-deps <package-name>

# Check for outdated packages
npm outdated

# Audit for security vulnerabilities
npm audit

# Fix auto-fixable vulnerabilities
npm audit fix --legacy-peer-deps
```

**⚠️ Warning:** Major version updates should be tested thoroughly, especially:
- `vite` (build system changes)
- `date-fns` (react-day-picker compatibility)
- `vitest` (requires vite compatibility)
- `@tanstack/react-query` (API changes)

#### Resetting Corrupted Dependencies

If you encounter strange npm errors:

```bash
# Remove node_modules and reinstall
sudo rm -rf node_modules
npm install --legacy-peer-deps
```

### 🤝 Team Coordination

**All team members must:**
1. Use compatible Node.js/npm versions (see above)
2. **Always** use `--legacy-peer-deps` flag when installing packages
3. Review `package.json` changes carefully in PRs
4. Test builds locally before pushing
5. Document any new peer dependency conflicts

### 🔮 Future Improvements

Long-term goals to move toward standard practices:

- [ ] Resolve vitest/vite peer dependency conflicts (when vitest supports vite 6+)
- [ ] Evaluate pnpm or yarn as alternative package managers
- [ ] Consider workspace/monorepo structure if project grows
- [ ] Migrate to package-lock.json once peer dependencies are resolved
- [ ] Set up Renovate or Dependabot for automated, tested dependency updates

### 📚 Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Complete project overview and development guide
- [SECURITY.md](./SECURITY.md) - Security status and vulnerability tracking
- [Cloudflare Pages Deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite-project/)

## Environment Variables

Production secrets are managed via Cloudflare Pages environment variables. **Never commit:**
- `.env` files
- API keys, tokens, or credentials
- Private keys or certificates

See [SECURITY.md](./SECURITY.md) for security best practices.

## Questions or Issues?

- Check [CLAUDE.md](./CLAUDE.md) for architecture and patterns
- Review existing code for examples
- Ask in team chat before making major dependency changes
