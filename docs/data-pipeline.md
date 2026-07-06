# Data Pipeline

Current data flow:

```text
outputs/diptyque_full/diptyque_products.csv
  ↓
data/raw/diptyque_products_raw.csv
  ↓
scripts/clean-products.ts
  ↓
data/processed/products_clean.csv
public/products.json
  ↓
scripts/build-graph.ts
  ↓
public/product-graph.json
  ↓
React frontend
  ↓
Knowledge Graph + Graph-RAG QA
```

Directory roles:

- `outputs/` is the crawler output directory and backup of raw scrape artifacts.
- `data/raw/` is the archived raw data directory used as the formal input source for downstream cleaning scripts.
- `data/processed/` is the intermediate directory for cleaned and normalized datasets.
- `public/` stores runtime-readable data files for the frontend.
- `scripts/` stores data cleaning and graph construction scripts.
- `src/` stores frontend source code.
