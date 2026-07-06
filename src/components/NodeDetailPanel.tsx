import type { GraphEdge, GraphNode } from "../lib/contracts.js";

type Props = {
  selectedNode: GraphNode | null;
  relatedEdges: GraphEdge[];
  nodesById: Map<string, GraphNode>;
};

function relationPath(edge: GraphEdge, nodesById: Map<string, GraphNode>): string {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return `${edge.source} -> ${edge.relation} -> ${edge.target}`;
  return `${source.label} -> ${edge.relation} -> ${target.label}`;
}

export function NodeDetailPanel({ selectedNode, relatedEdges, nodesById }: Props): JSX.Element {
  if (!selectedNode) {
    return (
      <aside className="detail-panel empty-state">
        <h3>节点详情</h3>
        <p>点击图谱中的节点后，这里会显示商品、香调、分类及其证据路径。</p>
      </aside>
    );
  }

  const data = selectedNode.data ?? {};
  const detailEntries = Object.entries(data)
    .filter(([, value]) => typeof value === "string" && String(value).trim().length > 0)
    .slice(0, 12);

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <span className="node-type-pill">{selectedNode.type}</span>
        <h3>{selectedNode.label}</h3>
      </div>

      <div className="detail-body">
        {detailEntries.length > 0 && (
          <div className="detail-card">
            <h4>节点字段</h4>
            <dl className="detail-list">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="detail-list-row">
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="detail-card">
          <h4>相关路径</h4>
          <ul className="path-list">
            {relatedEdges.length === 0 ? <li>当前节点没有可展示的边。</li> : null}
            {relatedEdges.slice(0, 18).map((edge) => (
              <li key={edge.id}>{relationPath(edge, nodesById)}</li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}