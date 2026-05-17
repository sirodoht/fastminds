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

console.log("Migration complete: users table ready");
process.exit(0);
