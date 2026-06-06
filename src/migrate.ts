import { db } from "./db";

// Drop old tables if they exist (no CASCADE in SQLite)
await db`DROP TABLE IF EXISTS moderation_actions`;
await db`DROP TABLE IF EXISTS reports`;
await db`DROP TABLE IF EXISTS bookmarks`;
await db`DROP TABLE IF EXISTS admin_events`;
await db`DROP TABLE IF EXISTS conversation_feedback`;
await db`DROP TABLE IF EXISTS notifications`;
await db`DROP TABLE IF EXISTS post_updates`;
await db`DROP TABLE IF EXISTS conversation_messages`;
await db`DROP TABLE IF EXISTS conversations`;
await db`DROP TABLE IF EXISTS posts`;
await db`DROP TABLE IF EXISTS pending_registrations`;
await db`DROP TABLE IF EXISTS users`;

await db`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    email TEXT UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    email_verification_token TEXT,
    stripe_checkout_session_id TEXT UNIQUE,
    payment_verified INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0
  );
`;

await db`
  CREATE TABLE pending_registrations (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    stripe_checkout_session_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    author_id TEXT NOT NULL REFERENCES users(id),
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    initiator_id TEXT NOT NULL REFERENCES users(id),
    recipient_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX conversations_initiator_created_at_idx
  ON conversations (initiator_id, created_at DESC);
`;

await db`
  CREATE INDEX conversations_participants_idx
  ON conversations (initiator_id, recipient_id);
`;

await db`
  CREATE TABLE conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX conversation_messages_conversation_created_at_idx
  ON conversation_messages (conversation_id, created_at ASC);
`;

await db`
  CREATE TABLE post_updates (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX post_updates_post_id_idx
  ON post_updates (post_id, created_at ASC);
`;

await db`
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    body TEXT NOT NULL,
    href TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX notifications_user_created_at_idx
  ON notifications (user_id, created_at DESC);
`;

await db`
  CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;
`;

await db`
  CREATE TABLE conversation_feedback (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    giver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thumbs INTEGER CHECK (thumbs >= -2 AND thumbs <= 2),
    labels TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (conversation_id, giver_id)
  );
`;

await db`
  CREATE INDEX conversation_feedback_receiver_idx
  ON conversation_feedback (receiver_id, created_at);
`;

await db`
  CREATE TABLE admin_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX admin_events_type_created_at_idx
  ON admin_events (event_type, created_at DESC);
`;

await db`
  CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, post_id)
  );
`;

await db`
  CREATE INDEX bookmarks_user_created_at_idx
  ON bookmarks (user_id, created_at DESC);
`;

await db`
  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'message', 'account')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX reports_status_created_at_idx
  ON reports (status, created_at DESC);
`;

await db`
  CREATE INDEX reports_target_idx
  ON reports (target_type, target_id);
`;

await db`
  CREATE TABLE moderation_actions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    moderator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('warning', 'suspend', 'ban', 'content_removed', 'content_hidden', 'no_action')),
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

await db`
  CREATE INDEX moderation_actions_report_idx
  ON moderation_actions (report_id);
`;

console.log("Migration complete: users, posts, conversations, conversation_messages, post_updates, notifications, conversation_feedback, admin_events, bookmarks, reports, and moderation_actions tables ready");
process.exit(0);
