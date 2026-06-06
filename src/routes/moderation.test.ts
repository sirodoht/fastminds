import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../db";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";

const TEST_PORT = 3459;

async function createUser(username: string, isAdmin = false) {
  const passwordHash = await Bun.password.hash("password123");
  const [user] = await db`
    INSERT INTO users (username, password_hash, email_verified, is_admin)
    VALUES (${username}, ${passwordHash}, TRUE, ${isAdmin})
    RETURNING id, username, is_admin
  `;
  return user;
}

async function createPost(title: string, body: string, authorId: string) {
  const [post] = await db`
    INSERT INTO posts (title, body, author_id)
    VALUES (${title}, ${body}, ${authorId})
    RETURNING id, title, body, author_id
  `;
  return post;
}

async function login(username: string) {
  const res = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return res.json();
}

async function api(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`http://localhost:${TEST_PORT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe("Moderation", () => {
  let server: any;
  let user: { id: string; username: string };
  let admin: { id: string; username: string };
  let otherUser: { id: string; username: string };
  let post: { id: string };
  let token: string;
  let adminToken: string;
  let otherToken: string;

  beforeAll(async () => {
    const { default: serverConfig } = await import("../index");
    server = Bun.serve({ ...serverConfig, port: TEST_PORT });
    await new Promise((r) => setTimeout(r, 500));

    // Clean test data
    await db`DELETE FROM moderation_actions WHERE report_id IN (SELECT id FROM reports WHERE reporter_id IN (SELECT id FROM users WHERE username LIKE 'modtest_%'))`;
    await db`DELETE FROM reports WHERE reporter_id IN (SELECT id FROM users WHERE username LIKE 'modtest_%')`;
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'MODTEST %'))`;
    await db`DELETE FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'MODTEST %')`;
    await db`DELETE FROM posts WHERE title LIKE 'MODTEST %'`;
    await db`DELETE FROM users WHERE username LIKE 'modtest_%'`;

    user = await createUser("modtest_user");
    admin = await createUser("modtest_admin", true);
    otherUser = await createUser("modtest_other");

    token = (await login("modtest_user")).token;
    adminToken = (await login("modtest_admin")).token;
    otherToken = (await login("modtest_other")).token;

    post = await createPost("MODTEST Post", "This is a test post.", otherUser.id);
  });

  afterAll(async () => {
    await db`DELETE FROM moderation_actions WHERE report_id IN (SELECT id FROM reports WHERE reporter_id IN (${user.id}, ${admin.id}, ${otherUser.id}))`;
    await db`DELETE FROM reports WHERE reporter_id IN (${user.id}, ${admin.id}, ${otherUser.id})`;
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id = ${post.id})`;
    await db`DELETE FROM conversations WHERE post_id = ${post.id}`;
    await db`DELETE FROM posts WHERE id = ${post.id}`;
    await db`DELETE FROM users WHERE id IN (${user.id}, ${admin.id}, ${otherUser.id})`;
    server.stop(true);
  });

  test("POST /api/moderation/report — reports a post", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "post",
        target_id: post.id,
        reason: "Spam",
        details: "This post is spam.",
      }),
    });

    expect(status).toBe(201);
    expect(body.report).toBeDefined();
    expect(body.report.targetType).toBe("post");
    expect(body.report.targetId).toBe(post.id);
    expect(body.report.reason).toBe("Spam");
    expect(body.report.status).toBe("pending");
  });

  test("POST /api/moderation/report — rejects invalid target_type", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "invalid",
        target_id: post.id,
        reason: "Spam",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("target_type");
  });

  test("POST /api/moderation/report — rejects invalid reason", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "post",
        target_id: post.id,
        reason: "InvalidReason",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("Invalid reason");
  });

  test("POST /api/moderation/report — rejects missing target_id", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "post",
        reason: "Spam",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("target_id");
  });

  test("POST /api/moderation/report — rejects non-existent post", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "post",
        target_id: "00000000-0000-0000-0000-000000000000",
        reason: "Spam",
      }),
    });

    expect(status).toBe(404);
    expect(body.error).toContain("Post not found");
  });

  test("POST /api/moderation/report — rejects self-report for account", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "account",
        target_id: user.id,
        reason: "Spam",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("cannot report yourself");
  });

  test("POST /api/moderation/report — rejects duplicate pending report", async () => {
    // Already reported this post in the first test; try again
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "post",
        target_id: post.id,
        reason: "Harassment",
      }),
    });

    expect(status).toBe(409);
    expect(body.error).toContain("already have a pending report");
  });

  test("POST /api/moderation/report — reports an account", async () => {
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "account",
        target_id: otherUser.id,
        reason: "Harassment",
      }),
    });

    expect(status).toBe(201);
    expect(body.report).toBeDefined();
    expect(body.report.targetType).toBe("account");
    expect(body.report.targetId).toBe(otherUser.id);
  });

  test("POST /api/moderation/report — reports a message", async () => {
    // Create a conversation between user and otherUser
    const [conversation] = await db`
      INSERT INTO conversations (post_id, initiator_id, recipient_id)
      VALUES (${post.id}, ${user.id}, ${otherUser.id})
      RETURNING id
    `;

    const [message] = await db`
      INSERT INTO conversation_messages (conversation_id, sender_id, body)
      VALUES (${conversation.id}, ${otherUser.id}, 'A harassing message.')
      RETURNING id
    `;

    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "message",
        target_id: message.id,
        reason: "Harassment",
      }),
    });

    expect(status).toBe(201);
    expect(body.report).toBeDefined();
    expect(body.report.targetType).toBe("message");
    expect(body.report.targetId).toBe(message.id);

    await db`DELETE FROM conversation_messages WHERE id = ${message.id}`;
    await db`DELETE FROM conversations WHERE id = ${conversation.id}`;
  });

  test("POST /api/moderation/report — rejects message report from non-participant", async () => {
    // Create a conversation between admin and otherUser
    const [conversation] = await db`
      INSERT INTO conversations (post_id, initiator_id, recipient_id)
      VALUES (${post.id}, ${admin.id}, ${otherUser.id})
      RETURNING id
    `;

    const [message] = await db`
      INSERT INTO conversation_messages (conversation_id, sender_id, body)
      VALUES (${conversation.id}, ${otherUser.id}, 'Another message.')
      RETURNING id
    `;

    // user is not a participant
    const { status, body } = await api("/api/moderation/report", token, {
      method: "POST",
      body: JSON.stringify({
        target_type: "message",
        target_id: message.id,
        reason: "Spam",
      }),
    });

    expect(status).toBe(403);
    expect(body.error).toContain("Forbidden");

    await db`DELETE FROM conversation_messages WHERE id = ${message.id}`;
    await db`DELETE FROM conversations WHERE id = ${conversation.id}`;
  });

  test("GET /api/moderation/reports — rejects non-admin", async () => {
    const { status, body } = await api("/api/moderation/reports", token);

    expect(status).toBe(403);
    expect(body.error).toContain("Forbidden");
  });

  test("GET /api/moderation/reports — admin can list reports", async () => {
    const { status, body } = await api("/api/moderation/reports", adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body.reports.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  test("GET /api/moderation/reports — supports status filter", async () => {
    const { status, body } = await api("/api/moderation/reports?status=pending", adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body.reports.every((r: any) => r.status === "pending")).toBe(true);
  });

  test("GET /api/moderation/reports — supports target_type filter", async () => {
    const { status, body } = await api("/api/moderation/reports?target_type=account", adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body.reports.every((r: any) => r.targetType === "account")).toBe(true);
  });

  test("POST /api/moderation/reports/:id/resolve — admin can resolve a report", async () => {
    // Get first pending report
    const { body: listBody } = await api("/api/moderation/reports?status=pending", adminToken);
    const reportId = listBody.reports[0].id;

    const { status, body } = await api(`/api/moderation/reports/${reportId}/resolve`, adminToken, {
      method: "POST",
      body: JSON.stringify({
        action_type: "warning",
        note: "Sent a warning to the user.",
      }),
    });

    expect(status).toBe(200);
    expect(body.action).toBeDefined();
    expect(body.action.actionType).toBe("warning");
    expect(body.action.note).toBe("Sent a warning to the user.");

    // Verify report is now resolved
    const { body: afterList } = await api(`/api/moderation/reports?status=pending`, adminToken);
    expect(afterList.reports.every((r: any) => r.id !== reportId)).toBe(true);
  });

  test("POST /api/moderation/reports/:id/resolve — rejects invalid action_type", async () => {
    const { body: listBody } = await api("/api/moderation/reports?status=pending", adminToken);
    const reportId = listBody.reports[0].id;

    const { status, body } = await api(`/api/moderation/reports/${reportId}/resolve`, adminToken, {
      method: "POST",
      body: JSON.stringify({
        action_type: "invalid_action",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("Invalid action_type");
  });

  test("POST /api/moderation/reports/:id/resolve — rejects resolving already resolved report", async () => {
    // Find a resolved report
    const { body: listBody } = await api("/api/moderation/reports", adminToken);
    const resolvedReport = listBody.reports.find((r: any) => r.status === "resolved");
    if (!resolvedReport) {
      // Skip if no resolved report yet
      return;
    }

    const { status, body } = await api(`/api/moderation/reports/${resolvedReport.id}/resolve`, adminToken, {
      method: "POST",
      body: JSON.stringify({
        action_type: "no_action",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("already resolved");
  });
});
