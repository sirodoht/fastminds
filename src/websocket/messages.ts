import { verify } from "hono/jwt";
import { db } from "../db";
import type { Server, ServerWebSocket } from "bun";

export type MessageSocketData = {
  userId: string;
  username: string;
};

type MessageEvent =
  | {
      type: "message:new";
      message: {
        id: string;
        body: string;
        created_at: string;
        sender: string;
        recipient: string;
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

    if (
      !payload ||
      typeof payload !== "object" ||
      !("type" in payload) ||
      payload.type !== "message:create" ||
      !("recipientUsername" in payload) ||
      typeof payload.recipientUsername !== "string" ||
      !("body" in payload) ||
      typeof payload.body !== "string"
    ) {
      send(ws, { type: "error", error: "Invalid message payload" });
      return;
    }

    const body = payload.body.trim();
    const recipientUsername = payload.recipientUsername.trim();

    if (!body) {
      send(ws, { type: "error", error: "Message cannot be empty" });
      return;
    }

    if (body.length > 4000) {
      send(ws, { type: "error", error: "Message is too long" });
      return;
    }

    if (!recipientUsername) {
      send(ws, { type: "error", error: "Recipient is required" });
      return;
    }

    const [recipient] = await db`
      SELECT id, username
      FROM users
      WHERE username = ${recipientUsername}
    `;

    if (!recipient) {
      send(ws, { type: "error", error: "Recipient not found" });
      return;
    }

    if (recipient.id === ws.data.userId) {
      send(ws, { type: "error", error: "You cannot message yourself" });
      return;
    }

    const [message] = await db`
      INSERT INTO direct_messages (sender_id, recipient_id, body)
      VALUES (${ws.data.userId}, ${recipient.id}, ${body})
      RETURNING id, body, created_at
    `;

    sendToUsers([ws.data.userId, recipient.id], {
      type: "message:new",
      message: {
        ...message,
        sender: ws.data.username,
        recipient: recipient.username,
      },
    });
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
