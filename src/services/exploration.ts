import type {
  AskResponse,
  DimensionKey,
  ExplorationLink,
  GraphData,
  GraphEdge,
  GraphLayoutMode,
  GraphNode,
  GraphNodeType,
  ProductCardData,
  ThemeOrigin,
  ThemePanelData,
} from "../lib/contracts.js";

export type ExplorationState = {
  title: string;
  origin: ThemeOrigin;
  activeDimension: DimensionKey | null;
  selectedNodeId: string | null;
  prompt: string;
  answerResult: AskResponse | null;
};

export type GraphScene = {
  layout: GraphLayoutMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusNodeId: string | null;
  legendTypes: string[];
};

export type DimensionDefinition = {
  key: DimensionKey;
  label: string;
  graphType: GraphNodeType | "VirtualProduct";
  description: string;
};

const DIMENSIONS: DimensionDefinition[] = [
  { key: "product", label: "商品", graphType: "VirtualProduct", description: "从代表性商品开始，按产品类型和香调逐步展开。" },
  { key: "scent", label: "香调", graphType: "ScentNote", description: "通过香调查看个人香氛、家居香氛与护理产品的关联。" },
  { key: "collection", label: "系列", graphType: "CollectionOrSeries", description: "系列用于组织具有共同主题和产品线归属的商品。" },
  { key: "productType", label: "产品类型", graphType: "ProductType", description: "按香水、香氛蜡烛、车载扩香器等使用形态探索。" },
  { key: "priceRange", label: "价格区间", graphType: "PriceRange", description: "从预算角度筛选和比较不同商品。" },
  { key: "size", label: "规格 / 容量", graphType: "Size", description: "按容量或规格查看同系列商品的差异。" },
  { key: "brand", label: "品牌", graphType: "Brand", description: "当前图谱中的品牌维度，用于确认商品归属。" },
];

const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
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
  Theme: "#23180f",
  Dimension: "#b87d42",
  Product: "#111111",
  ScentNote: "#7f5a2f",
  CollectionOrSeries: "#8d7361",
  ProductType: "#ac6540",
  PriceRange: "#5f6f5e",
  Size: "#567083",
  Brand: "#324b54",
  Category: "#4f5f6f",
  Subcategory: "#718092",
  Ingredient: "#8f8f8f",
};

const NODE_SHAPES: Record<GraphNodeType, string> = {
  Theme: "round-rectangle",
  Dimension: "round-rectangle",
  Product: "rectangle",
  ScentNote: "ellipse",
  CollectionOrSeries: "hexagon",
  ProductType: "diamond",
  PriceRange: "tag",
  Size: "ellipse",
  Brand: "ellipse",
  Category: "ellipse",
  Subcategory: "ellipse",
  Ingredient: "ellipse",
};

function enrichNode(node: GraphNode, emphasis: "hero" | "primary" | "secondary" = "secondary", rank = 0): GraphNode {
  const size = emphasis === "hero" ? 64 : emphasis === "primary" ? 44 : 34;
  return {
    ...node,
    ui: {
      color: NODE_COLORS[node.type] ?? "#8b8b8b",
      shape: NODE_SHAPES[node.type] ?? "ellipse",
      size,
      opacity: emphasis === "secondary" ? 0.88 : 1,
      rank,
      emphasis,
    },
  };
}

function buildVirtualNode(id: string, label: string, type: GraphNodeType, data: Record<string, unknown>, emphasis: "hero" | "primary" | "secondary" = "secondary", rank = 0): GraphNode {
  return enrichNode({ id, label, type, data }, emphasis, rank);
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const map = new Map<string, GraphNode>();
  for (const node of nodes) {
    const previous = map.get(node.id);
    if (!previous || (node.ui?.size ?? 0) > (previous.ui?.size ?? 0)) {
      map.set(node.id, node);
    }
  }
  return Array.from(map.values());
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const map = new Map<string, GraphEdge>();
  for (const edge of edges) {
    if (!map.has(edge.id)) map.set(edge.id, edge);
  }
  return Array.from(map.values());
}

function sanitizeEdge(edge: GraphEdge, lineStyle: "solid" | "dashed" = "solid", width = 1.4): GraphEdge {
  return {
    ...edge,
    ui: {
      color: lineStyle === "dashed" ? "#d8b98b" : "#d4ccc1",
      width,
      lineStyle,
      arrowShape: "triangle",
    },
  };
}

