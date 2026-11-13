// Reverse proxy for /api/* -> https://api.hinchmart.com/api/*.
//
// A plain Vercel `rewrites` entry forwards the client's Origin/Referer
// headers unchanged, and the backend's CORS filter rejects ANY Origin header
// it doesn't recognize -- even on this same-origin-from-the-browser, proxied
// hop -- with "Invalid CORS request" (403). Browsers send Origin on
// same-origin POST/PUT/PATCH/DELETE requests too, so that 403 reaches the
// app. Proxying through a function instead lets us drop those headers
// before forwarding, so the backend sees a plain, origin-less server-to-
// server request.
const BACKEND_BASE = "https://api.hinchmart.com";
const DROPPED_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "accept-encoding",
]);
const DROPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  try {
    const { path, ...queryParams } = req.query;
    const segments = Array.isArray(path) ? path : path ? [path] : [];
    const url = new URL(`${BACKEND_BASE}/api/${segments.join("/")}`);

    for (const [key, value] of Object.entries(queryParams)) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    }

    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (DROPPED_REQUEST_HEADERS.has(key.toLowerCase()) || value === undefined) continue;
      forwardHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
    }

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = chunks.length ? Buffer.concat(chunks) : undefined;
    }

    const upstream = await fetch(url.toString(), {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: "manual",
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (DROPPED_RESPONSE_HEADERS.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({
      success: false,
      message: "Proxy error reaching the backend.",
      error: err?.message,
    });
  }
}
