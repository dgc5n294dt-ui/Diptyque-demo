import type { AskResponse } from "../lib/contracts.js";

export async function askGraphQuestion(question: string): Promise<AskResponse> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Ask request failed with status ${response.status}`);
  }

  return (await response.json()) as AskResponse;
}