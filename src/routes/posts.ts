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
