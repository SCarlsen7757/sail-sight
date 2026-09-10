import http from "node:http";
import crypto from "node:crypto";
import next from "next";
import fs from "node:fs";
import net from "node:net";

// This entry point has the socket peer, which NextRequest does not expose.
// Sign the sanitized client information so direct calls to a Next worker cannot
// supply spoofed forwarding headers to the API proxy.
process.env.ENTRY_PROXY_SECRET = crypto.randomBytes(32).toString("hex");
const dev = process.argv.includes("--dev") || process.env.NODE_ENV === "development";
process.env.NODE_ENV ??= dev ? "development" : "production";
const config = dev ? undefined : JSON.parse(fs.readFileSync(".next/required-server-files.json", "utf8")).config;
if (config) process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
const app = next({ dev, conf: config });
await app.prepare();
const handler = app.getRequestHandler();
const normalize = value => value.startsWith("::ffff:") && net.isIPv4(value.slice(7)) ? value.slice(7) : value;
const trusted = new Set((process.env.TRUSTED_INGRESS_PROXIES ?? "").split(",").map(value => normalize(value.trim())).filter(Boolean));
http.createServer((req, res) => {
  const peer = normalize(req.socket.remoteAddress ?? "unknown");
  let ip = peer;
  let scheme = "http";
  if (trusted.has(peer)) {
    const chain = String(req.headers["x-forwarded-for"] ?? "").split(",").map(s => normalize(s.trim())).filter(Boolean);
    while (chain.length && trusted.has(chain.at(-1))) chain.pop();
    ip = chain.at(-1) ?? peer;
    scheme = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  }
  if (process.env.APP_ORIGIN?.startsWith("https:") && scheme !== "https") {
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("HTTPS is required.");
    return;
  }
  for (const key of Object.keys(req.headers))
    if (key === "forwarded" || key.startsWith("x-forwarded-") || key.startsWith("x-sailsight-entry-")) delete req.headers[key];
  const value = `${ip}|${scheme}`;
  req.headers["x-sailsight-entry-client"] = value;
  req.headers["x-sailsight-entry-signature"] = crypto.createHmac("sha256", process.env.ENTRY_PROXY_SECRET).update(value).digest("hex");
  handler(req, res);
}).listen(Number(process.env.PORT ?? 3000), process.env.HOSTNAME ?? "127.0.0.1");
