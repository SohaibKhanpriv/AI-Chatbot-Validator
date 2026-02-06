"use client";

import { useEffect } from "react";
import { useStore } from "reactflow";

/**
 * Reports React Flow viewport transform to parent so the lane overlay
 * (rendered outside ReactFlow with pointer-events: none) can stay in sync.
 */
export default function ViewportSync({
  onTransform,
}: {
  onTransform: (transform: [number, number, number]) => void;
}) {
  const transform = useStore((s) => s.transform);
  useEffect(() => {
    onTransform(transform);
  }, [transform, onTransform]);
  return null;
}
