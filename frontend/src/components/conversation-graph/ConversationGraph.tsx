"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useGraphStore } from "@/state/graphStore";
import GraphNode from "./GraphNode";
import BranchLane from "./BranchLane";
import ViewportSync from "./ViewportSync";

const nodeTypes = { conversationNode: GraphNode };

export default function ConversationGraph() {
  const { nodes: storeNodes, edges: storeEdges } = useGraphStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const [viewportTransform, setViewportTransform] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    setNodes(storeNodes);
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const handleTransform = useCallback((transform: [number, number, number]) => {
    setViewportTransform(transform);
  }, []);

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden bg-[var(--background)]/80 border border-white/10 relative">
      {viewportTransform && (
        <div className="absolute inset-0 pointer-events-none z-0 rounded-xl overflow-hidden">
          <BranchLane transform={viewportTransform} />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { strokeWidth: 2, stroke: "rgba(255,255,255,0.25)" },
        }}
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0.5, 0.5]}
        className="conversation-graph"
      >
        <ViewportSync onTransform={handleTransform} />
        <Background color="rgba(0,229,255,0.06)" gap={24} size={1} />
        <Controls className="!bg-[var(--card-bg)] !border-white/10 !shadow-xl" />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { avatar?: string };
            const colors: Record<string, string> = {
              myla: "#60a5fa",
              nuri: "#a78bfa",
              flo: "#34d399",
              luna: "#818cf8",
              sophi: "#fb7185",
              spark: "#fb923c",
            };
            return colors[d?.avatar ?? ""] ?? "#60a5fa";
          }}
          className="!bg-[var(--card-bg)] !border-white/10"
        />
      </ReactFlow>
    </div>
  );
}
