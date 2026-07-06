import { useEffect, useMemo, useState } from "react";

import { GraphView } from "./components/GraphView.js";
import { QueryTab } from "./components/QueryTab.js";
import { RetrievalResultView } from "./components/RetrievalResultView.js";
import type { AskResponse, GraphData } from "./lib/contracts.js";
import { askGraphQuestion } from "./services/askClient.js";
import { buildChatResultModel, findGraphNodeById, getSceneForState, type ExplorationState } from "./services/exploration.js";
import { loadProductGraph } from "./services/retrievalClient.js";

type ActiveTab = "graph" | "chat";

const DEFAULT_STATE: ExplorationState = {
  origin: "default",
  selectedNodeId: null,
  prompt: "",
  answerResult: null,
};

export default function App(): JSX.Element {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("graph");
  const [state, setState] = useState<ExplorationState>(DEFAULT_STATE);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setLoadError("");
      try {
        setGraph(await loadProductGraph());
      } catch (error) {
        console.error(error);
        setLoadError("图谱数据加载失败，请检查部署配置。");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const scene = useMemo(() => (graph ? getSceneForState(graph, state) : null), [graph, state]);
  const chatModel = useMemo(() => (graph && state.answerResult ? buildChatResultModel(graph, state.answerResult) : null), [graph, state.answerResult]);
  const focusNode = useMemo(() => (graph ? findGraphNodeById(graph, scene?.focusNodeId ?? null) : null), [graph, scene?.focusNodeId]);

  function resetGraph(): void {
    setState((current) => ({
      ...current,
      origin: current.answerResult ? "query" : "default",
      selectedNodeId: null,
    }));
  }

  function openGraphFocus(nodeId: string | null): void {
    if (!nodeId) {
      resetGraph();
      return;
    }

    setActiveTab("graph");
    setState((current) => ({
      ...current,
      origin: current.answerResult ? "query" : "node",
      selectedNodeId: nodeId,
    }));
  }

  async function ask(questionText: string): Promise<void> {
    if (!questionText.trim()) return;
    setAsking(true);
    setQuestion(questionText);
    setActiveTab("chat");

    try {
      const response = await askGraphQuestion(questionText.trim());
      setState({
        origin: "query",
        selectedNodeId: null,
        prompt: questionText.trim(),
        answerResult: response.data as AskResponse,
      });
    } finally {
      setAsking(false);
    }
  }

  if (loading) {
    return <main className="kb-shell loading-state">正在加载 Diptyque 商品知识图谱...</main>;
  }

  if (loadError || !graph || !scene) {
    return <main className="kb-shell loading-state error-screen">{loadError || "图谱数据加载失败。"}</main>;
  }

  const footerCount = `${scene.nodes.length} 节点 · ${scene.edges.length} 关系`;

  return (
    <main className="kb-shell">
      <div id="app">
        <nav id="tab-bar">
          <button className={activeTab === "graph" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab("graph")}>
            <span className="tab-icon">◉</span>
            <span className="tab-label">图谱</span>
          </button>
          <button className={activeTab === "chat" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab("chat")}>
            <span className="tab-icon">💬</span>
            <span className="tab-label">问答</span>
          </button>
        </nav>

        <section id="graph-panel" className={activeTab === "graph" ? "panel active" : "panel"}>
          <div className="panel-header">
            <div className="graph-title-row">
              <h1>{scene.title}</h1>
              <span className="graph-mode-label">{scene.modeLabel}</span>
            </div>
            <div className="legend-row">
              {scene.legendItems.map((item) => (
                <span key={item.label} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="graph-wrap">
            <GraphView
              nodes={scene.nodes}
              edges={scene.edges}
              selectedNodeId={scene.focusNodeId}
              layoutMode={scene.layout}
              onSelectNode={openGraphFocus}
            />
          </div>

          <div className="panel-footer">
            <span>{footerCount}</span>
            <button className="muji-btn outline" onClick={resetGraph}>重置</button>
          </div>
        </section>

        <section id="chat-panel" className={activeTab === "chat" ? "panel active chat-panel" : "panel chat-panel"}>
          <RetrievalResultView
            question={question}
            loading={asking}
            result={state.answerResult}
            chatModel={chatModel}
            onAskSuggestion={(nextQuestion) => {
              setQuestion(nextQuestion);
              void ask(nextQuestion);
            }}
            onJumpToGraph={(nodeId) => {
              setActiveTab("graph");
              openGraphFocus(nodeId);
            }}
          />
          <QueryTab question={question} loading={asking} onQuestionChange={setQuestion} onSubmit={ask} />
        </section>
      </div>
    </main>
  );
}
