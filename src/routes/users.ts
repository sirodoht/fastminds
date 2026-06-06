import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { validateUsername, validateUUID } from "../lib/validation";

const REVEAL_THRESHOLD = 10;
const MIN_FEEDBACK_FOR_VISIBILITY = 10;

const ALL_POSITIVE_LABELS = [
  "Insightful", "Curious", "Kind", "Challenging",
];

const ALL_NEGATIVE_LABELS = [
  "AI", "Jerk", "Dogmatic", "Bad Faith", "Rambling",
];

const ALL_NEUTRAL_LABELS = [
  "Weird", "Contrarian",
];

const ALL_LABELS = new Set([
  ...ALL_POSITIVE_LABELS,
  ...ALL_NEGATIVE_LABELS,
  ...ALL_NEUTRAL_LABELS,
]);

const users = new Hono<AuthEnv>();

users.use("*", authMiddleware);

// GET /api/users/me/notifications — current user's notification preferences
users.get("/me/notifications", async (c) => {
  const userId = c.get("userId");

  const [user] = await db`
    SELECT email_notifications, email_new_message, email_new_post FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    emailNewConversation: user.email_notifications,
    emailNewMessage: user.email_new_message,
    emailNewPost: user.email_new_post,
  });
});

// PUT /api/users/me/notifications — update notification preferences
users.put("/me/notifications", async (c) => {
  const { emailNewConversation, emailNewMessage, emailNewPost } = await c.req.json();
  const userId = c.get("userId");

  const updates: string[] = [];
  const params: (boolean | string)[] = [];

  if (typeof emailNewConversation === "boolean") {
    updates.push("email_notifications = ?");
    params.push(emailNewConversation);
  }
  if (typeof emailNewMessage === "boolean") {
    updates.push("email_new_message = ?");
    params.push(emailNewMessage);
  }
  if (typeof emailNewPost === "boolean") {
    updates.push("email_new_post = ?");
    params.push(emailNewPost);
  }

  if (updates.length === 0) {
    return c.json({ error: "No valid fields provided" }, 400);
  }

  params.push(userId);
  const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
  const stmt = db.sqlite.query(sql);
  stmt.run(...params);
  stmt.finalize();

  const [updatedUser] = await db`
    SELECT email_notifications, email_new_message, email_new_post FROM users WHERE id = ${userId}
  `;

  return c.json({
    success: true,
    emailNewConversation: updatedUser.email_notifications,
    emailNewMessage: updatedUser.email_new_message,
    emailNewPost: updatedUser.email_new_post,
  });
});

// GET /api/users/:username — public profile by username
users.get("/:username", async (c) => {
  const username = c.req.param("username");

  const validationError = validateUsername(username);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const [user] = await db`
    SELECT id, username, created_at
    FROM users
    WHERE username = ${username}
  `;

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
    },
  });
});

// GET /api/users/:id/reputation
users.get("/:id/reputation", async (c) => {
  const userId = c.req.param("id");

  const validationError = validateUUID(userId);
  if (validationError) {
    return c.json({ error: "User not found" }, 404);
  }

  const [user] = await db`
    SELECT id FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Check visibility threshold
  const [feedbackCount] = await db`
    SELECT COUNT(DISTINCT conversation_id) AS count
    FROM conversation_feedback
    WHERE receiver_id = ${userId}
  `;

  const hidden = feedbackCount.count < MIN_FEEDBACK_FOR_VISIBILITY;

  // Compute decayed labels
  const labelRows = await db`
    SELECT
      json_each.value AS label,
      SUM(POWER(0.5, (julianday('now') - julianday(created_at)) / 365)) AS decayed_points,
      COUNT(*) AS raw_count
    FROM conversation_feedback
    CROSS JOIN json_each(labels)
    WHERE receiver_id = ${userId}
    GROUP BY json_each.value
  `;

  const positive: { label: string; decayedPoints: number; rawCount: number }[] = [];
  const negative: { label: string; decayedPoints: number; rawCount: number }[] = [];
  const neutral: { label: string; decayedPoints: number; rawCount: number }[] = [];

  for (const row of labelRows) {
    const entry = {
      label: row.label,
      decayedPoints: Number(row.decayed_points),
      rawCount: row.raw_count,
    };
    if (ALL_POSITIVE_LABELS.includes(row.label)) {
      positive.push(entry);
    } else if (ALL_NEGATIVE_LABELS.includes(row.label)) {
      negative.push(entry);
    } else if (ALL_NEUTRAL_LABELS.includes(row.label)) {
      neutral.push(entry);
    }
  }

  // Sort by decayed points descending
  positive.sort((a, b) => b.decayedPoints - a.decayedPoints);
  negative.sort((a, b) => b.decayedPoints - a.decayedPoints);
  neutral.sort((a, b) => b.decayedPoints - a.decayedPoints);

  return c.json({
    hidden,
    positive,
    negative,
    neutral,
  });
});

// GET /api/users/:id/stats
users.get("/:id/stats", async (c) => {
  const userId = c.req.param("id");

  const validationError = validateUUID(userId);
  if (validationError) {
    return c.json({ error: "User not found" }, 404);
  }

  const [user] = await db`
    SELECT id FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const [conversationsRow] = await db`
    SELECT COUNT(*) AS count FROM conversations
    WHERE initiator_id = ${userId} OR recipient_id = ${userId}
  `;

  const [startedRow] = await db`
    SELECT COUNT(*) AS count FROM conversations
    WHERE initiator_id = ${userId}
  `;

  const [messagesSentRow] = await db`
    SELECT COUNT(*) AS count FROM conversation_messages
    WHERE sender_id = ${userId}
  `;

  const [avgLengthRow] = await db`
    SELECT AVG(message_count) AS avg
    FROM (
      SELECT COUNT(*) AS message_count
      FROM conversation_messages
      GROUP BY conversation_id
      HAVING conversation_id IN (
        SELECT id FROM conversations
        WHERE initiator_id = ${userId} OR recipient_id = ${userId}
      )
    ) sub
  `;

  return c.json({
    totalConversations: conversationsRow.count,
    conversationsStarted: startedRow.count,
    messagesSent: messagesSentRow.count,
    averageConversationLength: avgLengthRow.avg ? Number(avgLengthRow.avg) : 0,
  });
});

export { users as usersRoutes };
export { ALL_LABELS };
