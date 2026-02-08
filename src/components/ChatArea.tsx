import { useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeBanner } from "./WelcomeBanner";
import { DateDivider } from "./DateDivider";
import { db } from "@/lib/db";

interface ChatAreaProps {
  threadId: string | null;
  isTyping: boolean;
  bubbleStyle?: "default" | "modern" | "compact";
  characterAvatar?: string; // Optional character avatar
  onSuggestionClick?: (text: string) => void;
}

export function ChatArea({ threadId, isTyping, bubbleStyle = "default", characterAvatar, onSuggestionClick }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useLiveQuery(
    async () => {
      if (!threadId) return [];
      return db.messages
        .where("threadId")
        .equals(threadId)
        .sortBy("timestamp");
    },
    [threadId]
  );

  // Scroll to bottom when messages change
  const shouldShowWelcome = !messages || messages.length === 0;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain pt-[calc(60px+env(safe-area-inset-top))] pb-[calc(110px+env(safe-area-inset-bottom))]">
      {shouldShowWelcome ? (
        <WelcomeBanner onSuggestionClick={onSuggestionClick} />
      ) : (
        <>
          <DateDivider label="Today" />
          <div className="flex flex-col gap-1 pb-2">
            <AnimatePresence mode="popLayout">
              {messages?.map((msg) => (
                <ChatBubble key={msg.id} message={msg} bubbleStyle={bubbleStyle} characterAvatar={characterAvatar} />
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator characterAvatar={characterAvatar} />}
          </div>
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
