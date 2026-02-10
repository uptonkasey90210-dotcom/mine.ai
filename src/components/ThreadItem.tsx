import { useState } from "react";
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from "framer-motion";
import { MessageSquare, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Thread } from "@/lib/db";

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
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

const SWIPE_THRESHOLD = -80;
const ACTION_BUTTON_WIDTH = 140;

export function ThreadItem({ thread, isActive, onClick, onArchive, onDelete }: ThreadItemProps) {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const [swiped, setSwiped] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      controls.start({ x: -ACTION_BUTTON_WIDTH });
      setSwiped(true);
    } else {
      controls.start({ x: 0 });
      setSwiped(false);
    }
  };

  const closeSwipe = () => {
    controls.start({ x: 0 });
    setSwiped(false);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action buttons revealed behind the item */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        <button
          type="button"
          onClick={() => { onArchive?.(thread.id); closeSwipe(); }}
          className="flex items-center justify-center w-[70px] bg-blue-600 text-white text-[11px] font-medium gap-1 flex-col"
        >
          <Archive size={16} />
          Archive
        </button>
        <button
          type="button"
          onClick={() => { onDelete?.(thread.id); closeSwipe(); }}
          className="flex items-center justify-center w-[70px] bg-red-600 text-white text-[11px] font-medium gap-1 flex-col"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      {/* Swipeable foreground */}
      <motion.button
        style={{ x }}
        animate={controls}
        drag="x"
        dragConstraints={{ left: -ACTION_BUTTON_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        whileTap={!swiped ? { scale: 0.97 } : undefined}
        type="button"
        onClick={() => { if (swiped) { closeSwipe(); } else { onClick(); } }}
        className={cn(
          "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors relative z-10 bg-zinc-950",
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
      </motion.button>
    </div>
  );
}
