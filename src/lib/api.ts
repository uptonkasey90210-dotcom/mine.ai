import { getSetting, db } from "./db";
import { resilientFetch, NetworkError, isDeviceOffline } from "./network";

// Type definitions for API responses
interface OllamaModel {
  name: string;
  id?: string;
}

interface OllamaResponse {
  models?: OllamaModel[];
}

interface OpenAIModel {
  id: string;
}

interface OpenAIResponse {
  data?: OpenAIModel[];
}

/**
 * Build the chat completions URL from a user-provided API base URL.
 * Handles cases where user enters:
 * - Base URL only: http://localhost:11434 → /v1/chat/completions
 * - Full path: http://localhost:11434/v1/chat/completions → as-is
 * - Ollama native path: http://localhost:11434/api/chat → kept as-is
 */
function buildChatCompletionUrl(apiUrl: string): string {
  const cleanUrl = apiUrl.replace(/\/+$/, '');

  // Already a full chat completions URL
  if (/\/chat\/completions$/i.test(cleanUrl)) {
    return cleanUrl;
  }

  // Ollama native endpoint — keep as-is (parser handles NDJSON)
  if (cleanUrl.endsWith('/api/chat')) {
    return cleanUrl;
  }

  // Base URL only — append OpenAI-compatible endpoint
  return `${cleanUrl}/v1/chat/completions`;
}

/**
 * Extract the base URL from a user-provided API URL.
 * Strips known API paths to get the root server address.
 */
function getBaseUrl(apiUrl: string): string {
  return apiUrl
    .replace(/\/+$/, '')
    .replace(/\/(v1\/chat\/completions|api\/chat|v1\/models|api\/tags)$/i, '');
}

export interface StreamOptions {
  apiUrl: string;
  modelName: string;
  systemPrompt: string;
  temperature: number;
  topP?: number;
  contextLength?: number;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  onChunk: (chunk: string) => void;
  onThinking?: (thinking: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Stream AI responses from the configured API endpoint
 * Supports OpenAI-compatible streaming APIs (Ollama, LM Studio, etc.)
 */
export async function streamAIResponse(options: StreamOptions): Promise<void> {
  const {
    apiUrl,
    modelName,
    systemPrompt,
    temperature,
    topP,
    contextLength,
    messages,
    onChunk,
    onThinking,
    onComplete,
    onError,
    signal,
  } = options;

  try {
    /* REFACTOR: Pre-flight offline check — fail fast before opening connection */
    if (isDeviceOffline()) {
      throw new NetworkError("offline", "Device is offline");
    }

    // Construct absolute URL — defaults to OpenAI-compatible /v1/chat/completions
    const targetUrl = buildChatCompletionUrl(apiUrl);

    // ═══ IDENTITY INJECTION (Service-Level) ═══
    // Force-read user profile from Dexie and prepend identity context
    // to the system prompt so the AI always knows who it's talking to.
    let resolvedSystemPrompt = systemPrompt;
    try {
      const profileSetting = await db.settings.get("user_profile");
      const userProfile = profileSetting?.value;
      if (userProfile) {
        const identityParts: string[] = [];
        if (userProfile.displayName) identityParts.push(`Name=${userProfile.displayName}`);
        if (userProfile.role) identityParts.push(`Role=${userProfile.role}`);
        if (userProfile.bio) identityParts.push(`Bio=${userProfile.bio}`);
        if (userProfile.location) identityParts.push(`Location=${userProfile.location}`);
        if (identityParts.length > 0) {
          const identityContext = `[User Info: ${identityParts.join(", ")}.]`;
          resolvedSystemPrompt = `${identityContext}\n\n${resolvedSystemPrompt}`;
        }
      }
    } catch (e) {
      // Silently proceed — identity is best-effort, never block the request
      console.warn("[api] Failed to read user profile for injection:", e);
    }
    
    /* REFACTOR: Use resilientFetch with 3s timeout for LAN, 10s for remote.
       Streaming requests use a longer initial timeout since the first token
       may take a few seconds on slow hardware. The stream itself has no
       timeout — once the first byte arrives, we rely on AbortController. */
    const response = await resilientFetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: resolvedSystemPrompt },
          ...messages,
        ],
        temperature,
        ...(topP !== undefined ? { top_p: topP } : {}),
        stream: true,
        ...(contextLength ? { num_ctx: contextLength } : {}),
      }),
      signal,
      /* Streaming first-byte timeout: allow more time for model loading */
      timeoutMs: 15000,
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          continue;
        }

        try {
          let json;

          if (trimmed.startsWith("data: ")) {
            // SSE format (OpenAI-compatible: Ollama /v1, LM Studio, etc.)
            json = JSON.parse(trimmed.slice(6));
          } else if (trimmed.startsWith("{")) {
            // NDJSON format (Ollama native /api/chat)
            json = JSON.parse(trimmed);
          } else {
            continue;
          }

          // Skip Ollama "done" signal (empty content, stats only)
          if (json.done === true) {
            continue;
          }

          // Handle different API response formats
          const content =
            json.choices?.[0]?.delta?.content || // OpenAI streaming delta
            json.message?.content ||             // Ollama native streaming chunk
            json.response ||                      // Legacy format
            "";

          if (content) {
            onChunk(content);
          }

          // Handle thinking/reasoning tokens
          const thinking = json.choices?.[0]?.delta?.thinking || json.thinking;
          if (thinking && onThinking) {
            onThinking(thinking);
          }
        } catch (e) {
          console.warn("Failed to parse streaming chunk:", e);
        }
      }
    }

    onComplete();
  } catch (error) {
    /* REFACTOR: Propagate NetworkError directly for structured error handling */
    if (error instanceof NetworkError) {
      onError(error);
    } else {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Fetch available models from the API endpoint
 * Supports Ollama (/api/tags) and OpenAI-compatible endpoints
 */
export async function fetchModels(
  baseUrl: string
): Promise<{ success: boolean; models: string[]; error?: string }> {
  try {
    // Construct absolute URL - strip any path to get base server address
    const cleanUrl = getBaseUrl(baseUrl);

    /* REFACTOR: Try Ollama format first with resilientFetch (auto-timeout) */
    const ollamaUrl = cleanUrl + '/api/tags';
    try {
      const response = await resilientFetch(ollamaUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json() as OllamaResponse;
      const models = data.models?.map((m) => m.name || m.id || "") || [];
      return { success: true, models: models.filter(Boolean) };
    } catch {
      /* Ollama endpoint not available — try OpenAI format */
    }

    /* REFACTOR: OpenAI fallback now also uses resilientFetch with timeout */
    const openaiUrl = cleanUrl + '/v1/models';
    const openaiResponse = await resilientFetch(openaiUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await openaiResponse.json() as OpenAIResponse;
    const models = data.data?.map((m) => m.id) || [];
    return { success: true, models };
  } catch (error) {
    if (error instanceof NetworkError) {
      return {
        success: false,
        models: [],
        error: error.userMessage,
      };
    }
    return {
      success: false,
      models: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test connection to the API endpoint
 */
export async function testAPIConnection(
  apiUrl: string,
  modelName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    /* REFACTOR: resilientFetch handles timeout, offline, and error classification */
    const targetUrl = buildChatCompletionUrl(apiUrl);
    
    await resilientFetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
        stream: false,
      }),
      /* Connection test uses shorter timeout — user is waiting for feedback */
      timeoutMs: 5000,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof NetworkError) {
      return {
        success: false,
        error: error.userMessage,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
