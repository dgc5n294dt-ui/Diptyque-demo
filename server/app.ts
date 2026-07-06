import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

import { handleAskRequest } from "./ask.js";

const rootDir = resolve(process.cwd());
const distDir = resolve(rootDir, "dist");
const publicDir = resolve(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendNotFound(response: import("node:http").ServerResponse): void {
  response.statusCode = 404;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end("Not Found");
}

function sendFile(response: import("node:http").ServerResponse, filePath: string): void {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  response.statusCode = 200;
  response.setHeader("Content-Type", type);
  createReadStream(filePath).pipe(response);
}

function resolveStaticFile(urlPath: string): string | null {
  const trimmed = urlPath.replace(/^\/+/, "");
  const candidates = [
    resolve(distDir, trimmed),
    resolve(publicDir, trimmed),
  ];

  for (const candidate of candidates) {
    const normalizedPath = normalize(candidate);
    if (!normalizedPath.startsWith(distDir) && !normalizedPath.startsWith(publicDir)) continue;
    if (existsSync(normalizedPath) && statSync(normalizedPath).isFile()) return normalizedPath;
  }

  return null;
}

async function serveIndex(response: import("node:http").ServerResponse): Promise<void> {
  const indexPath = join(distDir, "index.html");
  const html = await readFile(indexPath, "utf8");
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(html);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const pathname = requestUrl.pathname;

    if (pathname === "/api/ask") {
      await handleAskRequest(request, response);
      return;
    }

    const staticFile = resolveStaticFile(pathname);
    if (staticFile) {
      sendFile(response, staticFile);
      return;
    }

    await serveIndex(response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Diptyque server listening on http://0.0.0.0:${port}`);
});
