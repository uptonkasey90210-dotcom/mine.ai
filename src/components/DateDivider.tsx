import { Clock } from "lucide-react";

interface DateDividerProps {
  label?: string;
  date?: Date;
}

function computeLabel(date?: Date, label?: string): string {
  if (label) return label;
  if (!date) return "Today";

  const now = new Date();
  const msgDate = new Date(date);

  // Strip time for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return msgDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function DateDivider({ label, date }: DateDividerProps) {
  const displayLabel = computeLabel(date, label);
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <div className="flex-1 h-px bg-zinc-300/40 dark:bg-zinc-800/60" />
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-600 flex items-center gap-1">
        <Clock size={10} />
        {displayLabel}
      </span>
      <div className="flex-1 h-px bg-zinc-300/40 dark:bg-zinc-800/60" />
    </div>
  );
}
