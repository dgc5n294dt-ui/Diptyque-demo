import type { AskResponse } from "../lib/contracts.js";

type MockAnswerRecord = AskResponse & { id?: number };

function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

async function loadMockAnswers(): Promise<MockAnswerRecord[]> {
  const response = await fetch(publicUrl("answer-test-results.json"));
  if (!response.ok) {
    throw new Error(`Failed to load answer-test-results.json: ${response.status}`);
  }
  return (await response.json()) as MockAnswerRecord[];
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
    answer: "当前图谱中没有检索到相关信息。",
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

export async function askGraphQuestion(question: string): Promise<AskResponse> {
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

    return (await response.json()) as AskResponse;
  } catch (error) {
    console.warn("/api/ask unavailable, falling back to static mock answers.", error);
    const records = await loadMockAnswers();
    return findMockAnswer(records, question);
  }
}