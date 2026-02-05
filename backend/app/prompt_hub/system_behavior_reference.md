# Validation crib – Chat system reference

**Flow:** User message → effective query (follow-ups resolved) → intent (greeting, QUESTION, ADD GOAL, etc.) → character selection + RAG or other path → response saved with text, avatar, action_type, actions.

**Response schema (every assistant message):**
- text (or message); avatar/character: Myla, Nuri, Spark, Flo, Luna, Sophi; action_type: None, CTA, Button, List, GOAL_ADDED, etc.; actions: list of strings.
- Validation: expect text, avatar, action_type, actions; CTA → non-empty actions when required.

**Intent labels:** QUESTION, CONFIRM GOAL SELECTION, ADD GOAL, HELP_PICK_GOAL, FUNCTION_CALL: get_user_preferences, FUNCTION_CALL: get_user_profile_data, SUGGEST GOALS, CREATE GOAL, JOURNALING_INTENT, JOURNAL_QUERY, PLAN_UPGRADE_REQUIRED. Greeting/marking-goal return fixed JSON.

**Validation rules:** Effective query resolves "yes"/pronouns. Greeting only for real greetings; "I would like…" / "yes" → QUESTION. SUGGEST GOALS for "suggest me goals" only. Character: direct address → that character; domain keywords → mapped character. RAG: no repeated greetings in conversation; medical → disclaimer; tier → PLAN_UPGRADE_REQUIRED when needed. Goal explanation: text ends with "Want to know more?"; CTA + "Continue in chat". Subscription: FREE/HABITS in-depth ask → PLAN_UPGRADE_REQUIRED; upgrade message actions: ["View Plans"].
