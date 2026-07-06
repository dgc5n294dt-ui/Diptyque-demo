import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

import type { GraphEdge, GraphNode } from "../lib/contracts.js";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
};

function getNodeColor(type: string): string {
  switch (type) {
    case "Product": return "#111111";
    case "ScentNote": return "#7a5d3d";
    case "Category": return "#3c4a57";
    case "Subcategory": return "#6d7b8a";
    case "ProductType": return "#a16c3a";
    case "PriceRange": return "#5e6d5b";
    case "CollectionOrSeries": return "#8c7f72";
    case "Brand": return "#000000";
    default: return "#909090";
  }
}

export function GraphView({ nodes, edges, selectedNodeId, onSelectNode }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((node) => ({ data: { id: node.id, label: node.label, type: node.type } })),
        ...edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, relation: edge.relation } })),
      ],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            width: 20,
            height: 20,
            color: "#111111",
            "font-size": 10,
            "text-wrap": "wrap",
            "text-max-width": 80,
            "background-color": (ele) => getNodeColor(ele.data("type")),
            "text-valign": "bottom",
            "text-margin-y": 4,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.3,
            "line-color": "#d0cbc4",
            "target-arrow-color": "#d0cbc4",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.75,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#d1a15b",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 20,
      },
    });

    cy.on("tap", "node", (event) => {
      onSelectNode(event.target.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        onSelectNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, onSelectNode]);

  useEffect(() => {
    if (!cyRef.current) return;
    if (!selectedNodeId) {
      cyRef.current.$(":selected").unselect();
      cyRef.current.fit(undefined, 30);
      return;
    }

    const selected = cyRef.current.getElementById(selectedNodeId);
    if (selected.nonempty()) {
      selected.select();
      cyRef.current.animate({ center: { eles: selected }, duration: 250 });
    }
  }, [selectedNodeId]);

  return <div className="graph-canvas" ref={containerRef} />;
}