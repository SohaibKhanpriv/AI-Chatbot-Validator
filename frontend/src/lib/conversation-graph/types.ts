/**
 * API-driven conversation graph types.
 * No domain logic — visualization only. avatar = character identity.
 */

export type AvatarId =
  | "myla"
  | "nuri"
  | "flo"
  | "luna"
  | "sophi"
  | "spark";

export interface ConversationNodePayload {
  id: string;
  avatar: AvatarId;
  query_number?: number;
  branch_id?: string;
  parent_id?: string | null;
  message?: string | null;
  response_text?: string | null;
  query_text?: string | null;
  /** Optional timestamp or order for vertical layout */
  step_index?: number;
}

export interface ConversationEdgePayload {
  id: string;
  source: string;
  target: string;
  /** Optional: merge edge style */
  is_merge?: boolean;
}

export interface ConversationGraphPayload {
  nodes: ConversationNodePayload[];
  edges?: ConversationEdgePayload[];
}

/** Character visual identity (color, glow, label) */
export interface CharacterIdentity {
  id: AvatarId;
  label: string;
  color: string;
  colorSoft: string;
  glow: string;
  gradientRing: string;
  /** Tailwind ring/glow class or CSS var */
  ringClass: string;
}

export const CHARACTER_MAP: Record<AvatarId, CharacterIdentity> = {
  myla: {
    id: "myla",
    label: "Myla",
    color: "#60a5fa",
    colorSoft: "rgba(96, 165, 250, 0.35)",
    glow: "0 0 24px rgba(96, 165, 250, 0.5)",
    gradientRing: "linear-gradient(135deg, #60a5fa, #93c5fd)",
    ringClass: "ring-myla",
  },
  nuri: {
    id: "nuri",
    label: "Nuri",
    color: "#a78bfa",
    colorSoft: "rgba(167, 139, 250, 0.35)",
    glow: "0 0 24px rgba(167, 139, 250, 0.5)",
    gradientRing: "linear-gradient(135deg, #a78bfa, #c4b5fd)",
    ringClass: "ring-nuri",
  },
  flo: {
    id: "flo",
    label: "Flo",
    color: "#34d399",
    colorSoft: "rgba(52, 211, 153, 0.35)",
    glow: "0 0 24px rgba(52, 211, 153, 0.5)",
    gradientRing: "linear-gradient(135deg, #34d399, #6ee7b7)",
    ringClass: "ring-flo",
  },
  luna: {
    id: "luna",
    label: "Luna",
    color: "#818cf8",
    colorSoft: "rgba(129, 140, 248, 0.35)",
    glow: "0 0 24px rgba(129, 140, 248, 0.5)",
    gradientRing: "linear-gradient(135deg, #818cf8, #a5b4fc)",
    ringClass: "ring-luna",
  },
  sophi: {
    id: "sophi",
    label: "Sophi",
    color: "#fb7185",
    colorSoft: "rgba(251, 113, 133, 0.35)",
    glow: "0 0 24px rgba(251, 113, 133, 0.5)",
    gradientRing: "linear-gradient(135deg, #fb7185, #fda4af)",
    ringClass: "ring-sophi",
  },
  spark: {
    id: "spark",
    label: "Spark",
    color: "#fb923c",
    colorSoft: "rgba(251, 146, 60, 0.35)",
    glow: "0 0 24px rgba(251, 146, 60, 0.6)",
    gradientRing: "linear-gradient(135deg, #fb923c, #fdba74)",
    ringClass: "ring-spark",
  },
};

export function getCharacter(avatar: string): CharacterIdentity {
  const id = avatar.toLowerCase() as AvatarId;
  return CHARACTER_MAP[id] ?? CHARACTER_MAP.myla;
}
