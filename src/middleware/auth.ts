import { verify } from "hono/jwt";
import type { MiddlewareHandler } from "hono";
import { db } from "../db";

export type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }
  try {
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET!;
    const payload = await verify(token, secret, "HS256");
    c.set("userId", payload.sub as string);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};

export const optionalAuthMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const secret = process.env.JWT_SECRET!;
      const payload = await verify(token, secret, "HS256");
      c.set("userId", payload.sub as string);
    } catch {
      // ignore invalid token for optional auth
    }
  }
  await next();
};

export const verifiedEmailMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const userId = c.get("userId");
  const [user] = await db`
    SELECT email_verified FROM users WHERE id = ${userId}
  `;
  if (!user || !user.email_verified) {
    return c.json({ error: "Please verify your email to perform this action" }, 403);
  }
  await next();
};
