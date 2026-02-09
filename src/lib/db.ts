import Dexie, { type EntityTable } from "dexie";

// ─── Type Definitions ────────────────────────────────────────────
export interface Thread {
  id: string;
  title: string;
  updatedAt: Date;
  archived?: boolean;
  characterId?: number; // Optional: Link to a character for character-specific chats
}

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "ai";
  content: string;
  thinking?: string;
  timestamp: Date;
}

export interface Character {
  id?: number; // Auto-increment primary key
  name: string;
  avatar: string; // Base64 encoded image or blob URL
  description: string; // Short bio
  subtitle: string; // Tag line
  definition: string; // Long prompt (max 32k chars)
  greetings: string[]; // Array of greeting messages
  useAiGreeting: boolean; // Whether to use AI-generated greetings for new chats
  createdAt: Date;
  updatedAt: Date;
}

export interface Setting {
  key: string;
  value: any;
}

// ─── Database Class ──────────────────────────────────────────────
class MineAIDatabase extends Dexie {
  threads!: EntityTable<Thread, "id">;
  messages!: EntityTable<Message, "id">;
  settings!: EntityTable<Setting, "key">;
  characters!: EntityTable<Character, "id">;

  constructor() {
    super("MineAIDatabase");
    
    // Version 1: Initial schema
    this.version(1).stores({
      threads: "id, updatedAt",
      messages: "id, threadId, timestamp",
      settings: "key",
    });
    
    // Version 2: Add characters table and characterId to threads
    this.version(2).stores({
      threads: "id, updatedAt, characterId",
      messages: "id, threadId, timestamp",
      settings: "key",
      characters: "++id, name, createdAt, updatedAt",
    });
  }
}

// ─── Database Instance ───────────────────────────────────────────
export const db = new MineAIDatabase();

// ─── Default Settings ────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  apiUrl: "http://localhost:11434",
  modelName: "llama2",
  systemPrompt: "You are a helpful AI assistant named mine.ai. Be concise, clear, and friendly.",
  temperature: 0.7,
  top_p: 1.0,
  thinkingEnabled: true,
  haptic_enabled: true,
  spelling_enabled: true,
  accent_color: "#3b82f6",
  appearance: "System",
  security_biometric: false,
  incognito_active: false,
  sys_enabled: false,
  sys_enabled_llama3: false,
  sys_enabled_mistral: false,
  sys_enabled_gemma: false,
  sys_prompt_llama3: "You are a helpful AI assistant named mine.ai. Be concise, clear, and friendly.",
  sys_prompt_mistral: "You are a helpful AI assistant named mine.ai. Be concise, clear, and friendly.",
  sys_prompt_gemma: "You are a helpful AI assistant named mine.ai. Be concise, clear, and friendly.",
  font_size_modifier: "medium" as "small" | "medium" | "large",
  notifications_enabled: true,
  bubble_style: "default" as "default" | "modern" | "compact",
  theme_mode: "dark" as "dark" | "light" | "system",
  context_length: 4096,
  auto_lock_timeout: 5,
  user_email: "",
  subscription_tier: "Free Plan",
  app_language: "English",
  wallpaper_url: "",
  glass_mode: false,
  theme_preset: "default",
};

// ─── Settings Helper Functions ───────────────────────────────────
export async function getSetting<K extends keyof typeof DEFAULT_SETTINGS>(
  key: K
): Promise<typeof DEFAULT_SETTINGS[K]> {
  const setting = await db.settings.get(key);
  return setting?.value ?? DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends keyof typeof DEFAULT_SETTINGS>(
  key: K,
  value: typeof DEFAULT_SETTINGS[K]
): Promise<void> {
  await db.settings.put({ key, value });
}

// ─── Flexible Settings (for dynamic model-specific keys) ────────
export async function getFlexibleSetting(key: string, defaultValue?: any): Promise<any> {
  const setting = await db.settings.get(key);
  return setting?.value ?? defaultValue;
}

export async function setFlexibleSetting(key: string, value: any): Promise<void> {
  await db.settings.put({ key, value });
}

// Debug function to inspect all settings
export async function debugAllSettings(): Promise<Record<string, any>> {
  const all = await db.settings.toArray();
  const map = all.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, any>);
  return map;
}

export async function getAllSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const settings = await db.settings.toArray();
  const settingsMap = settings.reduce((acc, { key, value }) => {
    acc[key as keyof typeof DEFAULT_SETTINGS] = value;
    return acc;
  }, {} as Partial<typeof DEFAULT_SETTINGS>);
  
  return { ...DEFAULT_SETTINGS, ...settingsMap };
}

