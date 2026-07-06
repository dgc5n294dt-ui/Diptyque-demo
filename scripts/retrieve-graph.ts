import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type GraphNodeType =
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

type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  data: Record<string, unknown>;
};

type GraphEdgeRelation =
  | "BY_BRAND"
  | "HAS_PRODUCT_TYPE"
  | "BELONGS_TO_CATEGORY"
  | "BELONGS_TO_SUBCATEGORY"
  | "HAS_SCENT_NOTE"
  | "HAS_INGREDIENT"
  | "HAS_SIZE"
  | "IN_PRICE_RANGE"
  | "PART_OF_COLLECTION";

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: GraphEdgeRelation;
  label: string;
};

type ProductGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: Record<string, unknown>;
  ontology: Record<string, unknown>;
};

type MatchedEntity = {
  id: string;
  label: string;
  type: GraphNodeType;
  anchor_text: string;
  match_mode: "exact" | "contains";
  score: number;
};

type ProductGroupName =
  | "direct_products"
  | "indirect_or_bundle_products"
  | "supporting_results"
  | "uncertain_results";

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
  post_filter_group?: ProductGroupName;
  post_filter_reason?: string;
};

type NodeHit = {
  scent_note_id: string;
  label: string;
  type: GraphNodeType;
  matched_paths: string[];
};

type RetrievalIntent =
  | "products_by_entity"
  | "product_to_scent_notes"
  | "products_with_all_scent_notes"
  | "group_products_by_facets"
  | "filtered_products"
  | "unknown";

type QueryPlan = {
  intent: RetrievalIntent;
  anchor_texts: string[];
  preferred_types?: GraphNodeType[];
  min_price?: number;
  facets?: string[];
  use_two_hop_product_expansion?: boolean;
};

type ProductGroups = Record<ProductGroupName, ProductHit[]>;

type FilterEvidence = {
  product_id: string;
  label: string;
  category_or_attribute_paths: string[];
  price_paths: string[];
};

type RetrievalResult = {
  query: string;
  intent: RetrievalIntent;
  matched_entities: MatchedEntity[];
  direct_products: ProductHit[];
  indirect_or_bundle_products: ProductHit[];
  supporting_results: ProductHit[];
  uncertain_results: ProductHit[];
  target_product: ProductHit[];
  scent_notes: NodeHit[];
  filter_evidence: FilterEvidence[];
  evidence_paths: string[];
  warnings: string[];
};

type MutableProductHit = {
  node: GraphNode;
  evidence: Set<string>;
};

