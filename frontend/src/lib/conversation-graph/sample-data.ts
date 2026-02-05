import type { ConversationGraphPayload } from "./types";

/**
 * Sample API dataset for conversation graph visualization.
 * Same structure as expected from API: nodes with avatar, branch_id, parent_id, etc.
 */
export const sampleConversationGraph: ConversationGraphPayload = {
  nodes: [
    { id: "1", avatar: "myla", query_number: 1, branch_id: "main", step_index: 0, response_text: "I'm here to listen and support you. Ask me about wellbeing, goals, or just chat." },
    { id: "2", avatar: "myla", query_number: 2, branch_id: "main", parent_id: "1", step_index: 1, response_text: "Stress is your body's response to demand. We can work on strategies that fit you." },
    { id: "3", avatar: "nuri", query_number: 3, branch_id: "b1", parent_id: "2", step_index: 2, response_text: "Think of stress like a dial. We can explore what turns it up and what turns it down." },
    { id: "4", avatar: "flo", query_number: 4, branch_id: "b2", parent_id: "2", step_index: 2, response_text: "Here are three things you can try today: breathing, a short walk, or gratitude." },
    { id: "5", avatar: "nuri", query_number: 5, branch_id: "b1", parent_id: "3", step_index: 3, response_text: "Deep work often needs boundaries. Let's find a rhythm that sustains you." },
    { id: "6", avatar: "luna", query_number: 6, branch_id: "b1", parent_id: "5", step_index: 4, response_text: "Like the moon has phases, your energy does too. Honor the rest phase." },
    { id: "7", avatar: "flo", query_number: 7, branch_id: "b2", parent_id: "4", step_index: 3, response_text: "Start with one small step. Consistency beats intensity." },
    { id: "8", avatar: "sophi", query_number: 8, branch_id: "b2", parent_id: "7", step_index: 4, response_text: "You're not alone in this. Small wins add up." },
    { id: "9", avatar: "spark", query_number: 9, branch_id: "b3", parent_id: "6", step_index: 5, response_text: "Let's turn that into action. What's the first move?" },
    { id: "10", avatar: "spark", query_number: 10, branch_id: "b3", parent_id: "9", step_index: 6, response_text: "You've got this. Keep the momentum." },
  ],
  edges: [
    { id: "e-1-2", source: "1", target: "2" },
    { id: "e-2-3", source: "2", target: "3" },
    { id: "e-2-4", source: "2", target: "4" },
    { id: "e-3-5", source: "3", target: "5" },
    { id: "e-5-6", source: "5", target: "6" },
    { id: "e-4-7", source: "4", target: "7" },
    { id: "e-7-8", source: "7", target: "8" },
    { id: "e-6-9", source: "6", target: "9" },
    { id: "e-9-10", source: "9", target: "10" },
  ],
};

/** Sample with response text for hover/expand */
export const sampleWithMessages: ConversationGraphPayload = {
  nodes: [
    {
      id: "1",
      avatar: "myla",
      query_number: 1,
      branch_id: "main",
      step_index: 0,
      query_text: "What can you help me with?",
      response_text: "I'm here to listen and support you. You can ask me about wellbeing, goals, or just chat.",
    },
    {
      id: "2",
      avatar: "myla",
      query_number: 2,
      branch_id: "main",
      parent_id: "1",
      step_index: 1,
      query_text: "Tell me about stress.",
      response_text: "Stress is your body's response to demand. A little can be helpful; too much can affect sleep and mood. We can work on strategies that fit you.",
    },
    {
      id: "3",
      avatar: "nuri",
      query_number: 3,
      branch_id: "b1",
      parent_id: "2",
      step_index: 2,
      query_text: "Deep dive on that.",
      response_text: "Think of stress like a dial. We can explore what turns the dial up for you and what turns it down—breathing, routine, boundaries.",
    },
    {
      id: "4",
      avatar: "flo",
      query_number: 4,
      branch_id: "b2",
      parent_id: "2",
      step_index: 2,
      query_text: "I prefer something practical.",
      response_text: "Here are three things you can try today: 5 minutes of breathing, a short walk, or writing down one thing you're grateful for.",
    },
  ],
};
