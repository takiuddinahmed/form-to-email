# form-to-email API Documentation

**Base URL:** `https://form-to-email.takiuddinahmed.workers.dev`

---

## Endpoints

### `GET /` — Health Check

Verifies the worker is running and all required environment variables are configured.

**Request**

```http
GET / HTTP/1.1
Host: form-to-email.takiuddinahmed.workers.dev
```

**Response — healthy (`200`)**

```json
{ "ok": true }
```

**Response — misconfigured (`500`)**

```json
{
  "ok": false,
  "error": "Missing environment variables",
  "missing": ["GMAIL_USER", "GMAIL_APP_PASSWORD", "TO_EMAILS"]
}
```

---

### `POST /` — Submit Form

Accepts a form submission and sends it as an email to all configured recipients.

**Content types accepted**

- `application/json`
- `application/x-www-form-urlencoded`
- `multipart/form-data`

**Fields**

| Field   | Type   | Required | Description                                      |
| ------- | ------ | -------- | ------------------------------------------------ |
| `title` | string | Yes      | Used as the email subject line                   |
| *any*   | string | No       | Any additional fields are included in email body |

---

#### Request — JSON

```http
POST / HTTP/1.1
Host: form-to-email.takiuddinahmed.workers.dev
Content-Type: application/json

{
  "title": "New contact from website",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+8801700000000",
  "message": "Hello, I'd like to get in touch."
}
```

#### Request — form-urlencoded

```http
POST / HTTP/1.1
Host: form-to-email.takiuddinahmed.workers.dev
Content-Type: application/x-www-form-urlencoded

title=New+contact+from+website&name=Jane+Doe&email=jane%40example.com&message=Hello
```

---

**Response — success (`200`)**

```json
{ "ok": true }
```

**Response — missing title (`400`)**

```json
{ "error": "Missing required field: title" }
```

**Response — unsupported content type (`400`)**

```json
{ "error": "Invalid request body" }
```

**Response — server misconfiguration (`500`)**

```json
{ "error": "Server misconfiguration: missing email env vars" }
```

**Response — email send failed (`500`)**

```json
{
  "error": "Failed to send email",
  "detail": "<SMTP error message>"
}
```

---

## CORS

All endpoints support cross-origin requests from any origin.

| Header                         | Value            |
| ------------------------------ | ---------------- |
| `Access-Control-Allow-Origin`  | `*`              |
| `Access-Control-Allow-Methods` | `POST, OPTIONS`  |
| `Access-Control-Allow-Headers` | `Content-Type`   |

Preflight `OPTIONS` requests return `204 No Content`.

---

## Usage Examples

### JavaScript / Fetch (JSON)

```js
const res = await fetch("https://form-to-email.takiuddinahmed.workers.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "New contact from website",
    name: "Jane Doe",
    email: "jane@example.com",
    message: "Hello!",
  }),
});

const data = await res.json();
if (!res.ok) throw new Error(data.error);
console.log("Email sent:", data.ok);
```

### JavaScript / Fetch (FormData)

```js
const form = new FormData();
form.append("title", "New contact from website");
form.append("name", "Jane Doe");
form.append("email", "jane@example.com");
form.append("message", "Hello!");

const res = await fetch("https://form-to-email.takiuddinahmed.workers.dev", {
  method: "POST",
  body: form,
});

const data = await res.json();
```

### HTML Form (direct submit)

```html
<form action="https://form-to-email.takiuddinahmed.workers.dev" method="POST">
  <input type="hidden" name="title" value="New contact from website" />
  <input type="text" name="name" placeholder="Your name" required />
  <input type="email" name="email" placeholder="Your email" required />
  <textarea name="message" placeholder="Message" required></textarea>
  <button type="submit">Send</button>
</form>
```

### cURL

```bash
# JSON
curl -X POST https://form-to-email.takiuddinahmed.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","name":"Jane","email":"jane@example.com","message":"Hello"}'

# form-urlencoded
curl -X POST https://form-to-email.takiuddinahmed.workers.dev \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=Test&name=Jane&email=jane%40example.com&message=Hello"
```

---

## Email Output Format

The received email will look like this:

```
Subject: New contact from website

name: Jane Doe
email: jane@example.com
phone: +8801700000000
message: Hello, I'd like to get in touch.
```

The `title` field is used as the subject and excluded from the body. All other fields appear as `key: value` pairs in the order they were submitted.
