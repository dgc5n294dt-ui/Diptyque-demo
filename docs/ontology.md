# Product Ontology

## Why this project needs an ontology

This project is not only a product catalog. It needs a product ontology so the data can be represented as a structured knowledge graph instead of a flat table. That ontology makes product attributes, categories, scent notes, sizes, collections, and brand relationships explicit and queryable. This is important both for graph visualization and for the later Graph-RAG retrieval pipeline.

## Node types

- `Brand`: the product brand. In the current dataset this is a single fixed node, Diptyque.
- `Product`: one node per cleaned product record. Each product node keeps the full cleaned payload in `data`.
- `ProductType`: normalized product type such as candle, fragrance, decoration, perfume, home fragrance, or body care.
- `Category`: the main product category.
- `Subcategory`: the more specific product subcategory.
- `ScentNote`: scent or olfactory note extracted from `notes` and domain scent term recall.
- `Ingredient`: ingredient tokens derived from `ingredients`, limited to shorter and more reusable entities.
- `Size`: size or specification tokens such as 190G or 75ML.
- `PriceRange`: price bucket nodes instead of exact price nodes.
- `CollectionOrSeries`: collection or series names when the cleaned dataset provides them.

## Relation types

- `BY_BRAND`: Product -> Brand
- `HAS_PRODUCT_TYPE`: Product -> ProductType
- `BELONGS_TO_CATEGORY`: Product -> Category
- `BELONGS_TO_SUBCATEGORY`: Product -> Subcategory
- `HAS_SCENT_NOTE`: Product -> ScentNote
- `HAS_INGREDIENT`: Product -> Ingredient
- `HAS_SIZE`: Product -> Size
- `IN_PRICE_RANGE`: Product -> PriceRange
- `PART_OF_COLLECTION`: Product -> CollectionOrSeries

## Field source mapping

- Input source for graph building: `public/products.json`
- Product node payload source: all fields from the cleaned product schema
- ProductType nodes: `product_type`
- Category nodes: `category`
- Subcategory nodes: `subcategory`
- ScentNote nodes: direct `notes`/`subtitle`/`fragrance` candidates plus domain scent vocabulary matches from product text fields
- Ingredient nodes: `ingredients`
- Size nodes: `size`
- PriceRange nodes: derived from `price`
- CollectionOrSeries nodes: `collection_or_series`

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

```json
{
  "nodes": [],
  "edges": [],
  "stats": {},
  "ontology": {}
}
```

- `nodes`: every graph node with `id`, `label`, `type`, and `data`
- `edges`: every graph edge with `id`, `source`, `target`, `relation`, and `label`
- `stats`: graph counts and relation/type summaries
- `ontology`: compact ontology metadata for the frontend and future graph tooling

## Current graph-building limitations

- It depends entirely on the deterministic cleaned dataset and does not infer new semantics beyond the cleaned fields.
- `collection_or_series` coverage is limited by what the cleaning step could infer.
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
