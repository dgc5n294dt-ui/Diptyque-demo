const SUGGESTIONS = [
  "哪些产品含有无花果香调？",
  "多用途家居清洁喷雾有哪些香调？",
  "有哪些车载扩香器相关商品？",
  "圣日尔曼大道34号有哪些相关商品？",
];

type Props = {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: (question: string) => Promise<void> | void;
};

export function QueryTab({ question, loading, onQuestionChange, onSubmit }: Props): JSX.Element {
  async function handleSubmit(): Promise<void> {
    if (!question.trim()) return;
    await onSubmit(question.trim());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void handleSubmit();
  }

  return (
    <>
      <div className="chat-hero">
        <p className="chat-welcome-title">欢迎使用 Diptyque 商品知识库！</p>
        <p className="chat-welcome-copy">询问商品信息、价格区间、香调关系和搭配建议。</p>
        <p className="chat-welcome-copy muted">支持图谱联动、静态 fallback 与基于检索结果的自然语言回答。</p>

        <div className="suggest-area">
          <span className="suggest-label">💬 试试问：</span>
          <div className="suggest-chip-row">
            {SUGGESTIONS.map((sample) => (
              <button
                key={sample}
                className="suggest-chip"
                onClick={() => {
                  onQuestionChange(sample);
                  void onSubmit(sample);
                }}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="input-row fixed-input-row">
        <input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="询问 Diptyque 商品..."
        />
        <button className="muji-btn send-btn" onClick={() => void handleSubmit()} disabled={loading}>
          {loading ? "发送中" : "发送"}
        </button>
      </div>
    </>
  );
}
