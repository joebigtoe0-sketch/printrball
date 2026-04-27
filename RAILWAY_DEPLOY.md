# Railway Deployment (Web + Server)

This project runs best as **two Railway services** from the same repo:

- `powerball-server` (Fastify API + round engine worker)
- `powerball-web` (Next.js frontend)

## 1) Push code first

Push this repo to GitHub/GitLab, then connect it in Railway.

## 2) Create `powerball-server` service

1. Railway -> New Project -> Deploy from GitHub repo.
2. Create service name: `powerball-server`.
3. In service settings:
   - **Root Directory**: repo root (leave blank)
   - **Config as Code**: use `deploy/railway-server.json`
4. Add a **Volume** (important):
   - Mount path: `/data`
5. Set env vars (minimum):

```env
PORT=4000
DATA_DIR=/data
EXCLUSIONS_PATH=/data/exclusions.json

ADMIN_PASSWORD=change_me
MOCK_HOLDERS=0
TOKEN_MINT=

RPC_URL=...
HELIUS_API_KEY=
HELIUS_NETWORK=mainnet-beta
HOLDER_RPC_URL=
HOLDER_POLL_MS=120000

METEORA_LIVE_ENABLED=1
TREASURY_PRIVATE_KEY=...
PRIZE_POLL_MS=10000
MIN_CLAIM_LAMPORTS=1
PAYOUT_RESERVE_LAMPORTS=2500000
```

Notes:
- Keep only one backend replica (single instance) for now.
- `TREASURY_PRIVATE_KEY` stays server-only.

## 3) Create `powerball-web` service

1. Add another service from the same repo.
2. Service name: `powerball-web`.
3. In service settings:
   - **Root Directory**: repo root (leave blank)
   - **Config as Code**: use `deploy/railway-web.json`
4. Set env vars:

```env
NEXT_PUBLIC_API_URL=https://<powerball-server-domain>
NEXT_PUBLIC_TOKEN_TICKER=BALL
NEXT_PUBLIC_SOLSCAN_CLUSTER=mainnet-beta
```

## 4) Generate/public domains

Assign Railway domains to both services.

- `powerball-server`: copy URL for API
- `powerball-web`: your app URL

Then set:
- web `NEXT_PUBLIC_API_URL` -> server URL
- server `CORS_ORIGIN` -> web URL

Redeploy both after changing env vars.

## 5) First live boot

1. Open `https://<web-domain>/admin`
2. Login with `ADMIN_PASSWORD`
3. Save token mint
4. Save blacklist wallets
5. Click **Start (next boundary)**

## 6) Useful operations

- Fresh reset on server (wipes rounds/history/runtime):
  - `pnpm --filter @powerball/server reset-live`
- Health check:
  - `GET https://<server-domain>/health`
- State:
  - `GET https://<server-domain>/api/state`

## 7) Common gotchas

- If using volume, always set `DATA_DIR=/data`.
- Do not set blank path envs like `EXCLUSIONS_PATH=` unless intentionally filled.
- Keep exactly one backend instance to avoid double timers/draws.
