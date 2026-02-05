"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/state/graphStore";
import { CHARACTER_MAP } from "@/lib/conversation-graph/types";

const LANE_WIDTH = 120;
const LANE_OFFSET_X = 80;

/**
 * Renders Git-style vertical branch lanes behind the graph.
 * Each lane has a soft colored glow based on character usage in that lane.
 */
export default function BranchLane() {
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {Array.from({ length: laneCount }).map((_, i) => {
        const color = colors[i % colors.length] ?? "#60a5fa";
        const x = LANE_OFFSET_X + i * LANE_WIDTH - LANE_WIDTH / 2;
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-[120px] -translate-x-1/2"
            style={{
              left: x,
              background: `linear-gradient(180deg, transparent 0%, ${color}08 20%, ${color}12 50%, ${color}08 80%, transparent 100%)`,
              boxShadow: `inset 0 0 60px ${color}15`,
            }}
          />
        );
      })}
      {/* Vertical spine line (center of first lane) */}
      <div
        className="absolute top-0 bottom-0 w-px -translate-x-1/2 opacity-30"
        style={{ left: LANE_OFFSET_X, background: "linear-gradient(180deg, transparent, var(--neural-primary), transparent)" }}
      />
    </div>
  );
}