function buildGraphIndex(graph: GraphData): {
  nodeById: Map<string, GraphNode>;
  edgesByNodeId: Map<string, GraphEdge[]>;
  incomingByNodeId: Map<string, GraphEdge[]>;
} {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesByNodeId = new Map<string, GraphEdge[]>();
  const incomingByNodeId = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const sourceEdges = edgesByNodeId.get(edge.source) ?? [];
    sourceEdges.push(edge);
    edgesByNodeId.set(edge.source, sourceEdges);

    const targetEdges = incomingByNodeId.get(edge.target) ?? [];
    targetEdges.push(edge);
    incomingByNodeId.set(edge.target, targetEdges);

    const reverse = edgesByNodeId.get(edge.target) ?? [];
    reverse.push(edge);
    edgesByNodeId.set(edge.target, reverse);
  }

  return { nodeById, edgesByNodeId, incomingByNodeId };
}

function isBundleLike(product: GraphNode): boolean {
  const text = `${product.label} ${String(product.data.collection_or_series ?? "")} ${String(product.data.subcategory ?? "")}`;
  return /礼盒|套装|甄选|组合/.test(text);
}

function getConnectedNodes(graph: GraphData, nodeId: string): GraphNode[] {
  const { nodeById, edgesByNodeId } = buildGraphIndex(graph);
  const edgeSet = edgesByNodeId.get(nodeId) ?? [];
  const connected: GraphNode[] = [];
  for (const edge of edgeSet) {
    const neighborId = edge.source === nodeId ? edge.target : edge.source;
    const node = nodeById.get(neighborId);
    if (node) connected.push(node);
  }
  return connected;
}

function getOutgoingEdges(graph: GraphData, nodeId: string, relation?: string): GraphEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId && (!relation || edge.relation === relation));
}

function getProductsForNode(graph: GraphData, nodeId: string): GraphNode[] {
  const { nodeById } = buildGraphIndex(graph);
  return graph.edges
    .filter((edge) => (edge.source === nodeId || edge.target === nodeId))
    .map((edge) => nodeById.get(edge.source === nodeId ? edge.target : edge.source))
    .filter((node): node is GraphNode => Boolean(node) && node.type === "Product");
}

function toCurrency(price: string): string {
  return price ? `${price} 元` : "价格待确认";
}

function uniqueByLabel<T extends { label: string }>(items: T[], limit: number): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.label)) map.set(item.label, item);
    if (map.size >= limit) break;
  }
  return Array.from(map.values());
}

function toExplorationLink(node: GraphNode): ExplorationLink {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    caption: NODE_TYPE_LABELS[node.type],
  };
}

function getNodeLabel(nodeType: GraphNodeType): string {
  return NODE_TYPE_LABELS[nodeType];
}

function buildProductCard(graph: GraphData, node: GraphNode, relationReason: string): ProductCardData {
  const connected = getConnectedNodes(graph, node.id);
  const scents = uniqueByLabel(
    connected.filter((item) => item.type === "ScentNote").map((item) => ({ label: item.label })),
    4,
  ).map((item) => item.label);
  const nextExplore = uniqueByLabel(
    connected
      .filter((item) => ["ScentNote", "CollectionOrSeries", "ProductType", "PriceRange"].includes(item.type))
      .map(toExplorationLink),
    4,
  );

  return {
    nodeId: node.id,
    label: node.label,
    productType: String(node.data.product_type ?? ""),
    category: String(node.data.category ?? ""),
    subcategory: String(node.data.subcategory ?? ""),
    price: toCurrency(String(node.data.price ?? "")),
    priceRange: String(node.data.price_range ?? "待补充"),
    collectionOrSeries: String(node.data.collection_or_series ?? "未归入系列"),
    scentSummary: scents,
    relationReason,
    nextExplore,
  };
}

function topNodesByConnections(graph: GraphData, type: GraphNodeType, limit: number): GraphNode[] {
  const { edgesByNodeId } = buildGraphIndex(graph);
  return graph.nodes
    .filter((node) => node.type === type)
    .map((node) => ({ node, degree: (edgesByNodeId.get(node.id) ?? []).length }))
    .sort((a, b) => b.degree - a.degree || a.node.label.localeCompare(b.node.label, "zh-CN"))
    .slice(0, limit)
    .map((entry) => entry.node);
}

