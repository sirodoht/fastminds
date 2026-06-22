import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db, generateUUID } from "../db";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";

let testApp: any;

async function createUser(username: string) {
  const passwordHash = await Bun.password.hash("password123");
  const userId = generateUUID();
  const [user] = await db`
    INSERT INTO users (id, username, password_hash, email_verified)
    VALUES (${userId}, ${username}, ${passwordHash}, TRUE)
    RETURNING id, username
  `;
  return user;
}

async function login(username: string) {
  const res = await testApp.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return res.json();
}

async function api(path: string, token: string, options: RequestInit = {}) {
  const res = await testApp.request(path, {
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

describe("Posts", () => {
  let user: { id: string; username: string };
  let token: string;

  beforeAll(async () => {
    const mod = await import("../index");
    testApp = mod.app;

    await db`DELETE FROM admin_events WHERE body LIKE '%POSTS TEST %'`;
    await db`DELETE FROM posts WHERE title LIKE 'POSTS TEST %'`;
    await db`DELETE FROM users WHERE username LIKE 'poststest_%'`;

    user = await createUser("poststest_author");
    token = (await login("poststest_author")).token;
  });

  afterAll(async () => {
    await db`DELETE FROM admin_events WHERE body LIKE '%POSTS TEST %'`;
    await db`DELETE FROM posts WHERE title LIKE 'POSTS TEST %'`;
    if (user) {
      await db`DELETE FROM users WHERE id = ${user.id}`;
    } else {
      await db`DELETE FROM users WHERE username LIKE 'poststest_%'`;
    }
  });

  test("POST /api/posts stores structured composer answers without prompt labels", async () => {
    const { status, body } = await api("/api/posts", token, {
      method: "POST",
      body: JSON.stringify({
        question: "POSTS TEST Structured?",
        whyAsking: "Because timing matters.",
        responseHopingFor: "A grounded counterexample.",
        goodConversation: "Mutual curiosity.",
      }),
    });

    expect(status).toBe(201);
    expect(body.post.title).toBe("POSTS TEST Structured?");
    expect(body.post.body).toBe(
      "Because timing matters.\n\nA grounded counterexample.\n\nMutual curiosity."
    );
    expect(body.post.body).not.toContain("What makes this question");
    expect(body.post.body).not.toContain("What would be surprising");
  });

  test("POST /api/posts ignores old composer starter text", async () => {
    const { status, body } = await api("/api/posts", token, {
      method: "POST",
      body: JSON.stringify({
        question: "POSTS TEST Starter text?",
        whyAsking: "I'm asking this because ...",
        responseHopingFor: "It would be surprising to hear ...",
        goodConversation: "A focused exchange.",
      }),
    });

    expect(status).toBe(201);
    expect(body.post.body).toBe("A focused exchange.");
  });
});
