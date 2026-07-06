import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

type RawRow = Record<string, string>;

type CleanRow = {
  product_id: string;
  brand: string;
  product_name: string;
  identity_name: string;
  subtitle: string;
  product_type: string;
  category: string;
  subcategory: string;
  category_path: string;
  collection_or_series: string;
  price: string;
  market_price: string;
  currency: string;
  size: string;
  size_value: string;
  size_unit: string;
  description: string;
  long_description: string;
  notes: string;
  fragrance: string;
  ingredients: string;
  usage_tips: string;
  formula: string;
  story: string;
  savoir_faire: string;
  characteristics: string;
  primary_image: string;
  image_list: string;
  product_url: string;
  sku: string;
  spu: string;
  stock: string;
  status: string;
  search_text: string;
  entity_tags: string;
  source: string;
};

type QualityReport = {
  raw_product_count: number;
  clean_product_count: number;
  dedup_removed_count: number;
  unique_product_id_count: number;
  unique_category_count: number;
  unique_subcategory_count: number;
  unique_product_type_count: number;
  products_with_notes_count: number;
  products_with_entity_tags_count: number;
  missing_primary_image_count: number;
  missing_product_url_count: number;
  missing_price_count: number;
  missing_description_count: number;
  contains_invalid_literals: boolean;
  contains_html_residue: boolean;
  top_5_samples: CleanRow[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const inputCsvPath = resolve(rootDir, "data/raw/diptyque_products_raw.csv");
const outputCsvPath = resolve(rootDir, "data/processed/products_clean.csv");
const outputJsonPath = resolve(rootDir, "public/products.json");
const docPath = resolve(rootDir, "docs/data-cleaning.md");

const FIELD_ORDER: Array<keyof CleanRow> = [
  "product_id",
  "brand",
  "product_name",
  "identity_name",
  "subtitle",
  "product_type",
  "category",
  "subcategory",
  "category_path",
  "collection_or_series",
  "price",
  "market_price",
  "currency",
  "size",
  "size_value",
  "size_unit",
  "description",
  "long_description",
  "notes",
  "fragrance",
  "ingredients",
  "usage_tips",
  "formula",
  "story",
  "savoir_faire",
  "characteristics",
  "primary_image",
  "image_list",
  "product_url",
  "sku",
  "spu",
  "stock",
  "status",
  "search_text",
  "entity_tags",
  "source",
];

const SERIES_BLACKLIST = new Set([
  "\u4e2a\u4eba\u9999\u6c1b",
  "\u5bb6\u5c45\u9999\u6c1b",
  "\u8eab\u4f53\u62a4\u7406",
  "\u827a\u672f\u5bb6\u5c45",
  "\u63a2\u7d22\u5168\u90e8",
  "\u4eba\u6c14\u7cbe\u9009",
  "\u81fb\u9009\u793c\u8d60",
  "\u5f53\u5b63\u7cbe\u9009",
  "\u8865\u5145\u88c5",
  "\u624b\u90e8\u62a4\u80a4",
  "\u8eab\u4f53\u62a4\u80a4",
  "\u5ba4\u5185\u9999\u6c1b",
  "\u9999\u6c1b\u8721\u70db",
  "\u8721\u70db\u914d\u4ef6",
  "\u88c5\u9970\u6446\u4ef6",
  "\u9999\u6c1b\u8721\u70db\u914d\u9970",
]);

const INVALID_CATEGORY_SEGMENTS = new Set([
  "\u63a2\u7d22\u5168\u90e8",
  "\u4eba\u6c14\u7cbe\u9009",
  "\u5f53\u5b63\u7cbe\u9009",
  "\u81fb\u9009\u793c\u8d60",
  "\u9650\u65f6\u793c\u9047",
  "\u793c\u8d5e\u7231\u610f",
  "Diptyque & You",
  "\u670d\u52a1",
  "\u5173\u4e8eDiptyque",
  "\u590f\u65e5\u62a4\u80a4\u4eea\u5f0f",
  "\u590f\u65e5\u6c14\u606f\u5bb6\u5c45\u9999\u6c1b",
  "\u590f\u65e5\u9999\u6c1b",
  "\u7ecf\u5178\u9999\u6c1b\uff0c\u7115\u65b0\u91cd\u5851",
  "\u6c34\u5883\u82b1\u56ed\u590f\u65e5\u9650\u5b9a\u7cfb\u5217",
  "\u5965\u8d39\u6069\u7115\u65b0\u56de\u5f52",
]);

const COLLECTION_HINTS = [
  "\u5965\u8d39\u6069",
  "\u5927\u5343\u4e4b\u8574",
  "\u5e0c\u814a\u65e0\u82b1\u679c",
  "\u611f\u5b98\u4e4b\u6c34",
  "\u73ab\u7470\u9999\u8c03",
  "\u5f71\u4e2d\u4e4b\u6c34",
  "\u5df4\u9ece\u4e4b\u6c34",
  "\u8c2d\u9053",
  "\u675c\u6851",
  "\u7eb8\u4e0a",
  "\u808c\u80a4\u4e4b\u82b1",
  "\u5723\u65e5\u5c14\u66fc\u5927\u905334\u53f7",
  "\u6d46\u679c\u9999",
  "\u65e0\u82b1\u679c",
  "\u665a\u9999\u7389",
  "\u7425\u73c0",
  "\u70ad\u6728\u9999",
  "\u590f\u65e5\u4e4b\u5149",
  "\u590f\u65e5\u62a4\u80a4\u4eea\u5f0f",
  "\u6c34\u5883\u82b1\u56ed",
];

const invalidLiteralPattern = /(?:^|\b)(undefined|null|NaN)(?:\b|$)|\[object Object\]/i;
const htmlTagPattern = /<[^>]+>/;


function replaceChineseSeparators(text: string): string {
  return text
    .replace(/及/g, "|")
    .replace(/与/g, "|")
    .replace(/和/g, "|")
    .replace(/、/g, "|")
    .replace(/，/g, "|")
    .replace(/,/g, "|")
    .replace(/\//g, "|")
    .replace(/;/g, "|")
    .replace(/；/g, "|");
}

function cleanupCandidateToken(token: string): string {
  return normalizeWhitespace(
    token
      .replace(/^成分[:：]?\s*/u, "")
      .replace(/^其他微量成分[:：]?\s*/u, "")
      .replace(/的香气$/u, "")
      .replace(/香气$/u, "")
      .replace(/成分$/u, "")
      .replace(/[()??]+$/u, "")
  );
}

function splitNaturalCandidates(text: string): string[] {
  const cleaned = stripHtml(text);
  if (!cleaned) return [];
  const normalized = replaceChineseSeparators(
    cleaned
      .replace(/。其他微量成分[:：]?/gu, "|")
      .replace(/其他微量成分[:：]?/gu, "|")
      .replace(/。/gu, "|")
  );
  return uniquePreserveOrder(
    normalized
      .split("|")
      .map((part) => cleanupCandidateToken(part))
      .filter(Boolean)
  );
}

function ensureString(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value).trim();
  if (
    stringValue === "undefined" ||
    stringValue === "null" ||
    stringValue === "NaN" ||
    stringValue === "[object Object]"
  ) {
    return "";
  }
  return stringValue;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeWhitespace(text: string): string {
  return ensureString(text)
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(text: string): string {
  const normalized = ensureString(text);
  if (!normalized) return "";
  return normalizeWhitespace(decodeHtmlEntities(normalized.replace(/<[^>]*>/g, " ")));
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = normalizeWhitespace(value);
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push(cleaned);
  }
  return output;
}

function splitMultiValue(text: string, separators = /[\u3001\uff0c,|/;\uff1b]+/): string[] {
  const cleaned = stripHtml(text);
  if (!cleaned) return [];
  return uniquePreserveOrder(
    cleaned
      .split(separators)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean),
  );
}

function splitPipeLike(text: string): string[] {
  const cleaned = stripHtml(text);
  if (!cleaned) return [];
  return uniquePreserveOrder(cleaned.split("|").map((part) => normalizeWhitespace(part)));
}

function parseCategoryPath(raw: string): string[] {
  const value = ensureString(raw);
  if (!value) return [];
  const trimmed = value.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return uniquePreserveOrder(parsed.map((item) => stripHtml(String(item))));
      }
    } catch {
      // fall through
    }
  }

  return splitPipeLike(trimmed);
}

