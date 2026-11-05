#!/usr/bin/env node
/**
 * apex OS v2.16.10 — Standalone Stdio MCP Server
 * Permite conectar o apex OS diretamente no Antigravity IDE ou no OpenAI Codex CLI via stdio!
 *
 * Exemplo de uso no mcp_config.json (Antigravity) ou config.toml (Codex):
 * {
 *   "mcpServers": {
 *     "apex-os": {
 *       "command": "node",
 *       "args": ["<caminho>/paws-for-trello/mcp-server.js"],
 *       "env": { "APEX_API_URL": "http://localhost:3000/api/mcp" }
 *     }
 *   }
 * }
 */

const readline = require("readline");
const apiHandler = require("./api/index.js");

const API_URL = process.env.APEX_API_URL || process.env.PAWS_API_URL || "";

async function forwardToLocalOrRemote(rpcMessage) {
  if (API_URL) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcMessage)
    });
    return await res.json();
  }

  return new Promise((resolve) => {
    const fakeReq = {
      method: "POST",
      url: "/api/mcp",
      headers: { host: "localhost" },
      body: rpcMessage
    };
    const fakeRes = {
      statusCode: 200,
      setHeader() {},
      end(str) {
        try { resolve(JSON.parse(str)); } catch (e) { resolve({ jsonrpc: "2.0", id: rpcMessage.id, error: { code: -32603, message: e.message } }); }
      }
    };
    apiHandler(fakeReq, fakeRes);
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    const response = await forwardToLocalOrRemote(msg);
    if (response) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: " + err.message }
    }) + "\n");
  }
});
