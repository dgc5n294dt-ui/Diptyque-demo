import type { DimensionDefinition } from "../services/exploration.js";

type Props = {
  dimensions: DimensionDefinition[];
  onOpenDimension: (key: DimensionDefinition["key"]) => void;
};

export function OntologyPanel({ dimensions, onOpenDimension }: Props): JSX.Element {
  return (
    <section className="ontology-panel compact-ontology">
      <div className="section-header compact no-margin">
        <div>
          <h2>知识维度入口</h2>
          <p>先选维度，再进入具体取值与相关商品。默认不展示完整 product graph。</p>
        </div>
      </div>

      <div className="dimension-grid">
        {dimensions.map((dimension) => (
          <button key={dimension.key} className="dimension-card" onClick={() => onOpenDimension(dimension.key)}>
            <strong>{dimension.label}</strong>
            <span>{dimension.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
