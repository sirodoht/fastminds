import { verify } from "hono/jwt";
import type { MiddlewareHandler } from "hono";
import { db } from "../db";
import type { AuthEnv } from "./auth";

export const adminMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }
  try {
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET!;
    const payload = await verify(token, secret, "HS256");
    const userId = payload.sub as string;

    const [user] = await db`
      SELECT is_admin FROM users WHERE id = ${userId}
    `;
    if (!user || !user.is_admin) {
      return c.json({ error: "Forbidden" }, 403);
    }

    c.set("userId", userId);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};