function topProducts(graph: GraphData, limit: number): GraphNode[] {
  const { edgesByNodeId } = buildGraphIndex(graph);
  return graph.nodes
    .filter((node) => node.type === "Product")
    .map((node) => ({
      node,
      degree: (edgesByNodeId.get(node.id) ?? []).length,
      scentCount: getOutgoingEdges(graph, node.id, "HAS_SCENT_NOTE").length,
    }))
    .sort((a, b) => b.scentCount - a.scentCount || b.degree - a.degree || a.node.label.localeCompare(b.node.label, "zh-CN"))
    .slice(0, limit)
    .map((entry) => entry.node);
}

function buildDefaultScene(): GraphScene {
  const center = buildVirtualNode(
    "theme:diptyque-explorer",
    "Diptyque 产品知识探索",
    "Theme",
    { summary: "从香调、系列、产品类型、价格区间等维度逐步探索商品关系。" },
    "hero",
    10,
  );

  const dimensionNodes = DIMENSIONS.map((dimension, index) => buildVirtualNode(
    `dimension:${dimension.key}`,
    dimension.label,
    "Dimension",
    { dimensionKey: dimension.key, description: dimension.description },
    "primary",
    9 - index,
  ));

  const edges = dimensionNodes.map((node) => ({
    id: `edge:${center.id}:${node.id}`,
    source: center.id,
    target: node.id,
    relation: "EXPLORE_BY",
    label: "explore by",
    ui: { color: "#d9c7ad", width: 1.8, lineStyle: "solid", arrowShape: "none" },
  }));

  return {
    layout: "radial",
    nodes: [center, ...dimensionNodes],
    edges,
    focusNodeId: center.id,
    legendTypes: ["Dimension", "Theme"],
  };
}

function getDimensionValues(graph: GraphData, key: DimensionKey): GraphNode[] {
  switch (key) {
    case "scent":
      return topNodesByConnections(graph, "ScentNote", 12);
    case "collection":
      return topNodesByConnections(graph, "CollectionOrSeries", 10);
    case "productType":
      return topNodesByConnections(graph, "ProductType", 8);
    case "priceRange":
      return topNodesByConnections(graph, "PriceRange", 6);
    case "size":
      return topNodesByConnections(graph, "Size", 10);
    case "brand":
      return topNodesByConnections(graph, "Brand", 4);
    case "product":
      return topProducts(graph, 10);
    default:
      return [];
  }
}

function buildDimensionScene(graph: GraphData, key: DimensionKey): GraphScene {
  const definition = DIMENSIONS.find((item) => item.key === key) ?? DIMENSIONS[0];
  const center = buildVirtualNode(
    `theme:${key}`,
    definition.label,
    "Theme",
    { dimensionKey: key, description: definition.description },
    "hero",
    10,
  );
  const values = getDimensionValues(graph, key);
  const valueNodes = values.map((node, index) => enrichNode(node, "primary", 8 - index));
  const edges = values.map((node) => ({
    id: `edge:${center.id}:${node.id}`,
    source: center.id,
    target: node.id,
    relation: "HAS_VALUE",
    label: "has value",
    ui: { color: "#d7cab8", width: 1.5, lineStyle: "solid", arrowShape: "none" },
  }));

  return {
    layout: "radial",
    nodes: [center, ...valueNodes],
    edges,
    focusNodeId: center.id,
    legendTypes: ["Theme", "Dimension", definition.graphType === "VirtualProduct" ? "Product" : definition.graphType],
  };
}

function findNode(graph: GraphData, nodeId: string | null): GraphNode | null {
  if (!nodeId) return null;
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}

