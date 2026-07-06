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
  | "CollectionOrSeries";

export type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  data: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  label: string;
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