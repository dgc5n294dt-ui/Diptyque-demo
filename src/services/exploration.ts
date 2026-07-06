import type { AskResponse, GraphData, GraphEdge, GraphLayoutMode, GraphNode, GraphNodeType, ProductCardData } from "../lib/contracts.js";

export type ExplorationState = {
  origin: "default" | "node" | "query";
  selectedNodeId: string | null;
  prompt: string;
  answerResult: AskResponse | null;
};

export type LegendItem = {
  label: string;
  type: GraphNodeType;
  color: string;
};

export type GraphScene = {
  title: string;
  modeLabel: string;
  layout: GraphLayoutMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusNodeId: string | null;
  legendItems: LegendItem[];
};

export type ChatSuggestion = {
  kind: "ask" | "graph";
  label: string;
  question?: string;
  nodeId?: string;
};

export type ChatResultModel = {
  answer: string;
  directProducts: ProductCardData[];
  indirectProducts: ProductCardData[];
  matchedEntities: string[];
  filterEvidence: string[];
  evidencePaths: string[];
  suggestions: ChatSuggestion[];
  modeLabel: string;
  metaLine: string;
};

const TITLE = "Diptyque 商品知识图谱";

const NODE_LABELS: Record<GraphNodeType, string> = {
  Brand: "品牌",
  Product: "商品",
  ProductType: "产品类型",
  Category: "类目",
  Subcategory: "子类目",
  ScentNote: "香调",
  Ingredient: "成分",
  Size: "规格 / 容量",
  PriceRange: "价格区间",
  CollectionOrSeries: "系列",
  Dimension: "探索维度",
  Theme: "主题",
};

const NODE_COLORS: Record<GraphNodeType, string> = {
  Product: "#930b2d",
  ScentNote: "#6f9952",
  CollectionOrSeries: "#5988ad",
  ProductType: "#c28746",
  PriceRange: "#6d60a5",
  Size: "#d18ba5",
  Brand: "#89a8bb",
  Category: "#89a8bb",
  Subcategory: "#89a8bb",
  Ingredient: "#b3b3b3",
  Dimension: "#d7b58a",
  Theme: "#2f241c",
};

const LEGEND_ITEMS: LegendItem[] = [
  { label: "商品", type: "Product", color: NODE_COLORS.Product },
  { label: "香调", type: "ScentNote", color: NODE_COLORS.ScentNote },
  { label: "系列", type: "CollectionOrSeries", color: NODE_COLORS.CollectionOrSeries },
  { label: "产品类型", type: "ProductType", color: NODE_COLORS.ProductType },
  { label: "价格区间", type: "PriceRange", color: NODE_COLORS.PriceRange },
  { label: "规格 / 容量", type: "Size", color: NODE_COLORS.Size },
];

const FOCUSABLE_TYPES: GraphNodeType[] = [
  "Product",
  "ScentNote",
  "CollectionOrSeries",
  "ProductType",
  "PriceRange",
  "Size",
  "Brand",
  "Category",
  "Subcategory",
];

function getNodeColor(type: GraphNodeType): string {
  return NODE_COLORS[type] ?? "#b3b3b3";
}

function getNodeShape(type: GraphNodeType): string {
  if (type === "Product") return "ellipse";
  if (type === "CollectionOrSeries") return "round-rectangle";
  if (type === "ProductType") return "diamond";
  if (type === "PriceRange") return "round-rectangle";
  if (type === "Theme") return "round-rectangle";
  return "ellipse";
}

function relationLabel(edge: GraphEdge, nodeById: Map<string, GraphNode>): string {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  const pair = [source?.type, target?.type];

  if (pair.includes("ScentNote")) return "香调";
  if (pair.includes("CollectionOrSeries")) return "系列";
  if (pair.includes("ProductType")) return "类型";
  if (pair.includes("PriceRange")) return "价格";
  if (pair.includes("Size")) return "规格";
  if (pair.includes("Brand")) return "品牌";
  if (pair.includes("Category") || pair.includes("Subcategory")) return "场景";

  switch (edge.relation) {
    case "HAS_SCENT_NOTE": return "香调";
    case "PART_OF_COLLECTION": return "系列";
    case "IN_COLLECTION": return "系列";
    case "HAS_PRODUCT_TYPE": return "类型";
    case "IN_PRICE_RANGE": return "价格";
    case "HAS_SIZE": return "规格";
    case "BY_BRAND": return "品牌";
    case "BELONGS_TO_CATEGORY": return "类目";
    case "BELONGS_TO_SUBCATEGORY": return "场景";
    default: return "关联";
  }
}

