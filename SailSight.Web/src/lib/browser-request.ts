const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfHeaders(method: string, headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  if (typeof document !== "undefined" && !SAFE.has(method.toUpperCase())) {
    const token = document.cookie.split("; ").find(c => c.startsWith("sailsight.csrf="))?.slice("sailsight.csrf=".length);
    if (token) result.set("X-CSRF-Token", decodeURIComponent(token));
  }
  return result;
}

export async function browserRequest(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const method = init.method ?? request?.method ?? "GET";
  const options = { ...init, signal: init.signal ?? request?.signal, headers: csrfHeaders(method, init.headers ?? request?.headers) };
  const response = await fetch(input, options);
  if (method !== "GET" || !response.ok || !response.headers.has("X-Next-Offset")) return response;
  const data = await response.json();
  let next = response.headers.get("X-Next-Offset");
  let previous = -1;
  while (next !== null) {
    const offset = Number(next);
    if (!Number.isSafeInteger(offset) || offset <= previous || offset > 5_000_000) throw new Error("Invalid continuation");
    previous = offset;
    const url = new URL(request?.url ?? String(input), typeof window === "undefined" ? "http://localhost" : window.location.origin);
    url.searchParams.set("offset", next);
    const page = await fetch(url, options);
    if (!page.ok) return page;
    const items = await page.json();
    if (Array.isArray(data)) data.push(...items);
    else for (const key of Object.keys(data)) if (Array.isArray(data[key])) data[key].push(...items[key]);
    next = page.headers.get("X-Next-Offset");
  }
  const headers = new Headers(response.headers);
  headers.delete("X-Next-Offset"); headers.delete("content-length"); headers.delete("content-encoding");
  return new Response(JSON.stringify(data), { status: response.status, headers });
}
