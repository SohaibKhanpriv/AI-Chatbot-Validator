import type { CharacterTimeline } from "@/lib/api";
import type { ConversationGraphPayload, AvatarId } from "./types";
import { CHARACTER_MAP } from "./types";

const AVATAR_IDS = new Set<string>(Object.keys(CHARACTER_MAP));

function toAvatarId(avatar: string | undefined): AvatarId {
  if (!avatar || typeof avatar !== "string") return "myla";
  const id = avatar.toLowerCase().trim();
  return (AVATAR_IDS.has(id) ? id : "myla") as AvatarId;
}

/**
 * Convert character-timeline API response (run) into conversation graph payload.
 * One node per query; avatar from chunks (last chunk or first); edges chain 1→2→3…
 */
export function timelineToGraphPayload(timeline: CharacterTimeline): ConversationGraphPayload {
  const nodes = timeline.items.map((item, i) => {
    const avatar =
      item.chunks?.length > 0
        ? item.chunks[item.chunks.length - 1].avatar
        : item.chunks?.[0]?.avatar;
    const avatarId = toAvatarId(avatar);
    const id = String(item.message_response_id);
    const prevId = i > 0 ? String(timeline.items[i - 1].message_response_id) : null;
    return {
      id,
      avatar: avatarId,
      query_number: item.query_index,
      step_index: i,
      branch_id: avatarId,
      parent_id: prevId,
      query_text: item.query_text ?? null,
      response_text: item.response_text ?? null,
    };
  });

  const edges = timeline.items.slice(1).map((item, i) => ({
    id: `e-${timeline.items[i].message_response_id}-${item.message_response_id}`,
    source: String(timeline.items[i].message_response_id),
    target: String(item.message_response_id),
    is_merge: false,
  }));

  return { nodes, edges };
}
