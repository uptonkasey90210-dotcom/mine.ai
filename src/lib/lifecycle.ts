/**
 * Mobile lifecycle management for Capacitor.
 *
 * Solves the "Zombie State" problem:
 * - Listens for Capacitor `appStateChange` events
 * - When iOS/Android backgrounds the app, JS execution freezes.
 *   Any in-flight ReadableStream will silently fail.
 * - On resume, fires registered callbacks so the app can:
 *   1. Abort stale streams
 *   2. Reset `isTyping` state
 *   3. Finalize partial AI messages
 *
 * Works in both Capacitor native and browser environments.
 * Falls back to `visibilitychange` when Capacitor is not available.
 */

type LifecycleCallback = (isActive: boolean) => void;

let listeners: LifecycleCallback[] = [];
let initialized = false;
let lastState: boolean = true; // Assume active on startup

/**
 * Register a callback for app state changes.
 * Returns an unsubscribe function.
 *
 * @param callback Called with `true` when app resumes, `false` when backgrounded.
 */
export function onAppStateChange(callback: LifecycleCallback): () => void {
  listeners.push(callback);
  ensureInitialized();

  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

/** Get current app active state */
export function isAppActive(): boolean {
  return lastState;
}

// ─── Initialization ──────────────────────────────────────────────

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  /* Try Capacitor App plugin first (native iOS/Android) */
  tryCapacitorListener().catch(() => {
    /* Fallback: use browser visibilitychange API */
    setupBrowserFallback();
  });
}

async function tryCapacitorListener(): Promise<void> {
  /* Dynamic import — won't crash if @capacitor/app isn't installed */
  const { App } = await import("@capacitor/app");

  App.addListener("appStateChange", (state: { isActive: boolean }) => {
    const wasActive = lastState;
    lastState = state.isActive;

    /* Only fire callbacks on actual transitions */
    if (wasActive !== state.isActive) {
      for (const cb of listeners) {
        try {
          cb(state.isActive);
        } catch (err) {
          console.error("[lifecycle] Callback error:", err);
        }
      }
    }
  });
}

function setupBrowserFallback(): void {
  document.addEventListener("visibilitychange", () => {
    const isActive = document.visibilityState === "visible";
    const wasActive = lastState;
    lastState = isActive;

    if (wasActive !== isActive) {
      for (const cb of listeners) {
        try {
          cb(isActive);
        } catch (err) {
          console.error("[lifecycle] Callback error:", err);
        }
      }
    }
  });

  /* Also listen for page freeze/resume (Chrome) */
  if ("onfreeze" in document) {
    document.addEventListener("freeze", () => {
      lastState = false;
      for (const cb of listeners) {
        try { cb(false); } catch {}
      }
    });
    document.addEventListener("resume", () => {
      lastState = true;
      for (const cb of listeners) {
        try { cb(true); } catch {}
      }
    });
  }
}
