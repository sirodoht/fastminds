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

await db`ALTER TABLE users DROP COLUMN IF EXISTS display_name;`;

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

await db`
  CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT direct_messages_not_to_self CHECK (sender_id <> recipient_id)
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS direct_messages_participants_created_at_idx
  ON direct_messages (sender_id, recipient_id, created_at DESC);
`;

await db`
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    body TEXT NOT NULL,
    href TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON notifications (user_id, created_at DESC);
`;

await db`
  CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;
`;

console.log("Migration complete: users, posts, direct_messages, and notifications tables ready");
process.exit(0);
