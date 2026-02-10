import { motion } from "framer-motion";
import { Avatar } from "./Avatar";

const messageVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 },
  },
};

interface TypingIndicatorProps {
  characterAvatar?: string;
}

export function TypingIndicator({ characterAvatar }: TypingIndicatorProps) {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="flex gap-2.5 px-4 py-1.5"
    >
      <Avatar role="ai" className="mt-1" characterAvatar={characterAvatar} />
      <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </motion.div>
  );
}
