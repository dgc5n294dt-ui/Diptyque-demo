import type { AskResponse } from "../lib/contracts.js";

type DeepSeekPrompt = {
  system: string;
  user: string;
  context: Record<string, unknown>;
};

function compressProducts(products: AskResponse["direct_products"]): unknown[] {
  return products.slice(0, 12).map((product) => ({
    product_id: product.product_id,
    label: product.label,
    product_type: product.product_type,
    category: product.category,
    price: product.price,
    post_filter_reason: product.post_filter_reason ?? "",
  }));
}

function compressScentNotes(scentNotes: AskResponse["scent_notes"]): unknown[] {
  return scentNotes.slice(0, 12).map((note) => ({
    scent_note_id: note.scent_note_id,
    label: note.label,
  }));
}

export function buildAnswerPrompt(response: AskResponse): DeepSeekPrompt {
  const context = {
    query: response.query,
    intent: response.intent,
    matched_entities: response.matched_entities,
    direct_products: compressProducts(response.direct_products),
    indirect_or_bundle_products: compressProducts(response.indirect_or_bundle_products),
    supporting_results: compressProducts(response.supporting_results),
    uncertain_results: compressProducts(response.uncertain_results),
    target_product: compressProducts(response.target_product),
    scent_notes: compressScentNotes(response.scent_notes),
    filter_evidence: response.filter_evidence.slice(0, 10),
    evidence_paths: response.evidence_paths.slice(0, 16),
    warnings: response.warnings,
  };

  return {
    system: [
      "你是 Diptyque 商品知识图谱问答助手。",
      "你只能使用给定的 retrieval result 回答。",
      "不要编造 retrieval result 中不存在的商品、香调、价格、分类或关系。",
      "如果 retrieval result 没有足够证据，请说明当前图谱中没有检索到。",
      "请优先区分直接相关商品和礼盒/套装/间接相关商品。",
      "回答后保留简短证据摘要。",
    ].join(" "),
    user: `请仅基于以下 retrieval result 回答用户问题。用户问题：${response.query}\n\nretrieval result:\n${JSON.stringify(context, null, 2)}`,
    context,
  };
}