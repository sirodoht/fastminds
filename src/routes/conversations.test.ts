import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../db";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";

const TEST_PORT = 3457;

// Helper to create a user and return token
async function createUser(username: string) {
  const passwordHash = await Bun.password.hash("password123");
  const [user] = await db`
    INSERT INTO users (username, password_hash, email_verified)
    VALUES (${username}, ${passwordHash}, TRUE)
    RETURNING id, username
  `;
  return user;
}

// Helper to create a post
async function createPost(title: string, body: string, authorId: string) {
  const [post] = await db`
    INSERT INTO posts (title, body, author_id)
    VALUES (${title}, ${body}, ${authorId})
    RETURNING id, title, body, author_id, archived_at
  `;
  return post;
}

// Helper to login and get token
async function login(username: string) {
  const res = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return res.json();
}

// Helper to make authenticated requests
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

describe("Conversations", () => {
  let server: any;
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };
  let post: { id: string; title: string; body: string; author_id: string; archived_at: string | null };
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // Start server on test port
    const { default: serverConfig } = await import("../index");
    server = Bun.serve({ ...serverConfig, port: TEST_PORT });
    await new Promise((r) => setTimeout(r, 500));

    // Clean test data
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'TEST %'))`;
    await db`DELETE FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'TEST %')`;
    await db`DELETE FROM notifications WHERE body LIKE 'TEST %' OR body = 'Someone responded to your post' OR body = 'New message in a conversation' OR body = 'A post you participated in has been updated'`;
    await db`DELETE FROM post_updates WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'TEST %')`;
    await db`DELETE FROM posts WHERE title LIKE 'TEST %'`;
    await db`DELETE FROM users WHERE username LIKE 'testuser_%'`;

    // Create test users
    userA = await createUser("testuser_a");
    userB = await createUser("testuser_b");

    // Login
    const loginA = await login("testuser_a");
    tokenA = loginA.token;
    const loginB = await login("testuser_b");
    tokenB = loginB.token;

    // Create a post by userA
    post = await createPost("TEST Post", "This is a test post body.", userA.id);
  });

  afterAll(async () => {
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id = ${post.id})`;
    await db`DELETE FROM conversations WHERE post_id = ${post.id}`;
    await db`DELETE FROM notifications WHERE user_id IN (${userA.id}, ${userB.id})`;
    await db`DELETE FROM post_updates WHERE post_id = ${post.id}`;
    await db`DELETE FROM posts WHERE id = ${post.id}`;
    await db`DELETE FROM users WHERE id IN (${userA.id}, ${userB.id})`;
    server.stop(true);
  });

  test("POST /api/conversations/from-post/:id — rejects unverified email", async () => {
    const passwordHash = await Bun.password.hash("password123");
    const [unverifiedUser] = await db`
      INSERT INTO users (username, password_hash, email_verified)
      VALUES (${"testuser_unverified"}, ${passwordHash}, FALSE)
      RETURNING id, username
    `;
    const loginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser_unverified", password: "password123" }),
    });
    const { token: unverifiedToken } = await loginRes.json();

    const { status: postStatus, body: postBody } = await api(
      "/api/posts",
      unverifiedToken,
      {
        method: "POST",
        body: JSON.stringify({ title: "TEST Unverified Post", body: "body" }),
      }
    );
    expect(postStatus).toBe(403);
    expect(postBody.error).toContain("verify your email");

    const { status: convStatus, body: convBody } = await api(
      `/api/conversations/from-post/${post.id}`,
      unverifiedToken,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this test post about ideas and conversations.",
        }),
      }
    );
    expect(convStatus).toBe(403);
    expect(convBody.error).toContain("verify your email");

    await db`DELETE FROM users WHERE id = ${unverifiedUser.id}`;
  });

  test("POST /api/conversations/from-post/:id — initiates conversation from a post", async () => {
    const { status, body } = await api(
      `/api/conversations/from-post/${post.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this test post about ideas and conversations.",
        }),
      }
    );

    expect(status).toBe(201);
    expect(body.conversation).toBeDefined();
    expect(body.conversation.postId).toBe(post.id);
    expect(body.message).toBeDefined();
    expect(body.message.body).toContain("thoughtful");
  });

  test("POST /api/conversations/from-post/:id — rejects empty first message", async () => {
    const { status, body } = await api(
      `/api/conversations/from-post/${post.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "" }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("required");
  });

  test("POST /api/conversations/from-post/:id — rejects short first message", async () => {
    const { status, body } = await api(
      `/api/conversations/from-post/${post.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "Too short" }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("substantial");
  });

  test("POST /api/conversations/from-post/:id — rejects own post", async () => {
    const { status, body } = await api(
      `/api/conversations/from-post/${post.id}`,
      tokenA,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this test post about ideas and conversations.",
        }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("own post");
  });

  test("POST /api/conversations/from-post/:id — rejects duplicate conversation on same post", async () => {
    // Create a fresh post for this test
    const [freshPost] = await db`
      INSERT INTO posts (title, body, author_id)
      VALUES (${"TEST Duplicate"}, ${"body"}, ${userA.id})
      RETURNING id
    `;

    // First conversation succeeds
    const { status: status1 } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this test post.",
        }),
      }
    );
    expect(status1).toBe(201);

    // Second conversation on same post fails
    const { status: status2, body: body2 } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "Another thoughtful response to the same post.",
        }),
      }
    );
    expect(status2).toBe(409);
    expect(body2.error).toContain("already started");

    await db`DELETE FROM conversations WHERE post_id = ${freshPost.id}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("POST /api/conversations/from-post/:id — rejects archived post", async () => {
    const [archivedPost] = await db`
      INSERT INTO posts (title, body, author_id, archived_at)
      VALUES (${"TEST Archived"}, ${"archived"}, ${userA.id}, ${new Date()})
      RETURNING id
    `;

    const { status, body } = await api(
      `/api/conversations/from-post/${archivedPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this archived post.",
        }),
      }
    );

    expect(status).toBe(400);
    expect(body.error).toContain("archived");

    await db`DELETE FROM posts WHERE id = ${archivedPost.id}`;
  });

  test("POST /api/conversations/from-post/:id — enforces daily limit", async () => {
    // Create 10 fresh posts for this test
    const freshPosts = [];
    for (let i = 0; i < 10; i++) {
      const [p] = await db`
        INSERT INTO posts (title, body, author_id)
        VALUES (${`TEST Daily Limit ${i}`}, ${"body"}, ${userA.id})
        RETURNING id
      `;
      freshPosts.push(p.id);
    }

    // Create 10 conversations today on different posts
    for (let i = 0; i < 10; i++) {
      await db`
        INSERT INTO conversations (post_id, initiator_id, recipient_id)
        VALUES (${freshPosts[i]}, ${userB.id}, ${userA.id})
      `;
    }

    // Try to start an 11th conversation on a new post
    const [eleventhPost] = await db`
      INSERT INTO posts (title, body, author_id)
      VALUES (${"TEST Daily Limit 11"}, ${"body"}, ${userA.id})
      RETURNING id
    `;

    const { status, body } = await api(
      `/api/conversations/from-post/${eleventhPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this test post about ideas and conversations.",
        }),
      }
    );

    expect(status).toBe(429);
    expect(body.error).toContain("daily limit");

    await db`DELETE FROM conversations WHERE post_id IN ${db(freshPosts)}`;
    await db`DELETE FROM posts WHERE id IN ${db(freshPosts)} OR id = ${eleventhPost.id}`;
  });

  test("GET /api/conversations/:id — returns conversation with blind phase", async () => {
    // Create a fresh post for this test
    const [freshPost] = await db`
      INSERT INTO posts (title, body, author_id)
      VALUES (${"TEST Blind Phase"}, ${"body"}, ${userA.id})
      RETURNING id
    `;

    // Start a conversation
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "A thoughtful and substantial response to this test post.",
        }),
      }
    );
    const convId = createBody.conversation.id;

    // Get as initiator (userB)
    const { status, body } = await api(`/api/conversations/${convId}`, tokenB);

    expect(status).toBe(200);
    expect(body.conversation.revealed).toBe(false);
    expect(body.conversation.messageCount).toBe(1);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].senderUsername).toBeNull();
    expect(body.messages[0].isMine).toBe(true);

    // Get as recipient (userA)
    const { status: status2, body: body2 } = await api(`/api/conversations/${convId}`, tokenA);
    expect(status2).toBe(200);
    expect(body2.conversation.revealed).toBe(false);
    expect(body2.messages[0].senderUsername).toBeNull();
    expect(body2.messages[0].isMine).toBe(false);

    // Cleanup
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("POST /api/conversations/:id/messages — sends messages and triggers reveal at 10", async () => {
    // Create a fresh post for this test
    const [freshPost] = await db`
      INSERT INTO posts (title, body, author_id)
      VALUES (${"TEST Reveal"}, ${"body"}, ${userA.id})
      RETURNING id
    `;

    // Start a conversation
    const { body: createBody } = await api(
      `/api/conversations/from-post/${freshPost.id}`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({
          body: "First message from userB.",
        }),
      }
    );
    const convId = createBody.conversation.id;

    // Send 8 more messages alternating
    for (let i = 0; i < 8; i++) {
      const token = i % 2 === 0 ? tokenA : tokenB;
      await api(`/api/conversations/${convId}/messages`, token, {
        method: "POST",
        body: JSON.stringify({ body: `Message ${i + 2}` }),
      });
    }

    // At 9 messages, still blind
    const { body: before } = await api(`/api/conversations/${convId}`, tokenB);
    expect(before.conversation.messageCount).toBe(9);
    expect(before.conversation.revealed).toBe(false);
    expect(before.messages[0].senderUsername).toBeNull();

    // 10th message
    await api(`/api/conversations/${convId}/messages`, tokenA, {
      method: "POST",
      body: JSON.stringify({ body: "Tenth message" }),
    });

    // Now revealed
    const { body: after } = await api(`/api/conversations/${convId}`, tokenB);
    expect(after.conversation.messageCount).toBe(10);
    expect(after.conversation.revealed).toBe(true);
    expect(after.messages[0].senderUsername).toBeDefined();
    expect(after.messages[0].senderUsername).not.toBeNull();

    // Cleanup
    await db`DELETE FROM conversation_messages WHERE conversation_id = ${convId}`;
    await db`DELETE FROM conversations WHERE id = ${convId}`;
    await db`DELETE FROM posts WHERE id = ${freshPost.id}`;
  });

  test("GET /api/conversations — lists user's conversations", async () => {
    const { status, body } = await api("/api/conversations", tokenB);

    expect(status).toBe(200);
    expect(Array.isArray(body.conversations)).toBe(true);
    expect(body.conversations.length).toBeGreaterThan(0);
    expect(body.conversations[0].postTitle).toBeDefined();
    expect(body.conversations[0].messageCount).toBeDefined();
    expect(body.conversations[0].revealed).toBeDefined();
  });

  test("POST /api/posts/:id/updates — author can append update", async () => {
    const { status, body } = await api(
      `/api/posts/${post.id}/updates`,
      tokenA,
      {
        method: "POST",
        body: JSON.stringify({ body: "An update to the original post." }),
      }
    );

    expect(status).toBe(201);
    expect(body.update).toBeDefined();
    expect(body.update.body).toBe("An update to the original post.");
  });

  test("POST /api/posts/:id/updates — non-author is forbidden", async () => {
    const { status, body } = await api(
      `/api/posts/${post.id}/updates`,
      tokenB,
      {
        method: "POST",
        body: JSON.stringify({ body: "Unauthorized update." }),
      }
    );

    expect(status).toBe(403);
    expect(body.error).toContain("Forbidden");
  });

  test("GET /api/posts/:id/updates — anyone can read updates", async () => {
    const { status, body } = await api(`/api/posts/${post.id}/updates`, tokenB);

    expect(status).toBe(200);
    expect(Array.isArray(body.updates)).toBe(true);
    expect(body.updates.length).toBeGreaterThan(0);
  });
});
