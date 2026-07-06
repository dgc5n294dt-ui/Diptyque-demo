import { useMemo, useState } from "react";

import type { AskResponse, ProductCardData, ThemePanelData } from "../lib/contracts.js";

type Props = {
  panel: ThemePanelData;
  result: AskResponse | null;
  error: string;
  onJumpToNode: (nodeId: string) => void;
};

function ProductCard({ item, onJumpToNode }: { item: ProductCardData; onJumpToNode: (nodeId: string) => void }): JSX.Element {
  return (
    <article className="product-card">
      <div className="product-card-head">
        <div>
          <h4>{item.label}</h4>
          <p>{item.productType || "类型待补充"}</p>
        </div>
        <span className="price-pill">{item.price}</span>
      </div>

      <div className="product-meta-grid">
        <span>类目：{item.category || "待补充"}</span>
        <span>子类：{item.subcategory || "待补充"}</span>
        <span>价格区间：{item.priceRange || "待补充"}</span>
        <span>系列：{item.collectionOrSeries || "未归入系列"}</span>
      </div>

      <p className="product-reason">{item.relationReason}</p>

      <div className="product-scent-row">
        <strong>香调摘要</strong>
        <div className="mini-chip-list">
          {item.scentSummary.length === 0 ? <span className="mini-chip muted-chip">当前局部图中暂无香调摘要</span> : null}
          {item.scentSummary.map((note) => <span key={note} className="mini-chip">{note}</span>)}
        </div>
      </div>

      <div className="product-next-row">
        <strong>继续探索</strong>
        <div className="mini-chip-list">
          {item.nextExplore.map((link) => (
            <button key={`${item.nodeId}:${link.id}`} className="mini-chip button-chip" onClick={() => onJumpToNode(link.id)}>
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function renderJson(result: AskResponse): string {
  return JSON.stringify(
    {
      query: result.query,
      intent: result.intent,
      matched_entities: result.matched_entities,
      direct_products: result.direct_products,
      indirect_or_bundle_products: result.indirect_or_bundle_products,
      scent_notes: result.scent_notes,
      filter_evidence: result.filter_evidence,
      evidence_paths: result.evidence_paths,
      warnings: result.warnings,
      provider: result.provider,
    },
    null,
    2,
  );
}

export function RetrievalResultView({ panel, result, error, onJumpToNode }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const rawJson = useMemo(() => (result ? renderJson(result) : ""), [result]);

  return (
    <section className="result-shell single-page-result-shell">
      <section className="result-section answer-card prominent-card">
        <div className="answer-meta">
          <span className="provider-pill">{result ? `provider: ${result.provider}` : "默认探索"}</span>
          <span className="intent-pill">{result ? `intent: ${result.intent}` : panel.kicker}</span>
        </div>
        <h3>答案与导览</h3>
        <p>{panel.answer}</p>
        {error ? <div className="error-banner">{error}</div> : null}
      </section>

      <section className="result-section">
        <h4>直接相关商品</h4>
        {panel.directProducts.length === 0 ? <p className="muted">当前主题下暂无直接商品，先从左侧维度或具体取值继续探索。</p> : null}
        <div className="product-card-list">
          {panel.directProducts.map((item) => <ProductCard key={item.nodeId} item={item} onJumpToNode={onJumpToNode} />)}
        </div>
      </section>

      <section className="result-section">
        <h4>礼盒 / 套装 / 间接结果</h4>
        {panel.indirectProducts.length === 0 ? <p className="muted">当前没有需要单独提示的礼盒、套装或间接结果。</p> : null}
        <div className="product-card-list compact-cards">
          {panel.indirectProducts.map((item) => <ProductCard key={item.nodeId} item={item} onJumpToNode={onJumpToNode} />)}
        </div>
      </section>

      <section className="result-section">
        <h4>下一步探索</h4>
        <div className="link-chip-list">
          {panel.nextSteps.length === 0 ? <p className="muted">当前没有更多推荐入口。</p> : null}
          {panel.nextSteps.map((link) => (
            <button key={`next:${link.id}`} className="jump-chip" onClick={() => onJumpToNode(link.id)}>
              <strong>{link.label}</strong>
              <span>{link.caption ?? link.type}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="result-section debug-section">
        <div className="debug-header-row">
          <div>
            <h4>证据与调试</h4>
            <p>{panel.evidenceMessage}</p>
          </div>
          <button className="secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "收起证据路径" : "查看证据路径"}
          </button>
        </div>

        {expanded ? (
          <div className="debug-content">
            {result ? (
              <>
                <div className="debug-grid">
                  <section>
                    <h5>matched_entities</h5>
                    {result.matched_entities.length === 0 ? <p className="muted">暂无</p> : null}
                    <ul className="result-list">
                      {result.matched_entities.map((entity) => <li key={entity.id}>{entity.label} ({entity.type})</li>)}
                    </ul>
                  </section>
                  <section>
                    <h5>filter_evidence</h5>
                    {result.filter_evidence.length === 0 ? <p className="muted">暂无</p> : null}
                    <ul className="result-list">
                      {result.filter_evidence.map((item) => <li key={item.product_id}>{item.label}</li>)}
                    </ul>
                  </section>
                </div>

                <section>
                  <h5>evidence_paths</h5>
                  {result.evidence_paths.length === 0 ? <p className="muted">暂无</p> : null}
                  <ul className="path-list">
                    {result.evidence_paths.map((path, index) => <li key={`${index}:${path}`}>{path}</li>)}
                  </ul>
                </section>

                <section>
                  <h5>warnings</h5>
                  {result.warnings.length === 0 ? <p className="muted">暂无</p> : null}
                  <ul className="result-list">
                    {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </section>

                <section>
                  <h5>原始 retrieval 字段</h5>
                  <pre className="debug-pre">{rawJson}</pre>
                </section>
              </>
            ) : (
              <p className="muted">默认探索状态下暂无 retrieval 结果；点击维度、节点或输入问题后，这里会显示证据路径与原始字段。</p>
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}
