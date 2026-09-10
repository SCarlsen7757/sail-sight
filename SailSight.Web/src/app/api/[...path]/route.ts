import { type NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  if (STATE_CHANGING.has(req.method)) {
    const expected = process.env.APP_ORIGIN ?? "http://localhost:8081";
    if (req.headers.get("origin") !== expected) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > 201_048_576) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  let bytes = 0;
  const boundedBody = req.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > 201_048_576) throw new Error("request_too_large");
      controller.enqueue(chunk);
    }
  }));
  const target = `${API_BASE}/api/${path.join("/")}${req.nextUrl.search}`;

  const reqHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "host" || k === "forwarded" || k.startsWith("x-forwarded-")) return;
    if (k.startsWith("x-sailsight-entry-")) return;
    if (HOP_BY_HOP.has(k)) return;
    // Strip any inbound Authorization header so the browser cannot inject
    // bearer tokens through the BFF; the API authenticates via the cookie.
    if (k === "authorization") return;
    if (k === "accept-encoding") return;
    reqHeaders.set(key, value);
  });

  const client = req.headers.get("x-sailsight-entry-client");
  const signature = req.headers.get("x-sailsight-entry-signature");
  if (client && signature && process.env.ENTRY_PROXY_SECRET) {
    const expected = createHmac("sha256", process.env.ENTRY_PROXY_SECRET).update(client).digest("hex");
    if (signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      const [ip, scheme] = client.split("|");
      reqHeaders.set("x-forwarded-for", ip);
      reqHeaders.set("x-forwarded-proto", scheme);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  let upstream: Response;
  try { upstream = await fetch(target, {
    method: req.method,
    headers: reqHeaders,
    signal: req.signal,
    // req.body can be null for bodyless POSTs (e.g. logout); pass undefined
    // instead of null because undici rejects a null body source.
    body: hasBody ? (boundedBody ?? undefined) : undefined,
    // @ts-expect-error Node fetch requires duplex for streamed request bodies.
    duplex: "half",
  }); } catch (error) {
    if (bytes > 201_048_576) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    throw error;
  }

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