type MutableNodeHit = {
  node: GraphNode;
  evidence: Set<string>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const graphJsonPath = resolve(rootDir, "public/product-graph.json");
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const meaningfulRelationsForTwoHop = new Set<GraphEdgeRelation>([
  "HAS_SCENT_NOTE",
  "BELONGS_TO_CATEGORY",
  "BELONGS_TO_SUBCATEGORY",
  "PART_OF_COLLECTION",
]);
const entityTypePriority: Record<GraphNodeType, number> = {
  Product: 100,
  ScentNote: 90,
  CollectionOrSeries: 80,
  Category: 70,
  Subcategory: 60,
  ProductType: 50,
  PriceRange: 40,
  Ingredient: 30,
  Size: 20,
  Brand: 10,
};
const ENTITY_TYPE_DISPLAY: Record<GraphNodeType, string> = {
  Brand: "Brand",
  Product: "Product",
  ProductType: "ProductType",
  Category: "Category",
  Subcategory: "Subcategory",
  ScentNote: "ScentNote",
  Ingredient: "Ingredient",
  Size: "Size",
  PriceRange: "PriceRange",
  CollectionOrSeries: "CollectionOrSeries",
};
const bundleProductPattern = /\u793C\u76D2|\u5957\u88C5|\u7EC4\u5408\u88C5|\u7EC4\u5408|\u4E94\u652F\u88C5|5\u53EA\u88C5|\u4F53\u9A8C\u5957\u88C5/u;
const CH = {
  questionMark: "\uFF1F",
  comma: "\uFF0C",
  dunhao: "\u3001",
  contains: "\u542B\u6709",
  products: "\u4EA7\u54C1",
  goods: "\u5546\u54C1",
  relatedGoods: "\u76F8\u5173\u5546\u54C1",
  scentNotes: "\u9999\u8C03",
  whatScentNotes: "\u6709\u54EA\u4E9B\u9999\u8C03",
  hasWhatScentNotes: "\u5305\u542B\u54EA\u4E9B\u9999\u8C03",
  related: "\u76F8\u5173",
  and: "\u548C",
  also: "\u540C\u65F6\u5305\u542B",
  orAndSeparators: /[\u548C\u53CA\u4E0E\u3001]/u,
  whichAre: "\u54EA\u4E9B\u662F",
  inside: "\u91CC",
  aboveYuan: "\u5143\u4EE5\u4E0A",
  fig: "\u65E0\u82B1\u679C",
  lavender: "\u85B0\u8863\u8349",
  cedar: "\u96EA\u677E",
  candle: "\u8721\u70DB",
  roomSpray: "\u5BA4\u5185\u55B7\u96FE",
  bodyCare: "\u8EAB\u4F53\u62A4\u7406",
  bodyCareAlt: "\u8EAB\u4F53\u62A4\u80A4",
  perfumedBodyCare: "\u9999\u6C1B\u4E4B\u827A\u8EAB\u4F53\u62A4\u7406",
  noAnchorWarning: "No anchor text could be derived from the question.",
  noEntityWarning: "No graph entities matched the derived anchor text.",
} as const;

function ensureString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeText(text: string): string {
  return ensureString(text)
    .toLowerCase()
    .replace(/[\s\r\n\t]+/g, "")
    .replace(/[^\p{L}\p{N}+]+/gu, "");
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

function cleanupAnchorText(text: string): string {
  return ensureString(text)
    .replace(/[?\uFF1F]/g, "")
    .replace(/^(?:\u6709\u54EA\u4E9B|\u54EA\u4E9B)/u, "")
    .replace(/^\u542B\u6709/u, "")
    .replace(/(?:\u7684)?(?:\u76F8\u5173)?(?:\u5546\u54C1|\u4EA7\u54C1)$/u, "")
    .replace(/(?:\u7684)?\u9999\u8C03$/u, "")
    .replace(/\u91CC$/u, "")
    .trim();
}

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((left, right) => {
    const priorityDelta = entityTypePriority[right.type] - entityTypePriority[left.type];
    if (priorityDelta !== 0) return priorityDelta;
    const labelDelta = right.label.length - left.label.length;
    if (labelDelta !== 0) return labelDelta;
    return collator.compare(left.label, right.label);
  });
}

function compareProductHits(left: ProductHit, right: ProductHit): number {
  return collator.compare(left.label, right.label) || collator.compare(left.product_id, right.product_id);
}

function compareNodeHits(left: NodeHit, right: NodeHit): number {
  const typeDelta = entityTypePriority[right.type] - entityTypePriority[left.type];
  if (typeDelta !== 0) return typeDelta;
  return collator.compare(left.label, right.label) || collator.compare(left.scent_note_id, right.scent_note_id);
}

function formatNode(node: GraphNode): string {
  return `${ENTITY_TYPE_DISPLAY[node.type]}: ${node.label}`;
}

function getProductField(node: GraphNode, field: string): string {
  return ensureString(node.data?.[field]);
}

function getProductPriceRangeLabelFromPaths(paths: string[]): string {
  const pricePath = paths.find((path) => path.includes("-> IN_PRICE_RANGE -> PriceRange:"));
  if (!pricePath) return "";
  const match = pricePath.match(/PriceRange: (.+)$/);
  return match ? ensureString(match[1]) : "";
}

class GraphIndex {
  readonly graph: ProductGraph;
  readonly nodesById = new Map<string, GraphNode>();
  readonly outgoingBySource = new Map<string, GraphEdge[]>();
  readonly incomingByTarget = new Map<string, GraphEdge[]>();
  readonly productNodes: GraphNode[];
  readonly candidateEntityNodes: GraphNode[];

  private constructor(graph: ProductGraph) {
    this.graph = graph;
    for (const node of graph.nodes) {
      this.nodesById.set(node.id, node);
    }
    for (const edge of graph.edges) {
      const outgoing = this.outgoingBySource.get(edge.source) ?? [];
      outgoing.push(edge);
      this.outgoingBySource.set(edge.source, outgoing);

      const incoming = this.incomingByTarget.get(edge.target) ?? [];
      incoming.push(edge);
      this.incomingByTarget.set(edge.target, incoming);
    }
    this.productNodes = graph.nodes.filter((node) => node.type === "Product");
    this.candidateEntityNodes = graph.nodes.filter((node) => node.type !== "Brand");
  }

  static async load(): Promise<GraphIndex> {
    const raw = await readFile(graphJsonPath, "utf-8");
    const graph = JSON.parse(raw) as ProductGraph;
    return new GraphIndex(graph);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  getOutgoing(nodeId: string, relation?: GraphEdgeRelation): GraphEdge[] {
    const edges = this.outgoingBySource.get(nodeId) ?? [];
    return relation ? edges.filter((edge) => edge.relation === relation) : edges;
  }

  getIncoming(nodeId: string, relation?: GraphEdgeRelation): GraphEdge[] {
    const edges = this.incomingByTarget.get(nodeId) ?? [];
    return relation ? edges.filter((edge) => edge.relation === relation) : edges;
  }
}

function addProductEvidence(store: Map<string, MutableProductHit>, node: GraphNode, evidencePath: string): void {
  const current = store.get(node.id) ?? { node, evidence: new Set<string>() };
  current.evidence.add(evidencePath);
  store.set(node.id, current);
}

function addNodeEvidence(store: Map<string, MutableNodeHit>, node: GraphNode, evidencePath: string): void {
  const current = store.get(node.id) ?? { node, evidence: new Set<string>() };
  current.evidence.add(evidencePath);
  store.set(node.id, current);
}

function finalizeProductHits(store: Map<string, MutableProductHit>, sortByPriceDesc = false): ProductHit[] {
  const hits = Array.from(store.values()).map(({ node, evidence }) => {
    const matchedPaths = Array.from(evidence).sort(collator.compare);
    return {
      product_id: node.id,
      label: node.label,
      product_type: getProductField(node, "product_type"),
      category: getProductField(node, "category"),
      subcategory: getProductField(node, "subcategory"),
      collection_or_series: getProductField(node, "collection_or_series"),
      price: getProductField(node, "price"),
      price_range: getProductPriceRangeLabelFromPaths(matchedPaths),
      matched_paths: matchedPaths,
    };
  });

  if (sortByPriceDesc) {
    return hits.sort((left, right) => {
      const rightPrice = Number(right.price || 0);
      const leftPrice = Number(left.price || 0);
      if (rightPrice !== leftPrice) return rightPrice - leftPrice;
      return compareProductHits(left, right);
    });
  }

  return hits.sort(compareProductHits);
}

function finalizeNodeHits(store: Map<string, MutableNodeHit>): NodeHit[] {
  return Array.from(store.values())
    .map(({ node, evidence }) => ({
      scent_note_id: node.id,
      label: node.label,
      type: node.type,
      matched_paths: Array.from(evidence).sort(collator.compare),
    }))
    .sort(compareNodeHits);
}

function matchEntitiesForAnchor(
  index: GraphIndex,
  anchorText: string,
  preferredTypes?: GraphNodeType[],
): MatchedEntity[] {
  const cleanedAnchor = cleanupAnchorText(anchorText);
  const normalizedAnchor = normalizeText(cleanedAnchor);
  if (!normalizedAnchor) return [];

  const typeFilter = preferredTypes ? new Set(preferredTypes) : null;
  const candidates = index.candidateEntityNodes.filter((node) => {
    if (!typeFilter) return true;
    return typeFilter.has(node.type);
  });

  const exactNodes = sortNodes(
    candidates.filter((node) => normalizeText(node.label) === normalizedAnchor),
  );
  if (exactNodes.length > 0) {
    return exactNodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      anchor_text: cleanedAnchor,
      match_mode: "exact",
      score: 1000 + entityTypePriority[node.type],
    }));
  }

  const containsNodes = sortNodes(
    candidates.filter((node) => {
      const normalizedLabel = normalizeText(node.label);
      return normalizedLabel.includes(normalizedAnchor) || normalizedAnchor.includes(normalizedLabel);
    }),
  ).slice(0, 20);

  return containsNodes.map((node) => ({
    id: node.id,
    label: node.label,
    type: node.type,
    anchor_text: cleanedAnchor,
    match_mode: "contains",
    score: 500 + node.label.length + entityTypePriority[node.type],
  }));
}

