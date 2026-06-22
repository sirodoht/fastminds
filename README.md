# fastminds

where curious people have deep one-to-one conversations

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
| `STRIPE_SECRET_KEY` | Stripe secret key for payment verification |

Optional variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `ADMIN_EMAIL` | — | Address for admin alerts, including new posts and moderation events |
| `APP_URL` | `PUBLIC_URL` or request origin, depending on route | App URL used in email links |
| `DATABASE_URL` | `fastminds.db` | SQLite path; use `sqlite://fastminds.db` or a plain path |
| `EMAIL_WEBHOOK_URL` | — | Webhook endpoint for sending emails instead of Postmark |
| `FROM_EMAIL` | `noreply@fastminds.xyz` | Fallback sender address when using `EMAIL_WEBHOOK_URL` |
| `OPENAI_API_KEY` | — | Enables AI-generated post insights |
| `OPENAI_INSIGHTS_MODEL` | `gpt-5.5` | OpenAI model for post insights |
| `OPENAI_INSIGHTS_REASONING_EFFORT` | `xhigh` | Reasoning effort for post insights |
| `PORT` | `3000` | HTTP server port |
| `POSTMARK_API_KEY` | — | Postmark API key for transactional emails |
| `POSTMARK_FROM` | — | Sender address for Postmark emails |
| `PUBLIC_URL` | `http://localhost:3000` or `https://fastminds.xyz`, depending on route | Public-facing URL for links and social metadata |

Test/runtime variables:

| Variable | Purpose |
|----------|---------|
| `CI` | Disables real admin email sending when set to `true` |
| `NODE_ENV` | Tests set this to `test` to disable real admin email sending |

## Architecture

- Backend: Hono + SQLite (`bun:sqlite`) + Bun.serve with WebSocket upgrade
- Frontend: Svelte SPA built with Vite, served as static files by Hono in production
- Auth: JWT tokens stored in `localStorage`
- Real-time: WebSocket at `/ws/messages` for live message delivery and notifications
- Payment: Stripe Checkout for sign-up fee

## How Conversations Work

1. Users post questions/ideas
2. Others start anonymous conversations on posts
3. After 10 messages exchanged, identities are revealed to both participants
4. Once revealed, participants can leave feedback labels (e.g. "Insightful", "Curious", "Kind")
5. Labels decay over time — recent interactions weigh more

## Seed Data

The seed script creates fake intellectual personas:

- 25 users: pseudonyms like `socrates`, `hypatia`, `ada`, `turing`, `borges`, `pessoa`, `nietzsche`, `kierkegaard`, `octavia`, `curie`, `godel`, `ramanujan`, `vonnegut`, `ginsberg`, `montaigne`, `cicero`, and more
- 81 posts: idea-first questions and arguments spanning philosophy, science, mathematics, art, and ethics

Login: any seeded username with password `password123`

## Production Deployment

A systemd service file is provided at `deploy/fastminds.service`:

```bash
cp deploy/fastminds.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable fastminds
systemctl start fastminds
```

Build the frontend before deploying:

```bash
bun build:frontend
```

The server serves `packages/frontend/dist/` as static files and falls back to `index.html` for SPA routes.
