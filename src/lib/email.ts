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
      From: from,
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
  // 1. Postmark API
  if (await sendViaPostmark(opts)) return;

  // 2. Generic webhook (e.g. SendGrid, Resend HTTP API)
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: opts.to, subject: opts.subject, text: opts.text, html: opts.html }),
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
  console.log(opts.text);
  console.log("=".repeat(60));
}

export function buildVerificationUrl(token: string): string {
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}
