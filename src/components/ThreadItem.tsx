import { useEffect, useRef, useCallback } from "react";
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

const SWIPE_THRESHOLD = -60;
const ACTION_BUTTON_WIDTH = 140;

export function ThreadItem({ thread, isActive, openSwipeId, onSwipeOpen, onSwipeClose, onClick, onArchive, onDelete }: ThreadItemProps) {
  const controls = useAnimation();
  const isOpen = openSwipeId === thread.id;

  // Guard: distinguish drags from taps. Set true on drag start, cleared after a timeout.
  const didDragRef = useRef(false);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action buttons revealed behind the item */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onArchive?.(thread.id); onSwipeClose(); }}
          className="flex items-center justify-center w-[70px] bg-blue-600 text-white text-[11px] font-medium gap-1 flex-col"
        >
          <Archive size={16} />
          Archive
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete?.(thread.id); onSwipeClose(); }}
          className="flex items-center justify-center w-[70px] bg-red-600 text-white text-[11px] font-medium gap-1 flex-col"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>

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
          className={cn(
            "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors bg-zinc-950",
            isActive
              ? "bg-blue-600/10 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
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
    </div>
  );
}
