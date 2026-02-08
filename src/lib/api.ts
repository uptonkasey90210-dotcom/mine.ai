import { getSetting } from "./db";

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
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  onChunk: (chunk: string) => void;
  onThinking?: (thinking: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
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
    messages,
    onChunk,
    onThinking,
    onComplete,
    onError,
  } = options;

  try {
    // Construct absolute URL — defaults to OpenAI-compatible /v1/chat/completions
    const targetUrl = buildChatCompletionUrl(apiUrl);
    
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

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
    onError(error instanceof Error ? error : new Error(String(error)));
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
    // Try Ollama format first
    const ollamaUrl = cleanUrl + '/api/tags';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(ollamaUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as OllamaResponse;
      // Ollama returns { models: [{ name: "...", ... }] }
      const models = data.models?.map((m) => m.name || m.id || "") || [];
      return { success: true, models: models.filter(Boolean) };
    }

    // Fallback to OpenAI format
    const openaiUrl = cleanUrl + '/v1/models';
    const openaiResponse = await fetch(openaiUrl);
    
    if (openaiResponse.ok) {
      const data = await openaiResponse.json() as OpenAIResponse;
      const models = data.data?.map((m) => m.id) || [];
      return { success: true, models };
    }

    return {
      success: false,
      models: [],
      error: "Could not fetch models from API",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        models: [],
        error: "Connection timeout",
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Construct absolute URL — use same endpoint as streaming
    const targetUrl = buildChatCompletionUrl(apiUrl);
    
    const response = await fetch(targetUrl, {
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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Connection timeout. Check your API URL and network.",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
