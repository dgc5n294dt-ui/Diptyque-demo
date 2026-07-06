import type { AskResponse } from "../lib/contracts.js";
import { fetchJson } from "./retrievalClient.js";

type MockAnswerRecord = {
  id?: number;
  query: string;
  intent: string;
  answer: string;
  answer_sections?: string[];
  evidence_paths?: string[];
  warnings?: string[];
};

type RetrievalRecord = Omit<AskResponse, "answer" | "provider" | "answer_sections"> & { id?: number };

export type AskGraphQuestionResult = {
  data: AskResponse;
  mode: "api" | "static";
};

async function loadMockAnswers(): Promise<MockAnswerRecord[]> {
  return fetchJson<MockAnswerRecord[]>("answer-test-results.json");
}

async function loadMockRetrievalResults(): Promise<RetrievalRecord[]> {
  return fetchJson<RetrievalRecord[]>("retrieval-test-results.json");
}

function normalizeQuestion(text: string): string {
  return text.trim();
}

function buildFallbackResponse(question: string): AskResponse {
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

function mergeStaticRecords(question: string, retrievalRecords: RetrievalRecord[], answerRecords: MockAnswerRecord[]): AskResponse {
  const normalizedQuestion = normalizeQuestion(question);
  const retrieval = retrievalRecords.find((record) => normalizeQuestion(record.query) === normalizedQuestion);
  const answer = answerRecords.find((record) => normalizeQuestion(record.query) === normalizedQuestion);

  if (!retrieval && !answer) return buildFallbackResponse(question);
  if (!retrieval) {
    const fallback = buildFallbackResponse(question);
    return {
      ...fallback,
      answer: answer?.answer ?? fallback.answer,
      intent: answer?.intent ?? fallback.intent,
      answer_sections: answer?.answer_sections ?? [],
      evidence_paths: answer?.evidence_paths ?? fallback.evidence_paths,
      warnings: [...fallback.warnings, ...(answer?.warnings ?? [])],
    };
  }

  return {
    ...retrieval,
    answer: answer?.answer ?? buildFallbackResponse(question).answer,
    answer_sections: answer?.answer_sections ?? [],
    evidence_paths: answer?.evidence_paths?.length ? answer.evidence_paths : retrieval.evidence_paths,
    warnings: [...retrieval.warnings, ...(answer?.warnings ?? [])],
    provider: "mock",
  };
}

async function requestLiveAsk(question: string, history: string[]): Promise<AskResponse> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, history }),
  });

  if (!response.ok) {
    throw new Error(`Ask request failed with status ${response.status}`);
  }

  return (await response.json()) as AskResponse;
}

export async function askGraphQuestion(question: string, history: string[] = []): Promise<AskGraphQuestionResult> {
  try {
    return {
      data: await requestLiveAsk(question, history),
      mode: "api",
    };
  } catch (error) {
    console.warn("/api/ask unavailable, falling back to static mock answers.", error);
    const [retrievalRecords, answerRecords] = await Promise.all([
      loadMockRetrievalResults(),
      loadMockAnswers(),
    ]);
    return {
      data: mergeStaticRecords(question, retrievalRecords, answerRecords),
      mode: "static",
    };
  }
}
