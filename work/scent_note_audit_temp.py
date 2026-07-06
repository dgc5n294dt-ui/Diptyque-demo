import json
from pathlib import Path
from collections import Counter

root = Path(r"C:\Users\potato\Documents\Codex\2026-07-03\b")
graph = json.loads((root / 'public/product-graph.json').read_text(encoding='utf-8'))
node_by_id = {n['id']: n for n in graph['nodes']}

carrier_types = {'candle', 'fragrance', 'perfume', 'home fragrance', 'body care'}
carrier_keywords = [
    '\u6269\u9999', '\u9999\u6c1b', '\u9999\u7cbe', '\u8865\u5145\u88c5', '\u5ba4\u5185\u55b7\u96fe',
    '\u8721\u70db', '\u6de1\u9999\u6c34', '\u6de1\u9999\u7cbe', '\u9999\u818f', '\u6d01\u80a4\u9732',
    '\u6da6\u80a4\u4e73', '\u53d1\u9999\u55b7\u96fe', '\u9999\u6c1b\u7682', '\u8f66\u8f7d\u6269\u9999\u5668'
]
block_terms = [
    '\u6258\u76d8', '\u82b1\u74f6', '\u7b14\u8bb0\u672c', '\u70db\u53f0', '\u914d\u4ef6', '\u5de5\u5177',
    '\u88c5\u9970', '\u6446\u4ef6', '\u70db\u7f69', '\u70db\u526a', '\u5305\u88c5'
]
indirect_terms = ['\u793c\u76d2', '\u5957\u88c5', '\u7ec4\u5408', '\u793c\u8d60', '\u7504\u9009']
cleaning_terms = ['\u6e05\u6d01', '\u53bb\u6c61', '\u53bb\u6cb9\u8102', '\u9664\u57a2', '\u62a4\u7406\u5242']

strong_fields = ['product_name', 'identity_name', 'subtitle', 'notes', 'fragrance']
description_fields = ['description', 'long_description']
weak_fields = ['category', 'subcategory', 'collection_or_series', 'entity_tags', 'search_text']


def norm(value):
    if value is None:
        return ''
    text = str(value).strip()
    return '' if text in {'undefined', 'null', 'NaN', '[object Object]'} else text


def joined_surface(p):
    return ' | '.join([
        norm(p.get('product_name','')),
        norm(p.get('identity_name','')),
        norm(p.get('category','')),
        norm(p.get('subcategory','')),
        norm(p.get('collection_or_series','')),
        norm(p.get('category_path','')),
    ])


def is_carrier_product(p):
    product_type = norm(p.get('product_type', ''))
    if product_type in carrier_types:
        return True
    surface = joined_surface(p)
    return any(term in surface for term in carrier_keywords)


def is_blocked_surface(p):
    surface = joined_surface(p)
    has_block = any(term in surface for term in block_terms)
    has_carrier = any(term in surface for term in carrier_keywords)
    return has_block and not has_carrier


def is_bundle_or_gift_set(p):
    text = ' | '.join([
        norm(p.get('product_name','')),
        norm(p.get('identity_name','')),
        norm(p.get('subtitle','')),
        norm(p.get('description','')),
        norm(p.get('long_description','')),
    ])
    return any(term in text for term in indirect_terms)


def product_type_suspect(p):
    product_type = norm(p.get('product_type',''))
    text = joined_surface(p) + ' | ' + norm(p.get('description','')) + ' | ' + norm(p.get('long_description',''))
    if product_type == 'candle' and any(term in text for term in cleaning_terms):
        return True
    return False


def matched_fields_and_text(p, scent):
    matched_sources = []
    matched_text = {}
    for field in strong_fields + description_fields + weak_fields:
        val = norm(p.get(field, ''))
        if scent in val:
            matched_sources.append(field)
            matched_text[field] = val
    return matched_sources, matched_text


def recommend(p, scent, matched_sources):
    strong_hits = [f for f in matched_sources if f in strong_fields]
    desc_hits = [f for f in matched_sources if f in description_fields]
    weak_hits = [f for f in matched_sources if f in weak_fields]
    carrier = is_carrier_product(p)
    blocked = is_blocked_surface(p)
    bundle = is_bundle_or_gift_set(p)

    if blocked and not (strong_hits or desc_hits):
        return 'remove', 'decorative_or_tool_surface_without_direct_scent_evidence'

    if bundle:
        if strong_hits or desc_hits:
            return 'keep_but_indirect', 'bundle_or_gift_set_contains_scent_bearing_items'
        if weak_hits:
            return 'uncertain', 'bundle_or_gift_set_weak_source_only'

    if strong_hits:
        return 'keep', 'direct_scent_field_match'

    if carrier and desc_hits:
        return 'keep', 'description_match_on_scent_carrier'

    if weak_hits and not (strong_hits or desc_hits):
        return 'remove', 'weak_source_only'

    return 'uncertain', 'needs_manual_review'

rows = []
for e in graph['edges']:
    if e.get('relation') != 'HAS_SCENT_NOTE':
        continue
    source = node_by_id.get(e['source'])
    target = node_by_id.get(e['target'])
    if not source or not target:
        continue
    if source.get('type') != 'Product' or target.get('type') != 'ScentNote':
        continue
    p = source['data']
    scent = target['label']
    matched_sources, matched_text = matched_fields_and_text(p, scent)
    recommendation, reason = recommend(p, scent, matched_sources)
    rows.append({
        'product_id': p['product_id'],
        'product_name': p['product_name'],
        'product_type': norm(p.get('product_type','')),
        'category': norm(p.get('category','')),
        'subcategory': norm(p.get('subcategory','')),
        'collection_or_series': norm(p.get('collection_or_series','')),
        'scent_note': scent,
        'matched_sources': matched_sources,
        'matched_text': matched_text,
        'is_scent_carrier_product': is_carrier_product(p),
        'is_blocked_decorative_or_tool': is_blocked_surface(p),
        'is_bundle_or_gift_set': is_bundle_or_gift_set(p),
        'product_type_suspect': product_type_suspect(p),
        'recommendation': recommendation,
        'reason': reason,
    })

rows.sort(key=lambda r: (r['recommendation'], r['scent_note'], r['product_name'], r['product_id']))
out_path = root / 'work' / 'scent-note-audit.json'
out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')

fig = ''.join(map(chr, [26080, 33457, 26524]))
fig_rows = [r for r in rows if r['scent_note'] == fig]
print('audit_written', out_path)
print('total_scent_edges', len(rows))
print('recommendation_counts', Counter(r['recommendation'] for r in rows))
print('fig_count', len(fig_rows))
print(json.dumps(fig_rows, ensure_ascii=False, indent=2))
