import type { GraphData } from "../lib/contracts.js";

type Props = {
  graph: GraphData;
};

export function OntologyPanel({ graph }: Props): JSX.Element {
  return (
    <section className="ontology-panel compact-ontology">
      <div className="section-header compact no-margin">
        <div>
          <h2>知识图谱结构</h2>
          <p>
            通过节点类型与关系可视化体现 ontology。当前包含 {graph.ontology.nodeTypes.length} 类节点、
            {graph.ontology.relationTypes.length} 类关系。
          </p>
        </div>
        <div className="graph-stats-inline ontology-inline-stats">
          <span>Product {graph.stats.productCount}</span>
          <span>ScentNote {graph.stats.scentNoteCount}</span>
          <span>Edges {graph.stats.edgeCount}</span>
        </div>
      </div>
    </section>
  );
}