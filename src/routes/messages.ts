import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const messages = new Hono<AuthEnv>();

messages.use("*", authMiddleware);

messages.get("/conversations", async (c) => {
  const userId = c.get("userId");

  const conversations = await db`
    WITH ranked_messages AS (
      SELECT
        direct_messages.id,
        direct_messages.body,
        direct_messages.created_at,
        CASE
          WHEN direct_messages.sender_id = ${userId}
            THEN recipient.id
          ELSE sender.id
        END AS other_user_id,
        CASE
          WHEN direct_messages.sender_id = ${userId}
            THEN recipient.username
          ELSE sender.username
        END AS other_username,
        ROW_NUMBER() OVER (
          PARTITION BY CASE
            WHEN direct_messages.sender_id = ${userId}
              THEN direct_messages.recipient_id
            ELSE direct_messages.sender_id
          END
          ORDER BY direct_messages.created_at DESC
        ) AS row_number
      FROM direct_messages
      JOIN users AS sender ON direct_messages.sender_id = sender.id
      JOIN users AS recipient ON direct_messages.recipient_id = recipient.id
      WHERE direct_messages.sender_id = ${userId}
         OR direct_messages.recipient_id = ${userId}
    )
    SELECT id, body, created_at, other_user_id, other_username
    FROM ranked_messages
    WHERE row_number = 1
    ORDER BY created_at DESC
  `;

  return c.json({ conversations });
});

messages.get("/:username", async (c) => {
  const userId = c.get("userId");
  const username = c.req.param("username");

  const [otherUser] = await db`
    SELECT id, username
    FROM users
    WHERE username = ${username}
  `;

  if (!otherUser) {
    return c.json({ error: "User not found" }, 404);
  }

  if (otherUser.id === userId) {
    return c.json({ error: "You cannot message yourself" }, 400);
  }

  const thread = await db`
    SELECT
      direct_messages.id,
      direct_messages.body,
      direct_messages.created_at,
      sender.username AS sender,
      recipient.username AS recipient
    FROM direct_messages
    JOIN users AS sender ON direct_messages.sender_id = sender.id
    JOIN users AS recipient ON direct_messages.recipient_id = recipient.id
    WHERE (
      direct_messages.sender_id = ${userId}
      AND direct_messages.recipient_id = ${otherUser.id}
    ) OR (
      direct_messages.sender_id = ${otherUser.id}
      AND direct_messages.recipient_id = ${userId}
    )
    ORDER BY direct_messages.created_at ASC
  `;

  return c.json({
    user: {
      id: otherUser.id,
      username: otherUser.username,
    },
    messages: thread,
  });
});

export { messages as messagesRoutes };
