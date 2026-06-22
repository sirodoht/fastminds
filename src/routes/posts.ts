import { Hono } from "hono";
import { db, generateUUID } from "../db";
import { authMiddleware, optionalAuthMiddleware, verifiedEmailMiddleware, type AuthEnv } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { sendEmail, sendAdminEmail, logAdminEvent } from "../lib/email";
import { validateUUID } from "../lib/validation";
import { generatePostInsight } from "../lib/openai";

const posts = new Hono<AuthEnv>();

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanComposerAnswer(value: unknown) {
  const text = cleanText(value);
  if (text === "I'm asking this because ...") return "";
  if (text === "It would be surprising to hear ...") return "";
  return text;
}

function hasStructuredComposerPayload(payload: any) {
  return (
    "question" in payload ||
    "whyAsking" in payload ||
    "responseHopingFor" in payload ||
    "goodConversation" in payload
  );
}

function validateStructuredComposerPayload(payload: any) {
  const question = cleanText(payload.question);
  const whyAsking = cleanComposerAnswer(payload.whyAsking);
  const responseHopingFor = cleanComposerAnswer(payload.responseHopingFor);
  const goodConversation = cleanComposerAnswer(payload.goodConversation);

  if (!question) return { error: "Question is required" };
  if (question.length > 112) return { error: "Question must be 112 characters or fewer" };

  const answers = [whyAsking, responseHopingFor, goodConversation].filter(Boolean);

  return {
    title: question,
    body: answers.join("\n\n"),
  };
}

async function generateAndSavePostInsight(post: { id: string; title: string; body?: string | null }) {
  const generated = await generatePostInsight({
    title: post.title,
    body: post.body || "",
  });

  const [saved] = await db`
    INSERT INTO post_ai_insights (post_id, model, insight)
    VALUES (${post.id}, ${generated.model}, ${generated.insight})
    ON CONFLICT(post_id) DO UPDATE SET
      model = excluded.model,
      insight = excluded.insight,
      created_at = datetime('now')
    RETURNING insight, model, created_at
  `;

  return saved;
}

posts.get("/", optionalAuthMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const userId = c.get("userId");

  let rows;
  if (userId) {
    rows = await db`
      SELECT
        posts.id,
        posts.title,
        posts.body,
        posts.archived_at,
        posts.created_at,
        posts.author_id = ${userId} AS is_mine,
        EXISTS (
          SELECT 1 FROM bookmarks
          WHERE bookmarks.user_id = ${userId} AND bookmarks.post_id = posts.id
        ) AS is_bookmarked
      FROM posts
      WHERE posts.archived_at IS NULL
      ORDER BY posts.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    rows = await db`
      SELECT posts.id, posts.title, posts.body, posts.archived_at, posts.created_at, FALSE AS is_mine
      FROM posts
      WHERE posts.archived_at IS NULL
      ORDER BY posts.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  const [countRow] = await db`
    SELECT COUNT(*) AS total FROM posts WHERE archived_at IS NULL
  `;

  const posts = rows.map((r) => {
    const { is_mine, is_bookmarked, ...rest } = r;
    return {
      ...rest,
      isMine: is_mine,
      isBookmarked: is_bookmarked,
    };
  });

  return c.json({
    posts,
    page,
    limit,
    total: countRow.total,
  });
});

posts.get("/:id", optionalAuthMiddleware, async (c) => {
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT posts.id, posts.title, posts.body, posts.author_id, posts.archived_at, posts.created_at
    FROM posts
    WHERE posts.id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  const userId = c.get("userId");
  let hasStartedConversation = false;
  let conversationId = null;
  let isBookmarked = false;

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

    const [bookmark] = await db`
      SELECT 1 FROM bookmarks
      WHERE user_id = ${userId} AND post_id = ${id}
      LIMIT 1
    `;
    if (bookmark) {
      isBookmarked = true;
    }
  }

  const { author_id, ...rest } = post;

  return c.json({
    post: {
      ...rest,
      isMine: userId ? author_id === userId : false,
      hasStartedConversation,
      conversationId,
      isBookmarked,
    },
  });
});

posts.get("/:id/insight", async (c) => {
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id, title, body
    FROM posts
    WHERE id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [cached] = await db`
    SELECT insight, model, created_at
    FROM post_ai_insights
    WHERE post_id = ${id}
  `;

  if (cached) {
    return c.json({
      insight: cached.insight,
      model: cached.model,
      createdAt: cached.created_at,
      cached: true,
    });
  }

  try {
    const saved = await generateAndSavePostInsight(post);

    return c.json({
      insight: saved.insight,
      model: saved.model,
      createdAt: saved.created_at,
      cached: false,
    });
  } catch (err) {
    console.error("Failed to generate post insight", err);
    return c.json({ error: "AI insight is unavailable" }, 503);
  }
});

posts.post("/:id/insight/refresh", adminMiddleware, async (c) => {
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id, title, body
    FROM posts
    WHERE id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  try {
    const saved = await generateAndSavePostInsight(post);

    return c.json({
      insight: saved.insight,
      model: saved.model,
      createdAt: saved.created_at,
      cached: false,
    });
  } catch (err) {
    console.error("Failed to refresh post insight", err);
    return c.json({ error: "AI insight is unavailable" }, 503);
  }
});