function filterValidCategorySegments(parts: string[]): string[] {
  const filtered = parts.filter((part) => {
    if (!part) return false;
    if (INVALID_CATEGORY_SEGMENTS.has(part)) return false;
    if (part.includes("\u7cbe\u9009") || part.includes("\u793c\u9047")) return false;
    return true;
  });
  return filtered.length > 0 ? filtered : parts;
}

function parseImageList(raw: string): string[] {
  const value = ensureString(raw);
  if (!value) return [];
  const trimmed = value.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return uniquePreserveOrder(
          parsed
            .map((item) => normalizeWhitespace(String(item)))
            .filter((item) => /^https?:\/\//i.test(item)),
        );
      }
    } catch {
      // fall through
    }
  }

  return uniquePreserveOrder(
    trimmed
      .split("|")
      .map((part) => normalizeWhitespace(part))
      .filter((item) => /^https?:\/\//i.test(item)),
  );
}

function parseSize(raw: string): string {
  return uniquePreserveOrder(splitPipeLike(raw)).join(" | ");
}

function extractSizeParts(size: string): { values: string; units: string } {
  const chunks = splitPipeLike(size);
  const values: string[] = [];
  const units: string[] = [];

  for (const chunk of chunks) {
    const matches = Array.from(chunk.matchAll(/(\d+(?:\.\d+)?)\s*([A-Za-z]+|\u652f|\u4e2a|\u7247)/g));
    for (const match of matches) {
      values.push(match[1]);
      units.push(match[2].toUpperCase());
    }
  }

  return {
    values: uniquePreserveOrder(values).join(" | "),
    units: uniquePreserveOrder(units).join(" | "),
  };
}

