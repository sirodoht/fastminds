import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, verifiedEmailMiddleware, type AuthEnv } from "../middleware/auth";
import { sendAdminEmail, logAdminEvent } from "../lib/email";
import { ALL_LABELS } from "./users";

const REVEAL_THRESHOLD = 10;

function formatPgTextArray(arr: string[]): string {
  return "{" + arr.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",") + "}";
}

const conversations = new Hono<AuthEnv>();

conversations.use("*", authMiddleware);

// POST /api/posts/:id/conversations — initiate a conversation from a post
conversations.post("/from-post/:id", verifiedEmailMiddleware, async (c) => {
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

  // One conversation per post per user
  const [existingConversation] = await db`
    SELECT id FROM conversations
    WHERE post_id = ${postId} AND initiator_id = ${userId}
    LIMIT 1
  `;

  if (existingConversation) {
    return c.json({ error: "You already started a conversation on this post" }, 409);
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

  await db`
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = ${userId}
      AND href = ${`/conversations/${id}`}
      AND read_at IS NULL
  `;

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
    SELECT c.initiator_id, c.recipient_id, c.post_id,
           i.username AS initiator_username, r.username AS recipient_username
    FROM conversations c
    JOIN users i ON i.id = c.initiator_id
    JOIN users r ON r.id = c.recipient_id
    WHERE c.id = ${id}
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

  if (messageCount === REVEAL_THRESHOLD) {
    const [post] = await db`
      SELECT title, body FROM posts WHERE id = ${conversation.post_id}
    `;

    const messages = await db`
      SELECT m.body, m.created_at, u.username AS sender_username
      FROM conversation_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ${id}
      ORDER BY m.created_at ASC
    `;

    const messageLines = messages.map((m: any, i: number) =>
      `${i + 1}. [${m.created_at.toISOString()}] ${m.sender_username}: ${m.body}`
    ).join("\n");

    const emailText = `A conversation has reached the 10-message reveal threshold.

Conversation ID: ${id}
Initiator: ${conversation.initiator_username}
Recipient: ${conversation.recipient_username}

Post Title: ${post?.title || "N/A"}
Post Body:
${post?.body || "N/A"}

Messages:
${messageLines}`;

    const emailHtml = `<p>A conversation has reached the 10-message reveal threshold.</p>
<p><b>Conversation ID:</b> ${id}<br>
<b>Initiator:</b> ${conversation.initiator_username}<br>
<b>Recipient:</b> ${conversation.recipient_username}</p>
<p><b>Post Title:</b> ${post?.title || "N/A"}</p>
<p><b>Post Body:</b><br><pre>${post?.body || "N/A"}</pre></p>
<p><b>Messages:</b></p>
<ol>
${messages.map((m: any) => `<li><b>${m.sender_username}</b> (${m.created_at.toISOString()}):<br>${m.body}</li>`).join("\n")}
</ol>`;

    await sendAdminEmail({
      subject: "Conversation reached 10 messages",
      text: emailText,
      html: emailHtml,
    });
    await logAdminEvent("conversation:reveal", emailText);
  }

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

// GET /api/conversations/:id/feedback — get current user's feedback for this conversation
conversations.get("/:id/feedback", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const [conversation] = await db`
    SELECT id, initiator_id, recipient_id
    FROM conversations
    WHERE id = ${id}
  `;

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (conversation.initiator_id !== userId && conversation.recipient_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [feedback] = await db`
    SELECT id, thumbs, labels, created_at
    FROM conversation_feedback
    WHERE conversation_id = ${id} AND giver_id = ${userId}
    LIMIT 1
  `;

  if (!feedback) {
    return c.json({ feedback: null });
  }

  return c.json({
    feedback: {
      id: feedback.id,
      thumbs: feedback.thumbs,
      labels: feedback.labels,
      createdAt: feedback.created_at,
    },
  });
});

// POST /api/conversations/:id/feedback — leave or update feedback for a conversation partner
conversations.post("/:id/feedback", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { labels, thumbs } = await c.req.json();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const [conversation] = await db`
    SELECT id, initiator_id, recipient_id
    FROM conversations
    WHERE id = ${id}
  `;

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (conversation.initiator_id !== userId && conversation.recipient_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Check reveal threshold
  const [countRow] = await db`
    SELECT COUNT(*)::int AS count FROM conversation_messages WHERE conversation_id = ${id}
  `;
  if (countRow.count < REVEAL_THRESHOLD) {
    return c.json({ error: "Feedback is only available after 10 messages have been exchanged" }, 400);
  }

  // Check both participants exchanged messages
  const [bothExchanged] = await db`
    SELECT
      EXISTS (SELECT 1 FROM conversation_messages WHERE conversation_id = ${id} AND sender_id = ${conversation.initiator_id}) AS initiator_sent,
      EXISTS (SELECT 1 FROM conversation_messages WHERE conversation_id = ${id} AND sender_id = ${conversation.recipient_id}) AS recipient_sent
  `;
  if (!bothExchanged.initiator_sent || !bothExchanged.recipient_sent) {
    return c.json({ error: "Both participants must have exchanged messages before feedback can be given" }, 400);
  }

  // Validate labels
  const normalizedLabels: string[] = [];
  if (labels && Array.isArray(labels)) {
    for (const label of labels) {
      if (typeof label !== "string") {
        return c.json({ error: "Labels must be strings" }, 400);
      }
      const trimmed = label.trim();
      if (!ALL_LABELS.has(trimmed)) {
        return c.json({ error: `Invalid label: ${trimmed}` }, 400);
      }
      normalizedLabels.push(trimmed);
    }
  }

  // Validate thumbs
  if (thumbs !== undefined && thumbs !== null) {
    if (typeof thumbs !== "number" || !Number.isInteger(thumbs) || thumbs < -2 || thumbs > 2) {
      return c.json({ error: "Thumbs must be an integer between -2 and 2" }, 400);
    }
  }

  const receiverId = conversation.initiator_id === userId
    ? conversation.recipient_id
    : conversation.initiator_id;

  // Upsert: update if exists, insert if not
  const [existingFeedback] = await db`
    SELECT id FROM conversation_feedback
    WHERE conversation_id = ${id} AND giver_id = ${userId}
    LIMIT 1
  `;

  let feedback;
  if (existingFeedback) {
    [feedback] = await db`
      UPDATE conversation_feedback
      SET thumbs = ${thumbs ?? null}, labels = ${formatPgTextArray(normalizedLabels)}, created_at = now()
      WHERE id = ${existingFeedback.id}
      RETURNING id, created_at
    `;
  } else {
    [feedback] = await db`
      INSERT INTO conversation_feedback (conversation_id, giver_id, receiver_id, thumbs, labels)
      VALUES (${id}, ${userId}, ${receiverId}, ${thumbs ?? null}, ${formatPgTextArray(normalizedLabels)})
      RETURNING id, created_at
    `;
  }

  return c.json({
    feedback: {
      id: feedback.id,
      createdAt: feedback.created_at,
    },
  }, existingFeedback ? 200 : 201);
});

export { conversations as conversationsRoutes };
