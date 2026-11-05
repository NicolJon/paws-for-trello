/**
 * Servidor Local de Desenvolvimento e Produção para apex OS v2.16.10
 * Serve os arquivos estáticos de `public/` e encaminha `/api/*` e `/1/*` para `api/index.js`.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const apiHandler = require("./api/index.js");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".gs": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname;

  if (pathname.startsWith("/api") || pathname.startsWith("/1/")) {
    return apiHandler(req, res);
  }

  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback for apex OS routes (/b/..., /c/..., /u/...)
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`⚡ apex OS v2.16.10 (1:1 Reference Edition + Google Workspace + Antigravity/Codex MCP) rodando em http://localhost:${PORT}`);
});