function cleanNumericString(raw: string): string {
  const value = ensureString(raw).replace(/[\u00a5\uffe5,\s]/g, "");
  if (!value) return "";
  const matched = value.match(/\d+(?:\.\d+)?/g);
  return matched ? matched.join("") : "";
}

function normalizeProductType(rawType: string, categoryPath: string[], name: string, subtitle: string): string {
  const type = normalizeWhitespace(rawType).toLowerCase();
  const haystack = `${categoryPath.join(" ")} ${name} ${subtitle}`;

  if (/清洁|去污|去油脂|除垢|护理剂/.test(haystack)) {
    return "home fragrance";
  }

  if (type && type !== "candle") return type;
  if (type === "candle") return type;

  const rules: Array<{ label: string; test: RegExp }> = [
    { label: "home fragrance", test: /室内喷雾|扩香|家居香氛|香氛蜡|车载扩香器|电子扩香器/ },
    { label: "candle", test: /蜡烛|烛杯|烛罩|灭烛罩/ },
    { label: "perfume", test: /淡香水|淡香精|香膏|发香喷雾|香氛皂/ },
    { label: "body care", test: /护手霜|润肤乳|洁肤露|身体护理|手部护肤|身体护肤|洗发|护发/ },
    { label: "decoration", test: /花瓶|托盘|摆件|文创|艺术家居|烛台|玻璃罩|配饰/ },
  ];

  for (const rule of rules) {
    if (rule.test.test(haystack)) return rule.label;
  }

  return type || "";
}

function inferCollectionOrSeries(categoryPath: string[], productName: string, identityName: string, subtitle: string): string {
  for (const item of categoryPath) {
    if (SERIES_BLACKLIST.has(item)) continue;
    if (COLLECTION_HINTS.includes(item)) return item;
  }

  const haystack = `${productName} ${identityName} ${subtitle}`;
  for (const hint of COLLECTION_HINTS) {
    if (haystack.includes(hint)) return hint;
  }

  return "";
}

