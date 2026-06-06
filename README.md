# fastminds

Anonymous-to-pseudonymous conversations around ideas. No scores, no followers, no algorithms.

## Setup

Install dependencies:

```bash
bun install
```

Create a `.env` file (see [Environment](#environment) below).

Run migrations and seed data:

```bash
bun run migrate
bun run seed
```

Run the dev server (API + Vite frontend concurrently):

```bash
bun dev
```

## Environment

Required variables in `.env`:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing key for auth tokens |
| `DATABASE_URL` | SQLite path, e.g. `sqlite://fastminds.db` |
| `PUBLIC_URL` | Public-facing URL, e.g. `http://localhost:3000` |
| `APP_URL` | Same as above; used in email links |
| `STRIPE_SECRET_KEY` | Stripe secret key for $1 payment verification |
| `POSTMARK_SERVER_TOKEN` | Postmark API key for transactional emails |
| `ADMIN_EMAIL` | Address for admin alerts (new posts, etc.) |

Optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP server port |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signature verification |

## Architecture

- **Backend**: Hono + SQLite (`bun:sqlite`) + Bun.serve with WebSocket upgrade
- **Frontend**: Svelte SPA built with Vite, served as static files by Hono in production
- **Auth**: JWT tokens stored in `localStorage`
- **Real-time**: WebSocket at `/ws/messages` for live message delivery and notifications
- **Payment**: Stripe Checkout for one-time $1 sign-up fee (bypassable with `?bypass=true` in dev)

## How Conversations Work

1. Users post questions/ideas
2. Others start **anonymous** conversations on posts
3. After **10 messages exchanged**, identities are revealed to both participants
4. Once revealed, participants can leave feedback labels (e.g. "Insightful", "Curious", "Kind")
5. Labels decay over time — recent interactions weigh more

## Seed Data

The seed script creates fake intellectual personas:

- **25 users**: pseudonyms like `socrates`, `hypatia`, `ada`, `turing`, `borges`, `pessoa`, `nietzsche`, `kierkegaard`, `octavia`, `curie`, `godel`, `ramanujan`, `vonnegut`, `ginsberg`, `montaigne`, `cicero`, and more
- **81 posts**: idea-first questions and arguments spanning philosophy, science, mathematics, art, and ethics

Login: any seeded username with password `password123`

## Production Deployment

A systemd service file is provided at `deploy/fastminds.service`:

```bash
sudo cp deploy/fastminds.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable fastminds
sudo systemctl start fastminds
```

Build the frontend before deploying:

```bash
bun build:frontend
```

The server serves `packages/frontend/dist/` as static files and falls back to `index.html` for SPA routes.
