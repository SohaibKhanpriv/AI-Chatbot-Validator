import { create } from "zustand";
import type { Node, Edge } from "reactflow";
import type { ConversationNodePayload, ConversationEdgePayload, AvatarId } from "@/lib/conversation-graph/types";

export interface GraphNodeData {
  payload: ConversationNodePayload;
  avatar: AvatarId;
  queryNumber: number;
  branchId: string;
  laneIndex: number;
  stepIndex: number;
}

export interface GraphState {
  /** Raw API nodes */
  apiNodes: ConversationNodePayload[];
  /** Raw API edges (optional; can be derived from parent_id) */
  apiEdges: ConversationEdgePayload[];
  /** ReactFlow nodes (positioned) */
  nodes: Node<GraphNodeData>[];
  /** ReactFlow edges */
  edges: Edge[];
  /** Lane index per branch_id for consistent X positioning */
  branchLaneMap: Record<string, number>;
  /** Character color mapping: avatar -> lane index for color consistency */
  characterLaneMap: Record<string, number>;
  /** Selected node id (for expand panel) */
  selectedNodeId: string | null;
  /** Hovered node id (for tooltip) */
  hoveredNodeId: string | null;
  setApiGraph: (nodes: ConversationNodePayload[], edges?: ConversationEdgePayload[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  /** Reset selection */
  clearSelection: () => void;
}

function deriveEdges(nodes: ConversationNodePayload[]): ConversationEdgePayload[] {
  const edges: ConversationEdgePayload[] = [];
  nodes.forEach((n) => {
    if (n.parent_id) {
      edges.push({
        id: `e-${n.parent_id}-${n.id}`,
        source: n.parent_id,
        target: n.id,
        is_merge: false,
      });
    }
  });
  return edges;
}

/** Assign lane index by branch_id (order of first appearance) */
function buildBranchLaneMap(nodes: ConversationNodePayload[]): Record<string, number> {
  const map: Record<string, number> = {};
  let nextLane = 0;
  const sorted = [...nodes].sort(
    (a, b) => (a.step_index ?? a.query_number ?? 0) - (b.step_index ?? b.query_number ?? 0)
  );
  sorted.forEach((n) => {
    const bid = n.branch_id ?? n.id;
    if (map[bid] === undefined) map[bid] = nextLane++;
  });
  return map;
}

/** Assign consistent color lane by avatar (order of first appearance) */
function buildCharacterLaneMap(nodes: ConversationNodePayload[]): Record<string, number> {
  const map: Record<string, number> = {};
  let next = 0;
  const seen = new Set<string>();
  nodes.forEach((n) => {
    const a = String(n.avatar).toLowerCase();
    if (!seen.has(a)) {
      seen.add(a);
      map[a] = next++;
    }
  });
  return map;
}

const NODE_WIDTH = 52;
const NODE_HEIGHT = 52;
const LANE_GAP = 120;
const ROW_GAP = 80;

/** Convert API payload into positioned ReactFlow nodes and edges */
function layoutGraph(
  apiNodes: ConversationNodePayload[],
  apiEdges: ConversationEdgePayload[] | undefined
): { nodes: Node<GraphNodeData>[]; edges: Edge[]; branchLaneMap: Record<string, number>; characterLaneMap: Record<string, number> } {
  const branchLaneMap = buildBranchLaneMap(apiNodes);
  const characterLaneMap = buildCharacterLaneMap(apiNodes);
  const edgesProvided = apiEdges && apiEdges.length > 0;
  const rawEdges = edgesProvided ? apiEdges! : deriveEdges(apiNodes);

  const sortedNodes = [...apiNodes].sort(
    (a, b) =>
      (a.step_index ?? a.query_number ?? 0) - (b.step_index ?? b.query_number ?? 0)
  );

  const nodes: Node<GraphNodeData>[] = sortedNodes.map((n, i) => {
    const branchId = n.branch_id ?? n.id;
    const laneIndex = branchLaneMap[branchId] ?? 0;
    const stepIndex = n.step_index ?? n.query_number ?? i;
    const x = 80 + laneIndex * LANE_GAP;
    const y = 60 + stepIndex * ROW_GAP;
    return {
      id: n.id,
      type: "conversationNode",
      position: { x, y },
      data: {
        payload: n,
        avatar: (n.avatar as AvatarId) ?? "myla",
        queryNumber: n.query_number ?? stepIndex,
        branchId,
        laneIndex,
        stepIndex,
      },
    };
  });

  const edges: Edge[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: true,
    style: { strokeWidth: 2 },
    data: { isMerge: e.is_merge },
  }));

  return { nodes, edges, branchLaneMap, characterLaneMap };
}

export const useGraphStore = create<GraphState>((set) => ({
  apiNodes: [],
  apiEdges: [],
  nodes: [],
  edges: [],
  branchLaneMap: {},
  characterLaneMap: {},
  selectedNodeId: null,
  hoveredNodeId: null,

  setApiGraph: (apiNodes, apiEdges = []) => {
    const { nodes, edges, branchLaneMap, characterLaneMap } = layoutGraph(
      apiNodes,
      apiEdges.length > 0 ? apiEdges : undefined
    );
    set({
      apiNodes,
      apiEdges,
      nodes,
      edges,
      branchLaneMap,
      characterLaneMap,
      selectedNodeId: null,
      hoveredNodeId: null,
    });
  },

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),
  clearSelection: () => set({ selectedNodeId: null }),
}));