function normalizeNotes(subtitle: string, fragrance: string): string {
  const source = subtitle || fragrance;
  if (!source) return "";
  const rawNotes = splitMultiValue(source);
  const filtered = rawNotes.filter((item) => item.length <= 20 && !/[\u3002\uff01\uff1f]/.test(item));
  return uniquePreserveOrder(filtered).join(" | ");
}

function normalizeIngredients(text: string): string {
  const cleaned = stripHtml(text);
  if (!cleaned) return "";
  const parts = splitMultiValue(cleaned, /[\u3001\uff0c,\uff1b;]+/);
  if (parts.length >= 2) return parts.join(" | ");
  return cleaned;
}

function slugify(text: string): string {
  const normalized = normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "product";
}

function buildProductId(row: RawRow, productName: string): string {
  return ensureString(row.url_key) || ensureString(row.sku) || ensureString(row.spu) || slugify(productName);
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const cleaned = stripHtml(value ?? "");
    if (cleaned) return cleaned;
  }
  return "";
}

function buildSearchText(row: CleanRow): string {
  const parts = [
    row.product_name,
    row.identity_name,
    row.subtitle,
    row.product_type,
    row.category,
    row.subcategory,
    row.category_path,
    row.collection_or_series,
    row.notes,
    row.fragrance,
    row.description,
    row.long_description,
    row.usage_tips,
    row.story,
    row.characteristics,
  ];

  return uniquePreserveOrder(parts.map((part) => stripHtml(part)).filter(Boolean)).join(" | ");
}

function buildEntityTags(row: Omit<CleanRow, "entity_tags" | "search_text">): string {
  const tags = [...splitPipeLike(row.notes), row.category, row.subcategory, row.product_type, row.collection_or_series];
  return uniquePreserveOrder(tags).join(" | ");
}

function sanitizeOutputValue(value: string): string {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) return "";
  if (invalidLiteralPattern.test(cleaned)) return "";
  return cleaned;
}

function cleanRow(raw: RawRow): CleanRow {
  const productName = stripHtml(raw.name);
  const identityName = stripHtml(raw.identity_name);
  const subtitle = stripHtml(raw.subtitle);
  const categoryPathParts = parseCategoryPath(raw.category_names);
  const effectiveCategoryParts = filterValidCategorySegments(categoryPathParts);
  const categoryPath = categoryPathParts.join(" | ");
  const category = effectiveCategoryParts[0] ?? "";
  const subcategory = effectiveCategoryParts.at(-1) ?? "";
  const collectionOrSeries = inferCollectionOrSeries(categoryPathParts, productName, identityName, subtitle);
  const productType = normalizeProductType(raw.type, categoryPathParts, productName, subtitle);
  const size = parseSize(raw.sizes);
  const sizeParts = extractSizeParts(size);
  const description = firstNonEmpty(raw.pdp_short_description, raw.plp_description, raw.description_text, raw.meta_description);
  const longDescription = firstNonEmpty(raw.pdp_long_description, raw.detailed_description, raw.description_text);
  const fragrance = stripHtml(raw.fragrance);
  const notes = normalizeNotes(subtitle, fragrance);
  const imageListArray = parseImageList(raw.media_urls);
  const primaryImage = imageListArray[0] || stripHtml(raw.base_image) || stripHtml(raw.small_image) || stripHtml(raw.thumbnail);

  const baseRow: Omit<CleanRow, "entity_tags" | "search_text"> = {
    product_id: buildProductId(raw, productName),
    brand: "Diptyque",
    product_name: productName,
    identity_name: identityName,
    subtitle,
    product_type: productType,
    category,
    subcategory,
    category_path: categoryPath,
    collection_or_series: collectionOrSeries,
    price: cleanNumericString(raw.price),
    market_price: cleanNumericString(raw.market_price),
    currency: "CNY",
    size,
    size_value: sizeParts.values,
    size_unit: sizeParts.units,
    description,
    long_description: longDescription,
    notes,
    fragrance,
    ingredients: normalizeIngredients(raw.ingredients_text),
    usage_tips: stripHtml(raw.usage_tips_text),
    formula: stripHtml(raw.formule_text),
    story: stripHtml(raw.story_text),
    savoir_faire: stripHtml(raw.savoir_faire_text),
    characteristics: stripHtml(raw.caracteristics_text),
    primary_image: primaryImage,
    image_list: imageListArray.join(" | "),
    product_url: stripHtml(raw.url),
    sku: stripHtml(raw.sku),
    spu: stripHtml(raw.spu),
    stock: cleanNumericString(raw.stock),
    status: cleanNumericString(raw.status),
    source: "diptyque_official_website",
  };

  const entityTags = buildEntityTags(baseRow);
  const row: CleanRow = {
    ...baseRow,
    search_text: "",
    entity_tags: entityTags,
  };

  row.search_text = buildSearchText(row);

  for (const key of FIELD_ORDER) {
    row[key] = sanitizeOutputValue(row[key]);
  }

  return row;
}

