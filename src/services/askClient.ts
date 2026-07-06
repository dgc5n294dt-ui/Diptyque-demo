import type { AskResponse } from "../lib/contracts.js";
import { fetchJson, publicUrl } from "./retrievalClient.js";

type MockAnswerRecord = AskResponse & { id?: number };

export type AskGraphQuestionResult = {
  data: AskResponse;
  mode: "api" | "static";
};

async function loadMockAnswers(): Promise<MockAnswerRecord[]> {
  return fetchJson<MockAnswerRecord[]>("answer-test-results.json");
}

function normalizeQuestion(text: string): string {
  return text.trim();
}

function findMockAnswer(records: MockAnswerRecord[], question: string): AskResponse {
  const normalizedQuestion = normalizeQuestion(question);
  const match = records.find((record) => normalizeQuestion(record.query) === normalizedQuestion);
  if (match) return match;

  return {
    query: question,
    intent: "unknown",
    answer: "当前静态演示模式下没有找到完全匹配的预生成回答。你可以改用示例问题，或在本地带 ask 接口的模式下查看完整问答联动。",
    answer_sections: [],
    matched_entities: [],
    direct_products: [],
    indirect_or_bundle_products: [],
    supporting_results: [],
    uncertain_results: [],
    target_product: [],
    scent_notes: [],
    filter_evidence: [],
    evidence_paths: [],
    warnings: ["Static mock answer fallback was used, but no matching precomputed answer was found."],
    provider: "mock",
  };
}

export async function askGraphQuestion(question: string): Promise<AskGraphQuestionResult> {
  try {
    const response = await fetch(publicUrl("api/ask"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error(`Ask request failed with status ${response.status}`);
    }

    return {
      data: (await response.json()) as AskResponse,
      mode: "api",
    };
  } catch (error) {
    console.warn("/api/ask unavailable, falling back to static mock answers.", error);
    const records = await loadMockAnswers();
    return {
      data: findMockAnswer(records, question),
      mode: "static",
    };
  }
}
