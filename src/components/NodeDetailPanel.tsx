import type { GraphNode, ThemePanelData } from "../lib/contracts.js";

type Props = {
  panel: ThemePanelData;
  selectedNode: GraphNode | null;
  onJumpToNode: (nodeId: string) => void;
};

function SectionTitle({ title, caption }: { title: string; caption?: string }): JSX.Element {
  return (
    <div className="section-header compact detail-section-header">
      <div>
        <h3>{title}</h3>
        {caption ? <p>{caption}</p> : null}
      </div>
    </div>
  );
}

export function NodeDetailPanel({ panel, selectedNode, onJumpToNode }: Props): JSX.Element {
  return (
    <aside className="detail-panel exploration-detail-panel">
      <section className="detail-card hero-detail-card">
        <p className="eyebrow">{panel.kicker}</p>
        <div className="detail-title-row">
          <div>
            <h2>{panel.title}</h2>
            <p className="muted">{panel.typeLabel}</p>
          </div>
          {selectedNode ? <span className="node-type-pill">{selectedNode.type}</span> : null}
        </div>
        <p className="detail-summary">{panel.summary}</p>
      </section>

      <section className="detail-card">
        <SectionTitle title="答案与导览" caption={panel.guide} />
        <p className="detail-answer">{panel.answer}</p>
      </section>

      <section className="detail-card">
        <SectionTitle title="当前主题" caption="围绕当前主题可继续点击下列相关维度或概念节点。" />
        <div className="link-chip-list">
          {panel.relatedLinks.length === 0 ? <p className="muted">当前没有可展开的相关入口。</p> : null}
          {panel.relatedLinks.map((link) => (
            <button key={link.id} className="jump-chip" onClick={() => onJumpToNode(link.id)}>
              <strong>{link.label}</strong>
              <span>{link.caption ?? link.type}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
