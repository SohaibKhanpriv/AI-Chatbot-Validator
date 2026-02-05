"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGraphStore } from "@/state/graphStore";
import { getCharacter } from "@/lib/conversation-graph/types";
import { sampleConversationGraph } from "@/lib/conversation-graph/sample-data";
import ConversationGraph from "@/components/conversation-graph/ConversationGraph";

export default function ConversationGraphPage() {
  const { setApiGraph, nodes, selectedNodeId, setSelectedNodeId } = useGraphStore();

  useEffect(() => {
    setApiGraph(
      sampleConversationGraph.nodes,
      sampleConversationGraph.edges
    );
  }, [setApiGraph]);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;
  const selectedData = selectedNode?.data;
  const identity = selectedData ? getCharacter(selectedData.avatar) : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--neural-primary)] to-[var(--neural-accent)] bg-clip-text text-transparent">
          Conversation graph
        </h1>
        <p className="text-sm text-zinc-500">
          Git-style timeline · Hover for preview · Click to expand
        </p>
      </div>

      <div className="h-[calc(100vh-12rem)]">
        <ConversationGraph />
      </div>

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
              className="p-4 border-b border-white/10 flex items-center justify-between"
              style={{ borderColor: `${identity.color}30` }}
            >
              <span className="font-semibold" style={{ color: identity.color }}>
                {identity.label} · Query {selectedData.queryNumber}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
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
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Query</h3>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                    {selectedData.payload.query_text}
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Response</h3>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {selectedData.payload.response_text ?? selectedData.payload.message ?? "—"}
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
