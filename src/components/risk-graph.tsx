"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import {
  NODE_TYPE_LABELS,
  edgeKindLabel,
  neighborsOf,
  type GraphNode,
  type GraphNodeType,
  type RiskGraph,
} from "@/lib/graph/build";
import { cn } from "@/lib/utils";

const NODE_W = 176;
const NODE_H = 56;
const LAYER_X = 230;
const NODE_Y = 76;
const PAD_X = 48;
const PAD_Y = 36;

const TYPE_COLOR: Record<GraphNodeType, string> = {
  company: "var(--accent)",
  application: "var(--low)",
  repository: "#c4b5fd",
  vendor: "var(--high)",
  ai: "#a78bfa",
  external: "#38bdf8",
  regulation: "var(--medium)",
  claim: "#fbbf24",
  person: "#fb7185",
  document: "#34d399",
  risk: "var(--critical)",
};

const LAYERS: GraphNodeType[][] = [
  ["company"],
  ["claim"],
  ["application"],
  ["repository"],
  ["vendor", "ai", "regulation", "external", "person", "document"],
  ["risk"],
];

function layout(graph: RiskGraph) {
  const columns = LAYERS.map((types) =>
    types.flatMap((type) => graph.nodes.filter((node) => node.type === type)),
  );
  const maxHeight = Math.max(...columns.map((column) => column.length * NODE_Y), NODE_Y);
  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((column, col) => {
    const offset = (maxHeight - column.length * NODE_Y) / 2;
    column.forEach((node, row) => {
      positions.set(node.id, {
        x: PAD_X + col * LAYER_X,
        y: PAD_Y + row * NODE_Y + Math.max(0, offset),
      });
    });
  });
  return {
    positions,
    width: PAD_X * 2 + (LAYERS.length - 1) * LAYER_X + NODE_W,
    height: PAD_Y * 2 + maxHeight,
  };
}

function truncate(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function RiskGraphView({
  graph,
  className,
}: {
  graph: RiskGraph;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    graph.paths[0]?.nodes[0] ?? graph.nodes[0]?.id ?? null,
  );
  const [pathId, setPathId] = useState<string | null>(graph.paths[0]?.id ?? null);

  const { positions, width, height } = useMemo(() => layout(graph), [graph]);
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const path = graph.paths.find((item) => item.id === pathId) ?? null;
  const pathSet = new Set(path?.nodes ?? []);

  function selectNode(id: string) {
    setSelectedId(id);
    const matching = graph.paths.find((item) => item.nodes.includes(id));
    if (matching) setPathId(matching.id);
  }

  return (
    <div className={cn("grid gap-6 xl:grid-cols-[1fr_320px]", className)}>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="min-w-full"
          role="img"
          aria-label="Company risk graph"
        >
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3d4d66" />
            </marker>
            <marker
              id="graph-arrow-hot"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3ee0c5" />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const cx = (x1 + x2) / 2;
            const hot =
              pathSet.has(edge.from) && pathSet.has(edge.to);
            return (
              <path
                key={`${edge.from}-${edge.to}-${edge.kind}`}
                d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={hot ? "var(--accent)" : "#2a3a52"}
                strokeWidth={hot ? 2.4 : 1.2}
                markerEnd={hot ? "url(#graph-arrow-hot)" : "url(#graph-arrow)"}
                opacity={path && !hot ? 0.28 : 1}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const active = selectedId === node.id;
            const inPath = pathSet.has(node.id);
            const dim = Boolean(path) && !inPath && !active;
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => selectNode(node.id)}
                className="cursor-pointer"
                opacity={dim ? 0.35 : 1}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={active ? "#18202e" : "#121826"}
                  stroke={active || inPath ? "var(--accent)" : "var(--border)"}
                  strokeWidth={active ? 2 : 1}
                />
                <rect
                  width={6}
                  height={NODE_H}
                  rx={3}
                  fill={TYPE_COLOR[node.type]}
                />
                <text
                  x={16}
                  y={22}
                  fill="var(--ink)"
                  fontSize={12}
                  fontFamily="var(--font-ui), ui-sans-serif, sans-serif"
                >
                  {truncate(node.label, 24)}
                </text>
                <text
                  x={16}
                  y={40}
                  fill="var(--muted)"
                  fontSize={10}
                  fontFamily="var(--font-ui), ui-sans-serif, sans-serif"
                >
                  {NODE_TYPE_LABELS[node.type]}
                  {node.risk ? ` · ${node.risk}` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="space-y-4">
        {graph.paths.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-xl">Correlated paths</h2>
            <ul className="mt-3 space-y-2">
              {graph.paths.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPathId(item.id);
                      setSelectedId(item.nodes[0] ?? null);
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left",
                      pathId === item.id
                        ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                        : "border-[var(--border)] bg-[var(--elevated)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[var(--ink)]">{item.title}</p>
                      <SeverityBadge severity={item.severity} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {selected ? (
          <NodeInspector graph={graph} node={selected} neighbors={neighborsOf(graph, selected.id)} />
        ) : (
          <p className="text-sm text-[var(--muted)]">Select a node to inspect it.</p>
        )}
      </aside>
    </div>
  );
}

function NodeInspector({
  graph,
  node,
  neighbors,
}: {
  graph: RiskGraph;
  node: GraphNode;
  neighbors: GraphNode[];
}) {
  const relatedEdges = graph.edges.filter(
    (edge) => edge.from === node.id || edge.to === node.id,
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">{node.label}</h2>
        <Badge variant="muted">{NODE_TYPE_LABELS[node.type]}</Badge>
        {node.risk ? <SeverityBadge severity={node.risk} /> : null}
      </div>
      {node.evidence && (
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{node.evidence}</p>
      )}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Importance</dt>
          <dd className="capitalize">{node.importance}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Owner</dt>
          <dd>{node.owner ?? "Unassigned"}</dd>
        </div>
      </dl>
      {node.href && (
        <Link
          href={node.href}
          className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Open record
        </Link>
      )}
      <h3 className="mt-5 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Connected
      </h3>
      <ul className="mt-2 space-y-2">
        {relatedEdges.map((edge) => {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          const other = neighbors.find((item) => item.id === otherId);
          if (!other) return null;
          return (
            <li
              key={`${edge.from}-${edge.to}-${edge.kind}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm"
            >
              <p className="text-[var(--ink)]">{other.label}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {edgeKindLabel(edge.kind)} · {NODE_TYPE_LABELS[other.type]}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
