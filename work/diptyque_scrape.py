from __future__ import annotations

import argparse
import csv
import html
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.diptyque-cn.com/"
CATEGORY_PREFIX = "https://www.diptyque-cn.com/l/"
PRODUCT_URL_RE = re.compile(r"""https://www\.diptyque-cn\.com/p/[^"'\\s<>]+\.html""")
NUXT_DATA_RE = re.compile(
    r"""<script[^>]*id=["']__NUXT_DATA__["'][^>]*>(.*?)</script>""",
    re.DOTALL | re.IGNORECASE,
)
TITLE_RE = re.compile(r"""<title>(.*?)</title>""", re.DOTALL | re.IGNORECASE)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
THREAD_LOCAL = threading.local()


def get_session() -> requests.Session:
    session = getattr(THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )
        THREAD_LOCAL.session = session
    return session


def fetch_text(url: str, timeout: int = 30, retries: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = get_session().get(url, timeout=timeout)
            response.raise_for_status()
            response.encoding = response.encoding or "utf-8"
            return response.text
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == retries:
                break
            time.sleep(1.2 * attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def extract_nuxt_payload(html_text: str) -> list[Any]:
    match = NUXT_DATA_RE.search(html_text)
    if not match:
        raise ValueError("Could not locate __NUXT_DATA__")
    return json.loads(match.group(1))


def build_decoder(payload: list[Any]):
    cache: dict[int, Any] = {}
    visiting: set[int] = set()

    def decode_value(value: Any, in_container: bool = False) -> Any:
        if isinstance(value, (str, float, bool)) or value is None:
            return value
        if isinstance(value, int):
            return decode_slot(value) if in_container else value
        if isinstance(value, list):
            if value and isinstance(value[0], str):
                tag = value[0]
                if tag in {"Reactive", "ShallowReactive", "Ref", "ShallowRef", "NuxtError"} and len(value) >= 2:
                    return decode_slot(value[1])
                if tag == "Date" and len(value) >= 2:
                    return decode_value(value[1], True)
                if tag == "Set":
                    return [decode_value(item, True) for item in value[1:]]
                if tag == "Map":
                    decoded_items = [decode_value(item, True) for item in value[1:]]
                    return {
                        str(decoded_items[index]): decoded_items[index + 1]
                        for index in range(0, len(decoded_items) - 1, 2)
                    }
            return [decode_value(item, True) for item in value]
        if isinstance(value, dict):
            return {key: decode_value(item, True) for key, item in value.items()}
        return value

    def decode_slot(index: int) -> Any:
        if not isinstance(index, int):
            return index
        if index in cache:
            return cache[index]
        if index in visiting:
            return {"$ref": index}
        if index < 0 or index >= len(payload):
            return index
        visiting.add(index)
        decoded = decode_value(payload[index], False)
        cache[index] = decoded
        visiting.remove(index)
        return decoded

    return decode_slot


def html_to_text(fragment: str) -> str:
    if not fragment:
        return ""
    text = BeautifulSoup(fragment, "html.parser").get_text("\n", strip=True)
    text = html.unescape(text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def extract_title(html_text: str) -> str:
    match = TITLE_RE.search(html_text)
    if not match:
        return ""
    return html.unescape(match.group(1).strip())


def get_homepage_category_urls() -> list[str]:
    homepage_html = fetch_text(BASE_URL)
    soup = BeautifulSoup(homepage_html, "html.parser")
    category_urls = {
        urljoin(BASE_URL, anchor.get("href"))
        for anchor in soup.select("a[href]")
        if anchor.get("href", "").startswith("/l/") or anchor.get("href", "").startswith(CATEGORY_PREFIX)
    }
    return sorted(url for url in category_urls if url.startswith(CATEGORY_PREFIX))


def raw_key_count(value: Any) -> int:
    if isinstance(value, dict):
        return len(value)
    return 0


def scan_category_page(url: str) -> dict[str, Any]:
    html_text = fetch_text(url)
    page_title = extract_title(html_text)
    product_urls = set(PRODUCT_URL_RE.findall(html_text))
    payload = extract_nuxt_payload(html_text)
    decoder = build_decoder(payload)
    root = decoder(3) if len(payload) > 3 else None
    category_name = ""
    payload_items: dict[str, dict[str, Any]] = {}

    if isinstance(root, dict):
        current_category = root.get("current_category")
        if isinstance(current_category, dict):
            category_name = str(current_category.get("name") or "").strip()
        items = root.get("items")
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                url_key = item.get("url_key")
                if not url_key:
                    continue
                product_url = urljoin(BASE_URL, f"/p/{url_key}.html")
                product_urls.add(product_url)
                payload_items[product_url] = item

    return {
        "url": url,
        "title": page_title,
        "category_name": category_name,
        "product_urls": sorted(product_urls),
        "payload_items": payload_items,
    }


def locate_product(payload: list[Any]) -> dict[str, Any]:
    decoder = build_decoder(payload)

    raw_candidate_indexes = [
        index
        for index, value in enumerate(payload[:80])
        if isinstance(value, dict) and {"sku", "url_key", "name"} <= set(value.keys())
    ]
    if raw_candidate_indexes:
        candidate = decoder(raw_candidate_indexes[0])
        if isinstance(candidate, dict):
            return candidate

    if len(payload) > 2 and isinstance(payload[2], dict):
        for _, index in payload[2].items():
            if isinstance(index, int):
                candidate = decoder(index)
                if isinstance(candidate, dict) and candidate.get("sku") and candidate.get("url_key"):
                    return candidate

    raise ValueError("Could not locate product object in payload")


def first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}):
            return value
    return ""


def list_of_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    output: list[str] = []
    for item in value:
        if isinstance(item, dict):
            label = item.get("label")
            raw_value = item.get("value")
            text = first_non_empty(label, raw_value)
            if text not in ("", None):
                output.append(str(text))
        elif item not in ("", None):
            output.append(str(item))
    return output


def media_urls(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    sorted_items = sorted(
        [item for item in value if isinstance(item, dict) and item.get("url")],
        key=lambda item: (item.get("position") or 0, item.get("id") or ""),
    )
    return [str(item["url"]) for item in sorted_items]


def section_field(product: dict[str, Any], key: str) -> tuple[str, str]:
    value = product.get(key)
    if isinstance(value, dict):
        html_value = str(value.get("html") or "")
        text_value = html_to_text(html_value)
        return html_value, text_value
    if value in ("", None):
        return "", ""
    return str(value), str(value)


def normalize_product(
    url: str,
    product: dict[str, Any],
    category_names: set[str],
    category_page_urls: set[str],
    detail_source: str,
) -> dict[str, Any]:
    description_html, description_text = section_field(product, "description")
    usage_tips_html, usage_tips_text = section_field(product, "usage_tips")
    ingredients_html, ingredients_text = section_field(product, "ingredients")
    formule_html, formule_text = section_field(product, "formule")
    story_html, story_text = section_field(product, "story")
    savoir_faire_html, savoir_faire_text = section_field(product, "savoir_faire")
    caracteristics_html, caracteristics_text = section_field(product, "caracteristics")

    sizes = list_of_strings(product.get("size"))
    category_ids = list_of_strings(product.get("category_ids"))
    package_category_ids = list_of_strings(product.get("package_category_ids"))

    record = {
        "url": url,
        "url_key": str(product.get("url_key") or ""),
        "name": str(product.get("name") or ""),
        "identity_name": str(product.get("identity_name") or ""),
        "subtitle": str(product.get("subtitle") or ""),
        "sku": str(product.get("sku") or ""),
        "spu": str(product.get("spu") or ""),
        "type": str(product.get("type") or ""),
        "price": product.get("price"),
        "market_price": product.get("market_price"),
        "stock": product.get("stock"),
        "status": str(product.get("status") or ""),
        "country_of_manufacture": str(product.get("country_of_manufacture") or ""),
        "meta_title": str(product.get("meta_title") or ""),
        "meta_description": str(product.get("meta_description") or ""),
        "meta_keyword": str(product.get("meta_keyword") or ""),
        "plp_description": str(product.get("plp_description") or ""),
        "pdp_short_description": str(product.get("pdp_short_description") or ""),
        "pdp_long_description": str(product.get("pdp_long_description") or ""),
        "detailed_description": str(product.get("detailed_description") or ""),
        "fragrance": str(product.get("fragrance") or ""),
        "is_use_fragrance": product.get("is_use_fragrance"),
        "is_priority_purchase": product.get("is_priority_purchase"),
        "is_engrave": product.get("is_engrave"),
        "engrave_length": product.get("engrave_length"),
        "is_package": product.get("is_package"),
        "package_number": product.get("package_number"),
        "is_virtual_suite": product.get("is_virtual_suite"),
        "is_free_trial": product.get("is_free_trial"),
        "is_gift_product": product.get("is_gift_product"),
        "review_count": product.get("review_count"),
        "sizes": sizes,
        "category_ids": category_ids,
        "package_category_ids": package_category_ids,
        "category_names": sorted(name for name in category_names if name),
        "category_page_urls": sorted(category_page_urls),
        "thumbnail": str(product.get("thumbnail") or ""),
        "base_image": str(product.get("base_image") or ""),
        "small_image": str(product.get("small_image") or ""),
        "media_urls": media_urls(product.get("media")),
        "applet_long_images": media_urls(product.get("applet_long_images")),
        "description_html": description_html,
        "description_text": description_text,
        "usage_tips_html": usage_tips_html,
        "usage_tips_text": usage_tips_text,
        "ingredients_html": ingredients_html,
        "ingredients_text": ingredients_text,
        "formule_html": formule_html,
        "formule_text": formule_text,
        "story_html": story_html,
        "story_text": story_text,
        "savoir_faire_html": savoir_faire_html,
        "savoir_faire_text": savoir_faire_text,
        "caracteristics_html": caracteristics_html,
        "caracteristics_text": caracteristics_text,
        "detail_json": product.get("detail_json") if isinstance(product.get("detail_json"), (list, dict)) else [],
        "detail_source": detail_source,
    }
    return record


def scrape_product_page(url: str) -> dict[str, Any]:
    html_text = fetch_text(url)
    payload = extract_nuxt_payload(html_text)
    return locate_product(payload)


def flatten_for_csv(record: dict[str, Any]) -> dict[str, Any]:
    flattened: dict[str, Any] = {}
    for key, value in record.items():
        if isinstance(value, list):
            if value and all(isinstance(item, (dict, list)) for item in value):
                flattened[key] = json.dumps(value, ensure_ascii=False)
            else:
                flattened[key] = " | ".join(str(item) for item in value)
        elif isinstance(value, dict):
            flattened[key] = json.dumps(value, ensure_ascii=False)
        else:
            flattened[key] = value
    return flattened


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape Diptyque China product details")
    parser.add_argument("--output-dir", default="outputs")
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument("--limit-products", type=int, default=0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Fetching homepage category URLs...")
    category_urls = get_homepage_category_urls()
    print(f"Found {len(category_urls)} category pages")

    product_to_category_names: dict[str, set[str]] = {}
    product_to_category_pages: dict[str, set[str]] = {}
    product_fallbacks: dict[str, dict[str, Any]] = {}
    category_errors: list[dict[str, str]] = []

    print("Scanning category pages...")
    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = {executor.submit(scan_category_page, url): url for url in category_urls}
        for index, future in enumerate(as_completed(futures), start=1):
            url = futures[future]
            try:
                result = future.result()
            except Exception as exc:  # noqa: BLE001
                category_errors.append({"url": url, "error": str(exc)})
                continue

            page_name = result["category_name"] or result["title"]
            for product_url in result["product_urls"]:
                product_to_category_names.setdefault(product_url, set()).add(page_name)
                product_to_category_pages.setdefault(product_url, set()).add(result["url"])

                fallback_item = result["payload_items"].get(product_url)
                if fallback_item:
                    existing = product_fallbacks.get(product_url)
                    if existing is None or raw_key_count(fallback_item) > raw_key_count(existing):
                        product_fallbacks[product_url] = fallback_item

            if index % 15 == 0 or index == len(category_urls):
                print(
                    f"Scanned {index}/{len(category_urls)} category pages; "
                    f"unique product URLs: {len(product_to_category_names)}"
                )

    product_urls = sorted(product_to_category_names)
    if args.limit_products > 0:
        product_urls = product_urls[: args.limit_products]

    print(f"Fetching {len(product_urls)} product detail pages...")
    records: list[dict[str, Any]] = []
    product_errors: list[dict[str, str]] = []

    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = {executor.submit(scrape_product_page, url): url for url in product_urls}
        for index, future in enumerate(as_completed(futures), start=1):
            url = futures[future]
            try:
                product = future.result()
                detail_source = "product_page"
            except Exception as exc:  # noqa: BLE001
                fallback = product_fallbacks.get(url)
                if not fallback:
                    product_errors.append({"url": url, "error": str(exc)})
                    continue
                product = fallback
                detail_source = "category_page_fallback"
                product_errors.append({"url": url, "error": f"detail page failed; used fallback: {exc}"})

            record = normalize_product(
                url=url,
                product=product,
                category_names=product_to_category_names.get(url, set()),
                category_page_urls=product_to_category_pages.get(url, set()),
                detail_source=detail_source,
            )
            records.append(record)

            if index % 25 == 0 or index == len(product_urls):
                print(f"Parsed {index}/{len(product_urls)} product pages")

    records.sort(key=lambda item: (item["name"], item["sku"], item["url"]))

    json_path = output_dir / "diptyque_products.json"
    csv_path = output_dir / "diptyque_products.csv"
    summary_path = output_dir / "diptyque_scrape_summary.json"

    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    csv_rows = [flatten_for_csv(record) for record in records]
    fieldnames = list(csv_rows[0].keys()) if csv_rows else []
    with csv_path.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)

    summary = {
        "generated_at_epoch": int(time.time()),
        "base_url": BASE_URL,
        "category_page_count": len(category_urls),
        "unique_product_url_count": len(product_urls),
        "record_count": len(records),
        "category_errors": category_errors,
        "product_errors": product_errors,
        "output_files": {
            "json": str(json_path),
            "csv": str(csv_path),
        },
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(records)} records")
    print(f"JSON: {json_path}")
    print(f"CSV: {csv_path}")
    print(f"Summary: {summary_path}")
    if category_errors:
        print(f"Category errors: {len(category_errors)}")
    if product_errors:
        print(f"Product page issues: {len(product_errors)}")


if __name__ == "__main__":
    main()
