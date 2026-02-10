import { motion } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";

interface WelcomeBannerProps {
  onSuggestionClick?: (text: string) => void;
}

export function WelcomeBanner({ onSuggestionClick }: WelcomeBannerProps) {
  const suggestions = [
    { label: "Write code", prompt: "Help me write some code" },
    { label: "Explain concepts", prompt: "Explain a concept to me" },
    { label: "Brainstorm ideas", prompt: "Help me brainstorm ideas" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-8 px-6"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/10 flex items-center justify-center mb-4">
        <Sparkles size={26} className="text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-balance text-center tracking-tight">
        Welcome to mine.ai
      </h2>
      <p className="text-[13px] text-zinc-500 text-center max-w-[260px] leading-relaxed">
        Your personal AI assistant. Ask me anything to get started.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-5">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSuggestionClick?.(s.prompt)}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/80 rounded-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-95 cursor-pointer"
          >
            <ChevronRight size={11} className="text-blue-600 dark:text-blue-400" />
            {s.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