function dedupeMatchedEntities(entities: MatchedEntity[]): MatchedEntity[] {
  const byId = new Map<string, MatchedEntity>();
  for (const entity of entities) {
    const current = byId.get(entity.id);
    if (!current || entity.score > current.score) {
      byId.set(entity.id, entity);
    }
  }
  return Array.from(byId.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const priorityDelta = entityTypePriority[right.type] - entityTypePriority[left.type];
    if (priorityDelta !== 0) return priorityDelta;
    return collator.compare(left.label, right.label);
  });
}

function buildCategoryEvidence(index: GraphIndex, product: GraphNode): string | null {
  const edge = index.getOutgoing(product.id, "BELONGS_TO_CATEGORY")[0];
  if (!edge) return null;
  const node = index.getNode(edge.target);
  if (!node) return null;
  return `${formatNode(product)} -> ${edge.relation} -> ${formatNode(node)}`;
}

function buildPriceEvidence(index: GraphIndex, product: GraphNode): string | null {
  const edge = index.getOutgoing(product.id, "IN_PRICE_RANGE")[0];
  if (!edge) return null;
  const node = index.getNode(edge.target);
  if (!node) return null;
  return `${formatNode(product)} -> ${edge.relation} -> ${formatNode(node)}`;
}

function retrieveProductsFromEntities(
  index: GraphIndex,
  matches: MatchedEntity[],
  useTwoHopProductExpansion = false,
): Map<string, MutableProductHit> {
  const store = new Map<string, MutableProductHit>();

  for (const match of matches) {
    const anchorNode = index.getNode(match.id);
    if (!anchorNode) continue;

    if (anchorNode.type === "Product") {
      if (!useTwoHopProductExpansion) {
        addProductEvidence(store, anchorNode, `Matched product label -> ${formatNode(anchorNode)}`);
        continue;
      }

      for (const outgoing of index.getOutgoing(anchorNode.id)) {
        if (!meaningfulRelationsForTwoHop.has(outgoing.relation)) continue;
        const viaNode = index.getNode(outgoing.target);
        if (!viaNode) continue;
        for (const incoming of index.getIncoming(viaNode.id)) {
          const relatedProduct = index.getNode(incoming.source);
          if (!relatedProduct || relatedProduct.type !== "Product" || relatedProduct.id === anchorNode.id) continue;
          const evidencePath = `${formatNode(anchorNode)} -> ${outgoing.relation} -> ${formatNode(viaNode)} <- ${incoming.relation} - ${formatNode(relatedProduct)}`;
          addProductEvidence(store, relatedProduct, evidencePath);
        }
      }
      continue;
    }

    for (const incoming of index.getIncoming(anchorNode.id)) {
      const productNode = index.getNode(incoming.source);
      if (!productNode || productNode.type !== "Product") continue;
      const evidencePath = `${formatNode(productNode)} -> ${incoming.relation} -> ${formatNode(anchorNode)}`;
      addProductEvidence(store, productNode, evidencePath);
    }
  }

  return store;
}

