import { Hono } from "hono";
import { db } from "../db";
import { adminMiddleware } from "../middleware/admin";
import type { AuthEnv } from "../middleware/auth";
import { validateUUID } from "../lib/validation";

const admin = new Hono<AuthEnv>();

// GET /api/admin/conversations — list all conversations (admin only)
admin.get("/conversations", adminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await db`
    WITH last_messages AS (
      SELECT
        conversation_messages.conversation_id,
        conversation_messages.body AS last_body,
        conversation_messages.created_at AS last_created_at,
        ROW_NUMBER() OVER (
          PARTITION BY conversation_messages.conversation_id
          ORDER BY conversation_messages.created_at DESC
        ) AS rn
      FROM conversation_messages
    )
    SELECT
      conversations.id,
      conversations.post_id,
      conversations.initiator_id,
      conversations.recipient_id,
      conversations.created_at,
      posts.title AS post_title,
      initiator.username AS initiator_username,
      recipient.username AS recipient_username,
      last_messages.last_body,
      last_messages.last_created_at,
      (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = conversations.id) AS message_count
    FROM conversations
    JOIN posts ON conversations.post_id = posts.id
    JOIN users AS initiator ON conversations.initiator_id = initiator.id
    JOIN users AS recipient ON conversations.recipient_id = recipient.id
    LEFT JOIN last_messages ON last_messages.conversation_id = conversations.id AND last_messages.rn = 1
    ORDER BY last_messages.last_created_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await db`SELECT COUNT(*) AS total FROM conversations`;

  const conversations = rows.map((row) => ({
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    initiatorId: row.initiator_id,
    initiatorUsername: row.initiator_username,
    recipientId: row.recipient_id,
    recipientUsername: row.recipient_username,
    messageCount: row.message_count,
    createdAt: row.created_at,
    lastBody: row.last_body,
    lastCreatedAt: row.last_created_at,
  }));

  return c.json({
    conversations,
    page,
    limit,
    total: countRow.total,
  });
});

// GET /api/admin/conversations/:id — get a single conversation with messages (admin only)
admin.get("/conversations/:id", adminMiddleware, async (c) => {
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const [conversation] = await db`
    SELECT
      conversations.id,
      conversations.post_id,
      conversations.initiator_id,
      conversations.recipient_id,
      conversations.created_at,
      posts.title AS post_title,
      posts.body AS post_body,
      posts.created_at AS post_created_at,
      initiator.username AS initiator_username,
      recipient.username AS recipient_username
    FROM conversations
    JOIN posts ON conversations.post_id = posts.id
    JOIN users AS initiator ON conversations.initiator_id = initiator.id
    JOIN users AS recipient ON conversations.recipient_id = recipient.id
    WHERE conversations.id = ${id}
  `;

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const messages = await db`
    SELECT
      conversation_messages.id,
      conversation_messages.sender_id,
      conversation_messages.body,
      conversation_messages.created_at
    FROM conversation_messages
    WHERE conversation_messages.conversation_id = ${id}
    ORDER BY conversation_messages.created_at ASC
  `;

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  let senderMap = new Map<string, string>();
  if (senderIds.length > 0) {
    const users = await db`
      SELECT id, username FROM users WHERE id IN ${db(senderIds)}
    `;
    for (const u of users) {
      senderMap.set(u.id, u.username);
    }
  }

  const formattedMessages = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.created_at,
    senderId: m.sender_id,
    senderUsername: senderMap.get(m.sender_id) || null,
  }));

  const messageCount = messages.length;

  return c.json({
    conversation: {
      id: conversation.id,
      postId: conversation.post_id,
      postTitle: conversation.post_title,
      postBody: conversation.post_body,
      postCreatedAt: conversation.post_created_at,
      createdAt: conversation.created_at,
      initiatorId: conversation.initiator_id,
      initiatorUsername: conversation.initiator_username,
      recipientId: conversation.recipient_id,
      recipientUsername: conversation.recipient_username,
      messageCount,
    },
    messages: formattedMessages,
  });
});

export { admin as adminRoutes };
