"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

/**
 * React Error Boundary — catches render crashes in the component tree.
 *
 * Prevents a single bad Markdown render or Framer Motion error
 * from killing the entire app. Shows a recoverable fallback UI.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional granular fallback. Defaults to a generic recovery UI. */
  fallback?: ReactNode;
  /** Boundary name for debugging (e.g., "ChatBubble", "Sidebar") */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`,
      error,
      info.componentStack
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-800/40 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-sm text-zinc-400 max-w-65">
            Something went wrong{this.props.name ? ` in ${this.props.name}` : ""}.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
