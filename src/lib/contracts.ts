export type AnswerProvider = "mock" | "deepseek";

export type GraphNodeType =
  | "Brand"
  | "Product"
  | "ProductType"
  | "Category"
  | "Subcategory"
  | "ScentNote"
  | "Ingredient"
  | "Size"
  | "PriceRange"
  | "CollectionOrSeries"
  | "Dimension"
  | "Theme";

export type GraphLayoutMode = "radial" | "organic";

export type DimensionKey =
  | "product"
  | "scent"
  | "collection"
  | "productType"
  | "priceRange"
  | "size"
  | "brand";

export type ThemeOrigin = "default" | "dimension" | "node" | "query";

export type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  data: Record<string, unknown>;
  ui?: {
    color?: string;
    size?: number;
    shape?: string;
    opacity?: number;
    rank?: number;
    emphasis?: "hero" | "primary" | "secondary";
  };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  label: string;
  ui?: {
    color?: string;
    width?: number;
    lineStyle?: "solid" | "dashed";
    arrowShape?: "triangle" | "none";
  };
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    productCount: number;
    scentNoteCount: number;
    edgeCount: number;
    relationCounts: Record<string, number>;
    nodeTypeCounts: Record<string, number>;
  };
  ontology: {
    nodeTypes: string[];
    relationTypes: string[];
    description: string;
  };
};

export type MatchedEntity = {
  id: string;
  label: string;
  type: string;
  anchor_text: string;
  match_mode: string;
  score: number;
};

export type ProductResult = {
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

export type ScentNoteResult = {
  scent_note_id: string;
  label: string;
  type: string;
  matched_paths: string[];
};

export type FilterEvidence = {
  product_id: string;
  label: string;
  category_or_attribute_paths: string[];
  price_paths: string[];
};

export type AskResponse = {
  query: string;
  intent: string;
  answer: string;
  answer_sections?: string[];
  matched_entities: MatchedEntity[];
  direct_products: ProductResult[];
  indirect_or_bundle_products: ProductResult[];
  supporting_results: ProductResult[];
  uncertain_results: ProductResult[];
  target_product: ProductResult[];
  scent_notes: ScentNoteResult[];
  filter_evidence: FilterEvidence[];
  evidence_paths: string[];
  warnings: string[];
  provider: AnswerProvider;
};

export type ExplorationLink = {
  id: string;
  label: string;
  type: GraphNodeType;
  caption?: string;
};

export type ProductCardData = {
  nodeId: string;
  label: string;
  productType: string;
  category: string;
  subcategory: string;
  price: string;
  priceRange: string;
  collectionOrSeries: string;
  scentSummary: string[];
  relationReason: string;
  nextExplore: ExplorationLink[];
};

export type ThemePanelData = {
  title: string;
  kicker: string;
  typeLabel: string;
  origin: ThemeOrigin;
  summary: string;
  answer: string;
  guide: string;
  evidenceMessage: string;
  relatedLinks: ExplorationLink[];
  directProducts: ProductCardData[];
  indirectProducts: ProductCardData[];
  nextSteps: ExplorationLink[];
};
