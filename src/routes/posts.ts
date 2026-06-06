import { Hono } from "hono";
import { verify } from "hono/jwt";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const posts = new Hono<AuthEnv>();

async function optionalUserId(c: any): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET!;
    const payload = await verify(token, secret, "HS256");
    return payload.sub as string;
  } catch {
    return null;
  }
}

posts.get("/", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await db`
    SELECT posts.id, posts.title, posts.body, posts.author_id, posts.score, posts.archived_at, posts.created_at
    FROM posts
    ORDER BY posts.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await db`
    SELECT COUNT(*)::int AS total FROM posts
  `;

  return c.json({
    posts: rows,
    page,
    limit,
    total: countRow.total,
  });
});

posts.get("/:id", async (c) => {
  const id = c.req.param("id");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT posts.id, posts.title, posts.body, posts.author_id, posts.score, posts.archived_at, posts.created_at
    FROM posts
    WHERE posts.id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [conversationCount] = await db`
    SELECT COUNT(*)::int AS count FROM conversations WHERE post_id = ${id}
  `;

  const userId = await optionalUserId(c);
  let hasStartedConversation = false;
  let conversationId = null;

  if (userId) {
    const [existing] = await db`
      SELECT id FROM conversations
      WHERE post_id = ${id} AND initiator_id = ${userId}
      LIMIT 1
    `;
    if (existing) {
      hasStartedConversation = true;
      conversationId = existing.id;
    }
  }

  return c.json({
    post: {
      ...post,
      conversationCount: conversationCount.count,
      hasStartedConversation,
      conversationId,
    },
  });
});

posts.post("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { title, body } = await c.req.json();

  if (!title || !title.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }

  const [post] = await db`
    INSERT INTO posts (title, body, author_id)
    VALUES (${title.trim()}, ${body || ""}, ${userId})
    RETURNING id, title, body, score, created_at
  `;

  return c.json({ post }, 201);
});

// GET /api/posts/:id/updates
posts.get("/:id/updates", async (c) => {
  const id = c.req.param("id");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const updates = await db`
    SELECT id, body, created_at
    FROM post_updates
    WHERE post_id = ${id}
    ORDER BY created_at ASC
  `;

  return c.json({ updates });
});

// POST /api/posts/:id/updates — append an update (author only)
posts.post("/:id/updates", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { body } = await c.req.json();

  if (!body || !body.trim()) {
    return c.json({ error: "Update body is required" }, 400);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id, author_id FROM posts WHERE id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.author_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [update] = await db`
    INSERT INTO post_updates (post_id, body)
    VALUES (${id}, ${body.trim()})
    RETURNING id, body, created_at
  `;

  // Notify all users who participated in conversations on this post
  const participants = await db`
    SELECT DISTINCT user_id FROM (
      SELECT initiator_id AS user_id FROM conversations
      WHERE post_id = ${id} AND initiator_id <> ${userId}
      UNION
      SELECT recipient_id AS user_id FROM conversations
      WHERE post_id = ${id} AND recipient_id <> ${userId}
    ) sub
  `;

  for (const p of participants) {
    if (p.user_id) {
      await db`
        INSERT INTO notifications (user_id, actor_id, type, body, href)
        VALUES (
          ${p.user_id},
          ${userId},
          ${"post:update"},
          ${"A post you participated in has been updated"},
          ${`/posts/${id}`}
        )
      `;
    }
  }

  return c.json({ update }, 201);
});

export { posts as postsRoutes };
