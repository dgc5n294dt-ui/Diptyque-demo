import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ProductRecord = Record<string, string>;

type GraphNode = {
  id: string;
  label: string;
  type:
    | "Brand"
    | "Product"
    | "ProductType"
    | "Category"
    | "Subcategory"
    | "ScentNote"
    | "Ingredient"
    | "Size"
    | "PriceRange"
    | "CollectionOrSeries";
  data: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation:
    | "BY_BRAND"
    | "HAS_PRODUCT_TYPE"
    | "BELONGS_TO_CATEGORY"
    | "BELONGS_TO_SUBCATEGORY"
    | "HAS_SCENT_NOTE"
    | "HAS_INGREDIENT"
    | "HAS_SIZE"
    | "IN_PRICE_RANGE"
    | "PART_OF_COLLECTION";
  label: string;
};

type GraphStats = {
  brandCount: number;
  productCount: number;
  productTypeCount: number;
  categoryCount: number;
  subcategoryCount: number;
  scentNoteCount: number;
  ingredientCount: number;
  sizeCount: number;
  priceRangeCount: number;
  collectionCount: number;
  nodeCount: number;
  edgeCount: number;
  relationCounts: Record<string, number>;
  nodeTypeCounts: Record<string, number>;
};

type ProductGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
  ontology: {
    nodeTypes: string[];
    relationTypes: string[];
    description: string;
  };
};

