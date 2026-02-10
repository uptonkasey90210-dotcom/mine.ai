interface ThinkingBlockProps {
  content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  return (
    <details className="mb-2 rounded-md bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/10 open:bg-black/10 dark:open:bg-white/10 transition-colors">
      <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium opacity-50 hover:opacity-100 select-none flex items-center gap-2 list-none">
        <span>🧠 Thought Process</span>
      </summary>
      <div className="p-3 text-sm opacity-70 italic border-t border-zinc-200 dark:border-white/5 whitespace-pre-wrap font-mono leading-relaxed">
        {content}
      </div>
    </details>
  );
}