function retrieveScentNotesForProducts(index: GraphIndex, matches: MatchedEntity[]): {
  products: Map<string, MutableProductHit>;
  nodes: Map<string, MutableNodeHit>;
} {
  const productStore = new Map<string, MutableProductHit>();
  const nodeStore = new Map<string, MutableNodeHit>();

  for (const match of matches) {
    const productNode = index.getNode(match.id);
    if (!productNode || productNode.type !== "Product") continue;
    addProductEvidence(productStore, productNode, `Matched product label -> ${formatNode(productNode)}`);

    for (const edge of index.getOutgoing(productNode.id, "HAS_SCENT_NOTE")) {
      const scentNode = index.getNode(edge.target);
      if (!scentNode) continue;
      const evidencePath = `${formatNode(productNode)} -> ${edge.relation} -> ${formatNode(scentNode)}`;
      addNodeEvidence(nodeStore, scentNode, evidencePath);
    }
  }

  return { products: productStore, nodes: nodeStore };
}

function intersectProductsAcrossEntities(index: GraphIndex, matches: MatchedEntity[]): Map<string, MutableProductHit> {
  const perEntityStores = matches.map((match) => retrieveProductsFromEntities(index, [match], false));
  if (perEntityStores.length === 0) return new Map<string, MutableProductHit>();

  const sharedIds = new Set<string>(perEntityStores[0].keys());
  for (const store of perEntityStores.slice(1)) {
    for (const productId of Array.from(sharedIds)) {
      if (!store.has(productId)) {
        sharedIds.delete(productId);
      }
    }
  }

  const merged = new Map<string, MutableProductHit>();
  for (const productId of sharedIds) {
    for (const store of perEntityStores) {
      const hit = store.get(productId);
      if (!hit) continue;
      for (const evidencePath of hit.evidence) {
        addProductEvidence(merged, hit.node, evidencePath);
      }
    }
  }
  return merged;
}

