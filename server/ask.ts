import type { IncomingMessage, ServerResponse } from "node:http";

import { askQuestion } from "../src/services/qaService.js";

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function getQuestionFromUrl(request: IncomingMessage): string {
  const url = new URL(request.url ?? "/api/ask", "http://127.0.0.1");
  return String(url.searchParams.get("question") ?? "").trim();
}

function getHistoryFromUrl(request: IncomingMessage): string[] {
  const url = new URL(request.url ?? "/api/ask", "http://127.0.0.1");
  return url.searchParams.getAll("history").map((item) => String(item).trim()).filter(Boolean);
}

export async function handleAskRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST" && request.method !== "GET") {
    writeJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  let question = request.method === "GET" ? getQuestionFromUrl(request) : "";
  let history: string[] = request.method === "GET" ? getHistoryFromUrl(request) : [];

  if (request.method === "POST") {
    const body = await readBody(request);
    const parsed = body ? (JSON.parse(body) as { question?: string; history?: string[] }) : {};
    question = String(parsed.question ?? "").trim();
    history = Array.isArray(parsed.history) ? parsed.history.map((item) => String(item).trim()).filter(Boolean) : [];
  }

  if (!question) {
    writeJson(response, 400, { error: "missing_question", message: "question is required" });
    return;
  }

  const result = await askQuestion(question, history);
  writeJson(response, 200, result);
}
