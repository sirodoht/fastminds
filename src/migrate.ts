import { db } from "./db";

await db`
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    picture TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

console.log("Migration complete: users and posts tables ready");
process.exit(0);