function matchesFacet(product: ProductHit, facet: string): boolean {
  const surfaceFields = [product.label, product.category, product.subcategory, product.collection_or_series];
  const surfaceText = surfaceFields.join(" | ");

  if (facet === CH.candle) {
    return /\u8721\u70DB/u.test(surfaceText);
  }

  if (facet === CH.roomSpray) {
    return /\u5BA4\u5185\u55B7\u96FE/u.test(surfaceText);
  }

  if (facet === CH.bodyCare) {
    return [product.category, product.subcategory, product.product_type, product.label].some((value) =>
      new RegExp(`${CH.bodyCare}|${CH.bodyCareAlt}|${CH.perfumedBodyCare}|body care`, "u").test(value),
    );
  }

  return surfaceText.includes(facet) || product.product_type.includes(facet);
}

function groupProductsByFacets(products: ProductHit[], facets: string[]): Record<string, ProductHit[]> {
  const grouped: Record<string, ProductHit[]> = {};
  for (const facet of facets) {
    grouped[facet] = products.filter((product) => matchesFacet(product, facet)).sort(compareProductHits);
  }
  return grouped;
}

function createEmptyProductGroups(): ProductGroups {
  return {
    direct_products: [],
    indirect_or_bundle_products: [],
    supporting_results: [],
    uncertain_results: [],
  };
}

function isBundleLikeProduct(product: ProductHit): boolean {
  const surfaceText = [product.label, product.category, product.subcategory, product.collection_or_series].join(" | ");
  return bundleProductPattern.test(surfaceText);
}

function hasDirectEvidenceForMatch(product: ProductHit, match: MatchedEntity): boolean {
  const target = `${ENTITY_TYPE_DISPLAY[match.type]}: ${match.label}`;
  switch (match.type) {
    case "ScentNote":
      return product.matched_paths.some((path) => path.includes(`-> HAS_SCENT_NOTE -> ${target}`));
    case "Category":
      return product.matched_paths.some((path) => path.includes(`-> BELONGS_TO_CATEGORY -> ${target}`));
    case "Subcategory":
      return product.matched_paths.some((path) => path.includes(`-> BELONGS_TO_SUBCATEGORY -> ${target}`));
    case "CollectionOrSeries":
      return product.matched_paths.some((path) => path.includes(`-> PART_OF_COLLECTION -> ${target}`));
    case "ProductType":
      return product.matched_paths.some((path) => path.includes(`-> HAS_PRODUCT_TYPE -> ${target}`));
    case "PriceRange":
      return product.matched_paths.some((path) => path.includes(`-> IN_PRICE_RANGE -> ${target}`));
    case "Product":
      return product.matched_paths.some((path) => path.includes(`Matched product label -> Product: ${match.label}`));
    default:
      return false;
  }
}

function hasAnyDirectEvidence(product: ProductHit, matches: MatchedEntity[]): boolean {
  return matches.some((match) => hasDirectEvidenceForMatch(product, match));
}

function questionRequestsBundleLikeEntity(question: string, matches: MatchedEntity[]): boolean {
  if (/\u5957\u88C5|\u793C\u76D2|\u7EC4\u5408\u88C5|\u7EC4\u5408|\u8F66\u8F7D\u6269\u9999\u5668/u.test(question)) {
    return true;
  }

  return matches.some((match) => /\u5957\u88C5|\u793C\u76D2|\u7EC4\u5408\u88C5|\u7EC4\u5408|\u8F66\u8F7D\u6269\u9999\u5668/u.test(match.label));
}

function hasDirectEvidenceForTypes(
  product: ProductHit,
  matches: MatchedEntity[],
  types: GraphNodeType[],
): boolean {
  return matches.some((match) => types.includes(match.type) && hasDirectEvidenceForMatch(product, match));
}

function hasTwoHopEvidence(product: ProductHit): boolean {
  return product.matched_paths.some((path) => path.includes("<-"));
}

function getPrimaryEntityTypes(question: string, intent: RetrievalIntent, matches: MatchedEntity[]): GraphNodeType[] {
  if (intent === "product_to_scent_notes") return ["Product"];
  if (intent === "products_with_all_scent_notes") return ["ScentNote"];
  if (question.includes(CH.scentNotes)) return ["ScentNote"];

  const exactTypes = uniquePreserveOrder(
    matches.filter((match) => match.match_mode === "exact").map((match) => match.type),
  ) as GraphNodeType[];
  if (exactTypes.length > 0) return exactTypes;

  const allTypes = uniquePreserveOrder(matches.map((match) => match.type)) as GraphNodeType[];
  return allTypes;
}

function withGroup(product: ProductHit, group: ProductGroupName, reason: string): ProductHit {
  return {
    ...product,
    post_filter_group: group,
    post_filter_reason: reason,
  };
}

