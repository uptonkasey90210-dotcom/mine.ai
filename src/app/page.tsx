"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  initializeDatabase,
  createThread,
  addMessage,
  updateMessage,
  deleteThread,
  getAllSettings,
  getSetting,
  getFlexibleSetting,
  getCharacter,
  createCharacterThread,
  type Message,
  type Character,
} from "@/lib/db";
import { streamAIResponse, testAPIConnection } from "@/lib/api";
import { parseFile, formatFileContext } from "@/lib/parser";
import { Sidebar } from "@/components/Sidebar";
import { SettingsSheet } from "@/components/SettingsSheet";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatArea } from "@/components/ChatArea";
import { ChatInput } from "@/components/ChatInput";
import { CharacterProfileSheet } from "@/components/Character/CharacterProfileSheet";

export default function MineAIChat() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [characterProfileOpen, setCharacterProfileOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<number | null>(null);
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [modelStatus, setModelStatus] = useState<"online" | "offline" | "unknown">("unknown");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase().then(async () => {
      // Set initial active thread to the most recent one
      const threads = await db.threads.orderBy("updatedAt").reverse().toArray();
      if (threads.length > 0) {
        setActiveThreadId(threads[0].id);
      }
    });
  }, []);

  // Auto-connect effect: Test API connection on mount
  useEffect(() => {
    const testConnection = async () => {
      const settings = await getAllSettings();
      
      // Only test if API URL and model are configured
      if (settings.apiUrl && settings.modelName) {
        const result = await testAPIConnection(settings.apiUrl, settings.modelName);
        
        if (result.success) {
          setModelStatus("online");
        } else {
          setModelStatus("offline");
        }
      } else {
        setModelStatus("unknown");
      }
    };

    testConnection();
  }, []); // Run once on mount

  // Load active character when characterId changes
  useEffect(() => {
    if (activeCharacterId) {
      getCharacter(activeCharacterId).then((character) => {
        setActiveCharacter(character || null);
      });
    } else {
      setActiveCharacter(null);
    }
  }, [activeCharacterId]);

  // Load character from thread when thread changes
  useEffect(() => {
    if (activeThreadId) {
      db.threads.get(activeThreadId).then((thread) => {
        if (thread?.characterId) {
          setActiveCharacterId(thread.characterId);
        } else {
          setActiveCharacterId(null);
        }
      });
    } else {
      setActiveCharacterId(null);
    }
  }, [activeThreadId]);

  // Apply accent color dynamically from settings
  const accentColor = useLiveQuery(() => getSetting("accent_color"));
  useEffect(() => {
    if (accentColor) {
      document.documentElement.style.setProperty("--accent-color", accentColor);
    }
  }, [accentColor]);

  // Apply text size dynamically from settings
  const textSize = useLiveQuery(() => getSetting("font_size_modifier"));
  useEffect(() => {
    if (textSize) {
      const sizeMap: Record<string, string> = { small: "14px", medium: "16px", large: "18px" };
      document.documentElement.style.fontSize = sizeMap[textSize] || "16px";
    }
  }, [textSize]);

  // Get bubble style from settings
  const bubbleStyle = useLiveQuery(() => getSetting("bubble_style")) || "default";

  const handleSend = useCallback(async (message: string, file?: File) => {
    const trimmed = message.trim();
    if (!trimmed && !file) return;
    if (isTyping) return;

    // Create new thread if none exists
    let threadId = activeThreadId;
    if (!threadId) {
      const newThread = await createThread();
      threadId = newThread.id;
      setActiveThreadId(threadId);
    }

    // ═══ JUST-IN-TIME FETCHING (PREVENT STALE STATE) ═══
    // Force-fetch fresh settings and thread state immediately before sending
    const settings = await getAllSettings();
    const currentThread = await db.threads.get(threadId);
    
    // Fetch character directly from DB if thread is associated with one
    let currentCharacter: Character | null = null;
    if (currentThread?.characterId) {
      const char = await getCharacter(currentThread.characterId);
      if (char) {
        currentCharacter = char;
      }
    }

    // ═══ FILE PARSING (RAG) ═══
    let userMessage = trimmed;
    let displayMessage = trimmed;
    
    if (file) {
      // Show user we're processing the file
      displayMessage = `${trimmed}\n\n[📎 Attached: ${file.name}]`;
      
      // Parse the file content
      const parseResult = await parseFile(file);
      
      if (parseResult.success) {
        // Format the message with file context for the AI
        userMessage = formatFileContext(parseResult, trimmed);
      } else {
        // If parsing fails, inform the user
        displayMessage = `${trimmed}\n\n[⚠️ ${file.name} - ${parseResult.error}]`;
        userMessage = displayMessage;
      }
    }

    // Add user message to DB (display version with filename)
    await addMessage(threadId, "user", displayMessage);
    setInputValue("");
    setIsTyping(true);

    // Prepare AI message
    const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.messages.add({
      id: aiMessageId,
      threadId,
      role: "ai",
      content: "",
      timestamp: new Date(),
    });

    // ═══ SYSTEM PROMPT CONSTRUCTION ═══
    // Build the system prompt strictly from character data or use safe default
    let systemPrompt: string;
    
    // If chatting with a character, build an authoritative character prompt
    if (currentCharacter) {
      const parts: string[] = [];
      parts.push(`You are ${currentCharacter.name}.`);
      if (currentCharacter.subtitle) parts.push(currentCharacter.subtitle + '.');
      if (currentCharacter.description) parts.push(currentCharacter.description);
      // Definition is the PRIMARY behavioral instruction set for this character
      if (currentCharacter.definition && currentCharacter.definition.trim()) {
        parts.push('\n\n' + currentCharacter.definition.trim());
      }
      // Enforcement: prevent the model from breaking character
      parts.push(`\n\nIMPORTANT: Stay in character at all times as ${currentCharacter.name}. Never break character, never say you are an AI or a language model. Always respond from the perspective and personality described above.`);
      systemPrompt = parts.join(' ');
    } else {
      // Use user's custom system prompt from settings, or safe default
      systemPrompt = settings.systemPrompt || "You are mine.ai, a private, local-first AI assistant.";
    }

    // ═══ USER PROFILE INJECTION ═══
    const userProfile = await getFlexibleSetting("user_profile", null);
    if (userProfile && !currentCharacter) {
      const profileParts: string[] = [];
      if (userProfile.displayName) profileParts.push(`Name: ${userProfile.displayName}`);
      if (userProfile.role) profileParts.push(`Role: ${userProfile.role}`);
      if (userProfile.bio) profileParts.push(`Context: ${userProfile.bio}`);
      if (userProfile.location) profileParts.push(`Location: ${userProfile.location}`);
      if (profileParts.length > 0) {
        systemPrompt += `\n\n[USER PROFILE]\n${profileParts.join('\n')}`;
      }
    }

    // Prepare message history
    const history = await db.messages
      .where("threadId")
      .equals(threadId)
      .sortBy("timestamp");

    const apiMessages = history
      .filter((m) => m.role !== "ai" || m.content) // Exclude empty AI messages
      .slice(-10) // Last 10 messages for context
      .map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    // Replace the last user message with the RAG-enhanced version
    if (apiMessages.length > 0 && apiMessages[apiMessages.length - 1].role === "user") {
      apiMessages[apiMessages.length - 1].content = userMessage;
    }

    let accumulatedRawContent = "";
    let accumulatedThinking = "";

    // Helper: parse <think> tags from streamed content
    const separateThinkTags = (raw: string): { content: string; thinking: string } => {
      let thinking = '';
      let content = raw;
      // Extract completed <think>...</think> blocks
      content = content.replace(/<think>([\s\S]*?)<\/think>/g, (_, t) => {
        thinking += t;
        return '';
      });
      // Handle unclosed <think> (still streaming thinking)
      const openIdx = content.indexOf('<think>');
      if (openIdx !== -1) {
        thinking += content.slice(openIdx + 7);
        content = content.slice(0, openIdx);
      }
      return { content: content.trim(), thinking: thinking.trim() };
    };

    // Create abort controller for this stream
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setModelStatus("online");
      await streamAIResponse({
        apiUrl: settings.apiUrl,
        modelName: settings.modelName,
        systemPrompt, // Now uses the correct system prompt!
        temperature: settings.temperature,
        topP: settings.top_p,
        contextLength: settings.context_length,
        messages: apiMessages,
        signal: abortController.signal,
        onChunk: (chunk) => {
          accumulatedRawContent += chunk;
          const parsed = separateThinkTags(accumulatedRawContent);
          const mergedThinking = [accumulatedThinking, parsed.thinking].filter(Boolean).join('\n');
          updateMessage(aiMessageId, {
            content: parsed.content,
            ...(mergedThinking ? { thinking: mergedThinking } : {}),
          }).catch((err) => {
            console.error("Failed to update message:", err);
          });
        },
        onThinking: (thinking) => {
          if (settings.thinkingEnabled) {
            accumulatedThinking += thinking;
            updateMessage(aiMessageId, { thinking: accumulatedThinking }).catch((err) => {
              console.error("Failed to update thinking:", err);
            });
          }
        },
        onComplete: () => {
          setIsTyping(false);
          abortControllerRef.current = null;
        },
        onError: (error) => {
          // Don't show error if user manually aborted
          if (error.name === "AbortError") {
            setIsTyping(false);
            abortControllerRef.current = null;
            return;
          }
          console.error("Streaming error:", error);
          setModelStatus("offline");
          updateMessage(aiMessageId, {
            content: `❌ Error: ${error.message}\n\nPlease check your API settings and connection.`,
          }).catch((err) => {
            console.error("Failed to update error message:", err);
          });
          setIsTyping(false);
        },
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setModelStatus("offline");
      await updateMessage(aiMessageId, {
        content: `❌ Unexpected error occurred. Please try again.`,
      }).catch((err) => {
        console.error("Failed to update error message:", err);
      });
      setIsTyping(false);
    }
  }, [isTyping, activeThreadId]); // Removed activeCharacter - now fetched fresh from DB

  const handleClearChat = useCallback(async () => {
    if (!activeThreadId) return;
    if (!confirm("Clear this conversation? This action cannot be undone.")) return;

    await db.messages.where("threadId").equals(activeThreadId).delete();
    
    // Add welcome message
    await addMessage(
      activeThreadId,
      "ai",
      "Conversation cleared. How can I help you?"
    );
  }, [activeThreadId]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
    }
  }, []);

  const handleNewThread = useCallback(async () => {
    const newThread = await createThread();
    setActiveThreadId(newThread.id);
    setInputValue(""); // Clear input for fresh state
    setSidebarOpen(false);
  }, []);

  const handleSelectCharacter = useCallback(async (character: Character) => {
    // Set the active character
    setActiveCharacterId(character.id || null);
    setActiveCharacter(character);
    
    // Create a new thread for this character or get the most recent one
    const existingThreads = await db.threads
      .where("characterId")
      .equals(character.id || 0)
      .reverse()
      .sortBy("updatedAt");
    
    let threadId: string;
    if (existingThreads.length > 0) {
      threadId = existingThreads[0].id;
    } else {
      // Create new character thread
      const newThread = await createCharacterThread(character.id || 0, `Chat with ${character.name}`);
      threadId = newThread.id;
      
      // Add initial greeting if available
      if (character.greetings && character.greetings.length > 0) {
        const greeting = character.greetings[Math.floor(Math.random() * character.greetings.length)];
        await addMessage(threadId, "ai", greeting);
      }
    }
    
    setActiveThreadId(threadId);
    setSidebarOpen(false);
  }, []);

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background" data-glass-bg>
      {/* iOS Safe Area Background Extension */}
      <div className="fixed inset-0 bg-background -z-10" data-glass-bg />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectCharacter={handleSelectCharacter}
        activeCharacterId={activeCharacterId}
      />

      {/* Settings Bottom Sheet */}
      <SettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Character Profile Sheet */}
      <CharacterProfileSheet
        isOpen={characterProfileOpen}
        onClose={() => setCharacterProfileOpen(false)}
        character={activeCharacter}
        onDeleted={() => {
          setActiveCharacterId(null);
          setActiveCharacter(null);
          setActiveThreadId(null);
          setCharacterProfileOpen(false);
        }}
        onUpdated={(updated) => {
          setActiveCharacter(updated);
        }}
      />

      {/* Main Chat Area */}
      <main className="relative flex flex-col flex-1 h-full min-w-0">
        {/* Header with Safe Area */}
        <ChatHeader
          onMenuClick={() => setSidebarOpen(true)}
          onSettingsClick={() => setSettingsOpen(true)}
          onClearChat={handleClearChat}
          modelStatus={modelStatus}
          activeCharacter={activeCharacter}
          onAvatarClick={() => setCharacterProfileOpen(true)}
        />

        {/* Scrollable Messages */}
        <ChatArea 
          threadId={activeThreadId} 
          isTyping={isTyping} 
          bubbleStyle={bubbleStyle as any}
          characterAvatar={activeCharacter?.avatar}
          onSuggestionClick={(text) => handleSend(text)}
        />
        <div ref={scrollRef} />

        {/* Input with Safe Area */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(message, file) => handleSend(message, file)}
          isTyping={isTyping}
          onStop={handleStop}
        />
      </main>
    </div>
  );
}
