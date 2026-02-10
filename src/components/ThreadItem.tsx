import { useEffect, useRef, useCallback, useState } from "react";
import { motion, useAnimation, type PanInfo } from "framer-motion";
import { MessageSquare, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Thread } from "@/lib/db";

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  openSwipeId: string | null;
  onSwipeOpen: (threadId: string) => void;
  onSwipeClose: () => void;
  onClick: () => void;
  onArchive?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
}

function formatThreadDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

const SWIPE_THRESHOLD = -100;
const ACTION_BUTTON_WIDTH = 140;

export function ThreadItem({ thread, isActive, openSwipeId, onSwipeOpen, onSwipeClose, onClick, onArchive, onDelete }: ThreadItemProps) {
  const controls = useAnimation();
  const isOpen = openSwipeId === thread.id;
  const [showContextMenu, setShowContextMenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Guard: distinguish drags from taps. Set true on drag start, cleared after a timeout.
  const didDragRef = useRef(false);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!showContextMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showContextMenu]);

  // Auto-close when parent tells us another item opened or swipes were reset
  useEffect(() => {
    if (!isOpen) {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
    }
  }, [isOpen, controls]);

  const handleDragStart = useCallback(() => {
    didDragRef.current = true;
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    // Clear drag flag after a tick so the subsequent click event is suppressed
    dragTimerRef.current = setTimeout(() => { didDragRef.current = false; }, 80);

    if (info.offset.x < SWIPE_THRESHOLD) {
      // Swiped far enough — reveal actions
      controls.start({ x: -ACTION_BUTTON_WIDTH, transition: { type: "spring", stiffness: 400, damping: 30 } });
      onSwipeOpen(thread.id);
    } else {
      // Not far enough — snap closed
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      if (isOpen) onSwipeClose();
    }
  }, [controls, thread.id, onSwipeOpen, onSwipeClose, isOpen]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // If this click was the tail end of a drag gesture, swallow it
    if (didDragRef.current) {
      e.stopPropagation();
      return;
    }

    if (isOpen) {
      // Tap on an open row → close it
      e.stopPropagation();
      onSwipeClose();
    } else {
      onClick();
    }
  }, [isOpen, onSwipeClose, onClick]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (dragTimerRef.current) clearTimeout(dragTimerRef.current); };
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete?.(thread.id);
    }
  }, [onDelete, thread.id]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action buttons revealed behind the item — only mount when swiped open */}
      {isOpen && <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onArchive?.(thread.id); onSwipeClose(); }}
          className="flex items-center justify-center w-[70px] bg-blue-600 text-white text-[11px] font-medium gap-1 flex-col"
          aria-label={`Archive ${thread.title}`}
        >
          <Archive size={16} />
          Archive
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete?.(thread.id); onSwipeClose(); }}
          className="flex items-center justify-center w-[70px] bg-red-600 text-white text-[11px] font-medium gap-1 flex-col"
          aria-label={`Delete ${thread.title}`}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>}

      {/* Swipeable foreground */}
      <motion.div
        animate={controls}
        drag="x"
        dragConstraints={{ left: -ACTION_BUTTON_WIDTH, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        <button
          type="button"
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors",
            isActive
              ? "bg-blue-50 dark:bg-blue-950/40 text-zinc-900 dark:text-zinc-100"
              : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200",
          )}
        >
          <div className="shrink-0 mt-0.5">
            <MessageSquare
              size={15}
              className={cn(isActive ? "text-blue-400" : "text-zinc-600")}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium truncate tracking-tight">
                {thread.title}
              </span>
              <span className="text-[10px] text-zinc-600 shrink-0">
                {formatThreadDate(thread.updatedAt)}
              </span>
            </div>
          </div>
        </button>
      </motion.div>

      {/* Context menu for keyboard/right-click users */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute right-2 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[160px]"
        >
          {onArchive && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); onArchive(thread.id); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
            >
              <Archive size={14} />
              Archive
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); onDelete(thread.id); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/30 transition-colors text-left"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
