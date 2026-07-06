import { useEffect, useMemo, useState } from "react";

import { GraphView } from "./components/GraphView.js";
import { NodeDetailPanel } from "./components/NodeDetailPanel.js";
import { OntologyPanel } from "./components/OntologyPanel.js";
import { QueryTab } from "./components/QueryTab.js";
import { RetrievalResultView } from "./components/RetrievalResultView.js";
import type { AskResponse, DimensionKey, GraphData, ThemeOrigin } from "./lib/contracts.js";
import {
  findDimensionByNodeId,
  findGraphNodeById,
  getDimensionDefinitions,
  getPanelDataForState,
  getSceneForState,
  type ExplorationState,
} from "./services/exploration.js";
import { askGraphQuestion } from "./services/askClient.js";
import { loadProductGraph } from "./services/retrievalClient.js";

const DEFAULT_STATE: ExplorationState = {
  title: "Diptyque 产品知识探索",
  origin: "default",
  activeDimension: null,
  selectedNodeId: null,
  prompt: "",
  answerResult: null,
};

function setNodeFocus(nodeId: string, title: string, preserveAnswerResult: AskResponse | null, activeDimension: DimensionKey | null): ExplorationState {
  return {
    title,
    origin: "node",
    activeDimension,
    selectedNodeId: nodeId,
    prompt: "",
    answerResult: preserveAnswerResult,
  };
}

export default function App(): JSX.Element {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [demoMode, setDemoMode] = useState<"default" | "api" | "static">("default");
  const [state, setState] = useState<ExplorationState>(DEFAULT_STATE);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setLoadError("");
      try {
        const payload = await loadProductGraph();
        setGraph(payload);
      } catch (error) {
        console.error("Failed to load graph data.", error);
        setLoadError("图谱数据加载失败，请检查 product-graph.json 路径或部署配置。");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const dimensions = useMemo(() => getDimensionDefinitions(), []);
  const scene = useMemo(() => (graph ? getSceneForState(graph, state) : null), [graph, state]);
  const panel = useMemo(() => (graph ? getPanelDataForState(graph, state) : null), [graph, state]);
  const selectedNode = useMemo(() => (graph ? findGraphNodeById(graph, state.selectedNodeId) : null), [graph, state.selectedNodeId]);

  function resetToDefault(): void {
    setAskError("");
    setQuestion("");
    setDemoMode("default");
    setState(DEFAULT_STATE);
  }

  function openDimension(key: DimensionKey): void {
    setAskError("");
    setState({
      title: dimensions.find((item) => item.key === key)?.label ?? DEFAULT_STATE.title,
      origin: "dimension",
      activeDimension: key,
      selectedNodeId: null,
      prompt: "",
      answerResult: null,
    });
  }

  function focusGraphNode(nodeId: string, origin: ThemeOrigin, preserveAnswerResult: AskResponse | null, activeDimension: DimensionKey | null): void {
    if (!graph) return;
    const node = findGraphNodeById(graph, nodeId);
    if (!node) return;

    setAskError("");
    setState({
      title: node.label,
      origin,
      activeDimension,
      selectedNodeId: node.id,
      prompt: "",
      answerResult: preserveAnswerResult,
    });
  }

  function handleNodeSelect(nodeId: string | null): void {
    if (!graph) return;
    if (!nodeId) {
      if (state.answerResult) {
        setState((current) => ({
          ...current,
          origin: "query",
          selectedNodeId: null,
          activeDimension: null,
        }));
        return;
      }
      if (state.activeDimension) {
        setState((current) => ({ ...current, origin: "dimension", selectedNodeId: null }));
        return;
      }
      resetToDefault();
      return;
    }

    const dimensionKey = findDimensionByNodeId(nodeId);
    if (dimensionKey) {
      openDimension(dimensionKey);
      return;
    }

    if (state.answerResult) {
      focusGraphNode(nodeId, "node", state.answerResult, state.activeDimension);
      return;
    }

    focusGraphNode(nodeId, "node", null, state.activeDimension);
  }

  async function handleAsk(input: string): Promise<void> {
    if (!input.trim()) return;
    setAsking(true);
    setAskError("");
    setQuestion(input);

    try {
      const response = await askGraphQuestion(input.trim());
      const result = response.data as AskResponse;
      setDemoMode(response.mode);
      setState({
        title: input.trim(),
        origin: "query",
        activeDimension: null,
        selectedNodeId: null,
        prompt: input.trim(),
        answerResult: result,
      });
    } catch (error) {
      setAskError(error instanceof Error ? error.message : String(error));
    } finally {
      setAsking(false);
    }
  }

  function jumpToNode(nodeId: string): void {
    const dimensionKey = findDimensionByNodeId(nodeId);
    if (dimensionKey) {
      openDimension(dimensionKey);
      return;
    }

    if (state.answerResult) {
      focusGraphNode(nodeId, "node", state.answerResult, state.activeDimension);
      return;
    }

    focusGraphNode(nodeId, "node", null, state.activeDimension);
  }

  if (loading) {
    return <main className="app-shell loading-state">正在加载 Diptyque 产品知识图谱...</main>;
  }

  if (loadError || !graph || !scene || !panel) {
    return <main className="app-shell loading-state error-screen">{loadError || "图谱数据加载失败，请检查部署配置。"}</main>;
  }

  const modeLabel = demoMode === "api"
    ? "本地 ask 接口模式"
    : demoMode === "static"
      ? "静态演示模式"
      : "维度入口模式";
  const providerLabel = state.answerResult?.provider ?? "mock";

  return (
    <main className="app-shell explorer-shell">
      <QueryTab
        question={question}
        loading={asking}
        providerLabel={providerLabel}
        modeLabel={modeLabel}
        onQuestionChange={setQuestion}
        onSubmit={handleAsk}
        onResetExplore={resetToDefault}
      />

      <div className="layout-grid single-page-layout">
        <div className="main-column">
          <OntologyPanel dimensions={dimensions} onOpenDimension={openDimension} />

          <section className="graph-workspace single-page-graph-workspace">
            <div className="section-header compact">
              <div>
                <h2>当前关系图</h2>
                <p>
                  {state.answerResult && !state.selectedNodeId
                    ? "围绕当前问题，只展示命中实体、相关商品和关键关系。"
                    : state.selectedNodeId
                      ? "围绕当前主题节点，聚焦局部知识图，不展示完整 product graph。"
                      : state.activeDimension
                        ? "当前展示该维度下的一批真实取值，继续点击可进入局部探索。"
                        : "默认展示知识维度入口图，先理解这个 Demo 可以从哪些维度探索。"}
                </p>
              </div>
              <div className="graph-stats-inline">
                <span>节点 {scene.nodes.length}</span>
                <span>边 {scene.edges.length}</span>
                <span>
                  {state.answerResult && !state.selectedNodeId
                    ? "问题驱动"
                    : state.selectedNodeId
                      ? "节点聚焦"
                      : state.activeDimension
                        ? "维度展开"
                        : "默认入口"}
                </span>
              </div>
            </div>

            <GraphView
              nodes={scene.nodes}
              edges={scene.edges}
              selectedNodeId={scene.focusNodeId}
              layoutMode={scene.layout}
              onSelectNode={handleNodeSelect}
            />
          </section>
        </div>

        <div className="side-column">
          <NodeDetailPanel panel={panel} selectedNode={selectedNode} onJumpToNode={jumpToNode} />
          <RetrievalResultView panel={panel} result={state.answerResult} error={askError} onJumpToNode={jumpToNode} />
        </div>
      </div>
    </main>
  );
}
