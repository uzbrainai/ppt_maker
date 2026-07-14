# Deploying slidewind to Hostinger (VPS)

This is a runbook an engineer **or Claude** can follow to deploy the slidewind
deck generator (Node API + React web app) to a **Hostinger VPS**.

> **Why a VPS, not shared hosting?** The app runs a persistent Node service
> (LLM orchestration + `.pptx` generation). Hostinger **shared/web hosting cannot
> run a long-lived Node process** — you need a **VPS** plan (Ubuntu). If you only
> have shared hosting, the API must move elsewhere (a VPS, Render, Fly, a small
> cloud box) and the web build can be served as static files anywhere.

## Architecture (single VPS)

```
                Hostinger VPS (Ubuntu)
  Browser ──► nginx :443/:80
                 ├── /            → static web build (front/web/dist)
                 └── /api/*       → http://127.0.0.1:8081  (slidewind API, pm2)
                                        reads ./.env (OPENAI_API_KEY, TAVILY_API_KEY, …)
```

Everything is **same-origin**: the web app calls `/api/...`, nginx proxies it to
the API on localhost. Only ports 80/443 are public; the API stays on 127.0.0.1.

## Prerequisites

- A **Hostinger VPS** (KVM, Ubuntu 22.04+) with SSH/root access.
- A **domain** (or subdomain) pointed at the VPS IP (an `A` record). Hostinger
  manages DNS under *Domains → DNS*. Used for HTTPS.
- API tokens ready: **`OPENAI_API_KEY`** and **`TAVILY_API_KEY`** (both required).
- The repository accessible to the server (git URL, or upload via `scp`).

---

## Step 1 — Provision the server

SSH in (replace IP), then install Node 20, nginx, pm2, git, certbot:

```bash
ssh root@YOUR_SERVER_IP

apt update && apt -y upgrade
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs nginx git
npm i -g pm2
apt -y install certbot python3-certbot-nginx
mkdir -p /var/log/slidewind
node -v && nginx -v && pm2 -v   # sanity check
```

## Step 2 — Get the code

```bash
mkdir -p /var/www && cd /var/www
git clone <YOUR_REPO_URL> slidewind     # or: scp -r ./ root@IP:/var/www/slidewind
cd /var/www/slidewind
```

> The nginx config and pm2 config assume the app lives at **`/var/www/slidewind`**.
> If you put it elsewhere, update `deploy/nginx/slidewind.conf` (`root`) and
> `deploy/ecosystem.config.cjs` (`cwd`).

## Step 3 — Configure secrets (`.env`)

All tokens live in a single `.env` at the repo root (loaded automatically by the
API; never committed):

```bash
cp deploy/.env.example .env
nano .env        # paste OPENAI_API_KEY and TAVILY_API_KEY at minimum
```

Required: `OPENAI_API_KEY`, `TAVILY_API_KEY`. Everything else has safe defaults
(see comments in `.env`). Keep `SLIDEWIND_PORT=8081`.

## Step 4 — Build backend + frontend

```bash
bash deploy/build.sh
```

This runs `npm ci && npm run build` (→ `dist/`) and builds the web app with
`VITE_SLIDEWIND_BASE=/api` (→ `front/web/dist/`). It auto-creates
`front/web/.env.production` on first run.

## Step 5 — Run the API with pm2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup            # run the command it prints, to start on boot
curl -s localhost:8081/health    # → {"ok":true,...}
```

## Step 6 — nginx (serve web + proxy API)

```bash
# Put your real domain in the config first:
sed -i 's/your-domain.com/REAL_DOMAIN.com/g' deploy/nginx/slidewind.conf

cp deploy/nginx/slidewind.conf /etc/nginx/sites-available/slidewind
ln -sf /etc/nginx/sites-available/slidewind /etc/nginx/sites-enabled/slidewind
rm -f /etc/nginx/sites-enabled/default       # optional: drop the default site
nginx -t && systemctl reload nginx
```

Visit `http://REAL_DOMAIN.com` — the app should load. The SSE/long-generation
proxy settings (no buffering, 600s timeout) are already in the config.

## Step 7 — HTTPS

```bash
certbot --nginx -d REAL_DOMAIN.com -d www.REAL_DOMAIN.com
```

