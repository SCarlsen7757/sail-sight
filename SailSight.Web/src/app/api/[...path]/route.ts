import { type NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:5223";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const target = `${API_BASE}/api/${path.join("/")}${req.nextUrl.search}`;

  const reqHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "host") return;
    if (HOP_BY_HOP.has(k)) return;
    // Strip any inbound Authorization header so the browser cannot inject
    // bearer tokens through the BFF; the API authenticates via the cookie.
    if (k === "authorization") return;
    if (k === "accept-encoding") return;
    reqHeaders.set(key, value);
  });

  // Forward the CSRF cookie value as the X-CSRF-Token header for state-
  // changing requests if the client did not already set one. The API uses
  // a double-submit cookie pattern.
  if (STATE_CHANGING.has(req.method) && !reqHeaders.has("x-csrf-token")) {
    const csrf = req.cookies.get("sailsight.csrf")?.value;
    if (csrf) reqHeaders.set("x-csrf-token", csrf);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const upstream = await fetch(target, {
    method: req.method,
    headers: reqHeaders,
    // req.body can be null for bodyless POSTs (e.g. logout); pass undefined
    // instead of null because undici rejects a null body source.
    body: hasBody ? (req.body ?? undefined) : undefined,
    // @ts-expect-error
    duplex: "half",
  });

  // Build forwarded response headers.
  const resHeaders = new Headers();
  // Forward each Set-Cookie header individually so that multiple cookies
  // (e.g. sliding-expiration refresh + auth cookie clearance on logout) are
  // all sent to the browser. Headers.set() would overwrite duplicates.
  upstream.headers.getSetCookie().forEach((cookie) => {
    resHeaders.append("set-cookie", cookie);
  });
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "set-cookie") return; // already handled above
    if (HOP_BY_HOP.has(k)) return;
    // Node fetch already decoded the body — strip these so the browser does
    // not try to decode an already-decoded stream (ERR_CONTENT_DECODING_FAILED).
    if (k === "content-encoding") return;
    if (k === "content-length") return;
    resHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}