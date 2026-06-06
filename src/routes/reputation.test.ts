import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../db";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";

const TEST_PORT = 3459;

async function createUser(username: string) {
  const passwordHash = await Bun.password.hash("password123");
  const [user] = await db`
    INSERT INTO users (username, password_hash, email_verified)
    VALUES (${username}, ${passwordHash}, TRUE)
    RETURNING id, username
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

async function sendMessages(convId: string, tokenA: string, tokenB: string, count: number) {
  for (let i = 0; i < count; i++) {
    const token = i % 2 === 0 ? tokenA : tokenB;
    await api(`/api/conversations/${convId}/messages`, token, {
      method: "POST",
      body: JSON.stringify({ body: `Message ${i + 1}` }),
    });
  }
}

describe("Reputation System", () => {
  let server: any;
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };
  let userC: { id: string; username: string };
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  beforeAll(async () => {
    const { default: serverConfig } = await import("../index");
    server = Bun.serve({ ...serverConfig, port: TEST_PORT });
    await new Promise((r) => setTimeout(r, 500));

    // Clean all leftover test data
    await db`DELETE FROM conversation_feedback WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP %'))`;
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP %'))`;
    await db`DELETE FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP %')`;
    await db`DELETE FROM posts WHERE title LIKE 'REP %'`;
    await db`DELETE FROM users WHERE username LIKE 'rep_%'`;

    userA = await createUser("rep_userA");
    userB = await createUser("rep_userB");
    userC = await createUser("rep_userC");

    tokenA = (await login("rep_userA")).token;
    tokenB = (await login("rep_userB")).token;
    tokenC = (await login("rep_userC")).token;
  });

  afterAll(async () => {
    await db`DELETE FROM conversation_feedback WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP %'))`;
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP %'))`;
    await db`DELETE FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP %')`;
    await db`DELETE FROM posts WHERE title LIKE 'REP %'`;
    await db`DELETE FROM users WHERE username LIKE 'rep_%'`;
    server.stop(true);
  });

  test("POST /api/conversations/:id/feedback — rejected before reveal threshold", async () => {
    const freshPost = await createPost("REP Threshold", "body", userA.id);
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "First message for reputation test." }),
      }
    );
    const convId = createBody.conversation.id;

    // Send 8 more messages (total 9)
    await sendMessages(convId, tokenA, tokenB, 8);

    const { status, body } = await api(
      `/api/conversations/${convId}/feedback`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ labels: ["Insightful"], thumbs: 1 }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("10 messages");

    // Cleanup
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("POST /api/conversations/:id/feedback — accepted after 10 messages and both exchanged", async () => {
    const freshPost = await createPost("REP Accept", "body", userA.id);
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "First message for feedback acceptance." }),
      }
    );
    const convId = createBody.conversation.id;

    // Send 9 more messages (total 10)
    await sendMessages(convId, tokenA, tokenB, 9);

    const { status, body } = await api(
      `/api/conversations/${convId}/feedback`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ labels: ["Insightful", "Kind"], thumbs: 2 }),
      }
    );

    expect(status).toBe(201);
    expect(body.feedback).toBeDefined();
    expect(body.feedback.id).toBeDefined();

    // Cleanup
    await db`DELETE FROM conversation_feedback WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("POST /api/conversations/:id/feedback — allows updating existing feedback", async () => {
    const freshPost = await createPost("REP Update", "body", userA.id);
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "First message for update test." }),
      }
    );
    const convId = createBody.conversation.id;

    await sendMessages(convId, tokenA, tokenB, 9);

    // First feedback
    const { status: s1 } = await api(
      `/api/conversations/${convId}/feedback`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ labels: ["Insightful"], thumbs: 1 }),
      }
    );
    expect(s1).toBe(201);

    // Fetch existing feedback
    const { body: getBody } = await api(`/api/conversations/${convId}/feedback`, tokenB);
    expect(getBody.feedback).toBeDefined();
    expect(getBody.feedback.labels).toContain("Insightful");
    expect(getBody.feedback.thumbs).toBe(1);

    // Update feedback
    const { status: s2, body: b2 } = await api(
      `/api/conversations/${convId}/feedback`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ labels: ["Curious", "Kind"], thumbs: 2 }),
      }
    );
    expect(s2).toBe(200);
    expect(b2.feedback).toBeDefined();

    // Verify updated feedback
    const { body: getBody2 } = await api(`/api/conversations/${convId}/feedback`, tokenB);
    expect(getBody2.feedback.labels).toContain("Curious");
    expect(getBody2.feedback.labels).toContain("Kind");
    expect(getBody2.feedback.thumbs).toBe(2);

    // Cleanup
    await db`DELETE FROM conversation_feedback WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("POST /api/conversations/:id/feedback — rejects invalid labels", async () => {
    const freshPost = await createPost("REP Invalid Label", "body", userA.id);
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "First message for invalid label test." }),
      }
    );
    const convId = createBody.conversation.id;

    await sendMessages(convId, tokenA, tokenB, 9);

    const { status, body } = await api(
      `/api/conversations/${convId}/feedback`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ labels: ["NotALabel"], thumbs: 1 }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("Invalid label");

    // Cleanup
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("POST /api/conversations/:id/feedback — rejects invalid thumbs", async () => {
    const freshPost = await createPost("REP Invalid Thumbs", "body", userA.id);
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "First message for invalid thumbs test." }),
      }
    );
    const convId = createBody.conversation.id;

    await sendMessages(convId, tokenA, tokenB, 9);

    const { status, body } = await api(
      `/api/conversations/${convId}/feedback`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ labels: ["Insightful"], thumbs: 5 }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("Thumbs");

    // Cleanup
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("GET /api/users/:id/reputation — hidden when fewer than 10 feedback conversations", async () => {
    const { status, body } = await api(`/api/users/${userA.id}/reputation`, tokenB);
    expect(status).toBe(200);
    expect(body.hidden).toBe(true);
    expect(body.positive).toBeDefined();
    expect(body.negative).toBeDefined();
    expect(body.neutral).toBeDefined();
  });

  test("GET /api/users/:id/reputation — visible after 10 feedback conversations", async () => {
    // Create 10 conversations with feedback from userC
    for (let i = 0; i < 10; i++) {
      const [p] = await db`
        INSERT INTO posts (title, body, author_id)
        VALUES (${`REP Visibility ${i}`}, ${"body"}, ${userA.id})
        RETURNING id
      `;

      const { body: createBody } = await api(
        `/api/conversations/from-post/${p.id}`,
        tokenC,
        {
          method: "POST",
          body: JSON.stringify({ body: `Message for visibility test ${i}.` }),
        }
      );
      const convId = createBody.conversation.id;
      await sendMessages(convId, tokenA, tokenC, 9);

      await api(
        `/api/conversations/${convId}/feedback`,
        tokenC,
        {
          method: "POST",
          body: JSON.stringify({ labels: ["Insightful", "Kind"], thumbs: 2 }),
        }
      );
    }

    const { status, body } = await api(`/api/users/${userA.id}/reputation`, tokenB);
    expect(status).toBe(200);
    expect(body.hidden).toBe(false);
    expect(body.positive.length).toBeGreaterThan(0);
    const insightful = body.positive.find((p) => p.label === "Insightful");
    const kind = body.positive.find((p) => p.label === "Kind");
    expect(insightful).toBeDefined();
    expect(kind).toBeDefined();
    expect(insightful.rawCount).toBe(10);
    expect(insightful.decayedPoints).toBeGreaterThan(0);

    // Cleanup
    await db`DELETE FROM conversation_feedback WHERE receiver_id = ${userA.id}`;
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP Visibility %'))`;
    await db`DELETE FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'REP Visibility %')`;
    await db`DELETE FROM posts WHERE title LIKE 'REP Visibility %'`;
  });

  test("GET /api/users/:id/stats — returns conversation statistics", async () => {
    const { status, body } = await api(`/api/users/${userA.id}/stats`, tokenB);
    expect(status).toBe(200);
    expect(body.totalConversations).toBeDefined();
    expect(body.conversationsStarted).toBeDefined();
    expect(body.messagesSent).toBeDefined();
    expect(body.averageConversationLength).toBeDefined();
  });

  test("GET /api/users/:id/reputation — returns 404 for invalid user id", async () => {
    const { status } = await api(`/api/users/invalid-id/reputation`, tokenB);
    expect(status).toBe(404);
  });

  test("GET /api/users/:id/stats — returns 404 for invalid user id", async () => {
    const { status } = await api(`/api/users/invalid-id/stats`, tokenB);
    expect(status).toBe(404);
  });
});