function buildNodeFocusScene(graph: GraphData, nodeId: string): GraphScene {
  const node = findNode(graph, nodeId);
  if (!node) return buildDefaultScene();

  const connected = getConnectedNodes(graph, node.id);
  const directProducts = connected.filter((item) => item.type === "Product");
  const facetNodes = connected.filter((item) => item.type !== "Product" && item.id !== node.id);

  const productNodes = directProducts
    .sort((a, b) => (isBundleLike(a) === isBundleLike(b) ? 0 : isBundleLike(a) ? 1 : -1))
    .slice(0, 14)
    .map((item, index) => enrichNode(item, "primary", 12 - index));
  const facetSelection = uniqueByLabel(
    facetNodes
      .filter((item) => ["ScentNote", "CollectionOrSeries", "ProductType", "PriceRange", "Size", "Brand"].includes(item.type))
      .map((item) => ({ ...item })),
    10,
  ).map((item, index) => enrichNode(item, "secondary", 6 - index));

  const pickedIds = new Set([node.id, ...productNodes.map((item) => item.id), ...facetSelection.map((item) => item.id)]);
  const edges = graph.edges
    .filter((edge) => pickedIds.has(edge.source) && pickedIds.has(edge.target))
    .slice(0, 36)
    .map((edge) => sanitizeEdge(edge));

  return {
    layout: "organic",
    nodes: dedupeNodes([enrichNode(node, "hero", 20), ...productNodes, ...facetSelection]),
    edges: dedupeEdges(edges),
    focusNodeId: node.id,
    legendTypes: uniqueByLabel(
      [node, ...productNodes, ...facetSelection].map((item) => ({ label: item.type })),
      8,
    ).map((item) => item.label),
  };
}

function collectQueryNodes(graph: GraphData, result: AskResponse): GraphNode[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes: GraphNode[] = [];

  for (const entity of result.matched_entities) {
    const node = byId.get(entity.id);
    if (node) nodes.push(node);
  }

  const products = [
    ...result.direct_products,
    ...result.indirect_or_bundle_products,
    ...result.supporting_results,
    ...result.uncertain_results,
    ...result.target_product,
  ];
  for (const product of products) {
    const node = byId.get(product.product_id);
    if (node) nodes.push(node);
  }

  for (const note of result.scent_notes) {
    const node = byId.get(note.scent_note_id);
    if (node) nodes.push(node);
  }

  return nodes;
}

function buildQueryScene(graph: GraphData, result: AskResponse): GraphScene {
  const queryNode = buildVirtualNode(
    `theme:query:${result.query}`,
    result.query,
    "Theme",
    { intent: result.intent, summary: result.answer },
    "hero",
    24,
  );

  const selected = collectQueryNodes(graph, result);
  const selectedIds = new Set<string>([queryNode.id]);
  const rankedNodes: GraphNode[] = [];

  const matchNodes = result.matched_entities
    .map((entity) => findNode(graph, entity.id))
    .filter((node): node is GraphNode => Boolean(node))
    .slice(0, 5)
    .map((node, index) => enrichNode(node, "primary", 18 - index));
  const directNodes = result.direct_products
    .map((item) => findNode(graph, item.product_id))
    .filter((node): node is GraphNode => Boolean(node))
    .slice(0, 12)
    .map((node, index) => enrichNode(node, "primary", 12 - index));
  const indirectNodes = result.indirect_or_bundle_products
    .map((item) => findNode(graph, item.product_id))
    .filter((node): node is GraphNode => Boolean(node))
    .slice(0, 6)
    .map((node, index) => enrichNode(node, "secondary", 6 - index));
  const scentNodes = result.scent_notes
    .map((item) => findNode(graph, item.scent_note_id))
    .filter((node): node is GraphNode => Boolean(node))
    .slice(0, 6)
    .map((node, index) => enrichNode(node, "secondary", 6 - index));

  for (const node of [...matchNodes, ...directNodes, ...indirectNodes, ...scentNodes]) {
    rankedNodes.push(node);
    selectedIds.add(node.id);
  }

  const structuralEdges = graph.edges
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .slice(0, 30)
    .map((edge) => sanitizeEdge(edge));

  const queryEdges = rankedNodes.slice(0, 16).map((node) => ({
    id: `edge:${queryNode.id}:${node.id}`,
    source: queryNode.id,
    target: node.id,
    relation: "HIGHLIGHTS",
    label: "highlights",
    ui: {
      color: node.type === "Product" ? "#d1a06b" : "#d7cab8",
      width: node.type === "Product" ? 2.2 : 1.4,
      lineStyle: node.type === "Product" ? "solid" : "dashed",
      arrowShape: "none",
    },
  }));

  return {
    layout: "organic",
    nodes: dedupeNodes([queryNode, ...rankedNodes]).slice(0, 35),
    edges: dedupeEdges([...queryEdges, ...structuralEdges]).slice(0, 40),
    focusNodeId: matchNodes[0]?.id ?? directNodes[0]?.id ?? queryNode.id,
    legendTypes: uniqueByLabel([queryNode, ...rankedNodes].map((item) => ({ label: item.type })), 8).map((item) => item.label),
  };
}