function buildIndex(graph: GraphData): {
  nodeById: Map<string, GraphNode>;
  neighbors: Map<string, GraphNode[]>;
  edgesByNodeId: Map<string, GraphEdge[]>;
} {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const neighbors = new Map<string, GraphNode[]>();
  const edgesByNodeId = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;

    const sourceNeighbors = neighbors.get(source.id) ?? [];
    sourceNeighbors.push(target);
    neighbors.set(source.id, sourceNeighbors);

    const targetNeighbors = neighbors.get(target.id) ?? [];
    targetNeighbors.push(source);
    neighbors.set(target.id, targetNeighbors);

    const sourceEdges = edgesByNodeId.get(source.id) ?? [];
    sourceEdges.push(edge);
    edgesByNodeId.set(source.id, sourceEdges);

    const targetEdges = edgesByNodeId.get(target.id) ?? [];
    targetEdges.push(edge);
    edgesByNodeId.set(target.id, targetEdges);
  }

  return { nodeById, neighbors, edgesByNodeId };
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const map = new Map<string, GraphNode>();
  for (const node of nodes) {
    const prev = map.get(node.id);
    if (!prev || (node.ui?.size ?? 0) >= (prev.ui?.size ?? 0)) map.set(node.id, node);
  }
  return Array.from(map.values());
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}

function enhanceNode(node: GraphNode, emphasis: "hero" | "primary" | "secondary" = "secondary"): GraphNode {
  const size = emphasis === "hero" ? 34 : emphasis === "primary" ? 26 : 18;
  return {
    ...node,
    ui: {
      color: getNodeColor(node.type),
      size,
      shape: getNodeShape(node.type),
      opacity: emphasis === "secondary" ? 0.88 : 1,
      emphasis,
    },
  };
}

function enhanceEdge(edge: GraphEdge, nodeById: Map<string, GraphNode>): GraphEdge {
  return {
    ...edge,
    label: relationLabel(edge, nodeById),
    ui: {
      color: "rgba(209, 203, 194, 0.72)",
      width: 1.1,
      lineStyle: "solid",
      arrowShape: "none",
    },
  };
}

function topProducts(graph: GraphData, limit: number): GraphNode[] {
  const { edgesByNodeId } = buildIndex(graph);
  return graph.nodes
    .filter((node) => node.type === "Product")
    .map((node) => ({ node, degree: (edgesByNodeId.get(node.id) ?? []).length }))
    .sort((a, b) => b.degree - a.degree || a.node.label.localeCompare(b.node.label, "zh-CN"))
    .slice(0, limit)
    .map((item) => item.node);
}

function isBundleLike(node: GraphNode): boolean {
  const text = `${node.label} ${String(node.data.subcategory ?? "")} ${String(node.data.collection_or_series ?? "")}`;
  return /礼盒|套装|甄选|组合/.test(text);
}

function buildOverviewScene(graph: GraphData): GraphScene {
  const { nodeById, neighbors } = buildIndex(graph);
  const featured = topProducts(graph, 8);
  const pool: GraphNode[] = [];

  for (const product of featured) {
    pool.push(enhanceNode(product, "primary"));
    const connected = (neighbors.get(product.id) ?? [])
      .filter((node) => ["ScentNote", "CollectionOrSeries", "ProductType", "PriceRange", "Size"].includes(node.type))
      .slice(0, 3);
    for (const node of connected) pool.push(enhanceNode(node, "secondary"));
  }

  const nodeIds = new Set(pool.map((node) => node.id));
  const edges = graph.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .slice(0, 34)
    .map((edge) => enhanceEdge(edge, nodeById));

  return {
    title: TITLE,
    modeLabel: "热门概览",
    layout: "organic",
    nodes: dedupeNodes(pool).slice(0, 28),
    edges: dedupeEdges(edges).slice(0, 32),
    focusNodeId: null,
    legendItems: LEGEND_ITEMS,
  };
}

