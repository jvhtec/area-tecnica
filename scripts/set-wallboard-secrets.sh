#!/bin/bash
# Set wallboard secrets in production
# Usage: ./scripts/set-wallboard-secrets.sh

# Generate a secure secret if you don't have one
# Or use your existing secret
SECRET="wallboard-dev-secret"  # Change this to a secure random string in production

echo "Setting WALLBOARD_JWT_SECRET for production..."
echo "You need to run these commands with your SUPABASE_ACCESS_TOKEN set:"
echo ""
echo "export SUPABASE_ACCESS_TOKEN='your-token-here'"
echo "npx supabase secrets set WALLBOARD_JWT_SECRET='${SECRET}' --project-ref syldobdcdsgfgjtbuwxm"
echo ""
echo "Then redeploy both functions:"
echo "npx supabase functions deploy wallboard-auth --project-ref syldobdcdsgfgjtbuwxm"
echo "npx supabase functions deploy wallboard-feed --project-ref syldobdcdsgfgjtbuwxm"
