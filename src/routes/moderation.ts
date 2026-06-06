import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { sendAdminEmail, logAdminEvent } from "../lib/email";
import { validateUUID } from "../lib/validation";

const VALID_REASONS = new Set([
  "Spam",
  "Bots",
  "Harassment",
  "Doxxing",
  "Illegal content",
  "Coordinated abuse",
  "Other",
]);

const VALID_TARGET_TYPES = new Set(["post", "message", "account"]);

const moderation = new Hono<AuthEnv>();

// POST /api/moderation/report — submit a report (authenticated users only)
moderation.post("/report", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { target_type, target_id, reason, details } = await c.req.json();

  if (!target_type || !VALID_TARGET_TYPES.has(target_type)) {
    return c.json({ error: "target_type must be post, message, or account" }, 400);
  }

  if (!target_id || typeof target_id !== "string") {
    return c.json({ error: "target_id is required" }, 400);
  }

  if (!reason || !VALID_REASONS.has(reason)) {
    return c.json({ error: `Invalid reason. Valid reasons: ${[...VALID_REASONS].join(", ")}` }, 400);
  }

  let targetPost = null;
  let targetMessage = null;
  let targetAccount = null;

  // Validate target exists and reporter has visibility
  if (target_type === "post") {
    const validationError = validateUUID(target_id);
    if (validationError) {
      return c.json({ error: "Post not found" }, 404);
    }
    const [post] = await db`SELECT id, title, body FROM posts WHERE id = ${target_id}`;
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }
    targetPost = post;
  } else if (target_type === "message") {
    const validationError = validateUUID(target_id);
    if (validationError) {
      return c.json({ error: "Message not found" }, 404);
    }
    const [message] = await db`
      SELECT m.id, m.body, c.initiator_id, c.recipient_id
      FROM conversation_messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ${target_id}
    `;
    if (!message) {
      return c.json({ error: "Message not found" }, 404);
    }
    // Reporter must be a participant in the conversation
    if (message.initiator_id !== userId && message.recipient_id !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }
    targetMessage = message;
  } else if (target_type === "account") {
    const validationError = validateUUID(target_id);
    if (validationError) {
      return c.json({ error: "User not found" }, 404);
    }
    const [user] = await db`SELECT id, username FROM users WHERE id = ${target_id}`;
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    if (user.id === userId) {
      return c.json({ error: "You cannot report yourself" }, 400);
    }
    targetAccount = user;
  }

  // Prevent duplicate pending reports on the same target by the same user
  const [existing] = await db`
    SELECT id FROM reports
    WHERE reporter_id = ${userId}
      AND target_type = ${target_type}
      AND target_id = ${target_id}
      AND status = 'pending'
    LIMIT 1
  `;

  if (existing) {
    return c.json({ error: "You already have a pending report for this target" }, 409);
  }

  const [report] = await db`
    INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
    VALUES (${userId}, ${target_type}, ${target_id}, ${reason}, ${details || ""})
    RETURNING id, reporter_id, target_type, target_id, reason, details, status, created_at
  `;

  // Notify admins
  const [reporter] = await db`SELECT username FROM users WHERE id = ${userId}`;
  const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";

  let targetInfoText = "";
  let targetInfoHtml = "";

  if (targetPost) {
    const postUrl = `${publicUrl}/posts/${target_id}`;
    targetInfoText = `\nPost Title: ${targetPost.title}\nPost Body:\n${targetPost.body || "(no body)"}\nPost URL: ${postUrl}`;
    targetInfoHtml = `<p><b>Post Title:</b> ${targetPost.title}</p><p><b>Post Body:</b><br><pre>${targetPost.body || "(no body)"}</pre></p><p><b>Post URL:</b> <a href="${postUrl}">${postUrl}</a></p>`;
  } else if (targetMessage) {
    targetInfoText = `\nMessage Body:\n${targetMessage.body || "(no body)"}`;
    targetInfoHtml = `<p><b>Message Body:</b><br><pre>${targetMessage.body || "(no body)"}</pre></p>`;
  } else if (targetAccount) {
    targetInfoText = `\nReported User: ${targetAccount.username}`;
    targetInfoHtml = `<p><b>Reported User:</b> ${targetAccount.username}</p>`;
  }

  const emailText = `A new report has been submitted on fastminds.

Reporter: ${reporter?.username || "Unknown"} (${userId})
Target Type: ${target_type}
Target ID: ${target_id}
Reason: ${reason}
Details: ${details || "None"}
Report ID: ${report.id}${targetInfoText}`;

  const emailHtml = `<p>A new report has been submitted on fastminds.</p>
<p><b>Reporter:</b> ${reporter?.username || "Unknown"} (${userId})<br>
<b>Target Type:</b> ${target_type}<br>
<b>Target ID:</b> ${target_id}<br>
<b>Reason:</b> ${reason}<br>
<b>Details:</b> ${details || "None"}<br>
<b>Report ID:</b> ${report.id}</p>
${targetInfoHtml}`;

  await sendAdminEmail({
    subject: `New report: ${reason} (${target_type})`,
    text: emailText,
    html: emailHtml,
  });
  await logAdminEvent("report:create", emailText);

  return c.json({
    report: {
      id: report.id,
      targetType: report.target_type,
      targetId: report.target_id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.created_at,
    },
  }, 201);
});

