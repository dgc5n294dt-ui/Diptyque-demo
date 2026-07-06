import { useMemo, useState } from "react";

import type { AskResponse } from "../lib/contracts.js";
import { askGraphQuestion } from "../services/askClient.js";
import { RetrievalResultView } from "./RetrievalResultView.js";

const SAMPLE_QUESTIONS = [
  "哪些产品含有无花果香调？",
  "多用途家居清洁喷雾有哪些香调？",
  "有哪些含有薰衣草香调的商品？",
  "希腊无花果香调有哪些产品？",
  "圣日尔曼大道34号有哪些相关商品？",
  "迷你香氛蜡烛礼盒包含哪些香调？",
  "有哪些车载扩香器相关商品？",
  "无花果香调里哪些是蜡烛，哪些是室内喷雾，哪些是身体护理？",
  "有哪些1000元以上的个人香氛？",
  "哪些商品同时包含无花果和雪松？",
];

export function QueryTab(): JSX.Element {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const providerHint = useMemo(() => result?.provider ?? "mock", [result]);

  async function handleAsk(): Promise<void> {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await askGraphQuestion(question.trim());
      setResult(response);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : String(askError));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    void handleAsk();
  }

  return (
    <section className="query-tab">
      <div className="section-header">
        <h2>问答</h2>
        <p>当前使用 {providerHint} answer provider；如果静态站点没有本地 API，会自动回退到 mock 结果。</p>
      </div>

      <div className="query-toolbar">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="输入一个商品图谱问题..."
        />
        <div className="query-actions">
          <button onClick={() => void handleAsk()} disabled={loading}>{loading ? "检索中..." : "发送"}</button>
          <button className="secondary" onClick={() => { setQuestion(""); setResult(null); setError(""); }}>重置</button>
        </div>
      </div>

      <div className="sample-question-list">
        {SAMPLE_QUESTIONS.map((sample) => (
          <button key={sample} className="sample-chip" onClick={() => setQuestion(sample)}>{sample}</button>
        ))}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      <RetrievalResultView result={result} />
    </section>
  );
}