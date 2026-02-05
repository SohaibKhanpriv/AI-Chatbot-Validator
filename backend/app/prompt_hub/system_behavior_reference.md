# Chat System & Prompts – Reference for Testing/Validation

## 1. Chat system overview

**Entry point:** `neuroworld/apps/neuroworld/interactors/chat.py` → `call(db, request, vector_db, namespace, query, is_audio=False)` (async generator).

**Flow (high level):**
- Save user message; load Chat and last N messages from chat.attrs['history'].
- **Effective query:** If there is recent conversation, QuestionGenerator (using PromptHub.question_generator) rewrites the raw query into effective_query (resolves "yes", pronouns, follow-ups). Otherwise effective_query = query. All downstream logic (greeting, RAG, intents) uses effective_query.
- **Conversation context:** ConversationContextService.build_conversation_context(user_profile, effective_query) builds a text summary used in several prompts.
- **Intent pipelines (order matters):**
  - Subscription intent → handled; return.
  - NeuroCity intent → handled; return.
  - Assessment-in-progress / assessment category / assessment selection → handled; return.
  - Duplicate-goal actions, cancel flows (add_goal, help_pick_goal) → handled; return.
  - Greeting / intent classification (only when action_in_progress is not set): one LLM call decides the branch (greeting vs QUESTION vs ADD GOAL, etc.).
  - If QUESTION: character selection + RAG retrieval + rag_data_answer_generator → streamed reply.
  - If not QUESTION: may trigger Circle, greeting JSON, ADD GOAL, HELP_PICK_GOAL, CREATE GOAL, SUGGEST GOALS, function calls, journaling, etc.; each path returns its own response shape.
- All assistant replies are saved via save_message_to_db(..., assistant_message=..., character=..., action_type=..., actions=..., ...) and yielded as {"chunk": ..., "last_message": True/False}.

**So for validation:** inputs are query (+ history + user/profile); outputs are one or more chunks with text, avatar/character, action_type, actions, and optional extras.

---

## 2. Prompts by component

### 2.1 chat_utils/prompt_hub.py (PromptHub)

| Method / prompt | Purpose | Expected LLM output |
|-----------------|---------|---------------------|
| question_generator | Turn vague/follow-up user message into a clear, standalone question | Single string: regenerated or unchanged question. No prefixes (e.g. "Output:"). |
| greeting_prompt | Classify user intent for routing (greeting vs question vs actions) | One of: greeting JSON, or literal labels: QUESTION, CONFIRM GOAL SELECTION, ADD GOAL, HELP_PICK_GOAL, FUNCTION_CALL: get_user_preferences, FUNCTION_CALL: get_user_profile_data, SUGGEST GOALS, CREATE GOAL, JOURNALING_INTENT, JOURNAL_QUERY, PLAN_UPGRADE_REQUIRED, or the fixed marking-goal JSON. Rules: affirmative continuations (e.g. "I would like...") → QUESTION; standalone goal suggestion requests → SUGGEST GOALS; journal-related → JOURNAL_QUERY / JOURNALING_INTENT. |
| character_selecter | Choose which character answers (Myla, Nuri, Spark, Flo, Luna, Sophi) | Single character name. Direct address → that character; "who are you" → last character; domain keywords → mapped character; default Myla. |
| rag_data_answer_generator | Generate in-character answer from RAG chunk + history | Answer in character; no forced greetings in ongoing conversation; medical disclaimer when needed; subscription guardrails appended. Response is free-form text (no strict JSON) unless guardrails say return PLAN_UPGRADE_REQUIRED. |
| category_selector | Map user reply to NEURO category | One of the five category option strings, or NONE. |
| goals_options_selector | Map user reply to (character, goal title) for goal selection | character_name, goal_title (exact from list) or NONE. |
| days_selection | Parse days-per-week choice | One of 1–7 or NONE. |
| confirmation_question_selector | Parse "Ready to commit?" reply | YES, NO, or NONE. |
| help_pick_goal_next_question | Next question in "Help me pick a goal" flow | Single short question string, no preamble. |
| help_pick_goal_suggest_goals | Pick 3 goals from available list given Q&A summary | JSON array of 3 objects: {"goal_title": "Exact Title", "reason": "..."}. Titles must match list exactly. |
| assessment_personalization_prompt | Personalize assessment questions | Same JSON structure as original with personalized questions. |
| assessment_recommendation_prompt | Recommendations from assessment results | JSON with recommendations, suggested_goals, next_steps. |
| custom_goal_validation_prompt | Validate custom goal title/description and check duplicates | JSON: text, character, error (bool), corrected_name, corrected_description. Similar/duplicate → error + optionally corrected_name. |
| goal_explanation_prompt | Explain what to do for a goal in character voice | JSON: text (must end with "Want to know more?"), character, action_type: "CTA", actions: ["Continue in chat"]. |
| ai_goal_suggestion_prompt | Suggest 3–5 goals from available list | JSON: suggestions (by category), total_count, overall_insight. Each suggestion: goal_id, title, goal_version_id (BEGINNER), reason. Only from available_goals. |

