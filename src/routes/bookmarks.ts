import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const bookmarks = new Hono<AuthEnv>();

bookmarks.use("*", authMiddleware);

// GET /api/bookmarks — list current user's bookmarks
bookmarks.get("/", async (c) => {
  const userId = c.get("userId");

  const rows = await db`
    SELECT
      bookmarks.id AS bookmark_id,
      bookmarks.created_at AS bookmarked_at,
      posts.id,
      posts.title,
      posts.body,
      posts.author_id,
      posts.archived_at,
      posts.created_at
    FROM bookmarks
    JOIN posts ON bookmarks.post_id = posts.id
    WHERE bookmarks.user_id = ${userId}
    ORDER BY bookmarks.created_at DESC
  `;

  return c.json({ bookmarks: rows });
});

// POST /api/bookmarks — bookmark a post
bookmarks.post("/", async (c) => {
  const userId = c.get("userId");
  const { postId } = await c.req.json();

  if (!postId || typeof postId !== "string") {
    return c.json({ error: "postId is required" }, 400);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id FROM posts WHERE id = ${postId}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  try {
    const [bookmark] = await db`
      INSERT INTO bookmarks (user_id, post_id)
      VALUES (${userId}, ${postId})
      RETURNING id, post_id, created_at
    `;
    return c.json({ bookmark }, 201);
  } catch (err: any) {
    if (err.errno === "23505" || err.code === "23505") {
      return c.json({ error: "Post is already bookmarked" }, 409);
    }
    throw err;
  }
});

// DELETE /api/bookmarks/:postId — remove a bookmark
bookmarks.delete("/:postId", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("postId");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const result = await db`
    DELETE FROM bookmarks
    WHERE user_id = ${userId} AND post_id = ${postId}
  `;

  if (result.count === 0) {
    return c.json({ error: "Bookmark not found" }, 404);
  }

  return c.json({ ok: true });
});

export { bookmarks as bookmarksRoutes };
