/**
 * Token estimation and context window management.
 *
 * Solves the "Context Overflow" problem:
 * - Estimates token count using a fast heuristic (no WASM dependency)
 * - Implements sliding-window truncation that respects context_length
 * - Always preserves the system prompt and the most recent user message
 * - Truncates from the OLDEST messages forward
 *
 * The heuristic (~4 chars/token for English, ~3.5 for code-heavy)
 * is intentionally conservative to leave headroom for the model's response.
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ─── Token Estimation ────────────────────────────────────────────

/**
 * Fast token count estimator.
 * English prose ≈ 4 chars/token, code ≈ 3.5 chars/token.
 * We use 3.5 (conservative) to avoid overflow at the margin.
 *
 * Adds per-message overhead for role/formatting tokens (~4 tokens each).
 */
const CHARS_PER_TOKEN = 3.5;
const PER_MESSAGE_OVERHEAD = 4; // role, delimiters, etc.

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN) + PER_MESSAGE_OVERHEAD;
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

// ─── Sliding Window Truncation ───────────────────────────────────

export interface TruncationResult {
  messages: ChatMessage[];
  truncated: boolean;
  originalCount: number;
  finalCount: number;
  estimatedTokens: number;
}

/**
 * Truncate conversation history to fit within a token budget.
 *
 * Strategy:
 *  1. The system prompt is ALWAYS included (at index 0).
 *  2. The latest user message is ALWAYS included (at the end).
 *  3. Remaining budget is filled from newest → oldest.
 *  4. A 25% reserve is kept for the model's response tokens.
 *
 * @param systemPrompt  The system prompt content
 * @param history       Chronologically-ordered user/assistant messages
 * @param contextLength Max context window in tokens (e.g., 4096, 8192)
 */
export function truncateToFit(
  systemPrompt: string,
  history: ChatMessage[],
  contextLength: number
): TruncationResult {
  const originalCount = history.length;

  if (originalCount === 0) {
    const sysMsg: ChatMessage = { role: "system", content: systemPrompt };
    return {
      messages: [sysMsg],
      truncated: false,
      originalCount: 0,
      finalCount: 0,
      estimatedTokens: estimateTokens(systemPrompt),
    };
  }

  /* Reserve 25% of context for model response */
  const RESPONSE_RESERVE_RATIO = 0.25;
  const maxInputTokens = Math.floor(contextLength * (1 - RESPONSE_RESERVE_RATIO));

  const systemMessage: ChatMessage = { role: "system", content: systemPrompt };
  const systemTokens = estimateTokens(systemPrompt);

  /* The newest user message is non-negotiable */
  const lastMessage = history[history.length - 1];
  const lastMessageTokens = estimateTokens(lastMessage.content);

  /* Budget available for the middle of the conversation */
  let budgetRemaining = maxInputTokens - systemTokens - lastMessageTokens;

  if (budgetRemaining <= 0) {
    /* System prompt + last message alone exceeds budget.
       Still send them — the model will truncate internally. */
    const msgs = [systemMessage, lastMessage];
    return {
      messages: msgs,
      truncated: originalCount > 1,
      originalCount,
      finalCount: 1,
      estimatedTokens: systemTokens + lastMessageTokens,
    };
  }

  /* Fill from newest → oldest (excluding the last message already reserved) */
  const middleMessages: ChatMessage[] = [];
  for (let i = history.length - 2; i >= 0; i--) {
    const tokens = estimateTokens(history[i].content);
    if (tokens > budgetRemaining) break; // Can't fit this message
    middleMessages.unshift(history[i]); // Prepend to maintain order
    budgetRemaining -= tokens;
  }

  const finalMessages = [systemMessage, ...middleMessages, lastMessage];
  const finalTokens = estimateMessagesTokens(finalMessages);

  return {
    messages: finalMessages,
    truncated: middleMessages.length < originalCount - 1,
    originalCount,
    finalCount: middleMessages.length + 1, // +1 for last message
    estimatedTokens: finalTokens,
  };
}
