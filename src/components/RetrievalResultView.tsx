import type { AskResponse, ProductCardData } from "../lib/contracts.js";
import type { ChatResultModel, ChatSuggestion } from "../services/exploration.js";

type Props = {
  question: string;
  loading: boolean;
  result: AskResponse | null;
  chatModel: ChatResultModel | null;
  onAskSuggestion: (question: string) => void;
  onJumpToGraph: (nodeId: string) => void;
};

function ProductCard({ item, onJumpToGraph }: { item: ProductCardData; onJumpToGraph: (nodeId: string) => void }): JSX.Element {
  return (
    <article className="product-card muji-card">
      <div className="product-card-top">
        {item.imageUrl ? (
          <div className="product-card-thumb">
            <img src={item.imageUrl} alt={item.label} loading="lazy" />
          </div>
        ) : null}

        <div className="product-card-main">
          <div className="product-card-header">
            <div className="product-card-info">
              <strong>{item.label}</strong>
              {item.englishName ? <span className="name-en">{item.englishName}</span> : null}
              <span className="product-card-category">{item.category || "Diptyque"}</span>
            </div>
          </div>

          <div className="product-card-badges">
            {item.scentSummary.slice(0, 5).map((note) => <span key={note} className="badge">{note}</span>)}
            {item.collectionOrSeries ? <span className="badge">{item.collectionOrSeries}</span> : null}
            {item.size ? <span className="badge">{item.size}</span> : null}
          </div>

          {item.subtitle ? <div className="product-card-subtitle">{item.subtitle}</div> : null}
          {item.description ? <div className="product-card-desc">{item.description}</div> : null}

          <div className="product-card-specs">
            {item.collectionOrSeries ? `系列: ${item.collectionOrSeries}` : "系列待补充"}
            {" · "}
            {item.subcategory || item.priceRange || "商品详情"}
          </div>

          <div className="product-card-talk">💬 {item.relationReason}</div>
        </div>
      </div>

      <div className="product-card-footer">
        <span className="product-card-price">{item.price}</span>
        <div className="product-card-actions">
          <button className="muji-btn outline mini-graph-btn" onClick={() => onJumpToGraph(item.nodeId)}>◉ 图谱</button>
          {item.productUrl ? <a className="muji-btn outline mini-link-btn" href={item.productUrl} target="_blank" rel="noreferrer">详情</a> : null}
        </div>
      </div>
    </article>
  );
}

function SuggestChips({ suggestions, onAskSuggestion, onJumpToGraph }: {
  suggestions: ChatSuggestion[];
  onAskSuggestion: (question: string) => void;
  onJumpToGraph: (nodeId: string) => void;
}): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div className="suggest-chips">
      <span className="suggest-label">💬 试试问：</span>
      {suggestions.map((item) => item.kind === "ask"
        ? <button key={item.label} className="suggest-chip" onClick={() => item.question && onAskSuggestion(item.question)}>{item.label}</button>
        : <button key={item.label} className="suggest-chip" onClick={() => item.nodeId && onJumpToGraph(item.nodeId)}>{item.label}</button>)}
    </div>
  );
}

export function RetrievalResultView({ question, loading, result, chatModel, onAskSuggestion, onJumpToGraph }: Props): JSX.Element {
  return (
    <div className="scroll-container">
      <div className="chat-msg bot">
        <div className="answer-text">欢迎使用 Diptyque 商品知识库！询问商品信息、价格区间、香调关系和搭配推荐。</div>
        <SuggestChips
          suggestions={[
            { kind: "ask", label: "哪些产品含有无花果香调？", question: "哪些产品含有无花果香调？" },
            { kind: "ask", label: "多用途家居清洁喷雾有哪些香调？", question: "多用途家居清洁喷雾有哪些香调？" },
            { kind: "ask", label: "圣日尔曼大道34号有哪些相关商品？", question: "圣日尔曼大道34号有哪些相关商品？" },
            { kind: "ask", label: "有哪些1000元以上的个人香氛？", question: "有哪些1000元以上的个人香氛？" },
          ]}
          onAskSuggestion={onAskSuggestion}
          onJumpToGraph={onJumpToGraph}
        />
      </div>

      {question.trim() ? <div className="chat-msg user">{question.trim()}</div> : null}
      {loading ? <div className="chat-msg loading"><span className="thinking-text">思考中</span></div> : null}

      {chatModel ? (
        <div className="chat-msg bot result-block">
          <div className="answer-text">{chatModel.answer}</div>

          <div className="card-stack">
            {chatModel.directProducts.map((item) => <ProductCard key={item.nodeId} item={item} onJumpToGraph={onJumpToGraph} />)}
            {chatModel.indirectProducts.map((item) => <ProductCard key={item.nodeId} item={item} onJumpToGraph={onJumpToGraph} />)}
          </div>

          <details className="retrieval-pipeline route-pipeline collapsed">
            <summary className="pipeline-header">
              <span className="pipeline-title">🔍 检索决策链路</span>
              <span className="pipeline-mode-badge">{chatModel.modeLabel}</span>
            </summary>
            <div className="pipeline-body">
              <div className="detail-section">
                <div className="detail-section-title">匹配实体</div>
                {chatModel.matchedEntities.length === 0 ? <div className="detail-val muted">暂无</div> : null}
                {chatModel.matchedEntities.map((item) => <div key={item} className="detail-row"><span className="detail-val">{item}</span></div>)}
              </div>

              <div className="detail-section">
                <div className="detail-section-title">过滤证据</div>
                {chatModel.filterEvidence.length === 0 ? <div className="detail-val muted">暂无</div> : null}
                {chatModel.filterEvidence.map((item) => <div key={item} className="detail-row"><span className="detail-val">{item}</span></div>)}
              </div>

              <div className="detail-section">
                <div className="detail-section-title">知识证据</div>
                {chatModel.evidencePaths.length === 0 ? <div className="detail-val muted">暂无</div> : null}
                {chatModel.evidencePaths.map((item) => <div key={item} className="knowledge-evidence-row"><span className="chunk-text">{item}</span></div>)}
              </div>
            </div>
          </details>

          <SuggestChips suggestions={chatModel.suggestions} onAskSuggestion={onAskSuggestion} onJumpToGraph={onJumpToGraph} />
          <div className="answer-meta">{chatModel.metaLine}</div>
        </div>
      ) : null}

      {result?.warnings.length ? (
        <div className="chat-msg bot warning-block">
          {result.warnings.map((warning) => <div key={warning} className="detail-val">{warning}</div>)}
        </div>
      ) : null}
    </div>
  );
}
