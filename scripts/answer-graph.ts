import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { retrieveGraphQuestion } from "./retrieve-graph.js";

type MatchedEntity = {
  id: string;
  label: string;
  type: string;
  anchor_text: string;
  match_mode: string;
  score: number;
};

type ProductHit = {
  product_id: string;
  label: string;
  product_type: string;
  category: string;
  subcategory: string;
  collection_or_series: string;
  price: string;
  price_range: string;
  matched_paths: string[];
  post_filter_group?: string;
  post_filter_reason?: string;
};

type ScentNoteHit = {
  scent_note_id: string;
  label: string;
  type: string;
  matched_paths: string[];
};

type FilterEvidence = {
  product_id: string;
  label: string;
  category_or_attribute_paths: string[];
  price_paths: string[];
};

type RetrievalResult = {
  query: string;
  intent: string;
  matched_entities: MatchedEntity[];
  direct_products: ProductHit[];
  indirect_or_bundle_products: ProductHit[];
  supporting_results: ProductHit[];
  uncertain_results: ProductHit[];
  target_product: ProductHit[];
  scent_notes: ScentNoteHit[];
  filter_evidence: FilterEvidence[];
  evidence_paths: string[];
  warnings: string[];
};

type AnswerResult = {
  query: string;
  intent: string;
  answer: string;
  answer_sections: string[];
  used_direct_products: string[];
  used_indirect_or_bundle_products: string[];
  used_scent_notes: string[];
  evidence_paths: string[];
  warnings: string[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function ensureString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = ensureString(value);
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push(cleaned);
  }
  return output;
}

function limitList(values: string[], max = 8): string[] {
  return values.slice(0, max);
}

function joinReadable(values: string[]): string {
  const cleaned = values.filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  return `${cleaned.slice(0, -1).join("、")}、${cleaned.at(-1)}`;
}

function productLabelSummary(product: ProductHit): string {
  const extra: string[] = [];
  if (product.product_type) extra.push(product.product_type);
  if (product.category) extra.push(product.category);
  if (product.price) extra.push(`${product.price}元`);
  return extra.length > 0 ? `${product.label}（${extra.join(" / ")}）` : product.label;
}

function collectTopEvidence(result: RetrievalResult, max = 8): string[] {
  return result.evidence_paths.slice(0, max);
}

function formatEmptyAnswer(result: RetrievalResult): AnswerResult {
  const message = "当前图谱中没有检索到符合条件的结果。";
  return {
    query: result.query,
    intent: result.intent,
    answer: message,
    answer_sections: [message],
    used_direct_products: [],
    used_indirect_or_bundle_products: [],
    used_scent_notes: [],
    evidence_paths: collectTopEvidence(result),
    warnings: result.warnings,
  };
}

function formatProductToScentNotes(result: RetrievalResult): AnswerResult {
  if (result.target_product.length === 0 && result.scent_notes.length === 0) {
    return formatEmptyAnswer(result);
  }

  const targetLabels = result.target_product.map((product) => product.label);
  const scentLabels = result.scent_notes.map((note) => note.label);
  const sections: string[] = [];

  if (targetLabels.length > 0) {
    sections.push(`检索目标是：${joinReadable(targetLabels)}。`);
  }
  if (scentLabels.length > 0) {
    sections.push(`当前图谱里关联到的香调包括：${joinReadable(scentLabels)}。`);
  } else {
    sections.push("当前图谱里没有检索到该商品关联的香调。")
  }

  return {
    query: result.query,
    intent: result.intent,
    answer: sections.join(" "),
    answer_sections: sections,
    used_direct_products: targetLabels,
    used_indirect_or_bundle_products: [],
    used_scent_notes: scentLabels,
    evidence_paths: collectTopEvidence(result),
    warnings: result.warnings,
  };
}

function formatFilteredProducts(result: RetrievalResult): AnswerResult {
  if (result.direct_products.length === 0 && result.indirect_or_bundle_products.length === 0) {
    return formatEmptyAnswer(result);
  }

  const matchedLabels = uniquePreserveOrder(result.matched_entities.map((entity) => entity.label));
  const filterClause = matchedLabels.length > 0
    ? `这些结果同时满足“${joinReadable(matchedLabels)}”以及价格过滤条件。`
    : "这些结果同时满足当前属性条件和价格过滤条件。";

  const directLabels = result.direct_products.map(productLabelSummary);
  const indirectLabels = result.indirect_or_bundle_products.map(productLabelSummary);
  const sections: string[] = [filterClause];

  if (directLabels.length > 0) {
    sections.push(`直接结果有：${joinReadable(limitList(directLabels))}。`);
  }
  if (indirectLabels.length > 0) {
    sections.push(`另外，礼盒/套装类结果有：${joinReadable(limitList(indirectLabels))}。`);
  }

  return {
    query: result.query,
    intent: result.intent,
    answer: sections.join(" "),
    answer_sections: sections,
    used_direct_products: result.direct_products.map((product) => product.label),
    used_indirect_or_bundle_products: result.indirect_or_bundle_products.map((product) => product.label),
    used_scent_notes: [],
    evidence_paths: collectTopEvidence(result),
    warnings: result.warnings,
  };
}

