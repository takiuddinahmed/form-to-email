import { connect } from "cloudflare:sockets";

export interface Env {
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  TO_EMAILS: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const raw = await request.json<Record<string, unknown>>();
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      result[k] = String(v);
    }
    return result;
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const result: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      result[k] = String(v);
    }
    return result;
  }
  throw new Error("Unsupported content type");
}

function buildEmailBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([key]) => key !== "title")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function encodeBase64(str: string): string {
  return btoa(str);
}

/**
 * Reads lines from the SMTP stream until a line starting with `expectedCode`
 * followed by a space (final response line) is received.
 */
async function readSmtpResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expectedCode: string
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("SMTP connection closed unexpectedly");
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\r\n");
    // Keep incomplete last line in buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith(expectedCode + " ")) {
        return line;
      }
      // Multi-line response continuation: "250-..." — keep reading
      if (!line.startsWith(expectedCode + "-") && line.length > 0) {
        throw new Error(`Unexpected SMTP response: ${line}`);
      }
    }
  }
}

async function sendEmail(
  env: Env,
  recipients: string[],
  subject: string,
  body: string
): Promise<void> {
  const socket = connect(
    { hostname: "smtp.gmail.com", port: 465 },
    { secureTransport: "on", allowHalfOpen: false }
  );

  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  const write = (data: string) => writer.write(new TextEncoder().encode(data));

  try {
    // 220 greeting
    await readSmtpResponse(reader, "220");

    // EHLO
    await write(`EHLO nojimaint-email-form\r\n`);
    await readSmtpResponse(reader, "250");

    // AUTH LOGIN
    await write(`AUTH LOGIN\r\n`);
    await readSmtpResponse(reader, "334");

    await write(`${encodeBase64(env.GMAIL_USER)}\r\n`);
    await readSmtpResponse(reader, "334");

    await write(`${encodeBase64(env.GMAIL_APP_PASSWORD)}\r\n`);
    await readSmtpResponse(reader, "235");

    // MAIL FROM
    await write(`MAIL FROM:<${env.GMAIL_USER}>\r\n`);
    await readSmtpResponse(reader, "250");

    // RCPT TO (one per recipient)
    for (const recipient of recipients) {
      await write(`RCPT TO:<${recipient.trim()}>\r\n`);
      await readSmtpResponse(reader, "250");
    }

    // DATA
    await write(`DATA\r\n`);
    await readSmtpResponse(reader, "354");

    const toHeader = recipients.map((r) => r.trim()).join(", ");
    const date = new Date().toUTCString();
    const message = [
      `From: ${env.GMAIL_USER}`,
      `To: ${toHeader}`,
      `Subject: ${subject}`,
      `Date: ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
      ``,
      `.`,
      ``,
    ].join("\r\n");

    await write(message);
    await readSmtpResponse(reader, "250");

    // QUIT
    await write(`QUIT\r\n`);
    await readSmtpResponse(reader, "221");
  } finally {
    reader.releaseLock();
    writer.releaseLock();
    await socket.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let fields: Record<string, string>;
    try {
      fields = await parseBody(request);
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }

    if (!fields["title"] || fields["title"].trim() === "") {
      return json({ error: "Missing required field: title" }, 400);
    }

    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD || !env.TO_EMAILS) {
      return json({ error: "Server misconfiguration: missing email env vars" }, 500);
    }

    const recipients = env.TO_EMAILS.split(",").filter((r) => r.trim() !== "");
    if (recipients.length === 0) {
      return json({ error: "Server misconfiguration: TO_EMAILS is empty" }, 500);
    }

    const subject = fields["title"].trim();
    const body = buildEmailBody(fields);

    try {
      await sendEmail(env, recipients, subject, body);
      return json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: "Failed to send email", detail: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
