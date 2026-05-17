import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

const posts = new Hono();

posts.get("/", async (c) => {
  const rows = await db`
    SELECT posts.id, posts.title, posts.body, posts.score, posts.created_at,
           users.username AS author
    FROM posts
    JOIN users ON posts.author_id = users.id
    ORDER BY posts.created_at DESC
  `;
  return c.json({ posts: rows });
});

posts.get("/:id", async (c) => {
  const id = c.req.param("id");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT posts.id, posts.title, posts.body, posts.score, posts.created_at,
           users.username AS author
    FROM posts
    JOIN users ON posts.author_id = users.id
    WHERE posts.id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ post });
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

  const [user] = await db`
    SELECT username FROM users WHERE id = ${userId}
  `;

  return c.json({
    post: { ...post, author: user.username },
  }, 201);
});

export { posts as postsRoutes };
