import { Hono } from "hono";
import { sign } from "hono/jwt";
import { db } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { sendEmail, buildVerificationUrl } from "../lib/email";

const auth = new Hono<AuthEnv>();

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendVerificationEmail(userId: string, email: string) {
  const token = generateToken();
  await db`
    UPDATE users
    SET email_verification_token = ${token}
    WHERE id = ${userId}
  `;

  const url = buildVerificationUrl(token);
  await sendEmail({
    to: email,
    subject: "Verify your email — fastminds",
    text: `Welcome to fastminds!\n\nPlease verify your email by clicking this link:\n${url}\n\nThis link will expire when you request a new one.`,
    html: `<p>Welcome to fastminds!</p><p>Please verify your email by clicking <a href="${url}">this link</a>.</p><p>This link will expire when you request a new one.</p>`,
  });
}

auth.post("/register", async (c) => {
  const { username, password, email } = await c.req.json();

  if (!username || !password || !email) {
    return c.json({ error: "username, password, and email are required" }, 400);
  }
  if (username.length < 3) {
    return c.json({ error: "Username must be at least 3 characters" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  const existingUsername = await db`SELECT id FROM users WHERE username = ${username}`;
  if (existingUsername.length > 0) {
    return c.json({ error: "Username already taken" }, 409);
  }

  const existingEmail = await db`SELECT id FROM users WHERE email = ${email}`;
  if (existingEmail.length > 0) {
    return c.json({ error: "Email already taken" }, 409);
  }

  const passwordHash = await Bun.password.hash(password);
  const [user] = await db`
    INSERT INTO users (username, password_hash, email, email_verified)
    VALUES (${username}, ${passwordHash}, ${email}, FALSE)
    RETURNING id, username, email, email_verified, bio, picture, created_at
  `;

  await sendVerificationEmail(user.id, email);

  const secret = process.env.JWT_SECRET!;
  const token = await sign({ sub: user.id, username: user.username }, secret, "HS256");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      bio: user.bio,
      picture: user.picture,
      createdAt: user.created_at,
    },
    token,
  }, 201);
});

auth.post("/login", async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: "username and password are required" }, 400);
  }

  const [user] = await db`
    SELECT id, username, password_hash, email, email_verified, bio, picture, created_at
    FROM users WHERE username = ${username}
  `;
  if (!user) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const valid = await Bun.password.verify(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const secret = process.env.JWT_SECRET!;
  const token = await sign({ sub: user.id, username: user.username }, secret, "HS256");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      bio: user.bio,
      picture: user.picture,
      createdAt: user.created_at,
    },
    token,
  });
});

auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db`
    SELECT id, username, email, email_verified, bio, picture, created_at
    FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      bio: user.bio,
      picture: user.picture,
      createdAt: user.created_at,
    },
  });
});

auth.post("/verify-email", async (c) => {
  const { token } = await c.req.json();
  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  const [user] = await db`
    SELECT id FROM users
    WHERE email_verification_token = ${token}
  `;
  if (!user) {
    return c.json({ error: "Invalid or expired token" }, 400);
  }

  await db`
    UPDATE users
    SET email_verified = TRUE, email_verification_token = NULL
    WHERE id = ${user.id}
  `;

  return c.json({ success: true });
});

auth.post("/resend-verification", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db`
    SELECT id, email, email_verified FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  if (user.email_verified) {
    return c.json({ error: "Email already verified" }, 400);
  }

  await sendVerificationEmail(user.id, user.email);
  return c.json({ success: true });
});

export { auth as authRoutes };