function formatProductsByEntity(result: RetrievalResult): AnswerResult {
  if (result.direct_products.length === 0 && result.indirect_or_bundle_products.length === 0) {
    return formatEmptyAnswer(result);
  }

  const directLabels = result.direct_products.map(productLabelSummary);
  const indirectLabels = result.indirect_or_bundle_products.map(productLabelSummary);
  const supportingLabels = result.supporting_results.map(productLabelSummary);
  const sections: string[] = [];

  if (directLabels.length > 0) {
    sections.push(`直接命中的商品有：${joinReadable(limitList(directLabels))}。`);
  }
  if (indirectLabels.length > 0) {
    sections.push(`礼盒、套装或组合类结果有：${joinReadable(limitList(indirectLabels))}。`);
  }
  if (supportingLabels.length > 0) {
    sections.push(`补充结果有：${joinReadable(limitList(supportingLabels))}。`);
  }
  if (sections.length === 0) {
    sections.push("当前图谱中没有检索到符合条件的结果。")
  }

  return {
    query: result.query,
    intent: result.intent,
    answer: sections.join(" "),
    answer_sections: sections,
    used_direct_products: result.direct_products.map((product) => product.label),
    used_indirect_or_bundle_products: result.indirect_or_bundle_products.map((product) => product.label),
    used_scent_notes: [],
    evidence_paths: collectTopEvidence(result),
    warnings: result.warnings,
  };
}

function formatFacetGrouping(result: RetrievalResult): AnswerResult {
  if (result.direct_products.length === 0) {
    return formatEmptyAnswer(result);
  }

  const facetSections: string[] = [];
  const candle = result.direct_products.filter((product) => /蜡烛/u.test([product.label, product.subcategory, product.category].join(" | ")));
  const roomSpray = result.direct_products.filter((product) => /室内喷雾/u.test([product.label, product.subcategory, product.category].join(" | ")));
  const bodyCare = result.direct_products.filter((product) => /身体护理|身体护肤|香氛之艺身体护理|body care/u.test([product.label, product.subcategory, product.category, product.product_type].join(" | ")));

  if (candle.length > 0) facetSections.push(`蜡烛类有：${joinReadable(limitList(candle.map((product) => product.label)))}。`);
  if (roomSpray.length > 0) facetSections.push(`室内喷雾类有：${joinReadable(limitList(roomSpray.map((product) => product.label)))}。`);
  if (bodyCare.length > 0) facetSections.push(`身体护理类有：${joinReadable(limitList(bodyCare.map((product) => product.label)))}。`);

  if (facetSections.length === 0) {
    return formatEmptyAnswer(result);
  }

  return {
    query: result.query,
    intent: result.intent,
    answer: facetSections.join(" "),
    answer_sections: facetSections,
    used_direct_products: result.direct_products.map((product) => product.label),
    used_indirect_or_bundle_products: result.indirect_or_bundle_products.map((product) => product.label),
    used_scent_notes: [],
    evidence_paths: collectTopEvidence(result),
    warnings: result.warnings,
  };
}

export function formatAnswerFromRetrieval(result: RetrievalResult): AnswerResult {
  if (
    result.direct_products.length === 0 &&
    result.indirect_or_bundle_products.length === 0 &&
    result.target_product.length === 0 &&
    result.scent_notes.length === 0
  ) {
    return formatEmptyAnswer(result);
  }

  switch (result.intent) {
    case "product_to_scent_notes":
      return formatProductToScentNotes(result);
    case "filtered_products":
      return formatFilteredProducts(result);
    case "group_products_by_facets":
      return formatFacetGrouping(result);
    case "products_by_entity":
    case "products_with_all_scent_notes":
    case "unknown":
    default:
      return formatProductsByEntity(result);
  }
}

export async function answerGraphQuestion(question: string): Promise<AnswerResult> {
  const retrieval = await retrieveGraphQuestion(question);
  return formatAnswerFromRetrieval(retrieval as RetrievalResult);
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run answer:graph -- "<question>"');
    process.exitCode = 1;
    return;
  }

  const question = args.join(" ").trim();
  const result = await answerGraphQuestion(question);
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}