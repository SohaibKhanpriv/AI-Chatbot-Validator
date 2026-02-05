"use client";

import { memo } from "react";
import { type NodeProps, Handle, Position } from "reactflow";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphNodeData } from "@/state/graphStore";
import { getCharacter } from "@/lib/conversation-graph/types";
import { useGraphStore } from "@/state/graphStore";

const GraphNode = memo(function GraphNode({ id, data, selected }: NodeProps<GraphNodeData>) {
  const identity = getCharacter(data.avatar);
  const { payload, queryNumber } = data;
  const text = payload.response_text ?? payload.message ?? "";
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const setHoveredNodeId = useGraphStore((s) => s.setHoveredNodeId);
  const hoveredNodeId = useGraphStore((s) => s.hoveredNodeId);
  const isHovered = hoveredNodeId === id;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2 !bg-transparent" style={{ borderColor: identity.color }} />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative"
        onMouseEnter={() => setHoveredNodeId(id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={() => setSelectedNodeId(id)}
      >
        <div
          className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
          style={{
            boxShadow: selected
              ? `${identity.glow}, 0 0 0 2px ${identity.color}`
              : identity.glow,
            background: `radial-gradient(circle at 30% 30%, ${identity.colorSoft}, rgba(26,26,46,0.6))`,
            border: `2px solid ${identity.color}`,
          }}
          title={identity.label}
        >
          {/* Gradient ring */}
          <div
            className="absolute inset-0 rounded-full opacity-70"
            style={{
              background: identity.gradientRing,
              mask: "radial-gradient(circle 60% at 50% 50%, black, transparent)",
              WebkitMask: "radial-gradient(circle 60% at 50% 50%, black, transparent)",
            }}
          />
          {/* Avatar initial / badge */}
          <span
            className="relative z-10 text-sm font-bold uppercase text-white drop-shadow-md"
            style={{ color: identity.color, textShadow: `0 0 8px ${identity.color}` }}
          >
            {identity.label.slice(0, 1)}
          </span>
          {/* Query number badge */}
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-black/60 border border-white/20"
            style={{ color: identity.color }}
          >
            {queryNumber}
          </span>
        </div>
        {/* Pulse when selected */}
        {selected && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `2px solid ${identity.color}` }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
        {/* Hover tooltip */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-[1000] min-w-[200px] max-w-[320px] p-3 rounded-xl bg-[var(--card-bg)] border border-white/20 shadow-xl backdrop-blur-xl"
              style={{ borderColor: `${identity.color}40` }}
            >
              <p className="text-xs font-medium mb-1.5 truncate" style={{ color: identity.color }}>
                {identity.label} · Query {queryNumber}
              </p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-3">
                {text || "—"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2 !bg-transparent" style={{ borderColor: identity.color }} />
    </>
  );
});

export default GraphNode;