// GET /api/moderation/reports — list reports (admin only)
moderation.get("/reports", adminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query("status");
  const targetTypeFilter = c.req.query("target_type");

  let rows;
  let countRow;

  if (statusFilter && targetTypeFilter) {
    rows = await db`
      SELECT
        reports.id,
        reports.reporter_id,
        reports.target_type,
        reports.target_id,
        reports.reason,
        reports.details,
        reports.status,
        reports.created_at,
        users.username AS reporter_username,
        posts.title AS post_title
      FROM reports
      JOIN users ON users.id = reports.reporter_id
      LEFT JOIN posts ON reports.target_type = 'post' AND posts.id = reports.target_id::uuid
      WHERE reports.status = ${statusFilter}
        AND reports.target_type = ${targetTypeFilter}
      ORDER BY reports.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    [countRow] = await db`
      SELECT COUNT(*)::int AS total FROM reports
      WHERE status = ${statusFilter} AND target_type = ${targetTypeFilter}
    `;
  } else if (statusFilter) {
    rows = await db`
      SELECT
        reports.id,
        reports.reporter_id,
        reports.target_type,
        reports.target_id,
        reports.reason,
        reports.details,
        reports.status,
        reports.created_at,
        users.username AS reporter_username,
        posts.title AS post_title
      FROM reports
      JOIN users ON users.id = reports.reporter_id
      LEFT JOIN posts ON reports.target_type = 'post' AND posts.id = reports.target_id::uuid
      WHERE reports.status = ${statusFilter}
      ORDER BY reports.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    [countRow] = await db`
      SELECT COUNT(*)::int AS total FROM reports WHERE status = ${statusFilter}
    `;
  } else if (targetTypeFilter) {
    rows = await db`
      SELECT
        reports.id,
        reports.reporter_id,
        reports.target_type,
        reports.target_id,
        reports.reason,
        reports.details,
        reports.status,
        reports.created_at,
        users.username AS reporter_username,
        posts.title AS post_title
      FROM reports
      JOIN users ON users.id = reports.reporter_id
      LEFT JOIN posts ON reports.target_type = 'post' AND posts.id = reports.target_id::uuid
      WHERE reports.target_type = ${targetTypeFilter}
      ORDER BY reports.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    [countRow] = await db`
      SELECT COUNT(*)::int AS total FROM reports WHERE target_type = ${targetTypeFilter}
    `;
  } else {
    rows = await db`
      SELECT
        reports.id,
        reports.reporter_id,
        reports.target_type,
        reports.target_id,
        reports.reason,
        reports.details,
        reports.status,
        reports.created_at,
        users.username AS reporter_username,
        posts.title AS post_title
      FROM reports
      JOIN users ON users.id = reports.reporter_id
      LEFT JOIN posts ON reports.target_type = 'post' AND posts.id = reports.target_id::uuid
      ORDER BY reports.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    [countRow] = await db`SELECT COUNT(*)::int AS total FROM reports`;
  }

  const reports = rows.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    reporterUsername: r.reporter_username,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    postTitle: r.post_title,
    createdAt: r.created_at,
  }));

  return c.json({
    reports,
    page,
    limit,
    total: countRow.total,
  });
});

// POST /api/moderation/reports/:id/resolve — resolve a report (admin only)
moderation.post("/reports/:id/resolve", adminMiddleware, async (c) => {
  const moderatorId = c.get("userId");
  const id = c.req.param("id");
  const { action_type, note } = await c.req.json();

  const validationError = validateUUID(id);
  if (validationError) {
    return c.json({ error: "Report not found" }, 404);
  }

  if (!action_type) {
    return c.json({ error: "action_type is required" }, 400);
  }

  const VALID_ACTIONS = new Set([
    "warning",
    "suspend",
    "ban",
    "content_removed",
    "content_hidden",
    "no_action",
  ]);

  if (!VALID_ACTIONS.has(action_type)) {
    return c.json({ error: "Invalid action_type" }, 400);
  }

  const [report] = await db`
    SELECT id, status FROM reports WHERE id = ${id}
  `;

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  if (report.status !== "pending") {
    return c.json({ error: "Report is already resolved" }, 400);
  }

  await db`
    UPDATE reports SET status = 'resolved' WHERE id = ${id}
  `;

  const [action] = await db`
    INSERT INTO moderation_actions (report_id, moderator_id, action_type, note)
    VALUES (${id}, ${moderatorId}, ${action_type}, ${note || ""})
    RETURNING id, report_id, action_type, note, created_at
  `;

  const emailText = `A moderation report has been resolved.

Report ID: ${id}
Action: ${action_type}
Note: ${note || "None"}
Moderator ID: ${moderatorId}`;

  await sendAdminEmail({
    subject: `Report resolved: ${action_type}`,
    text: emailText,
  });
  await logAdminEvent("report:resolve", emailText);

  return c.json({
    action: {
      id: action.id,
      reportId: action.report_id,
      actionType: action.action_type,
      note: action.note,
      createdAt: action.created_at,
    },
  });
});

export { moderation as moderationRoutes };
