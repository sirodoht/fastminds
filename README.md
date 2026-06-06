# fastminds

A marketplace for first intellectual conversations. Discover ideas, start conversations, reveal people.

## Setup

Install dependencies:

```bash
bun install
```

Start PostgreSQL and ensure the `fastminds` database exists.

## Development

Run migrations and seed data:

```bash
bun run migrate
bun run seed
```

Run the dev server (API + Vite frontend):

```bash
bun dev
```

## Seed Data

The seed script creates a rich dataset of intellectual personas with posts, conversations, and notifications:

- **25 users** — pseudonyms like `socrates`, `hypatia`, `ada`, `turing`, `borges`, `pessoa`, `nietzsche`, `kierkegaard`, `octavia`, `curie`, `godel`, `ramanujan`, `vonnegut`, `ginsberg`, `montaigne`, `cicero`, and more
- **81 posts** — idea-first questions and arguments spanning philosophy, science, mathematics, art, and ethics
- **197 messages** — 16 full conversation threads (10–12 messages each) between pairs of thinkers
- **16 notifications** — unread message notifications for the most recent incoming messages

**Login:** any seeded username with password `password123`

---

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
