import { Hono } from "hono";
import { db, generateUUID } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { validateUUID } from "../lib/validation";

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
      posts.archived_at,
      posts.created_at,
      posts.author_id = ${userId} AS is_mine
    FROM bookmarks
    JOIN posts ON bookmarks.post_id = posts.id
    WHERE bookmarks.user_id = ${userId}
    ORDER BY bookmarks.created_at DESC
  `;

  const bookmarks = rows.map((r) => {
    const { is_mine, ...rest } = r;
    return { ...rest, isMine: is_mine };
  });

  return c.json({ bookmarks });
});

// POST /api/bookmarks — bookmark a post
bookmarks.post("/", async (c) => {
  const userId = c.get("userId");
  const { postId } = await c.req.json();

  if (!postId || typeof postId !== "string") {
    return c.json({ error: "postId is required" }, 400);
  }

  const validationError = validateUUID(postId);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id FROM posts WHERE id = ${postId}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  try {
    const bookmarkId = generateUUID();
    const [bookmark] = await db`
      INSERT INTO bookmarks (id, user_id, post_id)
      VALUES (${bookmarkId}, ${userId}, ${postId})
      RETURNING id, post_id, created_at
    `;
    return c.json({ bookmark }, 201);
  } catch (err: any) {
    if (
      err.errno === "23505" ||
      err.code === "23505" ||
      err.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      (err.message && err.message.includes("UNIQUE constraint failed"))
    ) {
      return c.json({ error: "Post is already bookmarked" }, 409);
    }
    throw err;
  }
});

// DELETE /api/bookmarks/:postId — remove a bookmark
bookmarks.delete("/:postId", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("postId");

  const validationError = validateUUID(postId);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const result = await db`
    DELETE FROM bookmarks
    WHERE user_id = ${userId} AND post_id = ${postId}
  `;

  if (result.count === 0) {
    return c.json({ error: "Bookmark not found" }, 404);
  }

  return c.json({ success: true });
});

export { bookmarks as bookmarksRoutes };
