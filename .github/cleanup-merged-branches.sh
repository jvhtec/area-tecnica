#!/bin/bash
# Script to clean up branches that have been merged into main

echo "🧹 Cleaning up merged branches..."
echo ""

# Fetch latest from origin
git fetch origin --prune

# Get list of remote branches merged into main (excluding main/dev/HEAD)
MERGED_BRANCHES=$(git branch -r --merged main | grep -v "HEAD" | grep -v "origin/main" | grep -v "origin/dev" | sed 's/origin\///')

# Count branches
BRANCH_COUNT=$(echo "$MERGED_BRANCHES" | wc -l)

echo "Found $BRANCH_COUNT merged branches to delete"
echo ""
echo "Branches to delete:"
echo "$MERGED_BRANCHES" | head -20
echo ""

if [ "$BRANCH_COUNT" -gt 20 ]; then
    echo "... and $(($BRANCH_COUNT - 20)) more"
    echo ""
fi

# Ask for confirmation
read -p "Delete these $BRANCH_COUNT remote branches? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deleting branches..."
    
    echo "$MERGED_BRANCHES" | while read branch; do
        if [ ! -z "$branch" ]; then
            echo "  Deleting origin/$branch"
            git push origin --delete "$branch" 2>/dev/null || echo "    (already deleted or error)"
        fi
    done
    
    echo ""
    echo "✅ Cleanup complete!"
    echo ""
    echo "Cleaning up local tracking branches..."
    git fetch origin --prune
    
    # Delete local branches that have been merged
    git branch --merged main | grep -v "^\*" | grep -v "main" | grep -v "dev" | xargs -r git branch -d
    
    echo "✅ All done!"
else
    echo "Cleanup cancelled"
fi
