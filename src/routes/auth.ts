import { Hono } from "hono";
import { sign } from "hono/jwt";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono();

auth.post("/register", async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: "username and password are required" }, 400);
  }
  if (username.length < 3) {
    return c.json({ error: "Username must be at least 3 characters" }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  const existing = await db`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) {
    return c.json({ error: "Username already taken" }, 409);
  }

  const passwordHash = await Bun.password.hash(password);
  const [user] = await db`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username, bio, picture, created_at
  `;

  const secret = process.env.JWT_SECRET!;
  const token = await sign({ sub: user.id, username: user.username }, secret, "HS256");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
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
    SELECT id, username, password_hash, bio, picture, created_at
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
    SELECT id, username, bio, picture, created_at
    FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      bio: user.bio,
      picture: user.picture,
      createdAt: user.created_at,
    },
  });
});

export { auth as authRoutes };
