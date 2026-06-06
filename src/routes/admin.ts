import { Hono } from "hono";
import { db } from "../db";
import { adminMiddleware } from "../middleware/admin";
import type { AuthEnv } from "../middleware/auth";
import { validateUUID } from "../lib/validation";
import { sendEmail } from "../lib/email";

const admin = new Hono<AuthEnv>();

// GET /api/admin/users — list all users (admin only)
admin.get("/users", adminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await db`
    SELECT
      id,
      username,
      email,
      email_verified,
      payment_verified,
      is_admin,
      created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await db`SELECT COUNT(*) AS total FROM users`;

  const users = rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerified: row.email_verified,
    paymentVerified: row.payment_verified,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
  }));

  return c.json({
    users,
    page,
    limit,
    total: countRow.total,
  });
});

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

// POST /api/admin/test-email — send a test notification email (admin only)
admin.post("/test-email", adminMiddleware, async (c) => {
  const { template, to, variables } = await c.req.json();

  if (!template || !to) {
    return c.json({ error: "template and to are required" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  const appUrl = process.env.APP_URL || process.env.PUBLIC_URL || "http://localhost:3000";

  let subject: string;
  let text: string;
  let html: string;

  if (template === "new_conversation") {
    const conversationUrl = variables?.conversationUrl || `${appUrl}/conversations/123`;
    subject = "Someone responded to your post on fastminds";
    text = `Someone started a conversation on your post.\n\nView it here: ${conversationUrl}`;
    html = `<p>Someone started a conversation on your post.</p><p><a href="${conversationUrl}">View conversation</a></p>`;
  } else if (template === "new_message") {
    const conversationUrl = variables?.conversationUrl || `${appUrl}/conversations/123`;
    subject = "New message on fastminds";
    text = `You have a new message in a conversation.\n\nView it here: ${conversationUrl}`;
    html = `<p>You have a new message in a conversation.</p><p><a href="${conversationUrl}">View conversation</a></p>`;
  } else if (template === "new_post") {
    const postTitle = variables?.postTitle || "Test post";
    const postBody = variables?.postBody || "This is a test post body.";
    const postUrl = variables?.postUrl || `${appUrl}/posts/123`;
    const author = variables?.author || "testuser";
    subject = `New post on fastminds: ${postTitle}`;
    text = `A new post has been published on fastminds.\n\nTitle: ${postTitle}\nBody: ${postBody}\nPost URL: ${postUrl}\nAuthor: ${author}`;
    html = `<p>A new post has been published on fastminds.</p>
<p><b>Title:</b> ${postTitle}</p>
<p><b>Body:</b><br><pre>${postBody}</pre></p>
<p><b>Post URL:</b> <a href="${postUrl}">${postUrl}</a></p>
<p><b>Author:</b> ${author}</p>`;
  } else {
    return c.json({ error: "Invalid template" }, 400);
  }

  await sendEmail({ to, subject, text, html });

  return c.json({ success: true });
});

export { admin as adminRoutes };
