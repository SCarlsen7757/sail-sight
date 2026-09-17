// Public runtime configuration for the browser.
//
// This literal route shadows the `api/[...path]` proxy, which would otherwise
// forward `/api/config` to the .NET API. That is intentional and collision-free:
// the API only serves `/api/v{version}/...`.
//
// Deliberately unauthenticated and anonymous. It does NOT inherit the origin
// check, header allowlist or HMAC client-address forwarding that the proxy
// applies, because it forwards nothing, reads no cookies and takes no body.
// Only values that are safe to hand to any visitor belong here — the CARTO key
// ships to the browser by design and is constrained by CARTO's referer
// allowlist, not by secrecy.

// Read per request so the value tracks the container environment and survives
// this route ever being considered for prerendering.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    // `|| null` rather than `?? null`: compose interpolates an unset variable to
    // the empty string, and the payload should be null in both cases.
    { cartoApiKey: process.env.CARTO_API_KEY || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