function buildFocusScene(graph: GraphData, nodeId: string): GraphScene {
  const { nodeById, neighbors } = buildIndex(graph);
  const node = nodeById.get(nodeId);
  if (!node) return buildOverviewScene(graph);

  const related = (neighbors.get(node.id) ?? []).filter((item) => FOCUSABLE_TYPES.includes(item.type));
  const directProducts = related.filter((item) => item.type === "Product" && !isBundleLike(item)).slice(0, 6);
  const indirectProducts = related.filter((item) => item.type === "Product" && isBundleLike(item)).slice(0, 3);
  const facets = related.filter((item) => item.type !== "Product").slice(0, 8);

  const allNodes = [enhanceNode(node, "hero"), ...directProducts.map((item) => enhanceNode(item, "primary")), ...indirectProducts.map((item) => enhanceNode(item, "secondary")), ...facets.map((item) => enhanceNode(item, "secondary"))];
  const ids = new Set(allNodes.map((item) => item.id));
  const edges = graph.edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => enhanceEdge(edge, nodeById))
    .slice(0, 24);

  return {
    title: TITLE,
    modeLabel: `${NODE_LABELS[node.type]}聚焦`,
    layout: "organic",
    nodes: dedupeNodes(allNodes),
    edges: dedupeEdges(edges),
    focusNodeId: node.id,
    legendItems: LEGEND_ITEMS,
  };
}

function buildQueryScene(graph: GraphData, result: AskResponse): GraphScene {
  const { nodeById } = buildIndex(graph);
  const nodes: GraphNode[] = [];

  for (const entity of result.matched_entities.slice(0, 4)) {
    const node = nodeById.get(entity.id);
    if (node) nodes.push(enhanceNode(node, "secondary"));
  }
  for (const product of result.direct_products.slice(0, 8)) {
    const node = nodeById.get(product.product_id);
    if (node) nodes.push(enhanceNode(node, "primary"));
  }
  for (const product of result.indirect_or_bundle_products.slice(0, 4)) {
    const node = nodeById.get(product.product_id);
    if (node) nodes.push(enhanceNode(node, "secondary"));
  }
  for (const note of result.scent_notes.slice(0, 4)) {
    const node = nodeById.get(note.scent_note_id);
    if (node) nodes.push(enhanceNode(node, "secondary"));
  }

  const uniqueNodes = dedupeNodes(nodes);
  const ids = new Set(uniqueNodes.map((node) => node.id));
  const edges = graph.edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => enhanceEdge(edge, nodeById))
    .slice(0, 30);

  return {
    title: TITLE,
    modeLabel: result.direct_products.length <= 1 ? "商品聚焦" : "问答结果",
    layout: "organic",
    nodes: uniqueNodes,
    edges: dedupeEdges(edges),
    focusNodeId: uniqueNodes[0]?.id ?? null,
    legendItems: LEGEND_ITEMS,
  };
}

function connectedNodes(graph: GraphData, nodeId: string): GraphNode[] {
  return (buildIndex(graph).neighbors.get(nodeId) ?? []).filter((node) => FOCUSABLE_TYPES.includes(node.type));
}

function priceText(value: string): string {
  return value ? `官网当前价格：￥${value}` : "价格待确认";
}

