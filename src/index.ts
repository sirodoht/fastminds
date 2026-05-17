import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { authRoutes } from "./routes/auth";
import { messagesRoutes } from "./routes/messages";
import { postsRoutes } from "./routes/posts";
import {
  messageWebSocketHandler,
  upgradeMessagesWebSocket,
  type MessageSocketData,
} from "./websocket/messages";

const app = new Hono();

app.use("/api/*", cors({ origin: "http://localhost:5173", credentials: true }));
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/messages", messagesRoutes);
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

const serverConfig = {
  async fetch(req: Request, server: Bun.Server<MessageSocketData>) {
    if (new URL(req.url).pathname === "/ws/messages") {
      return upgradeMessagesWebSocket(req, server);
    }

    return app.fetch(req);
  },
  port: Number(process.env.PORT || 3000),
  websocket: messageWebSocketHandler,
};

export { app };
export default serverConfig;
