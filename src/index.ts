import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { authRoutes } from "./routes/auth";
import { postsRoutes } from "./routes/posts";

const app = new Hono();

app.use("/api/*", cors({ origin: "http://localhost:5173", credentials: true }));
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/posts", postsRoutes);
app.use("/*", serveStatic({ root: "./packages/frontend/dist" }));
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.notFound();
  }

  const index = Bun.file("./packages/frontend/dist/index.html");
  if (!(await index.exists())) {
    return c.notFound();
  }

  return c.html(await index.text());
});

export default app;

if (import.meta.main) {
  Bun.serve({ fetch: app.fetch, port: 3000 });
}