function compactUnique(values: string[], limit: number): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function buildProductCard(graph: GraphData, node: GraphNode, relationReason: string): ProductCardData {
  const related = connectedNodes(graph, node.id);
  const scents = compactUnique(related.filter((item) => item.type === "ScentNote").map((item) => item.label), 4);
  const notes = compactUnique(String(node.data.notes || "").split("|").map((item) => item.trim()), 4);

  return {
    nodeId: node.id,
    label: String(node.data.product_name || node.label),
    subtitle: String(node.data.subtitle || node.data.product_type || ""),
    englishName: "",
    category: String(node.data.category || ""),
    subcategory: String(node.data.subcategory || ""),
    price: priceText(String(node.data.price || "")),
    priceRange: String(node.data.price_range || ""),
    collectionOrSeries: String(node.data.collection_or_series || ""),
    scentSummary: scents.length > 0 ? scents : notes,
    relationReason,
    nextExplore: compactUnique(
      related
        .filter((item) => ["ScentNote", "CollectionOrSeries", "ProductType", "PriceRange"].includes(item.type))
        .map((item) => item.label),
      3,
    ).map((label) => ({
      id: related.find((item) => item.label === label)?.id || "",
      label,
      type: related.find((item) => item.label === label)?.type || "ScentNote",
    })),
    imageUrl: String(node.data.primary_image || ""),
    productUrl: String(node.data.product_url || ""),
    description: String(node.data.description || node.data.long_description || ""),
    size: String(node.data.size || ""),
  };
}

function defaultSuggestions(result: AskResponse): ChatSuggestion[] {
  const suggestions: ChatSuggestion[] = [];
  const firstEntity = result.matched_entities[0];
  const firstProduct = result.direct_products[0];

  if (firstProduct) {
    suggestions.push({ kind: "graph", label: `查看 ${firstProduct.label} 图谱`, nodeId: firstProduct.product_id });
    suggestions.push({ kind: "ask", label: `${firstProduct.label} 有哪些香调？`, question: `${firstProduct.label}有哪些香调？` });
  }
  if (firstEntity) {
    suggestions.push({ kind: "graph", label: `查看 ${firstEntity.label} 关系`, nodeId: firstEntity.id });
  }
  if (result.scent_notes[0]) {
    suggestions.push({ kind: "graph", label: `查看 ${result.scent_notes[0].label} 图谱`, nodeId: result.scent_notes[0].scent_note_id });
  }

  return suggestions.slice(0, 4);
}

function fallbackCard(item: { product_id: string; label: string; product_type: string; category: string; subcategory: string; price: string; price_range: string; collection_or_series: string; post_filter_reason?: string }, reason: string): ProductCardData {
  return {
    nodeId: item.product_id,
    label: item.label,
    subtitle: item.product_type,
    englishName: "",
    category: item.category,
    subcategory: item.subcategory,
    price: priceText(item.price),
    priceRange: item.price_range,
    collectionOrSeries: item.collection_or_series,
    scentSummary: [],
    relationReason: item.post_filter_reason || reason,
    nextExplore: [],
    imageUrl: "",
    productUrl: "",
    description: "",
    size: "",
  };
}

export function buildChatResultModel(graph: GraphData, result: AskResponse): ChatResultModel {
  const { nodeById } = buildIndex(graph);
  const directProducts = result.direct_products.slice(0, 4).map((item) => {
    const node = nodeById.get(item.product_id);
    return node ? buildProductCard(graph, node, item.post_filter_reason || "来自图谱直接结果") : fallbackCard(item, "来自图谱直接结果");
  });

  const indirectProducts = result.indirect_or_bundle_products.slice(0, 3).map((item) => {
    const node = nodeById.get(item.product_id);
    return node ? buildProductCard(graph, node, item.post_filter_reason || "来自礼盒 / 套装 / 间接结果") : fallbackCard(item, "来自礼盒 / 套装 / 间接结果");
  });

  return {
    answer: result.answer,
    directProducts,
    indirectProducts,
    matchedEntities: result.matched_entities.map((item) => `${item.label} · ${item.type}`).slice(0, 6),
    filterEvidence: result.filter_evidence.map((item) => item.label).slice(0, 6),
    evidencePaths: result.evidence_paths.slice(0, 8),
    suggestions: defaultSuggestions(result),
    modeLabel: result.intent,
    metaLine: `来源: 图谱证据 · provider: ${result.provider}`,
  };
}

export function getSceneForState(graph: GraphData, state: ExplorationState): GraphScene {
  if (state.answerResult) return buildQueryScene(graph, state.answerResult);
  if (state.selectedNodeId) return buildFocusScene(graph, state.selectedNodeId);
  return buildOverviewScene(graph);
}

export function findGraphNodeById(graph: GraphData, nodeId: string | null): GraphNode | null {
  if (!nodeId) return null;
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}
