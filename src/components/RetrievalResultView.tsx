import type { AskResponse, FilterEvidence, MatchedEntity, ProductResult, ScentNoteResult } from "../lib/contracts.js";

type Props = { result: AskResponse | null };

function renderEntity(entity: MatchedEntity): string {
  return `${entity.label} (${entity.type})`;
}

function renderProduct(product: ProductResult): string {
  const price = product.price ? `${product.price}元` : "无价格";
  return `${product.label} | ${product.product_type} | ${product.category} | ${price}`;
}

function renderScentNote(note: ScentNoteResult): string {
  return `${note.label} (${note.scent_note_id})`;
}

function renderFilterEvidence(item: FilterEvidence): string {
  return `${item.label} | 属性证据 ${item.category_or_attribute_paths.length} 条 | 价格证据 ${item.price_paths.length} 条`;
}

function Section({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <section className="result-section">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="muted">暂无</p> : null}
      {items.length > 0 ? <ul className="result-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </section>
  );
}

export function RetrievalResultView({ result }: Props): JSX.Element {
  if (!result) {
    return <div className="result-shell empty-state"><p>提交一个问题后，这里会展示 answer、provider、实体匹配结果以及证据路径。</p></div>;
  }

  return (
    <div className="result-shell">
      <section className="answer-card">
        <div className="answer-meta">
          <span className="provider-pill">provider: {result.provider}</span>
          <span className="intent-pill">intent: {result.intent}</span>
        </div>
        <h3>回答</h3>
        <p>{result.answer}</p>
      </section>

      <div className="result-grid">
        <Section title="matched_entities" items={result.matched_entities.map(renderEntity)} />
        <Section title="direct_products" items={result.direct_products.map(renderProduct)} />
        <Section title="indirect_or_bundle_products" items={result.indirect_or_bundle_products.map(renderProduct)} />
        <Section title="scent_notes" items={result.scent_notes.map(renderScentNote)} />
        <Section title="filter_evidence" items={result.filter_evidence.map(renderFilterEvidence)} />
        <Section title="warnings" items={result.warnings} />
      </div>

      <section className="result-section wide">
        <h4>evidence_paths</h4>
        {result.evidence_paths.length === 0 ? <p className="muted">暂无</p> : null}
        {result.evidence_paths.length > 0 ? <ul className="path-list">{result.evidence_paths.map((path) => <li key={path}>{path}</li>)}</ul> : null}
      </section>
    </div>
  );
}