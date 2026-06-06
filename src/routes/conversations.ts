import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const REVEAL_THRESHOLD = 10;

const conversations = new Hono<AuthEnv>();

conversations.use("*", authMiddleware);

// POST /api/posts/:id/conversations — initiate a conversation from a post
conversations.post("/from-post/:id", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");
  const { body } = await c.req.json();

  if (!body || !body.trim()) {
    return c.json({ error: "First message is required" }, 400);
  }

  if (body.trim().length < 20) {
    return c.json({ error: "First message should be substantial (at least 20 characters)" }, 400);
  }

  // Validate post id format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id, author_id, archived_at FROM posts WHERE id = ${postId}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.archived_at) {
    return c.json({ error: "This post is archived and cannot receive new conversations" }, 400);
  }

  if (post.author_id === userId) {
    return c.json({ error: "You cannot start a conversation on your own post" }, 400);
  }

  // Daily limit: max 10 new conversations per day
  const [dailyCount] = await db`
    SELECT COUNT(*)::int AS count FROM conversations
    WHERE initiator_id = ${userId}
      AND created_at >= CURRENT_DATE
  `;

  if (dailyCount.count >= 10) {
    return c.json({ error: "You have reached the daily limit of 10 new conversations" }, 429);
  }

  const [conversation] = await db`
    INSERT INTO conversations (post_id, initiator_id, recipient_id)
    VALUES (${postId}, ${userId}, ${post.author_id})
    RETURNING id, post_id, initiator_id, recipient_id, created_at
  `;

  const [message] = await db`
    INSERT INTO conversation_messages (conversation_id, sender_id, body)
    VALUES (${conversation.id}, ${userId}, ${body.trim()})
    RETURNING id, body, created_at
  `;

  // Create notification for post author
  await db`
    INSERT INTO notifications (user_id, actor_id, type, body, href)
    VALUES (
      ${post.author_id},
      ${userId},
      ${"conversation:new"},
      ${"Someone responded to your post"},
      ${`/conversations/${conversation.id}`}
    )
  `;

  return c.json({
    conversation: {
      id: conversation.id,
      postId: conversation.post_id,
      createdAt: conversation.created_at,
    },
    message: {
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      senderId: message.sender_id,
    },
  }, 201);
});

// GET /api/conversations — list current user's conversations
conversations.get("/", async (c) => {
  const userId = c.get("userId");

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
      (SELECT COUNT(*)::int FROM conversation_messages WHERE conversation_id = conversations.id) AS message_count
    FROM conversations
    JOIN posts ON conversations.post_id = posts.id
    JOIN users AS initiator ON conversations.initiator_id = initiator.id
    JOIN users AS recipient ON conversations.recipient_id = recipient.id
    LEFT JOIN last_messages ON last_messages.conversation_id = conversations.id AND last_messages.rn = 1
    WHERE conversations.initiator_id = ${userId}
       OR conversations.recipient_id = ${userId}
    ORDER BY last_messages.last_created_at DESC NULLS LAST
  `;

  const result = rows.map((row) => {
    const revealed = row.message_count >= REVEAL_THRESHOLD;
    const isInitiator = row.initiator_id === userId;
    const otherUserId = isInitiator ? row.recipient_id : row.initiator_id;
    const otherUsername = isInitiator ? row.recipient_username : row.initiator_username;

    return {
      id: row.id,
      postId: row.post_id,
      postTitle: row.post_title,
      createdAt: row.created_at,
      lastBody: row.last_body,
      lastCreatedAt: row.last_created_at,
      messageCount: row.message_count,
      revealed,
      otherUserId: revealed ? otherUserId : null,
      otherUsername: revealed ? otherUsername : null,
    };
  });

  return c.json({ conversations: result });
});

// GET /api/conversations/:id — get a single conversation with messages
conversations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
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
      posts.created_at AS post_created_at
    FROM conversations
    JOIN posts ON conversations.post_id = posts.id
    WHERE conversations.id = ${id}
  `;

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (conversation.initiator_id !== userId && conversation.recipient_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
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

  const messageCount = messages.length;
  const revealed = messageCount >= REVEAL_THRESHOLD;
  const isInitiator = conversation.initiator_id === userId;

  // Fetch sender usernames only if revealed
  let senderMap = new Map<string, string>();
  if (revealed) {
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    if (senderIds.length > 0) {
      const users = await db`
        SELECT id, username FROM users WHERE id IN ${db(senderIds)}
      `;
      for (const u of users) {
        senderMap.set(u.id, u.username);
      }
    }
  }

  const formattedMessages = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.created_at,
    senderId: m.sender_id,
    senderUsername: revealed ? senderMap.get(m.sender_id) || null : null,
    isMine: m.sender_id === userId,
  }));

  const otherUserId = isInitiator ? conversation.recipient_id : conversation.initiator_id;

  return c.json({
    conversation: {
      id: conversation.id,
      postId: conversation.post_id,
      postTitle: conversation.post_title,
      postBody: conversation.post_body,
      postCreatedAt: conversation.post_created_at,
      createdAt: conversation.created_at,
      messageCount,
      revealed,
      otherUserId: revealed ? otherUserId : null,
    },
    messages: formattedMessages,
  });
});

// POST /api/conversations/:id/messages — send a message
conversations.post("/:id/messages", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { body } = await c.req.json();

  if (!body || !body.trim()) {
    return c.json({ error: "Message cannot be empty" }, 400);
  }

  if (body.trim().length > 4000) {
    return c.json({ error: "Message is too long" }, 400);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const [conversation] = await db`
    SELECT initiator_id, recipient_id
    FROM conversations
    WHERE id = ${id}
  `;

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (conversation.initiator_id !== userId && conversation.recipient_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [message] = await db`
    INSERT INTO conversation_messages (conversation_id, sender_id, body)
    VALUES (${id}, ${userId}, ${body.trim()})
    RETURNING id, conversation_id, sender_id, body, created_at
  `;

  const otherUserId = conversation.initiator_id === userId
    ? conversation.recipient_id
    : conversation.initiator_id;

  // Count messages after insert
  const [countRow] = await db`
    SELECT COUNT(*)::int AS count FROM conversation_messages WHERE conversation_id = ${id}
  `;
  const messageCount = countRow.count;
  const revealed = messageCount >= REVEAL_THRESHOLD;

  // Notification for the other user
  await db`
    INSERT INTO notifications (user_id, actor_id, type, body, href)
    VALUES (
      ${otherUserId},
      ${userId},
      ${"conversation:message"},
      ${"New message in a conversation"},
      ${`/conversations/${id}`}
    )
  `;

  return c.json({
    message: {
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      senderId: message.sender_id,
      senderUsername: null,
      isMine: true,
      conversationId: message.conversation_id,
    },
    messageCount,
    revealed,
  });
});

export { conversations as conversationsRoutes };
