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
    subcategory: product.subcategory,
    collection_or_series: product.collection_or_series,
    price: product.price,
    price_range: product.price_range,
    post_filter_reason: product.post_filter_reason ?? "",
  }));
}

function compressScentNotes(scentNotes: AskResponse["scent_notes"]): unknown[] {
  return scentNotes.slice(0, 12).map((note) => ({
    scent_note_id: note.scent_note_id,
    label: note.label,
  }));
}

export function buildAnswerPrompt(response: AskResponse, history: string[] = []): DeepSeekPrompt {
  const context = {
    query: response.query,
    intent: response.intent,
    recent_history: history.slice(-4),
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
      "你是 Diptyque 的智能导购回答层。",
      "你只能基于给定 retrieval result 回答，不能编造结果之外的商品、香调、系列、价格、规格或关系。",
      "如果 recent_history 提供了上一轮对话，你可以在当前回答中利用这些上下文，但不能突破当前 retrieval result 的事实边界。",
      "你要先直接回答顾客问题，再按顾客关心的使用场景组织结果。",
      "请明确区分 direct_products 和 indirect_or_bundle_products。",
      "你可以解释为什么某些商品更符合需求，但解释必须能从 retrieval result 或 evidence_paths 中找到依据。",
      "如果图谱证据不足，请明确说明当前检索结果不足，而不是凭常识补全。",
      "回答语气应自然、专业、像导购，不要写成数据库字段说明。",
    ].join(" "),
    user: `请仅基于以下 retrieval result 回答用户问题。用户问题：${response.query}\n\nretrieval result:\n${JSON.stringify(context, null, 2)}`,
    context,
  };
}