type QualityReport = {
  productCount: number;
  nodeCount: number;
  edgeCount: number;
  nodeTypeCounts: Record<string, number>;
  relationCounts: Record<string, number>;
  hasDuplicateNodes: boolean;
  hasDuplicateEdges: boolean;
  missingSourceReferences: number;
  missingTargetReferences: number;
  isolatedProductCount: number;
  containsInvalidLiterals: boolean;
  ingredientNodeCountLimited: boolean;
  ingredientNodeCount: number;
  top10Nodes: GraphNode[];
  top10Edges: GraphEdge[];
  samplePaths: string[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const productsJsonPath = resolve(rootDir, "public/products.json");
const graphJsonPath = resolve(rootDir, "public/product-graph.json");
const ontologyDocPath = resolve(rootDir, "docs/ontology.md");

const BRAND_ID = "brand:diptyque";
const BRAND_LABEL = "Diptyque";
const MAX_INGREDIENT_LABEL_LENGTH = 40;
const MAX_INGREDIENT_NODE_COUNT = 80;

const invalidLiteralPattern = /(?:^|\b)(undefined|null|NaN)(?:\b|$)|\[object Object\]/i;
const pureMarketingLabels = new Set([
  "\u5f53\u5b63\u7cbe\u9009",
  "\u590f\u65e5\u62a4\u80a4\u4eea\u5f0f",
  "\u590f\u65e5\u6c14\u606f\u5bb6\u5c45\u9999\u6c1b",
  "\u590f\u65e5\u9650\u5b9a\u7cfb\u5217",
  "\u7ecf\u5178\u9999\u6c1b\uff0c\u7115\u65b0\u91cd\u5851",
  "\u793c\u8d5e\u7231\u610f",
  "\u9650\u65f6\u793c\u9047",
  "\u4eba\u6c14\u7cbe\u9009",
  "\u81fb\u9009\u793c\u8d60",
  "\u63a2\u7d22\u5168\u90e8",
  "\u5965\u8d39\u6069\u7115\u65b0\u56de\u5f52",
  "\u6c34\u5883\u82b1\u56ed\u590f\u65e5\u9650\u5b9a\u7cfb\u5217",
  "\u590f\u65e5\u9999\u6c1b",
]);
const categoryRejectSubstrings = ["http://", "https://", "<", ">"];
const scentRejectSubstrings = [
  "\u624b\u5de5",
  "\u5236\u4f5c",
  "\u7d20\u74f7",
  "\u73bb\u7483",
  "\u70db\u53f0",
  "\u6446\u4ef6",
  "\u8bbe\u8ba1",
  "\u62a4\u624b",
  "\u6da6\u80a4",
  "\u8eab\u4f53",
  "\u914d\u65b9",
  "\u955c\u9762",
  "\u6a2a\u683c",
  "\u65e0\u7ebf",
  "\u5438\u6536",
  "\u6210\u5206",
  "\u9002\u7528\u4e8e",
  "\u7167\u6599",
  "\u6253\u9020",
  "\u5370\u5237",
  "\u9676\u74f7",
  "\u8721\u5236",
  "\u5439\u5236",
  "\u51b7\u5f0f\u6269\u9999",
  "\u8461\u8404\u7259",
  "\u7ebf\u6761",
  "\u53cc\u624b",
  "\u6da6\u80a4\u971c",
  "\u591a\u6548",
  "\u6e05\u723d",
];
const scentRejectWords = [
  "\u9999\u6c34",
  "\u8721\u70db",
  "\u8eab\u4f53\u62a4\u7406",
  "\u88c5\u9970",
  "\u9650\u5b9a",
  "\u7ecf\u5178",
  "\u7cfb\u5217",
  "\u793c\u76d2",
  "\u8865\u5145\u88c5",
  "\u5957\u88c5",
];
const ingredientRejectSubstrings = [
  "\u5176\u4ed6\u5fae\u91cf\u6210\u5206",
  "\u6210\u5206\uff1a",
  "\u9999\u6c14\uff1a",
  "\u4f7f\u7528\u5efa\u8bae",
  "\u9002\u5408\u60a8\u7684\u4e2a\u4eba\u4f7f\u7528\u9700\u6c42",
  "\u786e\u8ba4\u76f8\u5173\u6210\u5206",
  "\u8bf4\u660e",
  "\u9700\u6c42",
  "http://",
  "https://",
  "<",
  ">",
];
const DOMAIN_SCENT_RULES: Array<{ term: string; outputs: string[] }> = [
  { term: "\u5e0c\u814a\u65e0\u82b1\u679c", outputs: ["\u5e0c\u814a\u65e0\u82b1\u679c", "\u65e0\u82b1\u679c"] },
  { term: "\u65e0\u82b1\u679c", outputs: ["\u65e0\u82b1\u679c"] },
  { term: "\u73ab\u7470\u9999\u8c03", outputs: ["\u73ab\u7470\u9999\u8c03", "\u73ab\u7470"] },
  { term: "\u73ab\u7470", outputs: ["\u73ab\u7470"] },
  { term: "\u5927\u9a6c\u58eb\u9769\u73ab\u7470", outputs: ["\u5927\u9a6c\u58eb\u9769\u73ab\u7470", "\u73ab\u7470"] },
  { term: "\u5343\u53f6\u73ab\u7470", outputs: ["\u5343\u53f6\u73ab\u7470", "\u73ab\u7470"] },
  { term: "\u6d46\u679c\u9999", outputs: ["\u6d46\u679c"] },
  { term: "\u6d46\u679c", outputs: ["\u6d46\u679c"] },
  { term: "\u9ed1\u52a0\u4ed1", outputs: ["\u9ed1\u52a0\u4ed1"] },
  { term: "\u9ed1\u918b\u6817", outputs: ["\u9ed1\u918b\u6817"] },
  { term: "\u9ed1\u918b\u6817\u82b1\u857e", outputs: ["\u9ed1\u918b\u6817\u82b1\u857e"] },
  { term: "\u9ed1\u918b\u6817\u53f6", outputs: ["\u9ed1\u918b\u6817\u53f6"] },
  { term: "\u665a\u9999\u7389", outputs: ["\u665a\u9999\u7389"] },
  { term: "\u6a80\u9999", outputs: ["\u6a80\u9999"] },
  { term: "\u96ea\u677e", outputs: ["\u96ea\u677e"] },
  { term: "\u85b0\u8863\u8349", outputs: ["\u85b0\u8863\u8349"] },
  { term: "\u9999\u8349", outputs: ["\u9999\u8349"] },
  { term: "\u9e9d\u9999", outputs: ["\u9e9d\u9999"] },
  { term: "\u8309\u8389", outputs: ["\u8309\u8389"] },
  { term: "\u6a59\u82b1", outputs: ["\u6a59\u82b1"] },
  { term: "\u4f5b\u624b\u67d1", outputs: ["\u4f5b\u624b\u67d1"] },
  { term: "\u5e7f\u85ff\u9999", outputs: ["\u5e7f\u85ff\u9999"] },
  { term: "\u6ca1\u836f", outputs: ["\u6ca1\u836f"] },
  { term: "\u711a\u9999", outputs: ["\u711a\u9999"] },
  { term: "\u5ca9\u73ab\u7470", outputs: ["\u5ca9\u73ab\u7470"] },
  { term: "\u5ca9\u8537\u8587", outputs: ["\u5ca9\u8537\u8587"] },
  { term: "\u8ff7\u8fed\u9999", outputs: ["\u8ff7\u8fed\u9999"] },
  { term: "\u7c89\u7ea2\u80e1\u6912", outputs: ["\u7c89\u7ea2\u80e1\u6912"] },
  { term: "\u675c\u677e\u5b50", outputs: ["\u675c\u677e\u5b50"] },
  { term: "\u96f6\u9675\u9999\u8c46", outputs: ["\u96f6\u9675\u9999\u8c46"] },
  { term: "\u82e6\u6a59\u53f6", outputs: ["\u82e6\u6a59\u53f6"] },
  { term: "\u542b\u7f9e\u8349", outputs: ["\u542b\u7f9e\u8349"] },
  { term: "\u4f9d\u5170\u9999\u8c03", outputs: ["\u4f9d\u5170"] },
  { term: "\u4f9d\u5170", outputs: ["\u4f9d\u5170"] },
  { term: "\u9e22\u5c3e\u82b1", outputs: ["\u9e22\u5c3e\u82b1"] },
  { term: "\u8354\u679d\u9999\u8c03", outputs: ["\u8354\u679d"] },
  { term: "\u8354\u679d", outputs: ["\u8354\u679d"] },
  { term: "\u7518\u8349", outputs: ["\u7518\u8349"] },
  { term: "\u751c\u674f\u4ec1", outputs: ["\u751c\u674f\u4ec1"] },
  { term: "\u6728\u8d28\u9999\u8c03", outputs: ["\u6728\u8d28\u9999\u8c03"] },
  { term: "\u82b1\u9999\u8c03", outputs: ["\u82b1\u9999\u8c03"] },
  { term: "\u679c\u9999\u8c03", outputs: ["\u679c\u9999\u8c03"] },
  { term: "\u8f9b\u9999\u8c03", outputs: ["\u8f9b\u9999\u8c03"] },
  { term: "\u8349\u672c\u9999\u8c03", outputs: ["\u8349\u672c\u9999\u8c03"] },
];

function ensureString(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text === "undefined" || text === "null" || text === "NaN" || text === "[object Object]") {
    return "";
  }
  return text;
}

function normalizeWhitespace(text: string): string {
  return ensureString(text)
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function splitPipe(text: string): string[] {
  return uniquePreserveOrder(ensureString(text).split("|").map((part) => normalizeWhitespace(part)));
}

function slugify(text: string): string {
  return ensureString(text)
    .toLowerCase()
    .replace(/[|/,\uFF0C\u3001\uFF1B;]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeNodeId(prefix: string, label: string): string {
  const slug = slugify(label);
  return slug ? `${prefix}:${slug}` : "";
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) {
    out[value] = (out[value] ?? 0) + 1;
  }
  return out;
}

function getPriceRange(price: string): { id: string; label: string } | null {
  const numeric = Number(ensureString(price));
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 499) return { id: "price-range:0-499", label: "0-499" };
  if (numeric <= 999) return { id: "price-range:500-999", label: "500-999" };
  if (numeric <= 1999) return { id: "price-range:1000-1999", label: "1000-1999" };
  return { id: "price-range:2000-plus", label: "2000+" };
}

function shouldKeepCategoryLike(label: string): boolean {
  const text = normalizeWhitespace(label);
  if (!text) return false;
  if (invalidLiteralPattern.test(text)) return false;
  if (pureMarketingLabels.has(text)) return false;
  if (categoryRejectSubstrings.some((token) => text.includes(token))) return false;
  if (/^\d+(?:\.\d+)?$/.test(text)) return false;
  return true;
}

function shouldKeepCollection(label: string): boolean {
  return shouldKeepCategoryLike(label);
}

function shouldKeepScentNote(label: string): boolean {
  const text = normalizeWhitespace(label);
  if (!text) return false;
  if (invalidLiteralPattern.test(text)) return false;
  if (text.length > 20) return false;
  if (text.includes("http://") || text.includes("https://")) return false;
  if (text.includes("<") || text.includes(">")) return false;
  if (/^\d+(?:\.\d+)?$/.test(text)) return false;
  if (["\u3002", "\uff01", "\uff1f", "\uff1b", ":", "\uff1a"].some((token) => text.includes(token))) return false;
  if (/\d/.test(text) && ["ml", "ML", "mL", "g", "G", "L", "\u5143", "\uffe5", "\u00a5"].some((token) => text.includes(token))) return false;
  if (scentRejectSubstrings.some((token) => text.includes(token))) return false;
  if (scentRejectWords.some((token) => text.includes(token))) return false;
  if (text.length > 12 && /[\u3001\uff0c,|/]/u.test(text)) return false;
  return true;
}

function shouldKeepIngredient(label: string): boolean {
  const text = normalizeWhitespace(label);
  if (!text) return false;
  if (invalidLiteralPattern.test(text)) return false;
  if (text.length > MAX_INGREDIENT_LABEL_LENGTH) return false;
  if (/^\d+(?:\.\d+)?$/.test(text)) return false;
  if (ingredientRejectSubstrings.some((token) => text.includes(token))) return false;
  if (["\u3002", "\uff01", "\uff1f", "\uff1b", ":", "\uff1a"].some((token) => text.includes(token)) && text.length > 20) return false;
  return true;
}

function parseShortValues(text: string, maxLen: number): string[] {
  return splitPipe(text).filter((value) => value.length > 0 && value.length <= maxLen);
}

function normalizeEntityToken(token: string): string {
  return normalizeWhitespace(
    token
      .replace(/^\u6210\u5206[:\uff1a]?\s*/u, "")
      .replace(/^\u5176\u4ed6\u5fae\u91cf\u6210\u5206[:\uff1a]?\s*/u, "")
      .replace(/\u7684\u9999\u6c14$/u, "")
      .replace(/\u9999\u6c14$/u, "")
      .replace(/\u6210\u5206$/u, "")
      .replace(/[()\uFF08\uFF09]+$/u, "")
  );
}

function expandEntityCandidates(text: string, maxLen: number): string[] {
  const seeds = parseShortValues(text, maxLen);
  const expanded: string[] = [];
  for (const seed of seeds) {
    const normalized = normalizeEntityToken(seed);
    if (normalized) expanded.push(normalized);
    if (seed.includes("\u548c") || seed.includes("\u53ca") || seed.includes("\u4e0e")) {
      const parts = seed
        .replace(/\u53ca/g, "|")
        .replace(/\u4e0e/g, "|")
        .replace(/\u548c/g, "|")
        .split("|")
        .map((part) => normalizeEntityToken(part))
        .filter(Boolean);
      expanded.push(...parts);
    }
  }
  return uniquePreserveOrder(expanded.filter((item) => item.length > 0 && item.length <= maxLen));
}

function collectDomainScentTerms(product: ProductRecord): {
  direct: string[];
  nameIdentity: string[];
  description: string[];
  weak: string[];
} {
  const directSources = [
    ensureString(product.notes),
    ensureString(product.subtitle),
    ensureString(product.fragrance),
  ];
  const nameIdentitySources = [
    ensureString(product.product_name),
    ensureString(product.identity_name),
  ];
  const descriptionSources = [
    ensureString(product.description),
    ensureString(product.long_description),
  ];
  const weakSources = [
    ensureString(product.category),
    ensureString(product.subcategory),
    ensureString(product.collection_or_series),
    ensureString(product.entity_tags),
    ensureString(product.search_text),
  ];

  const directMatches: string[] = [];
  const nameIdentityMatches: string[] = [];
  const descriptionMatches: string[] = [];
  const weakMatches: string[] = [];

  for (const rule of DOMAIN_SCENT_RULES) {
    if (directSources.some((text) => text.includes(rule.term))) {
      directMatches.push(...rule.outputs);
      continue;
    }
    if (nameIdentitySources.some((text) => text.includes(rule.term))) {
      nameIdentityMatches.push(...rule.outputs);
      continue;
    }
    if (descriptionSources.some((text) => text.includes(rule.term))) {
      descriptionMatches.push(...rule.outputs);
      continue;
    }
    if (weakSources.some((text) => text.includes(rule.term))) {
      weakMatches.push(...rule.outputs);
    }
  }

  return {
    direct: uniquePreserveOrder(directMatches).filter(shouldKeepScentNote),
    nameIdentity: uniquePreserveOrder(nameIdentityMatches).filter(shouldKeepScentNote),
    description: uniquePreserveOrder(descriptionMatches).filter(shouldKeepScentNote),
    weak: uniquePreserveOrder(weakMatches).filter(shouldKeepScentNote),
  };
}

function isFragranceCarrierProduct(product: ProductRecord): boolean {
  const productType = ensureString(product.product_type);
  const allowedType = ["candle", "fragrance", "perfume", "home fragrance", "body care"].includes(productType);
  if (!allowedType) return false;
  const text = [
    ensureString(product.product_name),
    ensureString(product.identity_name),
    ensureString(product.category),
    ensureString(product.subcategory),
    ensureString(product.category_path),
  ].join(" | ");
  const blockerTerms = [
    "??",
    "??",
    "???",
    "??",
    "??",
    "??",
    "??",
    "??",
  ];
  return !blockerTerms.some((term) => text.includes(term));
}

function getScentNotes(product: ProductRecord): string[] {
  const direct = [
    ...expandEntityCandidates(product.notes, 20),
    ...expandEntityCandidates(product.subtitle, 20),
    ...expandEntityCandidates(product.fragrance, 20),
  ].filter(shouldKeepScentNote);

  const domain = collectDomainScentTerms(product);
  const fromFragranceFields = uniquePreserveOrder([...direct, ...domain.direct]).filter(shouldKeepScentNote);
  const isCarrier = isFragranceCarrierProduct(product);

  if (!isCarrier) {
    return fromFragranceFields;
  }

  const finalNotes = uniquePreserveOrder([
    ...fromFragranceFields,
    ...domain.nameIdentity,
    ...domain.description,
  ]).filter(shouldKeepScentNote);

  return finalNotes;
}

function getIngredientCandidates(text: string): string[] {
  return expandEntityCandidates(text, MAX_INGREDIENT_LABEL_LENGTH).filter(shouldKeepIngredient);
}

class GraphBuilder {
  private nodeMap = new Map<string, GraphNode>();
  private edgeMap = new Map<string, GraphEdge>();

  addNode(node: GraphNode): void {
    if (!node.id || this.nodeMap.has(node.id)) return;
    this.nodeMap.set(node.id, node);
  }

  addEdge(source: string, relation: GraphEdge["relation"], target: string, label: string): void {
    if (!source || !target) return;
    const edgeKey = `${source}::${relation}::${target}`;
    if (this.edgeMap.has(edgeKey)) return;
    this.edgeMap.set(edgeKey, {
      id: `edge:${slugify(edgeKey)}`,
      source,
      target,
      relation,
      label,
    });
  }

  nodes(): GraphNode[] {
    return Array.from(this.nodeMap.values());
  }

  edges(): GraphEdge[] {
    return Array.from(this.edgeMap.values());
  }
}

function buildOntologyDoc(): string {
  return `# Product Ontology

## Why this project needs an ontology

This project is not only a product catalog. It needs a product ontology so the data can be represented as a structured knowledge graph instead of a flat table. That ontology makes product attributes, categories, scent notes, sizes, collections, and brand relationships explicit and queryable. This is important both for graph visualization and for the later Graph-RAG retrieval pipeline.

## Node types

- \`Brand\`: the product brand. In the current dataset this is a single fixed node, Diptyque.
- \`Product\`: one node per cleaned product record. Each product node keeps the full cleaned payload in \`data\`.
- \`ProductType\`: normalized product type such as candle, fragrance, decoration, perfume, home fragrance, or body care.
- \`Category\`: the main product category.
- \`Subcategory\`: the more specific product subcategory.
- \`ScentNote\`: scent or olfactory note extracted from \`notes\` and domain scent term recall.
- \`Ingredient\`: ingredient tokens derived from \`ingredients\`, limited to shorter and more reusable entities.
- \`Size\`: size or specification tokens such as 190G or 75ML.
- \`PriceRange\`: price bucket nodes instead of exact price nodes.
- \`CollectionOrSeries\`: collection or series names when the cleaned dataset provides them.

## Relation types

- \`BY_BRAND\`: Product -> Brand
- \`HAS_PRODUCT_TYPE\`: Product -> ProductType
- \`BELONGS_TO_CATEGORY\`: Product -> Category
- \`BELONGS_TO_SUBCATEGORY\`: Product -> Subcategory
- \`HAS_SCENT_NOTE\`: Product -> ScentNote
- \`HAS_INGREDIENT\`: Product -> Ingredient
- \`HAS_SIZE\`: Product -> Size
- \`IN_PRICE_RANGE\`: Product -> PriceRange
- \`PART_OF_COLLECTION\`: Product -> CollectionOrSeries

## Field source mapping

- Input source for graph building: \`public/products.json\`
- Product node payload source: all fields from the cleaned product schema
- ProductType nodes: \`product_type\`
- Category nodes: \`category\`
- Subcategory nodes: \`subcategory\`
- ScentNote nodes: direct \`notes\`/\`subtitle\`/\`fragrance\` candidates plus domain scent vocabulary matches from product text fields
- Ingredient nodes: \`ingredients\`
- Size nodes: \`size\`
- PriceRange nodes: derived from \`price\`
- CollectionOrSeries nodes: \`collection_or_series\`

## Why PriceRange uses buckets instead of exact price

Using a price range node is better than generating one node per exact price because:

- it keeps the graph smaller and easier to read
- it avoids low-value fragmentation
- it is more useful for retrieval and user questions such as "which products are in the 500-999 range?"
- it generalizes better when prices change slightly

## Why Ingredient nodes are limited

Ingredient text can be very long and noisy. If every token became a node, the graph would be dominated by overly specific or low-value ingredient entities. The current graph therefore limits ingredient nodes by:

- requiring shorter labels
- favoring recurring ingredients
- keeping only the top 80 most frequent ingredient nodes

This preserves the graph's readability and retrieval value while keeping full ingredient text inside the Product node data.

## product-graph.json structure

The graph output file has this top-level structure:

\`\`\`json
{
  "nodes": [],
  "edges": [],
  "stats": {},
  "ontology": {}
}
\`\`\`

- \`nodes\`: every graph node with \`id\`, \`label\`, \`type\`, and \`data\`
- \`edges\`: every graph edge with \`id\`, \`source\`, \`target\`, \`relation\`, and \`label\`
- \`stats\`: graph counts and relation/type summaries
- \`ontology\`: compact ontology metadata for the frontend and future graph tooling

## Current graph-building limitations

- It depends entirely on the deterministic cleaned dataset and does not infer new semantics beyond the cleaned fields.
- \`collection_or_series\` coverage is limited by what the cleaning step could infer.
- Ingredient nodes are frequency-limited and may omit rare ingredients.
- Category and subcategory quality still depends on the upstream cleaned taxonomy, which may contain some source-site ambiguity.
- Domain scent recall uses a curated vocabulary and does not yet perform synonym expansion beyond the configured rules.
- This graph removes only a narrow set of obvious marketing labels and obvious false scent or ingredient entities.

## Future extensions

This ontology can later be extended for:

- Graph-RAG retrieval over graph neighborhoods
- embedding generation for node and edge text
- vector search for semantic recall
- a backend graph query API
- Neo4j property graph storage
- RDF / OWL export for semantic-web workflows
- synonym, alias, and bilingual entity layers
`;
}

async function main(): Promise<void> {
  const raw = await readFile(productsJsonPath, "utf-8");
  const products = JSON.parse(raw) as ProductRecord[];

  const builder = new GraphBuilder();
  builder.addNode({
    id: BRAND_ID,
    label: BRAND_LABEL,
    type: "Brand",
    data: { brand: "Diptyque" },
  });

  const ingredientCandidates: string[] = [];
  for (const product of products) {
    ingredientCandidates.push(...getIngredientCandidates(product.ingredients));
  }

  const ingredientFrequency = Object.entries(countBy(ingredientCandidates))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_INGREDIENT_NODE_COUNT);
  const allowedIngredients = new Set(ingredientFrequency.map(([label]) => label));

  for (const product of products) {
    const productNodeId = `product:${ensureString(product.product_id)}`;
    builder.addNode({
      id: productNodeId,
      label: ensureString(product.product_name),
      type: "Product",
      data: { ...product },
    });

    builder.addEdge(productNodeId, "BY_BRAND", BRAND_ID, "by brand");

    const productType = ensureString(product.product_type);
    if (productType) {
      const nodeId = makeNodeId("product-type", productType);
      if (nodeId) {
        builder.addNode({ id: nodeId, label: productType, type: "ProductType", data: {} });
        builder.addEdge(productNodeId, "HAS_PRODUCT_TYPE", nodeId, "has product type");
      }
    }

    const category = shouldKeepCategoryLike(product.category) ? ensureString(product.category) : "";
    if (category) {
      const nodeId = makeNodeId("category", category);
      if (nodeId) {
        builder.addNode({ id: nodeId, label: category, type: "Category", data: {} });
        builder.addEdge(productNodeId, "BELONGS_TO_CATEGORY", nodeId, "belongs to category");
      }
    }

    const subcategory = shouldKeepCategoryLike(product.subcategory) ? ensureString(product.subcategory) : "";
    if (subcategory) {
      const nodeId = makeNodeId("subcategory", subcategory);
      if (nodeId) {
        builder.addNode({ id: nodeId, label: subcategory, type: "Subcategory", data: {} });
        builder.addEdge(productNodeId, "BELONGS_TO_SUBCATEGORY", nodeId, "belongs to subcategory");
      }
    }

    for (const note of getScentNotes(product)) {
      const nodeId = makeNodeId("scent-note", note);
      if (!nodeId) continue;
      builder.addNode({ id: nodeId, label: note, type: "ScentNote", data: {} });
      builder.addEdge(productNodeId, "HAS_SCENT_NOTE", nodeId, "has scent note");
    }

    for (const ingredient of getIngredientCandidates(product.ingredients)) {
      if (!allowedIngredients.has(ingredient)) continue;
      const nodeId = makeNodeId("ingredient", ingredient);
      if (!nodeId) continue;
      builder.addNode({ id: nodeId, label: ingredient, type: "Ingredient", data: {} });
      builder.addEdge(productNodeId, "HAS_INGREDIENT", nodeId, "has ingredient");
    }

    for (const size of splitPipe(product.size)) {
      const nodeId = makeNodeId("size", size);
      if (!nodeId) continue;
      builder.addNode({ id: nodeId, label: size, type: "Size", data: {} });
      builder.addEdge(productNodeId, "HAS_SIZE", nodeId, "has size");
    }

    const priceRange = getPriceRange(product.price);
    if (priceRange) {
      builder.addNode({ id: priceRange.id, label: priceRange.label, type: "PriceRange", data: {} });
      builder.addEdge(productNodeId, "IN_PRICE_RANGE", priceRange.id, "in price range");
    }

    const collection = shouldKeepCollection(product.collection_or_series)
      ? ensureString(product.collection_or_series)
      : "";
    if (collection) {
      const nodeId = makeNodeId("collection", collection);
      if (nodeId) {
        builder.addNode({ id: nodeId, label: collection, type: "CollectionOrSeries", data: {} });
        builder.addEdge(productNodeId, "PART_OF_COLLECTION", nodeId, "part of collection");
      }
    }
  }

  const nodes = builder.nodes();
  const edges = builder.edges();
  const nodeTypeCounts = countBy(nodes.map((node) => node.type));
  const relationCounts = countBy(edges.map((edge) => edge.relation));

  const graph: ProductGraph = {
    nodes,
    edges,
    stats: {
      brandCount: nodeTypeCounts.Brand ?? 0,
      productCount: nodeTypeCounts.Product ?? 0,
      productTypeCount: nodeTypeCounts.ProductType ?? 0,
      categoryCount: nodeTypeCounts.Category ?? 0,
      subcategoryCount: nodeTypeCounts.Subcategory ?? 0,
      scentNoteCount: nodeTypeCounts.ScentNote ?? 0,
      ingredientCount: nodeTypeCounts.Ingredient ?? 0,
      sizeCount: nodeTypeCounts.Size ?? 0,
      priceRangeCount: nodeTypeCounts.PriceRange ?? 0,
      collectionCount: nodeTypeCounts.CollectionOrSeries ?? 0,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      relationCounts,
      nodeTypeCounts,
    },
    ontology: {
      nodeTypes: [
        "Brand",
        "Product",
        "ProductType",
        "Category",
        "Subcategory",
        "ScentNote",
        "Ingredient",
        "Size",
        "PriceRange",
        "CollectionOrSeries",
      ],
      relationTypes: [
        "BY_BRAND",
        "HAS_PRODUCT_TYPE",
        "BELONGS_TO_CATEGORY",
        "BELONGS_TO_SUBCATEGORY",
        "HAS_SCENT_NOTE",
        "HAS_INGREDIENT",
        "HAS_SIZE",
        "IN_PRICE_RANGE",
        "PART_OF_COLLECTION",
      ],
      description: "Diptyque product ontology for product knowledge graph and Graph-RAG demo.",
    },
  };

  const nodeIds = new Set(nodes.map((node) => node.id));
  const productNodeIds = new Set(nodes.filter((node) => node.type === "Product").map((node) => node.id));
  const productAdjacency = new Map<string, number>();
  for (const id of productNodeIds) productAdjacency.set(id, 0);
  for (const edge of edges) {
    if (productAdjacency.has(edge.source)) {
      productAdjacency.set(edge.source, (productAdjacency.get(edge.source) ?? 0) + 1);
    }
    if (productAdjacency.has(edge.target)) {
      productAdjacency.set(edge.target, (productAdjacency.get(edge.target) ?? 0) + 1);
    }
  }

  const hasDuplicateNodes = nodeIds.size !== nodes.length;
  const uniqueEdgeKeys = new Set(edges.map((edge) => `${edge.source}::${edge.relation}::${edge.target}`));
  const hasDuplicateEdges = uniqueEdgeKeys.size !== edges.length;
  const missingSourceReferences = edges.filter((edge) => !nodeIds.has(edge.source)).length;
  const missingTargetReferences = edges.filter((edge) => !nodeIds.has(edge.target)).length;
  const isolatedProductCount = Array.from(productAdjacency.values()).filter((count) => count === 0).length;
  const containsInvalidLiterals = JSON.stringify(graph).match(invalidLiteralPattern) !== null;
  const ingredientNodeCount = nodeTypeCounts.Ingredient ?? 0;

  const edgeByRelation = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const current = edgeByRelation.get(edge.relation) ?? [];
    current.push(edge);
    edgeByRelation.set(edge.relation, current);
  }
  const labelById = new Map(nodes.map((node) => [node.id, node.label]));
  const nodeLabel = (id: string): string => labelById.get(id) ?? id;
  const firstEdge = (relation: GraphEdge["relation"]): GraphEdge | undefined => edgeByRelation.get(relation)?.[0];

  const samplePaths: string[] = [];
  const figEdge = edges.find((edge) => edge.relation === "HAS_SCENT_NOTE" && edge.target === "scent-note:\u65e0\u82b1\u679c");
  if (figEdge) {
    const categoryEdge = edges.find((edge) => edge.source === figEdge.source && edge.relation === "BELONGS_TO_CATEGORY");
    if (categoryEdge) {
      samplePaths.push(
        `ScentNote: ${nodeLabel(figEdge.target)} <- HAS_SCENT_NOTE <- Product: ${nodeLabel(figEdge.source)} -> BELONGS_TO_CATEGORY -> Category: ${nodeLabel(categoryEdge.target)}`,
      );
    }
  }
  const scentEdge = firstEdge("HAS_SCENT_NOTE");
  if (scentEdge && samplePaths.length < 5) {
    const categoryEdge = edges.find((edge) => edge.source === scentEdge.source && edge.relation === "BELONGS_TO_CATEGORY");
    if (categoryEdge) {
      samplePaths.push(
        `ScentNote: ${nodeLabel(scentEdge.target)} <- HAS_SCENT_NOTE <- Product: ${nodeLabel(scentEdge.source)} -> BELONGS_TO_CATEGORY -> Category: ${nodeLabel(categoryEdge.target)}`,
      );
    }
  }
  const sizeEdge = firstEdge("HAS_SIZE");
  if (sizeEdge) samplePaths.push(`Product: ${nodeLabel(sizeEdge.source)} -> HAS_SIZE -> Size: ${nodeLabel(sizeEdge.target)}`);
  const priceEdge = firstEdge("IN_PRICE_RANGE");
  if (priceEdge) samplePaths.push(`Product: ${nodeLabel(priceEdge.source)} -> IN_PRICE_RANGE -> PriceRange: ${nodeLabel(priceEdge.target)}`);
  const brandEdge = firstEdge("BY_BRAND");
  if (brandEdge) samplePaths.push(`Product: ${nodeLabel(brandEdge.source)} -> BY_BRAND -> Brand: ${nodeLabel(brandEdge.target)}`);
  const typeEdge = firstEdge("HAS_PRODUCT_TYPE");
  if (typeEdge) samplePaths.push(`Product: ${nodeLabel(typeEdge.source)} -> HAS_PRODUCT_TYPE -> ProductType: ${nodeLabel(typeEdge.target)}`);
  const uniquePaths = uniquePreserveOrder(samplePaths).slice(0, 5);

  const qualityReport: QualityReport = {
    productCount: nodeTypeCounts.Product ?? 0,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypeCounts,
    relationCounts,
    hasDuplicateNodes,
    hasDuplicateEdges,
    missingSourceReferences,
    missingTargetReferences,
    isolatedProductCount,
    containsInvalidLiterals,
    ingredientNodeCountLimited: ingredientNodeCount <= MAX_INGREDIENT_NODE_COUNT,
    ingredientNodeCount,
    top10Nodes: nodes.slice(0, 10),
    top10Edges: edges.slice(0, 10),
    samplePaths: uniquePaths,
  };

  await writeFile(graphJsonPath, `${JSON.stringify(graph, null, 2)}\n`, "utf-8");
  await writeFile(ontologyDocPath, buildOntologyDoc(), "utf-8");
  console.log(JSON.stringify(qualityReport, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