posts.put("/:id/insight", adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const { insight } = await c.req.json();

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (!insight || !insight.trim()) {
    return c.json({ error: "Insight is required" }, 400);
  }

  const trimmedInsight = insight.trim();
  if (trimmedInsight.length > 1000) {
    return c.json({ error: "Insight must be 1000 characters or fewer" }, 400);
  }

  const [post] = await db`
    SELECT id
    FROM posts
    WHERE id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL || "gpt-5.5";
  const [saved] = await db`
    INSERT INTO post_ai_insights (post_id, model, insight)
    VALUES (${id}, ${model}, ${trimmedInsight})
    ON CONFLICT(post_id) DO UPDATE SET
      insight = excluded.insight,
      created_at = datetime('now')
    RETURNING insight, model, created_at
  `;

  return c.json({
    insight: saved.insight,
    model: saved.model,
    createdAt: saved.created_at,
    cached: false,
  });
});

posts.post("/", authMiddleware, verifiedEmailMiddleware, async (c) => {
  const userId = c.get("userId");
  const payload = await c.req.json();
  let title = cleanText(payload.title);
  let body = cleanText(payload.body);

  if (hasStructuredComposerPayload(payload)) {
    const structured = validateStructuredComposerPayload(payload);
    if ("error" in structured) {
      return c.json({ error: structured.error }, 400);
    }
    title = structured.title;
    body = structured.body;
  }

  if (!title || !title.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }

  if (title.trim().length > 112) {
    return c.json({ error: "Title must be 112 characters or fewer" }, 400);
  }

  const postId = generateUUID();
  const [post] = await db`
    INSERT INTO posts (id, title, body, author_id)
    VALUES (${postId}, ${title.trim()}, ${body}, ${userId})
    RETURNING id, title, body, created_at
  `;

  const [author] = await db`
    SELECT username FROM users WHERE id = ${userId}
  `;

  const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
  const postUrl = `${publicUrl}/posts/${post.id}`;

  const emailText = `A new post has been published on fastminds.\n\nTitle: ${post.title}\nBody: ${post.body}\nPost URL: ${postUrl}\nAuthor: ${author.username}`;
  const emailHtml = `<p>A new post has been published on fastminds.</p>
<p><b>Title:</b> ${post.title}</p>
<p><b>Body:</b><br><pre>${post.body}</pre></p>
<p><b>Post URL:</b> <a href="${postUrl}">${postUrl}</a></p>
<p><b>Author:</b> ${author.username}</p>`;

  await sendAdminEmail({
    subject: `New post: ${post.title}`,
    text: emailText,
    html: emailHtml,
  });
  await logAdminEvent("post:create", emailText);

  // Send email to users who opted in to new post notifications
  const subscribers = await db`
    SELECT email FROM users
    WHERE email_verified = TRUE AND email_new_post = TRUE AND id <> ${userId}
  `;
  for (const subscriber of subscribers) {
    if (subscriber.email) {
      await sendEmail({
        to: subscriber.email,
        subject: `New post on fastminds: ${post.title}`,
        text: emailText,
        html: emailHtml,
      });
    }
  }

  return c.json({ post }, 201);
});

// GET /api/posts/:id/updates
posts.get("/:id/updates", async (c) => {
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
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
posts.post("/:id/updates", authMiddleware, verifiedEmailMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { body } = await c.req.json();

  if (!body || !body.trim()) {
    return c.json({ error: "Update body is required" }, 400);
  }

  const validationError = validateUUID(id);
  if (validationError) {
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

  const updateId = generateUUID();
  const [update] = await db`
    INSERT INTO post_updates (id, post_id, body)
    VALUES (${updateId}, ${id}, ${body.trim()})
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
      const notificationId = generateUUID();
      await db`
        INSERT INTO notifications (id, user_id, actor_id, type, body, href)
        VALUES (
          ${notificationId},
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

// POST /api/posts/:id/archive — archive a post (author only)
posts.post("/:id/archive", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id, author_id, archived_at FROM posts WHERE id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.author_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (post.archived_at) {
    return c.json({ error: "Post is already archived" }, 400);
  }

  const [updated] = await db`
    UPDATE posts SET archived_at = datetime('now') WHERE id = ${id}
    RETURNING id, archived_at
  `;

  return c.json({ post: { id: updated.id, archivedAt: updated.archived_at } });
});

// POST /api/posts/:id/unarchive — unarchive a post (author only)
posts.post("/:id/unarchive", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Post not found" }, 404);
  }

  const [post] = await db`
    SELECT id, author_id, archived_at FROM posts WHERE id = ${id}
  `;

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.author_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!post.archived_at) {
    return c.json({ error: "Post is not archived" }, 400);
  }

  const [updated] = await db`
    UPDATE posts SET archived_at = NULL WHERE id = ${id}
    RETURNING id, archived_at
  `;

  return c.json({ post: { id: updated.id, archivedAt: updated.archived_at } });
});

export { posts as postsRoutes };