function dedupeRows(rows: CleanRow[]): { rows: CleanRow[]; removed: number } {
  const seen = new Set<string>();
  const output: CleanRow[] = [];
  let removed = 0;

  for (const row of rows) {
    const fallbackKey = `${row.product_name}::${row.sku}`;
    const key = row.product_id || fallbackKey;
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    output.push(row);
  }

  return { rows: output, removed };
}

function includesInvalidLiterals(rows: CleanRow[]): boolean {
  return rows.some((row) => FIELD_ORDER.some((field) => invalidLiteralPattern.test(row[field])));
}

function includesHtmlResidue(rows: CleanRow[]): boolean {
  return rows.some((row) => FIELD_ORDER.some((field) => htmlTagPattern.test(row[field])));
}

function buildDoc(): string {
  return `# Data Cleaning

## Raw CSV source

- Input file: \`data/raw/diptyque_products_raw.csv\`
- Source provenance: copied from \`outputs/diptyque_full/diptyque_products.csv\`
- The raw CSV comes from the previously completed Diptyque official website crawl and is treated as the only input for this cleaning step.

## Clean schema

The cleaning script outputs the following fields:

- \`product_id\`
- \`brand\`
- \`product_name\`
- \`identity_name\`
- \`subtitle\`
- \`product_type\`
- \`category\`
- \`subcategory\`
- \`category_path\`
- \`collection_or_series\`
- \`price\`
- \`market_price\`
- \`currency\`
- \`size\`
- \`size_value\`
- \`size_unit\`
- \`description\`
- \`long_description\`
- \`notes\`
- \`fragrance\`
- \`ingredients\`
- \`usage_tips\`
- \`formula\`
- \`story\`
- \`savoir_faire\`
- \`characteristics\`
- \`primary_image\`
- \`image_list\`
- \`product_url\`
- \`sku\`
- \`spu\`
- \`stock\`
- \`status\`
- \`search_text\`
- \`entity_tags\`
- \`source\`

## Main field mappings

- \`product_id\`: \`url_key\` -> \`sku\` -> \`spu\` -> slugified \`name\`
- \`product_name\`: \`name\`
- \`identity_name\`: \`identity_name\`
- \`subtitle\`: \`subtitle\`
- \`product_type\`: \`type\`, with limited fallback inference from category/name keywords
- \`category_path\`: parsed from \`category_names\`
- \`category\` / \`subcategory\`: first and last effective values from \`category_path\` after skipping obvious marketing labels
- \`collection_or_series\`: inferred conservatively from category/name/subtitle hints
- \`price\` / \`market_price\`: cleaned from \`price\` / \`market_price\`
- \`size\`: cleaned from \`sizes\`
- \`size_value\` / \`size_unit\`: extracted from \`size\`
- \`description\`: \`pdp_short_description\` -> \`plp_description\` -> \`description_text\` -> \`meta_description\`
- \`long_description\`: \`pdp_long_description\` -> \`detailed_description\` -> \`description_text\`
- \`notes\`: split from \`subtitle\`, fallback to \`fragrance\`
- \`fragrance\`: \`fragrance\`
- \`ingredients\`: \`ingredients_text\`
- \`usage_tips\`: \`usage_tips_text\`
- \`formula\`: \`formule_text\`
- \`story\`: \`story_text\`
- \`savoir_faire\`: \`savoir_faire_text\`
- \`characteristics\`: \`caracteristics_text\`
- \`primary_image\`: first image from \`media_urls\`, then \`base_image\`, \`small_image\`, \`thumbnail\`
- \`image_list\`: parsed from \`media_urls\`
- \`product_url\`: \`url\`
- \`sku\`: \`sku\`
- \`spu\`: \`spu\`
- \`stock\`: \`stock\`
- \`status\`: \`status\`
- \`search_text\`: assembled from cleaned semantic fields
- \`entity_tags\`: assembled from notes/category/subcategory/product_type/collection

## Raw fields intentionally dropped

The following raw fields are not written into the clean outputs because they are redundant, HTML-heavy, overly internal, or unsuitable for frontend/runtime use:

- \`detail_json\`
- \`description_html\`
- \`usage_tips_html\`
- \`ingredients_html\`
- \`formule_html\`
- \`story_html\`
- \`savoir_faire_html\`
- \`caracteristics_html\`
- \`meta_title\`
- \`meta_keyword\`
- \`category_ids\`
- \`package_category_ids\`
- \`category_page_urls\`
- \`applet_long_images\`

## How to run

\`\`\`bash
npm run clean:products
\`\`\`

## Output files

- \`data/processed/products_clean.csv\`
- \`public/products.json\`

## Current cleaning limitations

- \`collection_or_series\` is inferred conservatively from observed text hints, so some valid series names may remain blank.
- \`product_type\` fallback inference only covers a few major groups and intentionally leaves uncertain cases blank.
- \`notes\` extraction relies primarily on \`subtitle\` delimiter splitting and does not perform deeper linguistic parsing.
- \`ingredients\` splitting uses lightweight punctuation heuristics and may keep some long ingredient strings intact.
- Category paths on the source site sometimes mix product taxonomies with marketing landing labels; the current logic removes only a limited set of obvious marketing segments.
- The script is designed for deterministic local data preparation and does not use embeddings, LLMs, vector search, or graph logic at this stage.
`;
}

