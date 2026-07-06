import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

import type { GraphEdge, GraphLayoutMode, GraphNode } from "../lib/contracts.js";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  layoutMode?: GraphLayoutMode;
  onSelectNode: (nodeId: string | null) => void;
};

function getLayout(layoutMode: GraphLayoutMode): cytoscape.LayoutOptions {
  if (layoutMode === "radial") {
    return {
      name: "concentric",
      animate: false,
      fit: true,
      minNodeSpacing: 26,
      padding: 26,
      concentric: (node) => Number(node.data("rank") ?? 1),
      levelWidth: () => 1,
    };
  }

  return {
    name: "cose",
    animate: false,
    fit: true,
    padding: 24,
    nodeRepulsion: 8800,
    idealEdgeLength: 110,
  };
}

export function GraphView({ nodes, edges, selectedNodeId, layoutMode = "organic", onSelectNode }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            type: node.type,
            color: node.ui?.color,
            size: node.ui?.size,
            opacity: node.ui?.opacity,
            shape: node.ui?.shape,
            rank: node.ui?.rank,
            emphasis: node.ui?.emphasis,
          },
        })),
        ...edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            relation: edge.relation,
            label: edge.label,
            color: edge.ui?.color,
            width: edge.ui?.width,
            lineStyle: edge.ui?.lineStyle,
            arrowShape: edge.ui?.arrowShape,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            width: "data(size)",
            height: "data(size)",
            shape: "data(shape)",
            color: "#1d140f",
            "font-size": 11,
            "font-weight": 600,
            "text-wrap": "wrap",
            "text-max-width": 104,
            "background-color": "data(color)",
            opacity: "data(opacity)",
            "text-valign": "bottom",
            "text-margin-y": 7,
            "border-width": 1.5,
            "border-color": "#f8f2ea",
          },
        },
        {
          selector: 'node[type = "Theme"]',
          style: {
            color: "#f8f2ea",
            "text-outline-width": 0,
            "font-size": 13,
            "text-max-width": 132,
          },
        },
        {
          selector: 'node[emphasis = "hero"]',
          style: {
            "border-width": 2.5,
            "border-color": "#ead8c1",
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(width)",
            "line-color": "data(color)",
            "target-arrow-color": "data(color)",
            "target-arrow-shape": "data(arrowShape)",
            "curve-style": "bezier",
            "line-style": "data(lineStyle)",
            opacity: 0.9,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#d8a36b",
            "overlay-opacity": 0,
          },
        },
        {
          selector: ".faded",
          style: {
            opacity: 0.18,
          },
        },
      ],
      layout: getLayout(layoutMode),
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
  }, [nodes, edges, layoutMode, onSelectNode]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass("faded");
    if (!selectedNodeId) {
      cy.$(":selected").unselect();
      cy.fit(undefined, 30);
      return;
    }

    const selected = cy.getElementById(selectedNodeId);
    if (selected.nonempty()) {
      cy.nodes().difference(selected.closedNeighborhood()).addClass("faded");
      selected.select();
      cy.animate({ fit: { eles: selected.closedNeighborhood(), padding: 42 }, duration: 260 });
    }
  }, [selectedNodeId]);

  return <div className="graph-canvas" ref={containerRef} />;
}
