CREATE TABLE IF NOT EXISTS post_ai_insights (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  insight TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
