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

function getLayout(layoutMode: GraphLayoutMode, hasFocus: boolean): cytoscape.LayoutOptions {
  if (layoutMode === "radial") {
    return {
      name: "concentric",
      animate: false,
      fit: true,
      minNodeSpacing: 34,
      padding: 40,
      avoidOverlap: true,
      spacingFactor: 1.2,
      concentric: (node) => {
        const emphasis = String(node.data("emphasis") ?? "secondary");
        if (emphasis === "hero") return 3;
        if (emphasis === "primary") return 2;
        return 1;
      },
      levelWidth: () => 1,
    };
  }

  if (hasFocus) {
    return {
      name: "breadthfirst",
      animate: false,
      fit: true,
      directed: false,
      padding: 44,
      spacingFactor: 1.45,
      avoidOverlap: true,
      circle: true,
    };
  }

  return {
    name: "concentric",
    animate: false,
    fit: true,
    minNodeSpacing: 36,
    padding: 44,
    avoidOverlap: true,
    spacingFactor: 1.18,
    concentric: (node) => {
      const emphasis = String(node.data("emphasis") ?? "secondary");
      if (emphasis === "hero") return 3;
      if (emphasis === "primary") return 2;
      return 1;
    },
    levelWidth: () => 1,
  };
}

export function GraphView({ nodes, edges, selectedNodeId, layoutMode = "organic", onSelectNode }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const hasFocus = Boolean(selectedNodeId);

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
            "font-size": 11,
            "font-weight": 500,
            "text-wrap": "wrap",
            "text-max-width": 96,
            "background-color": "data(color)",
            opacity: "data(opacity)",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 8,
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
            label: hasFocus ? "data(label)" : "",
            color: "#a99f96",
            "font-size": 8,
            "text-rotation": "autorotate",
            "text-margin-y": -4,
            "line-color": "data(color)",
            "curve-style": "bezier",
            "line-style": "data(lineStyle)",
            opacity: 0.72,
          },
        },
        {
          selector: 'node[emphasis = "hero"]',
          style: {
            "border-width": 3,
            "border-color": "#2f241c",
            "font-size": 12,
            "text-max-width": 112,
          },
        },
        {
          selector: 'node[emphasis = "secondary"]',
          style: {
            "font-size": 10,
            "text-max-width": 84,
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
            opacity: 0.12,
          },
        },
      ],
      layout: getLayout(layoutMode, hasFocus),
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
  }, [nodes, edges, layoutMode, onSelectNode, selectedNodeId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass("dimmed");
    if (!selectedNodeId) {
      cy.$(":selected").unselect();
      cy.fit(undefined, 30);
      return;
    }

    const selected = cy.getElementById(selectedNodeId);
    if (selected.nonempty()) {
      cy.nodes().difference(selected.closedNeighborhood()).addClass("dimmed");
      selected.select();
      cy.animate({ fit: { eles: selected.closedNeighborhood(), padding: 56 }, duration: 240 });
    }
  }, [selectedNodeId]);

  return <div className="graph-stage" ref={containerRef} />;
}
