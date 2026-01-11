# Web push credentials

The VAPID key pair required for web push notifications has been provisioned. Copy these values into your deployment secrets and rotation workflows as needed.

| Variable | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | `BFD4f-C2H57bRgIv0FximD-TfH5n532QghezqfPMZHDvKoPZ2SngkdQSEQI8HEhloMfH5ntjXtdX40zKsgoGRIU` |
| `VAPID_PRIVATE_KEY` | `[STORED IN SUPABASE SECRETS - NOT COMMITTED]` |

> **Security note:** keep the private key secret in production by storing it in your environment's secret manager (e.g., Supabase secrets, Vercel env vars). The public key is safe to expose to the client as `VITE_VAPID_PUBLIC_KEY`.
>
> **IMPORTANT:** The VAPID private key has been removed from this file for security reasons. It should only be stored in:
> - Supabase Edge Function secrets
> - Cloudflare Pages environment variables (if used there)
> - Never commit the private key to version control