### 2.2 Greeting response format (when greeting, not a label)

When the greeting classifier returns a greeting (intro + optional engagement question), it must be valid JSON:

```json
{"text": "greeting text", "avatar": "Myla", "action_type": "None", "actions": []}
```

Marking-goal intent returns this fixed structure:

```json
{"text": "Marking your goal is an important step...", "avatar": "Myla", "action_type": "CTA", "actions": ["Mark out your goal"]}
```

### 2.3 Journaling (journaling/prompts.py)

- JOURNALING_ASSISTANT_PROMPT: System prompt for the journaling assistant. Placeholders: {environmental_context}, {user_goals}, {system_goals}. Rules: empathetic tone; only suggest goals when there is explicit goal-setting intent; never for health concerns/sharing only; use get_available_goals at most once per turn; category from context or None; CTA actions for goals must be Add "[goal_title]"; add_goal_for_user when user picks an "Add …" action; response JSON with message, actions, action_type.
- action_type in journaling: CTA (goal options shown), GOAL_ADDED (goal added), None (normal reflection).

### 2.4 Subscription guardrails (services/subscription_guardrails_service.py)

- generate_guardrail_prompt(tier): Appended to RAG system prompt.
  - FREE / HABITS: 2–4 sentences max; no in-depth/personalized plans; if user asks for those → respond with only PLAN_UPGRADE_REQUIRED.
  - SUMMIT: In-depth, personalized, NEURO World resources; no NEURO Academy → PLAN_UPGRADE_REQUIRED.
  - CLINICAL: No restrictions; full depth and data.
- get_upgrade_message(tier): Returns { "text": "...", "action_type": "CTA", "actions": ["View Plans"] }.

### 2.5 Function-call response format (in interactors/chat.py)

After FUNCTION_CALL: get_user_preferences or get_user_profile_data, an internal LLM turns function result into a user-facing reply. Expected JSON:

```json
{"text": "natural response", "avatar": "Myla", "action_type": "None", "actions": []}
```

For get_user_profile_data, instructions tell the model to focus on goals/profile/points/streaks/badges as requested and to use the correct streak meaning (weeks).

### 2.6 NeuroCity intent (neurocity_integration/intent_detection.py)

- classification_prompt: Classifies into: explain_system, query_goal_progress, query_next_unlocks, admin_cms_workflow, update_request, none. Strong indicators: "NeuroCity", "Neuropolis", "city progress", "city state", "my city", etc.
- Output: JSON with intent_type, goal_id, selected_goal_id, goal_name, confidence. Response shape is the same generic chat message: text, avatar, action_type, actions.

### 2.7 Goal suggestion (non-LLM) – services/goal_suggestion_service.py

No prompts; scoring and balancing logic only. Uses persona and conversation topics to score goals, then 60% from preferred categories and 40% exploration. Good for validating that suggested goals match user persona and history.

### 2.8 Goal explanation – services/goal_explanation_service.py

Uses PromptHub.goal_explanation_prompt; returns: text (must end with "Want to know more?"), character, action_type: "CTA", actions: ["Continue in chat"].

### 2.9 Custom goal validation – services/custom_goal_validator.py

Returns: text, character, error, corrected_name, corrected_description. Duplicate/similar → error: true.

### 2.10 AI goal suggestion – services/ai_goal_suggestion_service.py

Only for HABITS/SUMMIT/CLINICAL. Returns: suggestions (by category), total_count, overall_insight; each item has goal_id, title, goal_version_id, reason.

---

