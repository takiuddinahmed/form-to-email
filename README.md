# nojimaint-email-form

A Cloudflare Worker that accepts form submissions and forwards them as emails via Gmail SMTP using an App Password.

## Features

- Accepts `POST /` with `application/json` or `application/x-www-form-urlencoded` bodies
- Requires a `title` field (used as the email subject)
- All other fields are dynamic and included in the email body as `key: value` pairs
- Sends to a comma-separated list of recipients from env
- Open CORS (`*`) with `OPTIONS` preflight support
- No third-party runtime dependencies — uses native `cloudflare:sockets` for SMTP

## Environment Variables

| Variable            | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `GMAIL_USER`        | Gmail address to send from (e.g. `you@gmail.com`)                      |
| `GMAIL_APP_PASSWORD`| Gmail App Password — generate at https://myaccount.google.com/apppasswords (requires 2FA) |
| `TO_EMAILS`         | Comma-separated recipient list (e.g. `a@example.com,b@example.com`)    |

## Local Development

1. Copy the example env file:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Fill in your real credentials in `.dev.vars` (never commit this file).
3. Start the local dev server:
   ```bash
   npm run dev
   ```

## Deployment via Cloudflare Dashboard

1. **Create the Worker** on the [Cloudflare dashboard](https://dash.cloudflare.com/) under **Workers & Pages → Create**, then connect your GitHub repository.
2. Set the following **build settings** in the dashboard:
   - Build command: `npm ci`
   - Deploy command: `npx wrangler deploy`
3. Add the **Worker secrets** (sensitive env vars) under **Workers & Pages → your worker → Settings → Variables and Secrets**:
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `TO_EMAILS`

## API

### `POST /`

**Request** (JSON):
```json
{
  "title": "Contact from website",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "Hello!"
}
```

**Request** (form-urlencoded):
```
title=Contact+from+website&name=Jane+Doe&email=jane%40example.com&message=Hello!
```

**Success response** (`200`):
```json
{ "ok": true }
```

**Error responses**:
- `400` — missing or empty `title` field, or unsupported content type
- `405` — non-POST method
- `500` — email sending failed or server misconfiguration
