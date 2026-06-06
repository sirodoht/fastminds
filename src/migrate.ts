import { db } from "./db";

await db`
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`ALTER TABLE users DROP COLUMN IF EXISTS display_name;`;
await db`ALTER TABLE users DROP COLUMN IF EXISTS bio;`;
await db`ALTER TABLE users DROP COLUMN IF EXISTS picture;`;

await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;`;
await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`;
await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT`;
await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT UNIQUE;`;
await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN NOT NULL DEFAULT FALSE`;

await db`
  CREATE TABLE IF NOT EXISTS pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    stripe_checkout_session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id),
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`ALTER TABLE posts DROP COLUMN IF EXISTS links;`;
await db`ALTER TABLE posts DROP COLUMN IF EXISTS score;`;
await db`ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;

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
  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id),
    initiator_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS conversations_initiator_created_at_idx
  ON conversations (initiator_id, created_at DESC);
`;

await db`
  CREATE INDEX IF NOT EXISTS conversations_participants_idx
  ON conversations (initiator_id, recipient_id);
`;

await db`
  CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_at_idx
  ON conversation_messages (conversation_id, created_at ASC);
`;

await db`
  CREATE TABLE IF NOT EXISTS post_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS post_updates_post_id_idx
  ON post_updates (post_id, created_at ASC);
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

await db`
  CREATE TABLE IF NOT EXISTS conversation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    giver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thumbs INTEGER CHECK (thumbs >= -2 AND thumbs <= 2),
    labels TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, giver_id)
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS conversation_feedback_receiver_idx
  ON conversation_feedback (receiver_id, created_at);
`;

await db`
  CREATE TABLE IF NOT EXISTS admin_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await db`
  CREATE INDEX IF NOT EXISTS admin_events_type_created_at_idx
  ON admin_events (event_type, created_at DESC);
`;

console.log("Migration complete: users, posts, direct_messages, conversations, conversation_messages, post_updates, notifications, conversation_feedback, and admin_events tables ready");
process.exit(0);
