import { verify } from "hono/jwt";
import { db, generateUUID } from "../db";
import { sendEmail } from "../lib/email";
import type { Server, ServerWebSocket } from "bun";

export type MessageSocketData = {
  userId: string;
  username: string;
};

type MessageEvent =
  | {
      type: "conversation:message:new";
      message: {
        id: string;
        body: string;
        created_at: string;
        senderId: string;
        conversationId: string;
        replyTo: string | null;
      };
    }
  | {
      type: "notification:new";
      notification: {
        id: string;
        type: string;
        body: string;
        href: string;
        read_at: string | null;
        created_at: string;
        actor: string | null;
      };
    }
  | {
      type: "error";
      error: string;
    };

const socketsByUserId = new Map<string, Set<ServerWebSocket<MessageSocketData>>>();

function send(ws: ServerWebSocket<MessageSocketData>, payload: MessageEvent) {
  ws.send(JSON.stringify(payload));
}

function sendToUsers(userIds: string[], payload: MessageEvent) {
  const delivered = new Set<ServerWebSocket<MessageSocketData>>();

  for (const userId of userIds) {
    for (const socket of socketsByUserId.get(userId) ?? []) {
      if (delivered.has(socket)) continue;
      delivered.add(socket);
      send(socket, payload);
    }
  }
}

export async function upgradeMessagesWebSocket(req: Request, server: Server<MessageSocketData>) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 401 });
  }

  try {
    const payload = await verify(token, process.env.JWT_SECRET!, "HS256");
    const userId = payload.sub;

    if (typeof userId !== "string") {
      return new Response("Invalid token", { status: 401 });
    }

    const [user] = await db`
      SELECT id, username
      FROM users
      WHERE id = ${userId}
    `;

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    if (server.upgrade(req, {
      data: {
        userId: user.id,
        username: user.username,
      },
    })) {
      return;
    }

    return new Response("WebSocket upgrade failed", { status: 400 });
  } catch {
    return new Response("Invalid token", { status: 401 });
  }
}

export const messageWebSocketHandler = {
  data: {} as MessageSocketData,

  open(ws: ServerWebSocket<MessageSocketData>) {
    const sockets = socketsByUserId.get(ws.data.userId) ?? new Set();
    sockets.add(ws);
    socketsByUserId.set(ws.data.userId, sockets);
  },

  async message(ws: ServerWebSocket<MessageSocketData>, rawMessage: string | Buffer) {
    let payload: unknown;

    try {
      const text = typeof rawMessage === "string"
        ? rawMessage
        : new TextDecoder().decode(rawMessage);
      payload = JSON.parse(text);
    } catch {
      send(ws, { type: "error", error: "Invalid message payload" });
      return;
    }

    if (!payload || typeof payload !== "object" || !("type" in payload)) {
      send(ws, { type: "error", error: "Invalid message payload" });
      return;
    }

    if (payload.type === "conversation:message:create") {
      if (
        !("conversationId" in payload) ||
        typeof payload.conversationId !== "string" ||
        !("body" in payload) ||
        typeof payload.body !== "string" ||
        ("replyTo" in payload && payload.replyTo !== undefined && payload.replyTo !== null && typeof payload.replyTo !== "string")
      ) {
        send(ws, { type: "error", error: "Invalid message payload" });
        return;
      }

      const body = payload.body.trim();
      const conversationId = payload.conversationId.trim();
      const replyTo = payload.replyTo?.trim() || null;

      if (!body) {
        send(ws, { type: "error", error: "Message cannot be empty" });
        return;
      }

      if (body.length > 4000) {
        send(ws, { type: "error", error: "Message is too long" });
        return;
      }

      if (!conversationId) {
        send(ws, { type: "error", error: "Conversation ID is required" });
        return;
      }

      const [conversation] = await db`
        SELECT initiator_id, recipient_id
        FROM conversations
        WHERE id = ${conversationId}
      `;

      if (!conversation) {
        send(ws, { type: "error", error: "Conversation not found" });
        return;
      }

      if (conversation.initiator_id !== ws.data.userId && conversation.recipient_id !== ws.data.userId) {
        send(ws, { type: "error", error: "Forbidden" });
        return;
      }

      // Validate replyTo if provided
      if (replyTo) {
        const [replyTarget] = await db`
          SELECT id FROM conversation_messages
          WHERE id = ${replyTo} AND conversation_id = ${conversationId}
          LIMIT 1
        `;
        if (!replyTarget) {
          send(ws, { type: "error", error: "Reply target message not found" });
          return;
        }
      }

      const messageId = generateUUID();
      const [message] = await db`
        INSERT INTO conversation_messages (id, conversation_id, sender_id, body, reply_to_message_id)
        VALUES (${messageId}, ${conversationId}, ${ws.data.userId}, ${body}, ${replyTo})
        RETURNING id, conversation_id, sender_id, body, created_at, reply_to_message_id
      `;

      const otherUserId = conversation.initiator_id === ws.data.userId
        ? conversation.recipient_id
        : conversation.initiator_id;

      const notificationId = generateUUID();
      const [notification] = await db`
        INSERT INTO notifications (id, user_id, actor_id, type, body, href)
        VALUES (
          ${notificationId},
          ${otherUserId},
          ${ws.data.userId},
          ${"conversation:message"},
          ${"New message in a conversation"},
          ${`/conversations/${conversationId}`}
        )
        RETURNING id, type, body, href, read_at, created_at
      `;

      sendToUsers([ws.data.userId, otherUserId], {
        type: "conversation:message:new",
        message: {
          id: message.id,
          body: message.body,
          created_at: message.created_at,
          senderId: message.sender_id,
          conversationId: message.conversation_id,
          replyTo: message.reply_to_message_id || null,
        },
      });

      sendToUsers([otherUserId], {
        type: "notification:new",
        notification: {
          ...notification,
          actor: ws.data.username,
        },
      });

      // Send email notification to the other user
      const [recipient] = await db`
        SELECT email, email_verified, email_new_message FROM users WHERE id = ${otherUserId}
      `;
      if (recipient?.email && recipient?.email_verified && recipient?.email_new_message) {
        const appUrl = process.env.APP_URL || process.env.PUBLIC_URL || "http://localhost:3000";
        const conversationUrl = `${appUrl}/conversations/${conversationId}`;
        await sendEmail({
          to: recipient.email,
          subject: "New message on fastminds",
          text: `You have a new message in a conversation.\n\nView it here: ${conversationUrl}`,
          html: `<p>You have a new message in a conversation.</p><p><a href="${conversationUrl}">View conversation</a></p>`,
        });
      }

      return;
    }

    send(ws, { type: "error", error: "Unknown message type" });
  },

  close(ws: ServerWebSocket<MessageSocketData>) {
    const sockets = socketsByUserId.get(ws.data.userId);
    if (!sockets) return;

    sockets.delete(ws);
    if (sockets.size === 0) {
      socketsByUserId.delete(ws.data.userId);
    }
  },
};