Certbot edits the nginx site to add TLS and sets up auto-renewal. Now use
`https://REAL_DOMAIN.com`.

## Step 8 — Verify end-to-end

1. Open `https://REAL_DOMAIN.com`, sign in (any email/password — see *Auth* note).
2. **New document → Presentation → Generate.**
3. Live progress should show `Research done in ~2–8s` (Tavily).
4. **Download .pptx**, and **Open in editor → edit text → Save as PPTX**.

Quick API check from the server:
```bash
curl -s -X POST localhost:8081/generate \
  -H 'content-type: application/json' \
  -d '{"topic":"test deck","pages":5,"research":false}' | head -c 200
```

---

## Updating / redeploying

```bash
cd /var/www/slidewind
git pull                 # or re-upload
bash deploy/build.sh
pm2 reload slidewind-api
# nginx only needs reload if you changed the nginx config or the web build path
```

## Operations

```bash
pm2 status                       # process state
pm2 logs slidewind-api           # live logs (stage timings, errors)
pm2 restart slidewind-api
tail -f /var/log/slidewind/err.log
```

## Enabling real auth (JWT)

The web app is already JWT-ready: on login it stores the token and sends
`Authorization: Bearer <jwt>` on every API call. To enforce it server-side, the
slidewind API can **verify JWTs issued by your existing auth backend** (pptmake),
as long as both share the same HS256 `JWT_SECRET`. Two changes:

1. **Issue tokens** — point the web app's auth at your backend by building with
   `VITE_API_BASE` set (in `front/web/.env.production`), e.g. `VITE_API_BASE=/api-auth`
   if you proxy it through nginx, or the backend's full URL. The backend must:
   - accept `POST /auth/login` and `POST /auth/register` with `{ email, password }`,
   - respond with `{ "user": {...}, "token": "<jwt>" }` (or `accessToken`),
   - sign the JWT with **HS256** using the shared `JWT_SECRET`.

2. **Verify tokens** — in the slidewind `.env` set:
   ```ini
   AUTH_REQUIRED=true
   JWT_SECRET=<the same secret the auth backend signs with>
   ```
   Then `pm2 reload slidewind-api`. Now `/generate*` and `/deck/*` reject any
   request without a valid, unexpired Bearer token (401). `SLIDEWIND_TOKEN`
   (sent as `x-api-key`) still bypasses, for server-to-server calls.

If you proxy the auth backend through the same nginx, add a location block, e.g.:
```nginx
location /api-auth/ { proxy_pass http://127.0.0.1:<AUTH_PORT>/; proxy_set_header Host $host; }
```

> Leave `AUTH_REQUIRED=false` (default) for demos — the app's mock session then
> works without any backend.

## Notes & limitations

- **Auth is a local mock until you enable JWT** (see above). With
  `AUTH_REQUIRED=false`, the web app accepts any email/password and stores a
  client-side session — generation is gated on being "signed in" but it is **not**
  real authentication. Flip on JWT for real multi-user security.
- **Generated decks are stored in memory** (for the canvas editor). A
  `pm2 restart` clears them — already-downloaded `.pptx` files are unaffected, but
  *reopening an old deck in the editor* after a restart will show "regenerate".
  Persisting to disk/Redis is a future task.
- **Premium tier** generates AI photos (`gpt-image`) and is slow/costly. General
  tier (default) is fast and image-free.
- **Costs:** research uses one Tavily *basic* search (≈1 credit) capped at 5
  results per deck; tune via `TAVILY_*` in `.env`. Turn research off per-deck in
  the UI for zero search cost.
- **Firewall:** ensure ports 80/443 are open (Hostinger panel / `ufw allow 'Nginx Full'`).
  Never expose 8081 publicly — it has no auth unless you set `SLIDEWIND_TOKEN`.

## Optional — Docker instead of pm2

The repo ships a `docker-compose.yml` (slidewind API + image microservice). On a
Docker-capable VPS you can run the **API** via compose and still serve the web
build through nginx:

```bash
cp deploy/.env.example .env && nano .env      # add tokens
docker compose up -d --build                  # API on :8081
bash deploy/build.sh                          # build front/web/dist
# then Steps 6–7 (nginx + HTTPS) as above
```

Use **either** pm2 **or** Docker for the API, not both.