async function main(): Promise<void> {
  const csvContent = await readFile(inputCsvPath, "utf-8");
  const rawRows = parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as RawRow[];

  const cleanedRows = rawRows.map(cleanRow);
  const deduped = dedupeRows(cleanedRows);
  const outputRows = deduped.rows;

  const csvOutput = stringify(outputRows, {
    header: true,
    columns: FIELD_ORDER,
  });

  await writeFile(outputCsvPath, csvOutput, "utf-8");
  await writeFile(outputJsonPath, `${JSON.stringify(outputRows, null, 2)}\n`, "utf-8");
  await writeFile(docPath, buildDoc(), "utf-8");

  const report: QualityReport = {
    raw_product_count: rawRows.length,
    clean_product_count: outputRows.length,
    dedup_removed_count: deduped.removed,
    unique_product_id_count: new Set(outputRows.map((row) => row.product_id)).size,
    unique_category_count: new Set(outputRows.map((row) => row.category).filter(Boolean)).size,
    unique_subcategory_count: new Set(outputRows.map((row) => row.subcategory).filter(Boolean)).size,
    unique_product_type_count: new Set(outputRows.map((row) => row.product_type).filter(Boolean)).size,
    products_with_notes_count: outputRows.filter((row) => Boolean(row.notes)).length,
    products_with_entity_tags_count: outputRows.filter((row) => Boolean(row.entity_tags)).length,
    missing_primary_image_count: outputRows.filter((row) => !row.primary_image).length,
    missing_product_url_count: outputRows.filter((row) => !row.product_url).length,
    missing_price_count: outputRows.filter((row) => !row.price).length,
    missing_description_count: outputRows.filter((row) => !row.description).length,
    contains_invalid_literals: includesInvalidLiterals(outputRows),
    contains_html_residue: includesHtmlResidue(outputRows),
    top_5_samples: outputRows.slice(0, 5),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
