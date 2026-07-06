# Data Cleaning

## Raw CSV source

- Input file: `data/raw/diptyque_products_raw.csv`
- Source provenance: copied from `outputs/diptyque_full/diptyque_products.csv`
- The raw CSV comes from the previously completed Diptyque official website crawl and is treated as the only input for this cleaning step.

## Clean schema

The cleaning script outputs the following fields:

- `product_id`
- `brand`
- `product_name`
- `identity_name`
- `subtitle`
- `product_type`
- `category`
- `subcategory`
- `category_path`
- `collection_or_series`
- `price`
- `market_price`
- `currency`
- `size`
- `size_value`
- `size_unit`
- `description`
- `long_description`
- `notes`
- `fragrance`
- `ingredients`
- `usage_tips`
- `formula`
- `story`
- `savoir_faire`
- `characteristics`
- `primary_image`
- `image_list`
- `product_url`
- `sku`
- `spu`
- `stock`
- `status`
- `search_text`
- `entity_tags`
- `source`

## Main field mappings

- `product_id`: `url_key` -> `sku` -> `spu` -> slugified `name`
- `product_name`: `name`
- `identity_name`: `identity_name`
- `subtitle`: `subtitle`
- `product_type`: `type`, with limited fallback inference from category/name keywords
- `category_path`: parsed from `category_names`
- `category` / `subcategory`: first and last effective values from `category_path` after skipping obvious marketing labels
- `collection_or_series`: inferred conservatively from category/name/subtitle hints
- `price` / `market_price`: cleaned from `price` / `market_price`
- `size`: cleaned from `sizes`
- `size_value` / `size_unit`: extracted from `size`
- `description`: `pdp_short_description` -> `plp_description` -> `description_text` -> `meta_description`
- `long_description`: `pdp_long_description` -> `detailed_description` -> `description_text`
- `notes`: split from `subtitle`, fallback to `fragrance`
- `fragrance`: `fragrance`
- `ingredients`: `ingredients_text`
- `usage_tips`: `usage_tips_text`
- `formula`: `formule_text`
- `story`: `story_text`
- `savoir_faire`: `savoir_faire_text`
- `characteristics`: `caracteristics_text`
- `primary_image`: first image from `media_urls`, then `base_image`, `small_image`, `thumbnail`
- `image_list`: parsed from `media_urls`
- `product_url`: `url`
- `sku`: `sku`
- `spu`: `spu`
- `stock`: `stock`
- `status`: `status`
- `search_text`: assembled from cleaned semantic fields
- `entity_tags`: assembled from notes/category/subcategory/product_type/collection

## Raw fields intentionally dropped

The following raw fields are not written into the clean outputs because they are redundant, HTML-heavy, overly internal, or unsuitable for frontend/runtime use:

- `detail_json`
- `description_html`
- `usage_tips_html`
- `ingredients_html`
- `formule_html`
- `story_html`
- `savoir_faire_html`
- `caracteristics_html`
- `meta_title`
- `meta_keyword`
- `category_ids`
- `package_category_ids`
- `category_page_urls`
- `applet_long_images`

## How to run

```bash
npm run clean:products
```

## Output files

- `data/processed/products_clean.csv`
- `public/products.json`

## Current cleaning limitations

- `collection_or_series` is inferred conservatively from observed text hints, so some valid series names may remain blank.
- `product_type` fallback inference only covers a few major groups and intentionally leaves uncertain cases blank.
- `notes` extraction relies primarily on `subtitle` delimiter splitting and does not perform deeper linguistic parsing.
- `ingredients` splitting uses lightweight punctuation heuristics and may keep some long ingredient strings intact.
- Category paths on the source site sometimes mix product taxonomies with marketing landing labels; the current logic removes only a limited set of obvious marketing segments.
- The script is designed for deterministic local data preparation and does not use embeddings, LLMs, vector search, or graph logic at this stage.
