/**
 * Network resilience utilities for local-first mobile environments.
 *
 * Handles the "Ghost Server" problem:
 * - Distinguishes "device offline" vs "server unreachable" vs "timeout"
 * - Enforces aggressive timeouts for local network endpoints (≤3s)
 * - Provides structured error types for actionable user feedback
 */

// ─── Error Classification ────────────────────────────────────────

export type NetworkErrorKind =
  | "offline"       // Device has no network connectivity
  | "timeout"       // Server didn't respond within deadline
  | "unreachable"   // DNS/TCP connection refused or failed
  | "http_error"    // Server responded with non-2xx status
  | "stream_abort"  // Stream was intentionally aborted (user or lifecycle)
  | "unknown";      // Catch-all

export class NetworkError extends Error {
  public readonly kind: NetworkErrorKind;
  public readonly statusCode?: number;
  public readonly userMessage: string;

  constructor(kind: NetworkErrorKind, message: string, statusCode?: number) {
    super(message);
    this.name = "NetworkError";
    this.kind = kind;
    this.statusCode = statusCode;
    this.userMessage = NetworkError.toUserMessage(kind, statusCode);
  }

  /* REFACTOR: Human-readable error messages mapped to each failure class */
  static toUserMessage(kind: NetworkErrorKind, statusCode?: number): string {
    switch (kind) {
      case "offline":
        return "You're offline. Check your Wi-Fi or cellular connection.";
      case "timeout":
        return "Connection timed out. Is your AI server running?";
      case "unreachable":
        return "Can't reach the server. Check the API URL and ensure Local Network access is allowed.";
      case "http_error":
        return statusCode === 404
          ? "Model endpoint not found. Check your API URL."
          : `Server error (HTTP ${statusCode ?? "?"}). Try again.`;
      case "stream_abort":
        return "Response was interrupted.";
      default:
        return "An unexpected network error occurred.";
    }
  }
}

// ─── Connectivity Detection ──────────────────────────────────────

/** Returns true if the device reports itself as offline (navigator.onLine) */
export function isDeviceOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine;
}

/** Detect if a URL targets a local/private network (192.168.x.x, 10.x.x.x, localhost) */
export function isLocalNetworkUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

// ─── Timeout-Aware Fetch ─────────────────────────────────────────

export interface ResilientFetchOptions extends RequestInit {
  /**
   * Timeout in milliseconds.
   * Defaults: 3000ms for local network, 10000ms for remote.
   * Set to 0 for no timeout (not recommended).
   */
  timeoutMs?: number;
}

/**
 * Wraps `fetch` with automatic timeout, offline pre-check,
 * and structured error classification.
 *
 * Merges an internal AbortController for timeout with any
 * caller-provided `signal` (e.g., user stop button).
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  /* REFACTOR: Pre-flight offline check to fail fast (<1ms) */
  if (isDeviceOffline()) {
    throw new NetworkError("offline", "Device is offline");
  }

  const { timeoutMs, signal: callerSignal, ...fetchOptions } = options;
  const effectiveTimeout =
    timeoutMs !== undefined
      ? timeoutMs
      : isLocalNetworkUrl(url)
        ? 3000   // Aggressive timeout for LAN endpoints
        : 10000; // Standard timeout for remote

  const timeoutController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (effectiveTimeout > 0) {
    timeoutId = setTimeout(() => timeoutController.abort(), effectiveTimeout);
  }

  /* Combine caller's abort signal with our timeout signal */
  const combinedSignal = callerSignal
    ? combineAbortSignals(callerSignal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: combinedSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      throw new NetworkError(
        "http_error",
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return response;
  } catch (error: unknown) {
    if (timeoutId) clearTimeout(timeoutId);

    if (error instanceof NetworkError) throw error;

    if (error instanceof DOMException || (error instanceof Error && error.name === "AbortError")) {
      /* Distinguish user-initiated abort from timeout */
      if (callerSignal?.aborted) {
        throw new NetworkError("stream_abort", "Request aborted by user");
      }
      throw new NetworkError("timeout", `Request timed out after ${effectiveTimeout}ms`);
    }

    /* TypeError from fetch = DNS failure, connection refused, CORS, etc. */
    if (error instanceof TypeError) {
      if (isDeviceOffline()) {
        throw new NetworkError("offline", "Device went offline during request");
      }
      throw new NetworkError(
        "unreachable",
        `Cannot reach ${new URL(url).hostname}: ${error.message}`
      );
    }

    throw new NetworkError(
      "unknown",
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Combine two AbortSignals — aborts when EITHER fires.
 * Uses AbortSignal.any() where available, falls back to manual wiring.
 */
function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  /* Modern browsers (Chrome 116+, Safari 17.4+) */
  if ("any" in AbortSignal && typeof (AbortSignal as any).any === "function") {
    return (AbortSignal as any).any([a, b]);
  }

  /* Fallback: wire both into a new controller */
  const controller = new AbortController();
  const onAbort = () => controller.abort();

  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }

  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });

  return controller.signal;
}