function classifyProductsByIntent(
  question: string,
  intent: RetrievalIntent,
  matches: MatchedEntity[],
  products: ProductHit[],
): ProductGroups {
  const groups = createEmptyProductGroups();
  const primaryTypes = getPrimaryEntityTypes(question, intent, matches);
  const bundleLikeCanBeDirect = questionRequestsBundleLikeEntity(question, matches);

  for (const product of products) {
    const bundleLike = isBundleLikeProduct(product);
    const directPrimary = hasDirectEvidenceForTypes(product, matches, primaryTypes);
    const anyDirect = hasAnyDirectEvidence(product, matches);
    const twoHop = hasTwoHopEvidence(product);
    const labelMatched = product.matched_paths.some((path) => path.startsWith("Matched product label -> Product:"));
    const hasPriceEvidence = product.matched_paths.some((path) => path.includes("-> IN_PRICE_RANGE -> PriceRange:"));

    if (intent === "product_to_scent_notes") {
      groups.direct_products.push(
        withGroup(product, "direct_products", bundleLike ? "core_bundle_or_set_object" : "core_product_object"),
      );
      continue;
    }

    if (intent === "filtered_products") {
      if (bundleLike && (directPrimary || anyDirect || hasPriceEvidence)) {
        groups.indirect_or_bundle_products.push(withGroup(product, "indirect_or_bundle_products", "bundle_or_set_matched_filter"));
        continue;
      }
      if ((directPrimary || anyDirect) && hasPriceEvidence) {
        groups.direct_products.push(withGroup(product, "direct_products", "direct_attribute_match_with_price_filter"));
        continue;
      }
      if (hasPriceEvidence || anyDirect || twoHop) {
        groups.supporting_results.push(withGroup(product, "supporting_results", "supporting_filter_match"));
        continue;
      }
      groups.uncertain_results.push(withGroup(product, "uncertain_results", "insufficient_filter_evidence"));
      continue;
    }

    if (bundleLike && (directPrimary || labelMatched || anyDirect)) {
      if (bundleLikeCanBeDirect) {
        groups.direct_products.push(withGroup(product, "direct_products", "bundle_like_object_is_core_for_current_intent"));
      } else {
        groups.indirect_or_bundle_products.push(withGroup(product, "indirect_or_bundle_products", "bundle_or_set_related_match"));
      }
      continue;
    }

    if (directPrimary || labelMatched) {
      groups.direct_products.push(withGroup(product, "direct_products", "direct_primary_relation_match"));
      continue;
    }

    if (anyDirect || twoHop) {
      groups.supporting_results.push(withGroup(product, "supporting_results", twoHop ? "two_hop_or_secondary_relation_match" : "secondary_relation_match"));
      continue;
    }

    groups.uncertain_results.push(withGroup(product, "uncertain_results", "insufficient_or_ambiguous_evidence"));
  }

  for (const groupName of Object.keys(groups) as ProductGroupName[]) {
    groups[groupName] = groups[groupName].sort(compareProductHits);
  }

  return groups;
}

function collectEvidencePaths(products: ProductHit[], nodes: NodeHit[]): string[] {
  return uniquePreserveOrder([
    ...products.flatMap((product) => product.matched_paths),
    ...nodes.flatMap((node) => node.matched_paths),
  ]);
}

function buildAndFilterEvidence(
  products: ProductHit[],
  matches: MatchedEntity[],
  filters: string[],
): FilterEvidence[] {
  if (filters.length === 0) return [];

  const attributeTargets = matches
    .filter((match) => match.type === "Category" || match.type === "Subcategory" || match.type === "ProductType")
    .map((match) => `${ENTITY_TYPE_DISPLAY[match.type]}: ${match.label}`);

  return products.map((product) => ({
    product_id: product.product_id,
    label: product.label,
    category_or_attribute_paths: product.matched_paths.filter((path) =>
      attributeTargets.some((target) => path.includes(target)) || path.includes("-> BELONGS_TO_CATEGORY ->") || path.includes("-> BELONGS_TO_SUBCATEGORY ->") || path.includes("-> HAS_PRODUCT_TYPE ->"),
    ),
    price_paths: product.matched_paths.filter((path) => path.includes("-> IN_PRICE_RANGE -> PriceRange:")),
  }));
}

