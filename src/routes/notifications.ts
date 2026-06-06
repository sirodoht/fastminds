import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const notifications = new Hono<AuthEnv>();

notifications.use("*", authMiddleware);

notifications.get("/", async (c) => {
  const userId = c.get("userId");

  const rows = await db`
    SELECT
      notifications.id,
      notifications.type,
      notifications.body,
      notifications.href,
      notifications.read_at,
      notifications.created_at,
      actor.username AS actor
    FROM notifications
    LEFT JOIN users AS actor ON notifications.actor_id = actor.id
    WHERE notifications.user_id = ${userId}
    ORDER BY notifications.created_at DESC
    LIMIT 50
  `;

  const [count] = await db`
    SELECT COUNT(*)::int AS unread_count
    FROM notifications
    WHERE user_id = ${userId}
      AND read_at IS NULL
  `;

  return c.json({
    notifications: rows,
    unreadCount: count.unread_count,
  });
});

notifications.get("/unread-count", async (c) => {
  const userId = c.get("userId");

  const [count] = await db`
    SELECT COUNT(*)::int AS unread_count
    FROM notifications
    WHERE user_id = ${userId}
      AND read_at IS NULL
  `;

  return c.json({ unreadCount: count.unread_count });
});

notifications.post("/read-all", async (c) => {
  const userId = c.get("userId");

  await db`
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = ${userId}
      AND read_at IS NULL
  `;

  return c.json({ success: true, unreadCount: 0 });
});

export { notifications as notificationsRoutes };
