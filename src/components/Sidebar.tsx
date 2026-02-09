import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { X, Sparkles, Plus, Settings, User, Trash2, Pencil, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { db, createThread, deleteThread, updateThreadTitle, type Character } from "@/lib/db";
import { ThreadItem } from "./ThreadItem";
import { CharacterSidebarTab } from "./Character/CharacterSidebarTab";
import { useState } from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenSettings: () => void;
  onSelectCharacter?: (character: Character) => void;
  activeCharacterId?: number | null;
}

type SidebarTab = "chats" | "characters";

export function Sidebar({
  isOpen,
  onClose,
  activeThreadId,
  onSelectThread,
  onOpenSettings,
  onSelectCharacter,
  activeCharacterId,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");
  const threads = useLiveQuery(
    () => db.threads.orderBy("updatedAt").reverse().toArray(),
    []
  );
  const userProfile = useLiveQuery(async () => {
    const s = await db.settings.get("user_profile");
    return s?.value;
  });

  const handleNewChat = async () => {
    const thread = await createThread();
    onSelectThread(thread.id);
    onClose();
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this conversation?")) {
      await deleteThread(threadId);
      if (activeThreadId === threadId) {
        // Switch to first available thread
        const remaining = await db.threads.orderBy("updatedAt").reverse().first();
        if (remaining) {
          onSelectThread(remaining.id);
        } else {
          // Create a new thread if none exist
          const newThread = await createThread();
          onSelectThread(newThread.id);
        }
      }
    }
  };

  const handleRenameThread = async (threadId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTitle = prompt("Rename conversation:", currentTitle);
    if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
      await updateThreadTitle(threadId, newTitle.trim());
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            role="button"
            tabIndex={-1}
            aria-label="Close sidebar"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] z-50 flex flex-col",
          "bg-black/60 backdrop-blur-xl border-r border-zinc-800/50",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Chat history sidebar"
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Sparkles size={14} className="text-zinc-100" />
            </div>
            <span className="text-[15px] font-semibold text-zinc-100 tracking-tight">
              mine.ai
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors text-zinc-500 hover:text-zinc-200"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-zinc-100 text-[13px] font-medium hover:opacity-90 transition-opacity shadow-lg shadow-blue-600/15"
          >
            <Plus size={15} />
            New Chat
          </motion.button>
        </div>

        {/* Tab Selector */}
        <div className="px-3 py-2 border-b border-zinc-800/50">
          <div className="flex gap-1 bg-zinc-900/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("chats")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors",
                activeTab === "chats"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <MessageSquare size={14} />
              Chats
            </button>
            <button
              onClick={() => setActiveTab("characters")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors",
                activeTab === "characters"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Users size={14} />
              Characters
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chats" ? (
            <div className="h-full overflow-y-auto px-2 pb-2">
              <div className="px-2 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  Recent
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {threads?.map((thread) => (
                  <div key={thread.id} className="relative group">
                    <ThreadItem
                      thread={thread}
                      isActive={thread.id === activeThreadId}
                      onClick={() => {
                        onSelectThread(thread.id);
                        onClose();
                      }}
                    />
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={(e) => handleRenameThread(thread.id, thread.title, e)}
                      className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-zinc-500 hover:text-blue-400 hover:border-blue-500/50 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Rename thread"
                    >
                      <Pencil size={13} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/50 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete thread"
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <CharacterSidebarTab
              onSelectCharacter={(character) => {
                onSelectCharacter?.(character);
                onClose();
              }}
              activeCharacterId={activeCharacterId}
            />
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <User size={13} className="text-zinc-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-zinc-100 truncate tracking-tight">
                {userProfile?.displayName || "mine.ai User"}
              </p>
              <p className="text-[10px] text-zinc-500">{userProfile?.role || "Privacy First"}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors text-zinc-500 hover:text-zinc-200"
              aria-label="Settings"
            >
              <Settings size={15} />
            </motion.button>
          </div>
        </div>
      </aside>
    </>
  );
}