function parseQuestion(question: string): QueryPlan {
  const strippedQuestion = ensureString(question).replace(/[?\uFF1F]/g, "").trim();

  if (strippedQuestion.includes(CH.also)) {
    const terms = strippedQuestion
      .replace(/^.*?\u540C\u65F6\u5305\u542B/u, "")
      .split(CH.orAndSeparators)
      .map((part) => cleanupAnchorText(part))
      .filter(Boolean);
    if (terms.length >= 2) {
      return {
        intent: "products_with_all_scent_notes",
        anchor_texts: uniquePreserveOrder(terms),
        preferred_types: ["ScentNote"],
      };
    }
  }

  const productScentMatch = strippedQuestion.match(/^(.*?)(?:\u6709\u54EA\u4E9B\u9999\u8C03|\u90FD\u6709\u54EA\u4E9B\u9999\u8C03|\u5305\u542B\u54EA\u4E9B\u9999\u8C03|\u6709\u4EC0\u4E48\u9999\u8C03)$/u);
  if (productScentMatch) {
    return {
      intent: "product_to_scent_notes",
      anchor_texts: [cleanupAnchorText(productScentMatch[1])],
      preferred_types: ["Product"],
    };
  }

  if (strippedQuestion.includes(CH.inside) && strippedQuestion.includes(CH.whichAre)) {
    const beforeInside = cleanupAnchorText(strippedQuestion.split(CH.inside)[0] ?? "");
    const facets = Array.from(strippedQuestion.matchAll(/\u54EA\u4E9B\u662F([^\uFF0C\u3001]+?)(?=\uFF0C|\u3001|$)/gu))
      .map((match) => cleanupAnchorText(match[1]))
      .filter(Boolean);
    return {
      intent: "group_products_by_facets",
      anchor_texts: beforeInside ? [beforeInside] : [],
      facets: uniquePreserveOrder(facets),
    };
  }

  const priceAboveMatch = strippedQuestion.match(/(\d+)\s*\u5143?\s*\u4EE5\u4E0A/u);
  if (priceAboveMatch) {
    const minPrice = Number(priceAboveMatch[1]);
    const anchorText = cleanupAnchorText(
      strippedQuestion
        .replace(/\u6709\u54EA\u4E9B|\u54EA\u4E9B/gu, "")
        .replace(/\d+\s*\u5143?\s*\u4EE5\u4E0A\u7684?/gu, "")
        .replace(/^\u7684/u, ""),
    );
    return {
      intent: "filtered_products",
      anchor_texts: anchorText ? [anchorText] : [],
      min_price: Number.isFinite(minPrice) ? minPrice : undefined,
    };
  }

  if (strippedQuestion.includes(CH.contains)) {
    const anchorText = cleanupAnchorText(strippedQuestion.split(CH.contains).slice(1).join(CH.contains));
    return {
      intent: "products_by_entity",
      anchor_texts: anchorText ? [anchorText] : [],
      preferred_types: ["ScentNote"],
    };
  }

  const patterns = [
    /^(.*?)(?:\u9999\u8C03)?\u6709\u54EA\u4E9B\u4EA7\u54C1$/u,
    /^(.*?)(?:\u9999\u8C03)?\u6709\u54EA\u4E9B\u5546\u54C1$/u,
    /^(.*?)(?:\u6709\u54EA\u4E9B\u76F8\u5173\u5546\u54C1|\u76F8\u5173\u5546\u54C1)$/u,
    /^\u6709\u54EA\u4E9B(.*?)(?:\u76F8\u5173\u5546\u54C1|\u5546\u54C1|\u4EA7\u54C1)$/u,
  ];

  for (const pattern of patterns) {
    const match = strippedQuestion.match(pattern);
    if (match) {
      return {
        intent: "products_by_entity",
        anchor_texts: [cleanupAnchorText(match[1])],
        use_two_hop_product_expansion: strippedQuestion.includes(CH.relatedGoods),
      };
    }
  }

  return {
    intent: "unknown",
    anchor_texts: [cleanupAnchorText(strippedQuestion)].filter(Boolean),
  };
}

function resolveMatches(index: GraphIndex, plan: QueryPlan): MatchedEntity[] {
  const matches: MatchedEntity[] = [];
  for (const anchorText of plan.anchor_texts) {
    let currentMatches = matchEntitiesForAnchor(index, anchorText, plan.preferred_types);
    if (currentMatches.length === 0 && plan.preferred_types) {
      currentMatches = matchEntitiesForAnchor(index, anchorText);
    }
    matches.push(...currentMatches);
  }
  return dedupeMatchedEntities(matches);
}

