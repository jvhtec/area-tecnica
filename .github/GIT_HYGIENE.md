# Git Hygiene Best Practices

## Branch Management Workflow

### Creating Branches
```bash
# Use descriptive names with category prefix
git checkout -b feat/user-authentication
git checkout -b fix/login-bug
git checkout -b refactor/api-cleanup
git checkout -b docs/update-readme
```

**Branch naming convention:**
- `feat/` - New features
- `fix/` - Bug fixes  
- `refactor/` - Code refactoring
- `docs/` - Documentation
- `chore/` - Maintenance tasks
- `claude/` - AI-assisted work (auto-generated)

### After PR Merge

**Immediately delete merged branches:**
```bash
# On GitHub: Check "Automatically delete head branches" in Settings → General
# Or manually via GitHub UI after merge

# Delete local branch
git branch -d feat/user-authentication

# Delete remote branch
git push origin --delete feat/user-authentication
```

### Regular Cleanup

**Monthly cleanup (automated):**
```bash
# Run the cleanup script
./.github/cleanup-merged-branches.sh
```

**Manual check:**
```bash
# See merged branches
git branch -r --merged main | grep -v "HEAD" | grep -v "main" | grep -v "dev"

# Count them
git branch -r --merged main | grep -v "HEAD" | grep -v "main" | grep -v "dev" | wc -l
```

## Pull Request Workflow

### Before Creating PR
1. **Rebase on main** to keep history clean:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Squash WIP commits** (optional):
   ```bash
   git rebase -i HEAD~5  # Interactive rebase last 5 commits
   ```

3. **Push to remote:**
   ```bash
   git push origin feat/my-feature
   ```

### After PR Approval

1. **Merge via GitHub UI** (use squash or merge commit)
2. **Delete branch via GitHub UI** (or enable auto-delete)
3. **Pull latest main locally:**
   ```bash
   git checkout main
   git pull origin main
   ```

4. **Delete local branch:**
   ```bash
   git branch -d feat/my-feature
   ```

## Common Scenarios

### Stale Branches

**Find stale branches (older than 3 months):**
```bash
git for-each-ref --sort=-committerdate refs/remotes/origin --format='%(refname:short)|%(committerdate:relative)' | grep -v "HEAD\|main\|dev" | head -20
```

**Delete stale merged branches:**
```bash
./.github/cleanup-merged-branches.sh
```

### Abandoned Work

If a branch was never merged and work is abandoned:
```bash
# Backup first (optional)
git checkout abandoned-feature
git tag archive/abandoned-feature-$(date +%Y%m%d)
git push origin archive/abandoned-feature-$(date +%Y%m%d)

# Delete branch
git push origin --delete abandoned-feature
git branch -D abandoned-feature  # -D for force delete
```

### Keeping Dev Clean

**Reset dev to match main** (after major merges):
```bash
git checkout dev
git reset --hard main
git push origin dev --force
```

## GitHub Settings

### Enable Auto-Delete Branches
1. Go to repo **Settings** → **General**
2. Enable **"Automatically delete head branches"**
3. Merged PR branches will auto-delete ✅

### Protected Branches
- `main` - Require PR reviews, no direct pushes
- `dev` - Team collaboration branch

## Automation (GitHub Actions)

Create `.github/workflows/cleanup-branches.yml`:
```yaml
name: Cleanup Merged Branches
on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly on 1st day
  workflow_dispatch:  # Manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Delete merged branches
        run: |
          git fetch origin --prune
          git branch -r --merged main | 
          grep -v "HEAD\|main\|dev" | 
          sed 's/origin\///' | 
          xargs -I {} git push origin --delete "{}" 2>/dev/null || true
```

## Quick Reference

```bash
# See all branches
git branch -a

# Count branches
git branch -a | wc -l

# Prune deleted remote branches locally
git fetch origin --prune

# Delete merged local branches
git branch --merged main | grep -v "^\*\|main\|dev" | xargs git branch -d

# Delete merged remote branches
./.github/cleanup-merged-branches.sh
```

## Maintenance Schedule

- **Daily**: Delete branches after PR merge
- **Weekly**: Run `git fetch origin --prune` to clean up stale references
- **Monthly**: Run cleanup script for missed merges
- **Quarterly**: Review and archive abandoned branches