// ─── Thread Helper Functions ─────────────────────────────────────
export async function createThread(title: string = "New Chat"): Promise<Thread> {
  const thread: Thread = {
    id: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    updatedAt: new Date(),
  };
  await db.threads.add(thread);
  return thread;
}

export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  await db.threads.update(threadId, { title, updatedAt: new Date() });
}

export async function deleteThread(threadId: string): Promise<void> {
  await db.transaction("rw", [db.threads, db.messages], async () => {
    await db.threads.delete(threadId);
    await db.messages.where("threadId").equals(threadId).delete();
  });
}

export async function toggleArchiveThread(threadId: string): Promise<void> {
  const thread = await db.threads.get(threadId);
  if (thread) {
    await db.threads.update(threadId, { archived: !thread.archived, updatedAt: new Date() });
  }
}

export async function touchThread(threadId: string): Promise<void> {
  await db.threads.update(threadId, { updatedAt: new Date() });
}

// ─── Message Helper Functions ────────────────────────────────────
export async function addMessage(
  threadId: string,
  role: "user" | "ai",
  content: string,
  thinking?: string
): Promise<Message> {
  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    threadId,
    role,
    content,
    thinking,
    timestamp: new Date(),
  };
  await db.messages.add(message);
  await touchThread(threadId);
  
  // Auto-generate thread title from first user message
  const messages = await db.messages.where("threadId").equals(threadId).toArray();
  if (messages.length === 1 && role === "user") {
    const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    await updateThreadTitle(threadId, title);
  }
  
  return message;
}

export async function updateMessage(
  messageId: string,
  updates: Partial<Pick<Message, "content" | "thinking">>
): Promise<void> {
  await db.messages.update(messageId, updates);
}

export async function getThreadMessages(threadId: string): Promise<Message[]> {
  return db.messages
    .where("threadId")
    .equals(threadId)
    .sortBy("timestamp");
}

// ─── Character Helper Functions ──────────────────────────────────
export async function createCharacter(
  data: Omit<Character, "id" | "createdAt" | "updatedAt">
): Promise<Character> {
  const character: Omit<Character, "id"> = {
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const id = await db.characters.add(character as Character);
  return { ...character, id } as Character;
}

export async function updateCharacter(
  id: number,
  updates: Partial<Omit<Character, "id" | "createdAt">>
): Promise<void> {
  await db.characters.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteCharacter(id: number): Promise<void> {
  await db.transaction("rw", [db.characters, db.threads, db.messages], async () => {
    // Get all threads associated with this character
    const threads = await db.threads.where("characterId").equals(id).toArray();
    
    // Delete all messages in those threads
    for (const thread of threads) {
      await db.messages.where("threadId").equals(thread.id).delete();
    }
    
    // Delete all threads associated with this character
    await db.threads.where("characterId").equals(id).delete();
    
    // Delete the character
    await db.characters.delete(id);
  });
}

export async function getCharacter(id: number): Promise<Character | undefined> {
  return db.characters.get(id);
}

export async function getAllCharacters(): Promise<Character[]> {
  return db.characters.orderBy("updatedAt").reverse().toArray();
}

export async function getCharacterThreads(characterId: number): Promise<Thread[]> {
  return db.threads
    .where("characterId")
    .equals(characterId)
    .reverse()
    .sortBy("updatedAt");
}

// Helper to create a thread for a specific character
export async function createCharacterThread(
  characterId: number,
  title: string = "New Chat"
): Promise<Thread> {
  const thread: Thread = {
    id: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    updatedAt: new Date(),
    characterId,
  };
  await db.threads.add(thread);
  return thread;
}

// ─── Initialization ──────────────────────────────────────────────
export async function initializeDatabase(): Promise<void> {
  // Check if we have any threads
  const threadCount = await db.threads.count();
  
  if (threadCount === 0) {
    // Create a welcome thread
    const welcomeThread = await createThread("Welcome to mine.ai");
    await addMessage(
      welcomeThread.id,
      "ai",
      "Hello! I'm mine.ai, your personal privacy-focused AI assistant. All your conversations are stored locally on your device—nothing is sent to any server except the AI endpoint you configure.\n\nTo get started:\n1. Tap the settings icon to configure your AI endpoint\n2. Test the connection to make sure it works\n3. Start chatting!\n\nHow can I help you today?"
    );
  }
  
  // Ensure default settings exist
  await getAllSettings();
}
