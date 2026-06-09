import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db, generateUUID } from "../db";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";
process.env.PUBLIC_URL = "http://localhost:3000";

const TEST_PORT = 3460;

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
  const res = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return res.json();
}

async function api(path: string, token: string | null, options: RequestInit = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`http://localhost:${TEST_PORT}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function fakeClientDataJSON(challenge: string): string {
  return Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin: "http://localhost:3000" })
  ).toString("base64url");
}

describe("Passkeys", () => {
  let server: any;
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };
  let tokenA: string;
  let tokenB: string;
  const fakeCredentialId = `pktest-cred-${generateUUID()}`;

  beforeAll(async () => {
    const { default: serverConfig } = await import("../index");
    server = Bun.serve({ ...serverConfig, port: TEST_PORT });
    await new Promise((r) => setTimeout(r, 500));

    await db`DELETE FROM users WHERE username LIKE 'pktest_%'`;

    userA = await createUser("pktest_a");
    userB = await createUser("pktest_b");

    const loginA = await login("pktest_a");
    tokenA = loginA.token;
    const loginB = await login("pktest_b");
    tokenB = loginB.token;
  });

  afterAll(async () => {
    await db`DELETE FROM users WHERE id IN (${userA.id}, ${userB.id})`;
    server.stop(true);
  });

  test("POST /api/auth/passkey/register/options — requires auth", async () => {
    const { status } = await api("/api/auth/passkey/register/options", null, {
      method: "POST",
    });

    expect(status).toBe(401);
  });

  test("POST /api/auth/passkey/register/options — returns options and stores challenge", async () => {
    const { status, body } = await api("/api/auth/passkey/register/options", tokenA, {
      method: "POST",
    });

    expect(status).toBe(200);
    expect(body.options.challenge).toBeDefined();
    expect(body.options.rp.id).toBe("localhost");
    expect(body.options.user.name).toBe("pktest_a");

    const challenges = await db`
      SELECT id FROM webauthn_challenges
      WHERE challenge = ${body.options.challenge} AND user_id = ${userA.id} AND type = 'registration'
    `;
    expect(challenges.length).toBe(1);
  });

  test("POST /api/auth/passkey/register/verify — rejects unknown challenge", async () => {
    const { status, body } = await api("/api/auth/passkey/register/verify", tokenA, {
      method: "POST",
      body: JSON.stringify({
        response: {
          id: "whatever",
          response: { clientDataJSON: fakeClientDataJSON("not-a-real-challenge") },
        },
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("Challenge expired or invalid");
  });

  test("POST /api/auth/passkey/register/verify — rejects another user's challenge", async () => {
    const { body: optionsBody } = await api("/api/auth/passkey/register/options", tokenA, {
      method: "POST",
    });

    const { status, body } = await api("/api/auth/passkey/register/verify", tokenB, {
      method: "POST",
      body: JSON.stringify({
        response: {
          id: "whatever",
          response: { clientDataJSON: fakeClientDataJSON(optionsBody.options.challenge) },
        },
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("Challenge expired or invalid");
  });

  test("POST /api/auth/passkey/login/options — returns options without auth", async () => {
    const { status, body } = await api("/api/auth/passkey/login/options", null, {
      method: "POST",
    });

    expect(status).toBe(200);
    expect(body.options.challenge).toBeDefined();
    expect(body.options.rpId).toBe("localhost");
  });

  test("POST /api/auth/passkey/login/verify — rejects unknown challenge", async () => {
    const { status, body } = await api("/api/auth/passkey/login/verify", null, {
      method: "POST",
      body: JSON.stringify({
        response: {
          id: "whatever",
          response: { clientDataJSON: fakeClientDataJSON("not-a-real-challenge") },
        },
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain("Challenge expired or invalid");
  });

  test("POST /api/auth/passkey/login/verify — rejects unknown credential and consumes challenge", async () => {
    const { body: optionsBody } = await api("/api/auth/passkey/login/options", null, {
      method: "POST",
    });
    const challenge = optionsBody.options.challenge;

    const { status, body } = await api("/api/auth/passkey/login/verify", null, {
      method: "POST",
      body: JSON.stringify({
        response: {
          id: "pktest-unknown-cred",
          response: { clientDataJSON: fakeClientDataJSON(challenge) },
        },
      }),
    });

    expect(status).toBe(401);
    expect(body.error).toContain("Passkey not recognized");

    // The challenge is one-shot: replaying it must fail.
    const retry = await api("/api/auth/passkey/login/verify", null, {
      method: "POST",
      body: JSON.stringify({
        response: {
          id: "pktest-unknown-cred",
          response: { clientDataJSON: fakeClientDataJSON(challenge) },
        },
      }),
    });

    expect(retry.status).toBe(400);
    expect(retry.body.error).toContain("Challenge expired or invalid");
  });

  test("GET /api/auth/passkeys — starts empty", async () => {
    const { status, body } = await api("/api/auth/passkeys", tokenA);

    expect(status).toBe(200);
    expect(body.passkeys).toEqual([]);
  });

  test("GET /api/auth/passkeys — lists user's passkeys", async () => {
    await db`
      INSERT INTO passkey_credentials (id, user_id, public_key, sign_count, transports, name)
      VALUES (${fakeCredentialId}, ${userA.id}, 'cGstdGVzdC1rZXk', 0, '["internal"]', 'Test passkey')
    `;

    const { status, body } = await api("/api/auth/passkeys", tokenA);

    expect(status).toBe(200);
    expect(body.passkeys.length).toBe(1);
    expect(body.passkeys[0].id).toBe(fakeCredentialId);
    expect(body.passkeys[0].name).toBe("Test passkey");

    const { body: otherBody } = await api("/api/auth/passkeys", tokenB);
    expect(otherBody.passkeys).toEqual([]);
  });

  test("POST /api/auth/passkey/register/options — excludes existing credentials", async () => {
    const { status, body } = await api("/api/auth/passkey/register/options", tokenA, {
      method: "POST",
    });

    expect(status).toBe(200);
    const excluded = body.options.excludeCredentials.map((c: any) => c.id);
    expect(excluded).toContain(fakeCredentialId);
  });

  test("DELETE /api/auth/passkeys/:id — rejects another user's passkey", async () => {
    const { status, body } = await api(`/api/auth/passkeys/${fakeCredentialId}`, tokenB, {
      method: "DELETE",
    });

    expect(status).toBe(404);
    expect(body.error).toContain("Passkey not found");
  });

  test("DELETE /api/auth/passkeys/:id — removes a passkey", async () => {
    const { status } = await api(`/api/auth/passkeys/${fakeCredentialId}`, tokenA, {
      method: "DELETE",
    });

    expect(status).toBe(200);

    const { body } = await api("/api/auth/passkeys", tokenA);
    expect(body.passkeys).toEqual([]);
  });

  test("DELETE /api/auth/passkeys/:id — returns 404 for missing passkey", async () => {
    const { status, body } = await api(`/api/auth/passkeys/${fakeCredentialId}`, tokenA, {
      method: "DELETE",
    });

    expect(status).toBe(404);
    expect(body.error).toContain("Passkey not found");
  });
});
