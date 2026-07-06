import { useEffect, useMemo, useState } from "react";

import { GraphView } from "./components/GraphView.js";
import { NodeDetailPanel } from "./components/NodeDetailPanel.js";
import { OntologyPanel } from "./components/OntologyPanel.js";
import { QueryTab } from "./components/QueryTab.js";
import type { GraphData, GraphEdge, GraphNode } from "./lib/contracts.js";

type TabKey = "graph" | "qa";

function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function nodeMatchesQuery(node: GraphNode, query: string): boolean {
  const haystack = [node.label, JSON.stringify(node.data ?? {})].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function getVisibleGraph(
  graph: GraphData,
  selectedNodeId: string | null,
  depth: number,
  activeTypes: Set<string>,
  searchText: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    adjacency.set(edge.source, new Set([...(adjacency.get(edge.source) ?? []), edge.target]));
    adjacency.set(edge.target, new Set([...(adjacency.get(edge.target) ?? []), edge.source]));
  }

  const typeFiltered = graph.nodes.filter((node) => activeTypes.size === 0 || activeTypes.has(node.type));
  const searchFiltered = searchText.trim()
    ? typeFiltered.filter((node) => nodeMatchesQuery(node, searchText.trim()))
    : typeFiltered;

  if (!selectedNodeId) {
    const visibleNodeIds = new Set(searchFiltered.map((node) => node.id));
    const visibleEdges = graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    return { nodes: searchFiltered, edges: visibleEdges };
  }

  const visibleNodeIds = new Set<string>([selectedNodeId]);
  let frontier = new Set<string>([selectedNodeId]);

  for (let hop = 0; hop < depth; hop += 1) {
    const next = new Set<string>();
    frontier.forEach((nodeId) => {
      (adjacency.get(nodeId) ?? new Set()).forEach((neighbor) => {
        visibleNodeIds.add(neighbor);
        next.add(neighbor);
      });
    });
    frontier = next;
  }

  const visibleNodes = Array.from(visibleNodeIds)
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is GraphNode => Boolean(node))
    .filter((node) => activeTypes.size === 0 || activeTypes.has(node.type))
    .filter((node) => !searchText.trim() || nodeMatchesQuery(node, searchText.trim()) || node.id === selectedNodeId);

  const filteredNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graph.edges.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target));
  return { nodes: visibleNodes, edges: visibleEdges };
}

export default function App(): JSX.Element {
  const [tab, setTab] = useState<TabKey>("graph");
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [neighborDepth, setNeighborDepth] = useState(2);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch(publicUrl("product-graph.json"));
        if (!response.ok) {
          throw new Error(`Failed to load product-graph.json: ${response.status}`);
        }
        const payload = (await response.json()) as GraphData;
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

  const nodesById = useMemo(() => new Map((graph?.nodes ?? []).map((node) => [node.id, node])), [graph]);

  const visible = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return getVisibleGraph(graph, selectedNodeId, neighborDepth, activeTypes, searchText);
  }, [graph, selectedNodeId, neighborDepth, activeTypes, searchText]);

  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;
  const relatedEdges = useMemo(() => {
    if (!graph || !selectedNodeId) return [];
    return graph.edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId);
  }, [graph, selectedNodeId]);

  function toggleType(type: string): void {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (loading) {
    return <main className="app-shell loading-state">正在加载 Diptyque 产品知识图谱...</main>;
  }

  if (loadError || !graph) {
    return <main className="app-shell loading-state error-screen">{loadError || "图谱数据加载失败，请检查部署配置。"}</main>;
  }

  return (
    <main className="app-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Diptyque Product Ontology</p>
          <h1>Diptyque 产品知识图谱</h1>
          <p className="hero-copy">通过图谱交互查看商品、香调、品类、规格与价格区间之间的关系。</p>
        </div>
      </header>

      <div className="tab-bar">
        <button className={tab === "graph" ? "active" : ""} onClick={() => setTab("graph")}>图谱</button>
        <button className={tab === "qa" ? "active" : ""} onClick={() => setTab("qa")}>问答</button>
      </div>

      {tab === "graph" ? (
        <div className="layout-grid">
          <div className="main-column">
            <OntologyPanel graph={graph} />
            <section className="graph-workspace">
              <div className="section-header compact">
                <div>
                  <h2>Graph View</h2>
                  <p>保留图谱可视化、搜索、筛选、邻居展开与节点详情。</p>
                </div>
                <div className="graph-stats-inline">
                  <span>可见节点 {visible.nodes.length}</span>
                  <span>可见边 {visible.edges.length}</span>
                </div>
              </div>

              <div className="graph-controls">
                <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索节点、商品名、香调或分类..." />
                <div className="button-row">
                  <button onClick={() => setNeighborDepth(1)}>1 跳</button>
                  <button onClick={() => setNeighborDepth(2)}>2 跳</button>
                  <button className="secondary" onClick={() => { setSelectedNodeId(null); setSearchText(""); setActiveTypes(new Set()); setNeighborDepth(2); }}>重置视图</button>
                </div>
              </div>

              <div className="type-filter-row">
                {graph.ontology.nodeTypes.map((type) => (
                  <button key={type} className={activeTypes.has(type) ? "type-chip active" : "type-chip"} onClick={() => toggleType(type)}>{type}</button>
                ))}
              </div>

              <GraphView nodes={visible.nodes} edges={visible.edges} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </section>
          </div>

          <NodeDetailPanel selectedNode={selectedNode} relatedEdges={relatedEdges} nodesById={nodesById} />
        </div>
      ) : <QueryTab />}
    </main>
  );
}