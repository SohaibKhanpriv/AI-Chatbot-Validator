"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/state/graphStore";
import { CHARACTER_MAP } from "@/lib/conversation-graph/types";

const LANE_WIDTH = 120;
const LANE_OFFSET_X = 80;

/**
 * Flow-to-screen: screenX = flowX * scale + tx
 * Transform is [tx, ty, scale].
 */
function flowToScreen(flowX: number, transform: [number, number, number]): number {
  const [tx, , scale] = transform;
  return flowX * scale + tx;
}

function flowWidthToScreen(flowW: number, transform: [number, number, number]): number {
  const [, , scale] = transform;
  return flowW * scale;
}

export type BranchLaneProps = {
  transform: [number, number, number];
};

/**
 * Renders Git-style vertical branch lanes in screen space. Receives viewport
 * transform from parent (synced from React Flow). Rendered outside ReactFlow
 * with pointer-events: none so it does not block pan/zoom/drag.
 */
export default function BranchLane({ transform }: BranchLaneProps) {
  const { branchLaneMap, characterLaneMap } = useGraphStore();

  const laneCount = useMemo(() => {
    const ids = Object.values(branchLaneMap);
    return ids.length ? Math.max(...ids) + 1 : 4;
  }, [branchLaneMap]);

  const colors = useMemo(() => {
    const avatars = Object.keys(characterLaneMap).sort(
      (a, b) => (characterLaneMap[a] ?? 0) - (characterLaneMap[b] ?? 0)
    );
    return avatars.map((a) => {
      const id = a as keyof typeof CHARACTER_MAP;
      return CHARACTER_MAP[id]?.color ?? CHARACTER_MAP.myla.color;
    });
  }, [characterLaneMap]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      {Array.from({ length: laneCount }).map((_, i) => {
        const color = colors[i % colors.length] ?? "#60a5fa";
        const flowCenterX = LANE_OFFSET_X + i * LANE_WIDTH;
        const screenCenterX = flowToScreen(flowCenterX, transform);
        const screenWidth = flowWidthToScreen(LANE_WIDTH, transform);
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0 -translate-x-1/2"
            style={{
              left: screenCenterX,
              width: Math.max(1, screenWidth),
              background: `linear-gradient(180deg, transparent 0%, ${color}20 15%, ${color}35 50%, ${color}20 85%, transparent 100%)`,
              boxShadow: `inset 0 0 80px ${color}28`,
            }}
          />
        );
      })}
      <div
        className="absolute top-0 bottom-0 w-px -translate-x-1/2 opacity-30"
        style={{
          left: flowToScreen(LANE_OFFSET_X, transform),
          background: "linear-gradient(180deg, transparent, var(--neural-primary), transparent)",
        }}
      />
    </div>
  );
}
