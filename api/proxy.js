// Reverse proxy for backend calls, addressed as /api/proxy?__hm_path=<path>.
//
// A dynamic catch-all function (api/[...path].js) is NOT invoked at all when
// deployed from this Windows machine via the Vercel CLI -- a plain fixed-name
// function (api/ping.js) works, but the bracket-named catch-all route never
// gets matched, which points to a Windows path-separator bug in how the CLI
// computes the route pattern for bracket filenames. Using a fixed filename
// with the real backend path passed as a query parameter sidesteps that
// entirely.
//
// Separately: a plain Vercel `rewrites` entry forwards the client's
// Origin/Referer headers unchanged, and the backend's CORS filter rejects
// ANY Origin header it doesn't recognize -- even on this same-origin-from-
// the-browser, proxied hop -- with "Invalid CORS request" (403). Browsers
// send Origin on same-origin POST/PUT/PATCH/DELETE requests too, so real
// traffic would hit that 403. Proxying through a function lets us drop
// those headers before forwarding, so the backend sees a plain, origin-less
// server-to-server request.
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
    const { __hm_path, ...queryParams } = req.query;
    const path = Array.isArray(__hm_path) ? __hm_path.join("/") : __hm_path || "";
    const url = new URL(`${BACKEND_BASE}/api/${path}`);

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