function summarizeDefaultTheme(): ThemePanelData {
  const links = DIMENSIONS.map((dimension) => ({
    id: `dimension:${dimension.key}`,
    label: dimension.label,
    type: "Dimension" as const,
    caption: dimension.description,
  }));

  return {
    title: "Diptyque 产品知识探索",
    kicker: "默认探索",
    typeLabel: "知识维度入口",
    origin: "default",
    summary: "从香调、系列、产品类型、价格区间、规格或品牌等维度逐步展开，而不是一次性查看完整商品图谱。",
    answer: "你可以直接输入一个问题，或先点击左侧维度入口，逐步进入具体香调、系列、产品类型与相关商品。",
    guide: "图谱不是主角，探索路径才是主角。先选维度，再看具体取值，最后再落到相关商品。",
    evidenceMessage: "默认视图为知识维度入口图，尚未触发具体检索。",
    relatedLinks: links,
    directProducts: [],
    indirectProducts: [],
    nextSteps: links.slice(0, 4),
  };
}

function summarizeDimensionTheme(graph: GraphData, key: DimensionKey): ThemePanelData {
  const definition = DIMENSIONS.find((item) => item.key === key) ?? DIMENSIONS[0];
  const values = getDimensionValues(graph, key).slice(0, 8).map(toExplorationLink);

  return {
    title: definition.label,
    kicker: "维度展开",
    typeLabel: "探索维度",
    origin: "dimension",
    summary: definition.description,
    answer: `当前展示的是“${definition.label}”维度下的一批真实取值。继续点击具体节点，可以进入局部知识图并查看相关商品。`,
    guide: `建议先从 ${values.slice(0, 3).map((item) => item.label).join(" / ")} 这类代表性入口继续探索。`,
    evidenceMessage: "当前维度入口来自前端虚拟节点，展开后的具体取值均来自真实图谱节点。",
    relatedLinks: values,
    directProducts: [],
    indirectProducts: [],
    nextSteps: values.slice(0, 5),
  };
}

function buildNodeSummary(graph: GraphData, node: GraphNode): ThemePanelData {
  const connected = getConnectedNodes(graph, node.id);
  const products = connected.filter((item) => item.type === "Product");
  const directProducts = products.filter((item) => !isBundleLike(item)).slice(0, 8).map((item) => buildProductCard(graph, item, `与当前主题“${node.label}”直接相连`));
  const indirectProducts = products.filter((item) => isBundleLike(item)).slice(0, 6).map((item) => buildProductCard(graph, item, `与当前主题“${node.label}”以礼盒 / 套装形式相关`));
  const facetLinks = uniqueByLabel(
    connected
      .filter((item) => ["ScentNote", "CollectionOrSeries", "ProductType", "PriceRange", "Size", "Brand"].includes(item.type))
      .map(toExplorationLink),
    8,
  );

  const typeLabel = getNodeLabel(node.type);
  const summary = node.type === "Product"
    ? `${node.label} 是图谱中的商品节点，可继续查看它连接的香调、系列、产品类型与价格区间。`
    : `${node.label} 是图谱中的${typeLabel}节点，当前已关联 ${products.length} 个商品，可继续按商品或其他维度缩小范围。`;

  const answer = node.type === "Product"
    ? `当前聚焦的是商品“${node.label}”。右侧会优先显示它的产品类型、价格、系列和香调摘要，并解释它为什么与当前主题相关。`
    : `当前聚焦的是“${node.label}”。左侧只展示与这个节点相关的局部关系，右侧会把直接商品、间接结果和下一步探索入口拆开。`;

  return {
    title: node.label,
    kicker: node.type === "Product" ? "商品节点" : "主题节点",
    typeLabel,
    origin: "node",
    summary,
    answer,
    guide: node.type === "Product"
      ? "从商品继续查看香调、系列或价格区间，会比回到完整图谱更清晰。"
      : "优先看直接相关商品，再根据系列、产品类型或价格区间继续缩小。",
    evidenceMessage: `当前主题来自图谱节点点击，局部关系直接基于 ${typeLabel} 与相邻节点构建。`,
    relatedLinks: facetLinks,
    directProducts,
    indirectProducts,
    nextSteps: [...facetLinks.slice(0, 5), ...directProducts.flatMap((item) => item.nextExplore).slice(0, 3)].slice(0, 6),
  };
}

