import { verify } from "hono/jwt";

export async function authMiddleware(c: any, next: any) {
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
}
