import { db, generateUUID } from "../db";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendViaPostmark({ to, subject, text, html }: SendEmailOptions) {
  const apiKey = process.env.POSTMARK_API_KEY;
  const from = process.env.POSTMARK_FROM;
  if (!apiKey || !from) return false;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": apiKey,
    },
    body: JSON.stringify({
      From: `"Fastminds" <${from}>`,
      FromName: "Fastminds",
      FromAddress: from,
      To: to,
      Subject: subject,
      TextBody: text,
      HtmlBody: html,
      MessageStream: "outbound",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark failed (${res.status}): ${body}`);
  }
  return true;
}

export async function sendEmail(opts: SendEmailOptions) {
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  const footerText = `\n\n---\nManage your email notifications: ${base}/notifications`;
  const footerHtml = `<hr style="border:none;border-top:1px solid #ddd;margin:1.5rem 0 0.5rem;"><p style="font-size:0.85rem;color:#666;"><a href="${base}/notifications">Manage your email notifications</a></p>`;

  const text = opts.text + footerText;
  const html = opts.html ? opts.html + footerHtml : undefined;

  // 1. Postmark API
  if (await sendViaPostmark({ ...opts, text, html })) return;

  // 2. Generic webhook (e.g. SendGrid, Resend HTTP API)
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  const fromAddress = process.env.POSTMARK_FROM || process.env.FROM_EMAIL || "noreply@fastminds.xyz";
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: opts.to, from: `"Fastminds" <${fromAddress}>`, subject: opts.subject, text, html }),
    });
    if (!res.ok) {
      throw new Error(`Email webhook failed: ${res.status} ${await res.text()}`);
    }
    return;
  }

  // 3. Development fallback: log to console
  console.log("=".repeat(60));
  console.log("📧 EMAIL (not sent — no POSTMARK_API_KEY or EMAIL_WEBHOOK_URL configured)");
  console.log("=".repeat(60));
  console.log(`To:      ${opts.to}`);
  console.log(`Subject: ${opts.subject}`);
  console.log("-".repeat(60));
  console.log(text);
  console.log("=".repeat(60));
}

export function buildVerificationUrl(token: string): string {
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

const isTest = process.env.NODE_ENV === "test" || process.env.CI === "true";

export async function sendAdminEmail(opts: Omit<SendEmailOptions, "to">) {
  if (isTest) return;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  await sendEmail({ to: adminEmail, ...opts });
}

export async function logAdminEvent(eventType: string, body: string) {
  const id = generateUUID();
  await db`
    INSERT INTO admin_events (id, event_type, body)
    VALUES (${id}, ${eventType}, ${body})
  `;
}
