import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../db";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";

const TEST_PORT = 3458;

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
    RETURNING id, title, body, author_id, archived_at
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

describe("End-to-end: Start conversation from post", () => {
  let server: any;
  let author: { id: string; username: string };
  let reader: { id: string; username: string };
  let post: { id: string };
  let authorToken: string;
  let readerToken: string;

  beforeAll(async () => {
    const { default: serverConfig } = await import("../index");
    server = Bun.serve({ ...serverConfig, port: TEST_PORT });
    await new Promise((r) => setTimeout(r, 500));

    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'E2E %'))`;
    await db`DELETE FROM conversations WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'E2E %')`;
    await db`DELETE FROM notifications WHERE body = 'Someone responded to your post' OR body = 'New message in a conversation'`;
    await db`DELETE FROM posts WHERE title LIKE 'E2E %'`;
    await db`DELETE FROM users WHERE username LIKE 'e2e_%'`;

    author = await createUser("e2e_author");
    reader = await createUser("e2e_reader");

    authorToken = (await login("e2e_author")).token;
    readerToken = (await login("e2e_reader")).token;

    post = await createPost("E2E Test Post", "A post to test conversation flow.", author.id);
  });

  afterAll(async () => {
    await db`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE post_id = ${post.id})`;
    await db`DELETE FROM conversations WHERE post_id = ${post.id}`;
    await db`DELETE FROM notifications WHERE user_id IN (${author.id}, ${reader.id})`;
    await db`DELETE FROM posts WHERE id = ${post.id}`;
    await db`DELETE FROM users WHERE id IN (${author.id}, ${reader.id})`;
    server.stop(true);
  });

  test("reader sees post feed", async () => {
    const { status, body } = await api("/api/posts", readerToken);
    expect(status).toBe(200);
    expect(body.posts.some((p: any) => p.id === post.id)).toBe(true);
  });

  test("reader opens post detail", async () => {
    const { status, body } = await api(`/api/posts/${post.id}`, readerToken);
    expect(status).toBe(200);
    expect(body.post.id).toBe(post.id);
    expect(body.post.created_at).toBeDefined();
    expect(body.post.archived_at).toBeNull();
  });

  test("reader starts a conversation from the post", async () => {
    const { status, body } = await api(
      `/api/conversations/from-post/${post.id}`,
      readerToken,
      {
        method: "POST",
        body: JSON.stringify({
          body: "This is a thoughtful response to your post about testing ideas and having meaningful conversations.",
        }),
      }
    );

    expect(status).toBe(201);
    expect(body.conversation).toBeDefined();
    expect(body.conversation.id).toBeDefined();
    expect(body.message).toBeDefined();
  });

  test("reader navigates to conversation detail", async () => {
    // Get conversations list first
    const { body: listBody } = await api("/api/conversations", readerToken);
    const conv = listBody.conversations.find((c: any) => c.postId === post.id);
    expect(conv).toBeDefined();

    // Navigate to conversation detail (simulated by API call)
    const { status, body } = await api(`/api/conversations/${conv.id}`, readerToken);
    expect(status).toBe(200);
    expect(body.conversation.id).toBe(conv.id);
    expect(body.conversation.revealed).toBe(false);
    expect(body.messages).toHaveLength(1);
  });

  test("author sees conversation in their list", async () => {
    const { status, body } = await api("/api/conversations", authorToken);
    expect(status).toBe(200);
    expect(body.conversations.some((c: any) => c.postId === post.id)).toBe(true);
  });

  test("author replies to conversation", async () => {
    const { body: listBody } = await api("/api/conversations", authorToken);
    const conv = listBody.conversations.find((c: any) => c.postId === post.id);

    const { status, body } = await api(
      `/api/conversations/${conv.id}/messages`,
      authorToken,
      {
        method: "POST",
        body: JSON.stringify({ body: "Thanks for your thoughtful response!" }),
      }
    );

    expect(status).toBe(200);
    expect(body.message.body).toBe("Thanks for your thoughtful response!");
  });
});
