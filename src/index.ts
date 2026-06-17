import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { authRoutes } from "./routes/auth";
import { conversationsRoutes } from "./routes/conversations";
import { notificationsRoutes } from "./routes/notifications";
import { postsRoutes } from "./routes/posts";
import { usersRoutes } from "./routes/users";
import { bookmarksRoutes } from "./routes/bookmarks";
import { moderationRoutes } from "./routes/moderation";
import { adminRoutes } from "./routes/admin";
import {
  messageWebSocketHandler,
  upgradeMessagesWebSocket,
  type MessageSocketData,
} from "./websocket/messages";
import { db } from "./db";

const app = new Hono();

const PUBLIC_URL = process.env.PUBLIC_URL || "https://fastminds.xyz";

function injectMetaTags(html: string, tags: Record<string, string>) {
  let head = html;
  for (const [property, content] of Object.entries(tags)) {
    if (property.startsWith("og:")) {
      // Replace existing tag or inject
      const regex = new RegExp(`<meta property="${property}" content="[^"]*" ?/?>`);
      if (regex.test(head)) {
        head = head.replace(regex, `<meta property="${property}" content="${content}" />`);
      } else {
        head = head.replace("</head>", `  <meta property="${property}" content="${content}" />\n  </head>`);
      }
    } else if (property.startsWith("twitter:")) {
      const regex = new RegExp(`<meta name="${property}" content="[^"]*" ?/?>`);
      if (regex.test(head)) {
        head = head.replace(regex, `<meta name="${property}" content="${content}" />`);
      } else {
        head = head.replace("</head>", `  <meta name="${property}" content="${content}" />\n  </head>`);
      }
    } else {
      const regex = new RegExp(`<meta name="${property}" content="[^"]*" ?/?>`);
      if (regex.test(head)) {
        head = head.replace(regex, `<meta name="${property}" content="${content}" />`);
      } else {
        head = head.replace("</head>", `  <meta name="${property}" content="${content}" />\n  </head>`);
      }
    }
  }
  return head;
}

app.use("/api/*", cors({ origin: "http://localhost:5173", credentials: true }));
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/conversations", conversationsRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/posts", postsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/bookmarks", bookmarksRoutes);
app.route("/api/moderation", moderationRoutes);
app.route("/api/admin", adminRoutes);
app.use("/*", serveStatic({ root: "./packages/frontend/dist" }));
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.notFound();
  }

  const index = Bun.file("./packages/frontend/dist/index.html");
  if (!(await index.exists())) {
    return c.notFound();
  }

  let html = await index.text();
  const path = c.req.path;
  const url = `${PUBLIC_URL}${path}`;

  // Default meta tags
  const tags: Record<string, string> = {
    "og:url": url,
    "og:type": "website",
    "og:description": "Where curious people have deep one-to-one conversations",
  };

  // Dynamic meta tags for specific routes
  if (path.startsWith("/posts/")) {
    const id = path.split("/")[2];
    if (id) {
      const [post] = await db`
        SELECT title, body FROM posts WHERE id = ${id}
      `;
      if (post) {
        const excerpt = post.body ? post.body.slice(0, 200).replace(/\n/g, " ") : "";
        tags["og:title"] = post.title;
        tags["og:description"] = excerpt || "Where curious people have deep one-to-one conversations";
      }
    }
  } else if (path.startsWith("/u/")) {
    const username = path.split("/")[2];
    if (username) {
      const [user] = await db`
        SELECT username FROM users WHERE username = ${username}
      `;
      if (user) {
        tags["og:title"] = `${user.username}`;
        tags["og:description"] = `Where curious people have deep one-to-one conversations`;
      }
    }
  } else if (path.startsWith("/conversations/")) {
    const id = path.split("/")[2];
    if (id) {
      const [conv] = await db`
        SELECT c.id, p.title
        FROM conversations c
        JOIN posts p ON c.post_id = p.id
        WHERE c.id = ${id}
      `;
      if (conv) {
        tags["og:title"] = `Conversation`;
        tags["og:description"] = conv.title ? `Conversation about: ${conv.title}` : "Where curious people have deep one-to-one conversations";
      }
    }
  }

  if (tags["og:title"]) {
    // Also update the <title> tag
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${tags["og:title"]}</title>`);
    html = injectMetaTags(html, tags);
  }

  return c.html(html);
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