function applyPriceFilter(
  index: GraphIndex,
  store: Map<string, MutableProductHit>,
  minPrice: number,
): Map<string, MutableProductHit> {
  const filtered = new Map<string, MutableProductHit>();
  for (const { node, evidence } of store.values()) {
    const price = Number(getProductField(node, "price"));
    if (!Number.isFinite(price) || price < minPrice) continue;
    for (const evidencePath of evidence) {
      addProductEvidence(filtered, node, evidencePath);
    }
    const priceEvidence = buildPriceEvidence(index, node);
    if (priceEvidence) {
      addProductEvidence(filtered, node, priceEvidence);
    }
  }
  return filtered;
}

export async function retrieveGraphQuestion(question: string): Promise<RetrievalResult> {
  const index = await GraphIndex.load();
  const plan = parseQuestion(question);
  const matches = resolveMatches(index, plan);
  const warnings: string[] = [];

  if (plan.anchor_texts.length === 0) {
    warnings.push(CH.noAnchorWarning);
  }
  if (matches.length === 0) {
    warnings.push(CH.noEntityWarning);
  }

  const filters: string[] = [];
  let recalledProducts = new Map<string, MutableProductHit>();
  let recalledNodes = new Map<string, MutableNodeHit>();

  let filterEvidence: FilterEvidence[] = [];

  switch (plan.intent) {
    case "product_to_scent_notes": {
      const retrieval = retrieveScentNotesForProducts(index, matches);
      recalledProducts = retrieval.products;
      recalledNodes = retrieval.nodes;
      break;
    }
    case "products_with_all_scent_notes": {
      recalledProducts = intersectProductsAcrossEntities(index, matches);
      break;
    }
    case "group_products_by_facets": {
      recalledProducts = retrieveProductsFromEntities(index, matches, false);
      break;
    }
    case "filtered_products": {
      filters.push(`price >= ${plan.min_price ?? 0}`);
      if (matches.length > 0) {
        recalledProducts = retrieveProductsFromEntities(index, matches, false);
      } else {
        for (const productNode of index.productNodes) {
          addProductEvidence(recalledProducts, productNode, `Scanned all products for price filter -> ${formatNode(productNode)}`);
        }
      }
      if (plan.min_price !== undefined) {
        recalledProducts = applyPriceFilter(index, recalledProducts, plan.min_price);
      }
      break;
    }
    case "products_by_entity": {
      recalledProducts = retrieveProductsFromEntities(index, matches, Boolean(plan.use_two_hop_product_expansion));
      break;
    }
    case "unknown":
    default: {
      recalledProducts = retrieveProductsFromEntities(index, matches, false);
      break;
    }
  }

  const productHits = finalizeProductHits(recalledProducts, plan.intent === "filtered_products");

  if (plan.intent === "filtered_products") {
    for (const hit of productHits) {
      const productNode = index.getNode(hit.product_id);
      if (!productNode) continue;
      const categoryEvidence = buildCategoryEvidence(index, productNode);
      if (categoryEvidence && !hit.matched_paths.includes(categoryEvidence)) {
        hit.matched_paths.push(categoryEvidence);
        hit.matched_paths.sort(collator.compare);
      }
    }
  }

  const productGroups = classifyProductsByIntent(question, plan.intent, matches, productHits);
  const nodeHits = finalizeNodeHits(recalledNodes);

  if (plan.intent === "filtered_products") {
    filterEvidence = buildAndFilterEvidence(productGroups.direct_products, matches, filters);
  }

  if (plan.intent === "group_products_by_facets" && plan.facets) {
    groupProductsByFacets(productGroups.direct_products, plan.facets);
  }

  const evidencePaths = collectEvidencePaths(productHits, nodeHits);
  const targetProduct = plan.intent === "product_to_scent_notes" ? productGroups.direct_products : [];
  const scentNotes = plan.intent === "product_to_scent_notes" ? nodeHits : [];

  return {
    query: question,
    intent: plan.intent,
    matched_entities: matches,
    direct_products: productGroups.direct_products,
    indirect_or_bundle_products: productGroups.indirect_or_bundle_products,
    supporting_results: productGroups.supporting_results,
    uncertain_results: productGroups.uncertain_results,
    target_product: targetProduct,
    scent_notes: scentNotes,
    filter_evidence: filterEvidence,
    evidence_paths: evidencePaths,
    warnings,
  };
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run retrieve:graph -- "<question>"');
    process.exitCode = 1;
    return;
  }

  const question = args.join(" ").trim();
  const result = await retrieveGraphQuestion(question);
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}