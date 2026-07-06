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
      minNodeSpacing: 24,
      padding: 24,
    };
  }

  return {
    name: "cose",
    animate: false,
    fit: true,
    padding: 24,
    nodeRepulsion: 7200,
    idealEdgeLength: 96,
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
            emphasis: node.ui?.emphasis,
          },
        })),
        ...edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            color: edge.ui?.color,
            width: edge.ui?.width,
            lineStyle: edge.ui?.lineStyle,
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
            color: "#3a2c25",
            "font-size": 10,
            "font-weight": 500,
            "text-wrap": "wrap",
            "text-max-width": 132,
            "background-color": "data(color)",
            opacity: "data(opacity)",
            "text-valign": "center",
            "text-halign": "center",
            "text-outline-color": "#f7f3ee",
            "text-outline-width": 3,
            "border-width": 1.5,
            "border-color": "rgba(255,255,255,0.9)",
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(width)",
            label: "data(label)",
            color: "#a99f96",
            "font-size": 8,
            "text-rotation": "autorotate",
            "text-margin-y": -4,
            "line-color": "data(color)",
            "curve-style": "bezier",
            "line-style": "data(lineStyle)",
            opacity: 0.95,
          },
        },
        {
          selector: 'node[emphasis = "hero"]',
          style: {
            "border-width": 3,
            "border-color": "#2f241c",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#f3d36a",
            "overlay-opacity": 0,
          },
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.16,
          },
        },
      ],
      layout: getLayout(layoutMode),
    });

    cy.on("tap", "node", (event) => {
      onSelectNode(event.target.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) onSelectNode(null);
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

    cy.elements().removeClass("dimmed");
    if (!selectedNodeId) {
      cy.$(":selected").unselect();
      cy.fit(undefined, 24);
      return;
    }

    const selected = cy.getElementById(selectedNodeId);
    if (selected.nonempty()) {
      cy.nodes().difference(selected.closedNeighborhood()).addClass("dimmed");
      selected.select();
      cy.animate({ fit: { eles: selected.closedNeighborhood(), padding: 48 }, duration: 240 });
    }
  }, [selectedNodeId]);

  return <div className="graph-stage" ref={containerRef} />;
}
