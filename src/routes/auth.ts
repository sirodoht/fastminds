import { Hono } from "hono";
import { sign } from "hono/jwt";
import Stripe from "stripe";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db, generateUUID } from "../db";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { sendEmail, sendAdminEmail, logAdminEvent, buildVerificationUrl } from "../lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

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
    html: `<p>Welcome to fastminds!</p><p>Please verify your email by clicking <a href="${url}">this link</a>.</p><p style="word-break:break-all;">${url}</p><p>This link will expire when you request a new one.</p>`,
  });
}

async function validateRegistrationInput(
  username: string,
  password: string,
  email: string
) {
  if (!username || !password || !email) {
    return { error: "username, password, and email are required", status: 400 };
  }
  if (username.length < 3) {
    return { error: "Username must be at least 3 characters", status: 400 };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Invalid email address", status: 400 };
  }

  const existingUsername = await db`SELECT id FROM users WHERE username = ${username}`;
  if (existingUsername.length > 0) {
    return { error: "Username already taken", status: 409 };
  }

  const existingEmail = await db`SELECT id FROM users WHERE email = ${email}`;
  if (existingEmail.length > 0) {
    return { error: "Email already taken", status: 409 };
  }

  return null;
}

auth.post("/register/checkout-session", async (c) => {
  const { username, password, email } = await c.req.json();

  const validationError = await validateRegistrationInput(username, password, email);
  if (validationError) {
    return c.json({ error: validationError.error }, validationError.status);
  }

  const passwordHash = await Bun.password.hash(password);
  const registrationToken = generateToken();

  await db`DELETE FROM pending_registrations WHERE username = ${username}`;

  await db`
    INSERT INTO pending_registrations (username, email, password_hash)
    VALUES (${username}, ${email}, ${passwordHash})
  `;

  const appUrl = process.env.APP_URL || new URL(c.req.url).origin;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "fastminds verification" },
          unit_amount: 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/register`,
    metadata: { registration_token: registrationToken },
  });

  await db`
    UPDATE pending_registrations
    SET stripe_checkout_session_id = ${session.id}
    WHERE username = ${username}
  `;

  return c.json({ url: session.url });
});

auth.post("/register/bypass", async (c) => {
  const { username, password, email } = await c.req.json();

  const validationError = await validateRegistrationInput(username, password, email);
  if (validationError) {
    return c.json({ error: validationError.error }, validationError.status);
  }

  const passwordHash = await Bun.password.hash(password);

  const userId = generateUUID();
  const [user] = await db`
    INSERT INTO users (id, username, password_hash, email, email_verified, stripe_checkout_session_id, payment_verified)
    VALUES (${userId}, ${username}, ${passwordHash}, ${email}, FALSE, NULL, TRUE)
    RETURNING id, username, email, email_verified, is_admin, email_notifications, email_new_message, email_new_post, created_at
  `;

  await sendVerificationEmail(user.id, email);

  await sendAdminEmail({
    subject: `New user registered: ${user.username}`,
    text: `A new user has registered on fastminds.\n\nUsername: ${user.username}\nEmail: ${user.email}\nUser ID: ${user.id}`,
  });

  const secret = process.env.JWT_SECRET!;
  const token = await sign({ sub: user.id, username: user.username }, secret, "HS256");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
      emailNewConversation: user.email_notifications,
      emailNewMessage: user.email_new_message,
      emailNewPost: user.email_new_post,
      createdAt: user.created_at,
    },
    token,
  }, 201);
});

auth.post("/register/complete", async (c) => {
  const { sessionId } = await c.req.json();

  if (!sessionId) {
    return c.json({ error: "sessionId is required" }, 400);
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return c.json({ error: "Invalid checkout session" }, 400);
  }

  if (session.payment_status !== "paid") {
    return c.json({ error: "Payment not completed" }, 400);
  }

  const existingSession = await db`SELECT id FROM users WHERE stripe_checkout_session_id = ${sessionId}`;
  if (existingSession.length > 0) {
    return c.json({ error: "Checkout session already used" }, 400);
  }

  const [pending] = await db`
    SELECT username, email, password_hash
    FROM pending_registrations
    WHERE stripe_checkout_session_id = ${sessionId}
  `;

  if (!pending) {
    return c.json({ error: "Registration session expired or not found" }, 400);
  }

  const existingUsername = await db`SELECT id FROM users WHERE username = ${pending.username}`;
  if (existingUsername.length > 0) {
    return c.json({ error: "Username already taken" }, 409);
  }

  const existingEmail = await db`SELECT id FROM users WHERE email = ${pending.email}`;
  if (existingEmail.length > 0) {
    return c.json({ error: "Email already taken" }, 409);
  }

  const userId = generateUUID();
  const [user] = await db`
    INSERT INTO users (id, username, password_hash, email, email_verified, stripe_checkout_session_id, payment_verified)
    VALUES (${userId}, ${pending.username}, ${pending.password_hash}, ${pending.email}, FALSE, ${sessionId}, TRUE)
    RETURNING id, username, email, email_verified, is_admin, email_notifications, email_new_message, email_new_post, created_at
  `;

  await db`DELETE FROM pending_registrations WHERE stripe_checkout_session_id = ${sessionId}`;

  await sendVerificationEmail(user.id, pending.email);

  await sendAdminEmail({
    subject: `New user registered: ${user.username}`,
    text: `A new user has registered on fastminds.\n\nUsername: ${user.username}\nEmail: ${user.email}\nUser ID: ${user.id}`,
  });
  await logAdminEvent("user:register", `Username: ${user.username}, Email: ${user.email}, ID: ${user.id}`);

  const secret = process.env.JWT_SECRET!;
  const token = await sign({ sub: user.id, username: user.username }, secret, "HS256");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
      emailNewConversation: user.email_notifications,
      emailNewMessage: user.email_new_message,
      emailNewPost: user.email_new_post,
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
    SELECT id, username, password_hash, email, email_verified, is_admin, email_notifications, email_new_message, email_new_post, created_at
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
      isAdmin: user.is_admin,
      emailNewConversation: user.email_notifications,
      emailNewMessage: user.email_new_message,
      emailNewPost: user.email_new_post,
      createdAt: user.created_at,
    },
    token,
  });
});

auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db`
    SELECT id, username, email, email_verified, is_admin, email_notifications, email_new_message, email_new_post, created_at
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
      isAdmin: user.is_admin,
      emailNewConversation: user.email_notifications,
      emailNewMessage: user.email_new_message,
      emailNewPost: user.email_new_post,
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

auth.post("/change-password", authMiddleware, async (c) => {
  const { oldPassword, newPassword } = await c.req.json();

  if (!oldPassword || !newPassword) {
    return c.json({ error: "oldPassword and newPassword are required" }, 400);
  }
  if (newPassword.length < 6) {
    return c.json({ error: "New password must be at least 6 characters" }, 400);
  }

  const userId = c.get("userId");
  const [user] = await db`
    SELECT id, password_hash FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const valid = await Bun.password.verify(oldPassword, user.password_hash);
  if (!valid) {
    return c.json({ error: "Incorrect current password" }, 401);
  }

  const newPasswordHash = await Bun.password.hash(newPassword);
  await db`
    UPDATE users SET password_hash = ${newPasswordHash} WHERE id = ${userId}
  `;

  return c.json({ success: true });
});

auth.post("/change-email", authMiddleware, async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  const userId = c.get("userId");
  const [currentUser] = await db`
    SELECT id, email FROM users WHERE id = ${userId}
  `;
  if (!currentUser) {
    return c.json({ error: "User not found" }, 404);
  }

  if (currentUser.email === email) {
    return c.json({ error: "Email is already your current email" }, 400);
  }

  const existingEmail = await db`SELECT id FROM users WHERE email = ${email}`;
  if (existingEmail.length > 0) {
    return c.json({ error: "Email already taken" }, 409);
  }

  await db`
    UPDATE users
    SET email = ${email}, email_verified = FALSE, email_verification_token = NULL
    WHERE id = ${userId}
  `;

  await sendVerificationEmail(userId, email);

  return c.json({ success: true });
});

auth.delete("/account", authMiddleware, async (c) => {
  const { password } = await c.req.json();

  if (!password) {
    return c.json({ error: "password is required" }, 400);
  }

  const userId = c.get("userId");
  const [user] = await db`
    SELECT id, username, password_hash FROM users WHERE id = ${userId}
  `;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const valid = await Bun.password.verify(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Incorrect password" }, 401);
  }

  let [deletedUser] = await db`SELECT id FROM users WHERE username = '[deleted]'`;
  if (!deletedUser) {
    const deletedPasswordHash = await Bun.password.hash(generateToken());
    const deletedUserId = generateUUID();
    [deletedUser] = await db`
      INSERT INTO users (id, username, password_hash, email, email_verified, payment_verified)
      VALUES (${deletedUserId}, '[deleted]', ${deletedPasswordHash}, NULL, FALSE, TRUE)
      RETURNING id
    `;
  }

  await db`UPDATE posts SET author_id = ${deletedUser.id} WHERE author_id = ${userId}`;
  await db`UPDATE conversations SET initiator_id = ${deletedUser.id} WHERE initiator_id = ${userId}`;
  await db`UPDATE conversations SET recipient_id = ${deletedUser.id} WHERE recipient_id = ${userId}`;
  await db`UPDATE conversation_messages SET sender_id = ${deletedUser.id} WHERE sender_id = ${userId}`;

  await db`DELETE FROM users WHERE id = ${userId}`;

  return c.json({ success: true });
});

const RP_NAME = "fastminds";

function getRpID(): string {
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  return new URL(base).hostname;
}

// The browser puts its true origin in clientDataJSON, so accepting any origin
// whose hostname matches the rpID (e.g. the vite dev server port) is safe.
function getExpectedOrigin(originHeader: string | undefined, rpID: string): string {
  if (originHeader) {
    try {
      const host = new URL(originHeader).hostname;
      if (host === rpID || host.endsWith(`.${rpID}`)) {
        return originHeader;
      }
    } catch {}
  }
  return new URL(process.env.PUBLIC_URL || "http://localhost:3000").origin;
}

async function saveChallenge(
  challenge: string,
  type: "registration" | "authentication",
  userId: string | null
) {
  await db`DELETE FROM webauthn_challenges WHERE created_at < datetime('now', '-5 minutes')`;
  const id = generateUUID();
  await db`
    INSERT INTO webauthn_challenges (id, challenge, user_id, type)
    VALUES (${id}, ${challenge}, ${userId}, ${type})
  `;
}

async function consumeChallenge(
  challenge: string,
  type: "registration" | "authentication",
  userId?: string
): Promise<boolean> {
  const rows = userId
    ? await db`
        SELECT id FROM webauthn_challenges
        WHERE challenge = ${challenge} AND type = ${type} AND user_id = ${userId}
          AND created_at >= datetime('now', '-5 minutes')
      `
    : await db`
        SELECT id FROM webauthn_challenges
        WHERE challenge = ${challenge} AND type = ${type} AND user_id IS NULL
          AND created_at >= datetime('now', '-5 minutes')
      `;
  if (rows.length === 0) return false;
  await db`DELETE FROM webauthn_challenges WHERE id = ${rows[0].id}`;
  return true;
}

function challengeFromClientData(clientDataJSON: unknown): string | null {
  if (typeof clientDataJSON !== "string") return null;
  try {
    const data = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8"));
    return typeof data.challenge === "string" ? data.challenge : null;
  } catch {
    return null;
  }
}

auth.post("/passkey/register/options", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db`SELECT id, username FROM users WHERE id = ${userId}`;
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const existing = await db`
    SELECT id, transports FROM passkey_credentials WHERE user_id = ${userId}
  `;

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpID(),
    userID: new TextEncoder().encode(user.id),
    userName: user.username,
    attestationType: "none",
    excludeCredentials: existing.map((cred: any) => ({
      id: cred.id,
      transports: JSON.parse(cred.transports || "[]"),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await saveChallenge(options.challenge, "registration", userId);

  return c.json({ options });
});

auth.post("/passkey/register/verify", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { response, name } = await c.req.json();

  if (!response) {
    return c.json({ error: "response is required" }, 400);
  }

  const challenge = challengeFromClientData(response?.response?.clientDataJSON);
  if (!challenge || !(await consumeChallenge(challenge, "registration", userId))) {
    return c.json({ error: "Challenge expired or invalid, please try again" }, 400);
  }

  const rpID = getRpID();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: getExpectedOrigin(c.req.header("Origin"), rpID),
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return c.json({ error: "Passkey verification failed" }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "Passkey verification failed" }, 400);
  }

  const { credential } = verification.registrationInfo;

  const duplicate = await db`SELECT id FROM passkey_credentials WHERE id = ${credential.id}`;
  if (duplicate.length > 0) {
    return c.json({ error: "This passkey is already registered" }, 409);
  }

  const passkeyName =
    (typeof name === "string" && name.trim()) ||
    `Passkey added ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  await db`
    INSERT INTO passkey_credentials (id, user_id, public_key, sign_count, transports, name)
    VALUES (
      ${credential.id},
      ${userId},
      ${Buffer.from(credential.publicKey).toString("base64url")},
      ${credential.counter},
      ${JSON.stringify(credential.transports || [])},
      ${passkeyName}
    )
  `;

  return c.json({ passkey: { id: credential.id, name: passkeyName } }, 201);
});

auth.post("/passkey/login/options", async (c) => {
  const options = await generateAuthenticationOptions({
    rpID: getRpID(),
    userVerification: "preferred",
  });

  await saveChallenge(options.challenge, "authentication", null);

  return c.json({ options });
});

auth.post("/passkey/login/verify", async (c) => {
  const { response } = await c.req.json();

  if (!response || typeof response.id !== "string") {
    return c.json({ error: "response is required" }, 400);
  }

  const challenge = challengeFromClientData(response?.response?.clientDataJSON);
  if (!challenge || !(await consumeChallenge(challenge, "authentication"))) {
    return c.json({ error: "Challenge expired or invalid, please try again" }, 400);
  }

  const [cred] = await db`
    SELECT id, user_id, public_key, sign_count, transports
    FROM passkey_credentials WHERE id = ${response.id}
  `;
  if (!cred) {
    return c.json({ error: "Passkey not recognized" }, 401);
  }

  const rpID = getRpID();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: getExpectedOrigin(c.req.header("Origin"), rpID),
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")),
        counter: cred.sign_count,
        transports: JSON.parse(cred.transports || "[]"),
      },
      requireUserVerification: false,
    });
  } catch {
    return c.json({ error: "Passkey verification failed" }, 401);
  }

  if (!verification.verified) {
    return c.json({ error: "Passkey verification failed" }, 401);
  }

  await db`
    UPDATE passkey_credentials
    SET sign_count = ${verification.authenticationInfo.newCounter}, last_used_at = datetime('now')
    WHERE id = ${cred.id}
  `;

  const [user] = await db`
    SELECT id, username, email, email_verified, is_admin, email_notifications, email_new_message, email_new_post, created_at
    FROM users WHERE id = ${cred.user_id}
  `;
  if (!user) {
    return c.json({ error: "Passkey not recognized" }, 401);
  }

  const secret = process.env.JWT_SECRET!;
  const token = await sign({ sub: user.id, username: user.username }, secret, "HS256");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
      emailNewConversation: user.email_notifications,
      emailNewMessage: user.email_new_message,
      emailNewPost: user.email_new_post,
      createdAt: user.created_at,
    },
    token,
  });
});

auth.get("/passkeys", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const passkeys = await db`
    SELECT id, name, created_at, last_used_at
    FROM passkey_credentials
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;

  return c.json({
    passkeys: passkeys.map((p: any) => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at,
    })),
  });
});

auth.delete("/passkeys/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [passkey] = await db`
    SELECT id FROM passkey_credentials WHERE id = ${id} AND user_id = ${userId}
  `;
  if (!passkey) {
    return c.json({ error: "Passkey not found" }, 404);
  }

  await db`DELETE FROM passkey_credentials WHERE id = ${id}`;

  return c.json({ success: true });
});

export { auth as authRoutes };
