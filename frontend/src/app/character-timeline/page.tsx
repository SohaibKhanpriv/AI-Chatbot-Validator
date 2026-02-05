"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type Run, type CharacterTimeline } from "@/lib/api";
import { useGraphStore } from "@/state/graphStore";
import { getCharacter } from "@/lib/conversation-graph/types";
import { timelineToGraphPayload } from "@/lib/conversation-graph/timeline-to-graph";
import ConversationGraph from "@/components/conversation-graph/ConversationGraph";

export default function CharacterTimelinePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<CharacterTimeline | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const { setApiGraph, nodes, selectedNodeId, setSelectedNodeId } = useGraphStore();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await api.runs.list();
        if (!cancelled) setRuns(list.filter((r) => r.status === "completed"));
      } finally {
        if (!cancelled) setLoadingRuns(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedRunId == null) {
      setTimeline(null);
      setSelectedNodeId(null);
      return;
    }
    let cancelled = false;
    setLoadingTimeline(true);
    setTimeline(null);
    setSelectedNodeId(null);
    api.reports
      .getCharacterTimeline(selectedRunId)
      .then((data) => {
        if (!cancelled) {
          setTimeline(data);
          const payload = timelineToGraphPayload(data);
          setApiGraph(payload.nodes, payload.edges);
        }
      })
      .catch(() => {
        if (!cancelled) setTimeline(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTimeline(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, setApiGraph, setSelectedNodeId]);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;
  const selectedData = selectedNode?.data;
  const identity = selectedData ? getCharacter(selectedData.avatar) : null;

  const currentIndex = selectedNodeId ? nodes.findIndex((n) => n.id === selectedNodeId) : -1;
  const prevNode = currentIndex > 0 ? nodes[currentIndex - 1] : null;
  const nextNode = currentIndex >= 0 && currentIndex < nodes.length - 1 ? nodes[currentIndex + 1] : null;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Character timeline</h1>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Run
          <select
            value={selectedRunId ?? ""}
            onChange={(e) =>
              setSelectedRunId(e.target.value ? parseInt(e.target.value, 10) : null)
            }
            disabled={loadingRuns}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[var(--neural-primary)] min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[var(--neural-primary)]/50"
          >
            <option value="">Select a run…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.id})
              </option>
            ))}
          </select>
        </label>
        {loadingRuns && <span className="text-sm text-zinc-500">Loading runs…</span>}
        {timeline && (
          <span className="text-sm text-zinc-500">
            {timeline.run_name || `Run ${timeline.run_id}`} · {timeline.items.length} queries
          </span>
        )}
      </div>

      {loadingTimeline && <p className="text-zinc-500">Loading timeline…</p>}

      {!loadingTimeline && selectedRunId != null && timeline && timeline.items.length === 0 && (
        <p className="text-zinc-500">No timeline data for this run.</p>
      )}

      {!loadingTimeline && timeline && timeline.items.length > 0 && (
        <>
          <p className="text-sm text-zinc-500">
            Git-style graph · Hover for preview · Click node to expand message
          </p>
          <div className="h-[calc(100vh-16rem)]">
            <ConversationGraph />
          </div>
        </>
      )}

      <AnimatePresence>
        {selectedNodeId && selectedData && identity && (
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col bg-[var(--card-bg)] border-l border-white/10 shadow-2xl backdrop-blur-xl"
          >
            <div
              className="p-4 border-b border-white/10 flex items-center justify-between gap-2"
              style={{ borderColor: `${identity.color}30` }}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => prevNode && setSelectedNodeId(prevNode.id)}
                  disabled={!prevNode}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Previous node"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => nextNode && setSelectedNodeId(nextNode.id)}
                  disabled={!nextNode}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Next node"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <span className="font-semibold truncate flex-1 text-center" style={{ color: identity.color }}>
                {identity.label} · Query {selectedData.queryNumber}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedData.payload.query_text && (
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                    Query
                  </h3>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                    {selectedData.payload.query_text}
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Response
                </h3>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {selectedData.payload.response_text ??
                    selectedData.payload.message ??
                    "—"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedNodeId && (
        <button
          type="button"
          onClick={() => setSelectedNodeId(null)}
          className="fixed inset-0 z-[45] bg-black/30 backdrop-blur-sm"
          aria-label="Close panel"
        />
      )}
    </div>
  );
}
