"use client";

import * as d3 from "d3";
import { HTMLAttributes, useEffect, useMemo, useRef, useState } from "react";

import { Slider } from "./ui/slider";
import { useDebounce } from "@uidotdev/usehooks";

// Vibe coded by GPT-4.1 starting from:
// https://observablehq.com/@d3/force-directed-graph/2
type ForceGraphProps = HTMLAttributes<HTMLDivElement> & {
  nodes: GeneNode[];
  links: GeneEdge[];
  defaultThreshold?: number;
  onTresholdSet: (threshold: number) => void;
};

export const StaticForceGraph = ({
  nodes,
  links,
  ...props
}: ForceGraphProps) => {
  const { nodes: staticNodes, links: staticLinks } = useMemo(
    () => ({ nodes, links }),
    [],
  );
  return <ForceGraph nodes={staticNodes} links={staticLinks} {...props} />;
};

export function ForceGraph({
  nodes,
  links,
  defaultThreshold = 0.5,
  onTresholdSet,
  ...props
}: ForceGraphProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const debouncedThreshold = useDebounce(threshold, 200);

  useEffect(() => {
    setThreshold(defaultThreshold);
  }, [defaultThreshold]);

  // Filter links based on debounced threshold
  const filteredLinks = useMemo(
    () => links.filter((l) => Math.abs(l.value) >= debouncedThreshold),
    [links, debouncedThreshold],
  );

  // Filter nodes to only those that are connected by filteredLinks
  const filteredNodeIds = useMemo(() => {
    const nodeSet = new Set<string>();
    filteredLinks.forEach((l) => {
      if (typeof l.source === "string") nodeSet.add(l.source);
      else if (l.source && typeof l.source === "object" && "id" in l.source)
        nodeSet.add(l.source.id);
      if (typeof l.target === "string") nodeSet.add(l.target);
      else if (l.target && typeof l.target === "object" && "id" in l.target)
        nodeSet.add(l.target.id);
    });
    return nodeSet;
  }, [filteredLinks]);

  const filteredNodes = useMemo(
    () => nodes.filter((n) => filteredNodeIds.has(n.id)),
    [nodes, filteredNodeIds],
  );

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    // Get the actual size of the container
    const container = ref.current;
    const width = container.offsetWidth || 928;
    const height = container.offsetHeight || 600;

    // Specify the color scale.
    const color = d3.scaleOrdinal<number, string>(d3.schemeCategory10);

    // The force simulation mutates links and nodes, so create a copy
    // so that re-evaluating this cell produces the same result.
    const simLinks: GeneEdge[] = filteredLinks.map((d) => ({ ...d }));
    const simNodes: GeneNode[] = filteredNodes.map((d) => ({ ...d }));

    // Create a simulation with several forces.
    const simulation = d3
      .forceSimulation<GeneNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<GeneNode, GeneEdge>(simLinks)
          .id((d) => d.id)
          .distance((d) => 120 - Math.abs(d.value) * 80), // Increase base distance
      )
      .force("charge", d3.forceManyBody<GeneNode>().strength(-200)) // Increase repulsion
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", ticked);

    // Create the SVG container with zoom support.
    const svg = d3
      .create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "width: 100%; height: 100%; display: block;");
    svgRef.current = svg.node();

    // Add a group for all graph elements to apply zoom/pan transforms
    const g = svg.append("g");
    gRef.current = g.node();

    // Add a line for each link, and a circle for each node.
    const maxCorrelation = Math.max(...simLinks.map((d) => Math.abs(d.value)));

    const link = g
      .append("g")
      .attr("stroke-opacity", 1)
      .selectAll<SVGLineElement, GeneEdge>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke-width", (d) => (Math.abs(d.value) / maxCorrelation) * 5)
      .attr("stroke", (d) => (d.value > 0 ? "#1976d2" : "#d32f2f"));

    // Compute node degree (number of neighbors)
    const nodeDegree: Record<string, number> = {};
    simNodes.forEach((n) => (nodeDegree[n.id] = 0));
    simLinks.forEach((l) => {
      if (typeof l.source === "string") nodeDegree[l.source]++;
      else if (typeof l.source === "object" && l.source && "id" in l.source)
        nodeDegree[l.source.id]++;
      if (typeof l.target === "string") nodeDegree[l.target]++;
      else if (typeof l.target === "object" && l.target && "id" in l.target)
        nodeDegree[l.target.id]++;
    });
    // Scale node radius based on degree
    const minR = 5,
      maxR = 20;
    const degrees = Object.values(nodeDegree);
    const minDegree = Math.min(...degrees);
    const maxDegree = Math.max(...degrees);
    const scaleR = d3
      .scaleLinear()
      .domain([minDegree, maxDegree])
      .range([minR, maxR]);

    const node = g
      .append("g")
      .selectAll<SVGCircleElement, GeneNode>("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d) => scaleR(nodeDegree[d.id] || 0))
      .attr("fill", (d) => color(d.group ?? 1));
    // Add gene name labels next to each node
    const labels = g
      .append("g")
      .selectAll<SVGTextElement, GeneNode>("text")
      .data(simNodes)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .attr("dx", 8)
      .attr("dy", 4)
      .attr("fill", "#333");

    node.append("title").text((d) => d.id);

    node.call(
      d3
        .drag<SVGCircleElement, GeneNode>()
        .on("start", function (event) {
          dragstarted(event);
        })
        .on("drag", function (event) {
          dragged(event);
        })
        .on("end", function (event) {
          dragended(event);
        }),
    );

    function ticked() {
      link
        .attr("x1", (d) => (d.source as GeneNode).x!)
        .attr("y1", (d) => (d.source as GeneNode).y!)
        .attr("x2", (d) => (d.target as GeneNode).x!)
        .attr("y2", (d) => (d.target as GeneNode).y!);

      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      labels.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    }

    function dragstarted(
      event: d3.D3DragEvent<SVGCircleElement, GeneNode, unknown>,
    ) {
      const subject = event.subject as GeneNode;
      if (!event.active) simulation.alphaTarget(0.3).restart();
      subject.fx = subject.x;
      subject.fy = subject.y;
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, GeneNode, unknown>,
    ) {
      const subject = event.subject as GeneNode;
      subject.fx = event.x;
      subject.fy = event.y;
    }

    function dragended(
      event: d3.D3DragEvent<SVGCircleElement, GeneNode, unknown>,
    ) {
      const subject = event.subject as GeneNode;
      if (!event.active) simulation.alphaTarget(0);
      subject.fx = null;
      subject.fy = null;
    }

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    zoomRef.current = zoom;
    (svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoom);

    // Mount SVG before cleanup return
    // @ts-expect-error: d3 creates a detached SVG node, which is safe to append
    ref.current.appendChild(svg.node());

    // When this component unmounts, stop the simulation.
    // (No invalidation in React, so just cleanup)
    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredLinks]);

  // Handler to reset zoom/pan
  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div className="stack relative h-full w-full" {...props}>
      <div
        ref={ref}
        className="flex h-full w-full items-center justify-center"
      />
      <div className="z-10 m-4 flex items-center gap-2 place-self-end">
        <label htmlFor="weight-threshold" className="text-xs font-medium">
          Edge weight ≥ {threshold.toFixed(2)}
        </label>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[threshold]}
          onValueChange={(values) => setThreshold(values[0])}
          onPointerUp={() => onTresholdSet(threshold)}
          className="accent-primary w-32 bg-white"
        />
        <button
          onClick={handleReset}
          className="text-tiny cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 font-medium shadow-md transition hover:bg-gray-50"
          type="button"
        >
          Reset Position
        </button>
      </div>
    </div>
  );
}

export function parseGeneMatrix(csv: string) {
  const rows = d3.csvParseRows(csv);
  const genes = rows[0].slice(1);
  const nodes: GeneNode[] = genes.map((id, idx) => ({ id, idx, group: 1 }));
  const edges: GeneEdge[] = [];
  for (let i = 1; i < rows.length; ++i) {
    for (let j = 1; j < rows[i].length; ++j) {
      if (i < j) {
        const value = +rows[i][j];
        if (!isNaN(value) && Math.abs(value) > 0.7) {
          edges.push({
            source: genes[i - 1],
            target: genes[j - 1],
            value,
          });
        }
      }
    }
  }
  return { nodes, edges };
}

export type GeneEdge = d3.SimulationLinkDatum<GeneNode> & {
  value: number;
};

export type GeneNode = d3.SimulationNodeDatum & {
  id: string;
  idx: number;
  group?: number;
};
