import { motion } from "framer-motion";
import { Menu, Sparkles, Sliders, Trash2, User } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getSetting, setSetting, getAllSettings, type Character } from "@/lib/db";
import { fetchModels } from "@/lib/api";
import { useState, useEffect } from "react";

interface ChatHeaderProps {
  onMenuClick: () => void;
  onSettingsClick: () => void;
  onClearChat?: () => void;
  modelStatus?: "online" | "offline" | "unknown";
  activeCharacter?: Character | null;
  onAvatarClick?: () => void;
}

export function ChatHeader({
  onMenuClick,
  onSettingsClick,
  onClearChat,
  modelStatus = "unknown",
  activeCharacter,
  onAvatarClick,
}: ChatHeaderProps) {
  const modelName = useLiveQuery(() => getSetting('modelName'));
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Fetch available models on mount
  useEffect(() => {
    const loadModels = async () => {
      const settings = await getAllSettings();
      if (settings.apiUrl) {
        const result = await fetchModels(settings.apiUrl);
        if (result.success && result.models.length > 0) {
          setAvailableModels(result.models);
        }
      }
    };
    loadModels();
  }, []);

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    await setSetting('modelName', newModel);
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] bg-black/60 backdrop-blur-xl border-b border-zinc-800/40" data-glass-surface>
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-xl hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-zinc-100"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </motion.button>
        <div className="flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={activeCharacter ? onAvatarClick : undefined}
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg overflow-hidden ${
              activeCharacter ? "cursor-pointer ring-2 ring-blue-500/50 hover:ring-blue-400" : ""
            }`}
          >
            {activeCharacter?.avatar ? (
              <img
                src={activeCharacter.avatar}
                alt={activeCharacter.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : activeCharacter ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <User size={14} className="text-zinc-100" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-blue-600/20">
                <Sparkles size={14} className="text-zinc-100" />
              </div>
            )}
          </motion.button>
          <div>
            {availableModels.length > 0 ? (
              <select
                value={modelName || ''}
                onChange={handleModelChange}
                className="bg-transparent text-[14px] font-semibold text-zinc-100 leading-tight tracking-tight outline-none cursor-pointer hover:text-blue-400 transition-colors max-w-[200px] truncate"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model} className="bg-zinc-900 text-zinc-100">
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-[14px] font-semibold text-zinc-100 leading-tight tracking-tight truncate max-w-[200px]">
                {activeCharacter?.name || modelName || 'mine.ai'}
              </h1>
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  modelStatus === "online"
                    ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                    : modelStatus === "offline"
                      ? "bg-red-400 shadow-sm shadow-red-400/50"
                      : "bg-zinc-500"
                }`}
              />
              <span className="text-[10px] text-zinc-500">
                {modelStatus === "online"
                  ? "Connected"
                  : modelStatus === "offline"
                    ? "Disconnected"
                    : "Unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onSettingsClick}
          className="p-2 rounded-xl hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-zinc-100"
          aria-label="Open settings"
        >
          <Sliders size={17} />
        </motion.button>
        {onClearChat && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onClearChat}
            className="p-2 rounded-xl hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-zinc-100"
            aria-label="Clear conversation"
          >
            <Trash2 size={17} />
          </motion.button>
        )}
      </div>
    </header>
  );
}
