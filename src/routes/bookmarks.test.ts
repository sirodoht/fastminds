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

describe("Bookmarks", () => {
  let server: any;
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };
  let post: { id: string; title: string; body: string; author_id: string; archived_at: string | null };
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const { default: serverConfig } = await import("../index");
    server = Bun.serve({ ...serverConfig, port: TEST_PORT });
    await new Promise((r) => setTimeout(r, 500));

    await db`DELETE FROM bookmarks WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'BM TEST %')`;
    await db`DELETE FROM posts WHERE title LIKE 'BM TEST %'`;
    await db`DELETE FROM users WHERE username LIKE 'bmtest_%'`;

    userA = await createUser("bmtest_a");
    userB = await createUser("bmtest_b");

    const loginA = await login("bmtest_a");
    tokenA = loginA.token;
    const loginB = await login("bmtest_b");
    tokenB = loginB.token;

    post = await createPost("BM TEST Post", "This is a test post body.", userA.id);
  });

  afterAll(async () => {
    await db`DELETE FROM bookmarks WHERE post_id = ${post.id}`;
    await db`DELETE FROM posts WHERE id = ${post.id}`;
    await db`DELETE FROM users WHERE id IN (${userA.id}, ${userB.id})`;
    server.stop(true);
  });

  test("POST /api/bookmarks — creates a bookmark", async () => {
    const { status, body } = await api("/api/bookmarks", tokenB, {
      method: "POST",
      body: JSON.stringify({ postId: post.id }),
    });

    expect(status).toBe(201);
    expect(body.bookmark).toBeDefined();
    expect(body.bookmark.post_id).toBe(post.id);
  });

  test("POST /api/bookmarks — rejects duplicate bookmark", async () => {
    const { status, body } = await api("/api/bookmarks", tokenB, {
      method: "POST",
      body: JSON.stringify({ postId: post.id }),
    });

    expect(status).toBe(409);
    expect(body.error).toContain("already bookmarked");
  });

  test("POST /api/bookmarks — rejects invalid postId", async () => {
    const { status, body } = await api("/api/bookmarks", tokenB, {
      method: "POST",
      body: JSON.stringify({ postId: "not-a-uuid" }),
    });

    expect(status).toBe(404);
    expect(body.error).toContain("Post not found");
  });

  test("POST /api/bookmarks — requires postId", async () => {
    const { status, body } = await api("/api/bookmarks", tokenB, {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("postId is required");
  });

  test("GET /api/bookmarks — lists user's bookmarks", async () => {
    const { status, body } = await api("/api/bookmarks", tokenB);

    expect(status).toBe(200);
    expect(Array.isArray(body.bookmarks)).toBe(true);
    expect(body.bookmarks.length).toBe(1);
    expect(body.bookmarks[0].id).toBe(post.id);
    expect(body.bookmarks[0].title).toBe("BM TEST Post");
  });

  test("GET /api/posts — includes bookmark status for authenticated user", async () => {
    const { status, body } = await api("/api/posts", tokenB);

    expect(status).toBe(200);
    const found = body.posts.find((p: any) => p.id === post.id);
    expect(found).toBeDefined();
    expect(found.is_bookmarked).toBe(true);
  });

  test("GET /api/posts/:id — includes bookmark status", async () => {
    const { status, body } = await api(`/api/posts/${post.id}`, tokenB);

    expect(status).toBe(200);
    expect(body.post.isBookmarked).toBe(true);
  });

  test("DELETE /api/bookmarks/:postId — removes a bookmark", async () => {
    const { status } = await api(`/api/bookmarks/${post.id}`, tokenB, {
      method: "DELETE",
    });

    expect(status).toBe(200);

    const { body } = await api("/api/bookmarks", tokenB);
    expect(body.bookmarks.length).toBe(0);
  });

  test("DELETE /api/bookmarks/:postId — returns 404 for missing bookmark", async () => {
    const { status, body } = await api(`/api/bookmarks/${post.id}`, tokenB, {
      method: "DELETE",
    });

    expect(status).toBe(404);
    expect(body.error).toContain("Bookmark not found");
  });

  test("DELETE /api/bookmarks/:postId — returns 404 for invalid postId", async () => {
    const { status, body } = await api("/api/bookmarks/not-a-uuid", tokenB, {
      method: "DELETE",
    });

    expect(status).toBe(404);
    expect(body.error).toContain("Post not found");
  });
});