## 3. Standard chat response schema (for validation)

Every assistant message saved and streamed follows this shape (field names may appear as in code or API):

- **text** (or message in journaling): string shown to the user.
- **avatar** (or character): one of Myla, Nuri, Spark, Flo, Luna, Sophi.
- **action_type:** e.g. None, CTA, Button, List, GOAL_ADDED, ASSESSMENT_CATEGORY, ASSESSMENT_SELECTION, LIST_GOALS, GOAL_SUGGESTIONS, DUPLICATE_GOAL_ACTIONS, ADJUST_GOAL_TARGET, etc.
- **actions:** list of strings (e.g. button labels, "View Plans", "Add \"Goal Title\"", "Mark out your goal", "Continue in chat").
- Optional: extras (e.g. Circle post IDs, NeuroCity payloads).

**Validation app should:**
- Expect every chunk to have text, avatar/character, action_type, actions.
- Allow only the known action_type and avatar enums.
- If action_type == "CTA", require non-empty actions when the prompt specifies a CTA (e.g. "Mark out your goal", "Continue in chat", "View Plans").

---

## 4. Greeting / intent labels (for test cases)

Exact strings the greeting classifier can return (or that the app treats as such after parsing):

- QUESTION – Continue to character selection + RAG; may include "QUESTION - and greeting response".
- CONFIRM GOAL SELECTION – User confirming a chosen goal.
- ADD GOAL – Start add-goal flow (unless last message was CTA and "goal thing is completed").
- HELP_PICK_GOAL – Start help-pick-goal flow.
- FUNCTION_CALL: get_user_preferences – Fetch preferences and respond from data.
- FUNCTION_CALL: get_user_profile_data – Fetch profile/goals/points/streaks/badges and respond.
- SUGGEST GOALS – Only for standalone requests ("suggest me goals", "what goals should I try"), not for "yes" to "want tips?".
- CREATE GOAL – Create custom goal flow.
- JOURNALING_INTENT – User wants to start journaling/reflection/gratitude.
- JOURNAL_QUERY – User asking about journals/entries/reflections.
- PLAN_UPGRADE_REQUIRED – Subscription guardrail triggered; client can show upgrade CTA.

Plus the two fixed JSON blobs (greeting intro and "Mark out your goal" CTA).

---

## 5. Validation checklist for the testing app

- **Effective query:** For "yes" after "Would you like more smoothie ideas?" → effective query should be like "I would like more smoothie ideas"; for "What did Dr Ayesha say about this?" with history about Alzheimer's → should reference "alzymer"/Alzheimer's.
- **Greeting vs QUESTION:** Greeting only for real greetings or high-level NEURO World intro; "I would like …" / "yes" in reply to a question → QUESTION.
- **SUGGEST GOALS vs QUESTION:** "suggest me goals" / "what goals should I try" → SUGGEST GOALS; "yes" to "want tips?" → QUESTION.
- **Function calls:** "my goals", "my points", "my streaks", "my badges", "my profile" → get_user_profile_data; "what do I like", "my preferences" → get_user_preferences; response must be valid JSON with text, avatar, action_type, actions.
- **Character selection:** Direct address ("Hey Luna") → Luna; "who are you" with last character Nuri → Nuri; sleep keywords → Luna; nutrition → Nuri; etc.
- **RAG answers:** In ongoing conversation, no "Ah my dear" style greetings; no repetition of same examples; medical questions get empathetic disclaimer + redirect; subscription tier enforces length and upgrade trigger (PLAN_UPGRADE_REQUIRED).
- **Goal explanation:** Response ends with "Want to know more?"; action_type CTA; actions includes "Continue in chat".
- **Custom goal validation:** Duplicate/similar goal → error: true; title/description corrections in corrected_name / corrected_description; response JSON has all required fields.
- **Journaling:** Goal tools only on explicit goal-setting intent; at most one get_available_goals per turn; action_type CTA only when showing goal options; "Add \"…\"" actions match goal titles.
- **NeuroCity:** Queries with "NeuroCity", "city progress", "my city" → NeuroCity path; response has standard text/avatar/action_type/actions.
- **Subscription:** Requests for in-depth/personalized content on FREE/HABITS → body or special handling for PLAN_UPGRADE_REQUIRED; upgrade message has actions: ["View Plans"].
