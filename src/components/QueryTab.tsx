import { useEffect, useState } from "react";

const SAMPLE_QUESTIONS = [
  "无花果有哪些产品",
  "多用途家居清洁喷雾有哪些香调",
  "车载扩香器相关商品",
  "圣日尔曼大道34号相关商品",
  "1000 元以上个人香氛",
];

type Props = {
  question: string;
  loading: boolean;
  providerLabel: string;
  modeLabel: string;
  onQuestionChange: (value: string) => void;
  onSubmit: (question: string) => Promise<void> | void;
  onResetExplore: () => void;
};

export function QueryTab({
  question,
  loading,
  providerLabel,
  modeLabel,
  onQuestionChange,
  onSubmit,
  onResetExplore,
}: Props): JSX.Element {
  const [draft, setDraft] = useState(question);

  useEffect(() => {
    setDraft(question);
  }, [question]);

  function syncDraft(value: string): void {
    setDraft(value);
    onQuestionChange(value);
  }

  async function handleAsk(): Promise<void> {
    if (!draft.trim()) return;
    await onSubmit(draft.trim());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void handleAsk();
  }

  return (
    <section className="query-panel">
      <div className="query-header">
        <div>
          <p className="eyebrow">Explore Diptyque Through Questions Or Concepts</p>
          <h1>Diptyque 产品知识探索体验</h1>
          <p className="hero-copy">
            输入一个问题或关键词，或者先从左侧维度入口开始，逐步看到香调、系列、产品类型与相关商品之间的关系。
          </p>
        </div>
        <div className="hero-badges">
          <span>{modeLabel}</span>
          <span>provider: {providerLabel}</span>
          <span>GitHub Pages 支持静态 fallback</span>
        </div>
      </div>

      <div className="query-toolbar single-page-toolbar">
        <textarea
          value={draft}
          onChange={(event) => syncDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="输入一个问题或关键词，例如：无花果有哪些产品？"
        />
        <div className="query-actions">
          <button onClick={() => void handleAsk()} disabled={loading}>{loading ? "探索中..." : "探索"}</button>
          <button className="secondary" onClick={onResetExplore}>回到维度入口</button>
        </div>
      </div>

      <div className="sample-question-list">
        {SAMPLE_QUESTIONS.map((sample) => (
          <button
            key={sample}
            className="sample-chip"
            onClick={() => {
              syncDraft(sample);
              void onSubmit(sample);
            }}
          >
            {sample}
          </button>
        ))}
      </div>
    </section>
  );
}