function buildQuerySummary(graph: GraphData, result: AskResponse): ThemePanelData {
  const directProducts = result.direct_products.slice(0, 10).map((item) => {
    const node = findNode(graph, item.product_id);
    return node
      ? buildProductCard(graph, node, item.post_filter_reason || "来自当前问题的直接检索结果")
      : {
          nodeId: item.product_id,
          label: item.label,
          productType: item.product_type,
          category: item.category,
          subcategory: item.subcategory,
          price: toCurrency(item.price),
          priceRange: item.price_range || "待补充",
          collectionOrSeries: item.collection_or_series || "未归入系列",
          scentSummary: [],
          relationReason: item.post_filter_reason || "来自当前问题的直接检索结果",
          nextExplore: [],
        };
  });

  const indirectProducts = result.indirect_or_bundle_products.slice(0, 8).map((item) => {
    const node = findNode(graph, item.product_id);
    return node
      ? buildProductCard(graph, node, item.post_filter_reason || "来自当前问题的礼盒 / 套装 / 间接结果")
      : {
          nodeId: item.product_id,
          label: item.label,
          productType: item.product_type,
          category: item.category,
          subcategory: item.subcategory,
          price: toCurrency(item.price),
          priceRange: item.price_range || "待补充",
          collectionOrSeries: item.collection_or_series || "未归入系列",
          scentSummary: [],
          relationReason: item.post_filter_reason || "来自当前问题的礼盒 / 套装 / 间接结果",
          nextExplore: [],
        };
  });

  const relatedLinks = uniqueByLabel(
    [
      ...result.matched_entities
        .map((entity) => findNode(graph, entity.id))
        .filter((node): node is GraphNode => Boolean(node))
        .map(toExplorationLink),
      ...result.scent_notes
        .map((item) => findNode(graph, item.scent_note_id))
        .filter((node): node is GraphNode => Boolean(node))
        .map(toExplorationLink),
    ],
    8,
  );

  return {
    title: result.query,
    kicker: "问题驱动",
    typeLabel: "检索结果主题",
    origin: "query",
    summary: `当前问题已先经过图谱检索，页面会围绕命中的节点、直接商品、间接结果和证据路径来组织展示。`,
    answer: result.answer,
    guide: "先看直接相关商品，再看礼盒 / 套装 / 间接结果，最后再通过系列、产品类型或价格区间继续探索。",
    evidenceMessage: "已基于图谱证据生成结果。",
    relatedLinks,
    directProducts,
    indirectProducts,
    nextSteps: [...relatedLinks, ...directProducts.flatMap((item) => item.nextExplore)].slice(0, 8),
  };
}

export function getDimensionDefinitions(): DimensionDefinition[] {
  return DIMENSIONS;
}

export function getSceneForState(graph: GraphData, state: ExplorationState): GraphScene {
  if (state.answerResult) return buildQueryScene(graph, state.answerResult);
  if (state.selectedNodeId) return buildNodeFocusScene(graph, state.selectedNodeId);
  if (state.activeDimension) return buildDimensionScene(graph, state.activeDimension);
  return buildDefaultScene();
}

export function getPanelDataForState(graph: GraphData, state: ExplorationState): ThemePanelData {
  if (state.answerResult) return buildQuerySummary(graph, state.answerResult);
  if (state.selectedNodeId) {
    const node = findNode(graph, state.selectedNodeId);
    if (node) return buildNodeSummary(graph, node);
  }
  if (state.activeDimension) return summarizeDimensionTheme(graph, state.activeDimension);
  return summarizeDefaultTheme();
}

export function findDimensionByNodeId(nodeId: string): DimensionKey | null {
  if (!nodeId.startsWith("dimension:")) return null;
  const key = nodeId.slice("dimension:".length) as DimensionKey;
  return DIMENSIONS.some((item) => item.key === key) ? key : null;
}

export function findGraphNodeById(graph: GraphData, nodeId: string | null): GraphNode | null {
  return findNode(graph, nodeId);
}
