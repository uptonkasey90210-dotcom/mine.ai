"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Mail,
  PlusSquare,
  ArrowUpCircle,
  Bell,
  Database,
  Archive,
  Shield,
  Globe,
  Moon,
  Palette,
  Smartphone,
  Type,
  Bug,
  HelpCircle,
  FileText,
  Lock,
  LogOut,
  Check,
  Brain,
  Server,
  MessageSquare,
  Download,
  Trash2,
  Fingerprint,
  Eye,
  EyeOff,
  Clock,
  Key,
} from "lucide-react";
import { db, getSetting, setSetting, getAllSettings, toggleArchiveThread, deleteThread, getFlexibleSetting, setFlexibleSetting, debugAllSettings } from "@/lib/db";
import { fetchModels } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────
type Screen = "root" | "security" | "data" | "about" | "ai" | "appearance" | "archived";
type ModelType = "default" | string;
type BubbleStyle = "default" | "modern" | "compact";

// ─── Bubble Style Options ────────────────────────────────────────
const BUBBLE_STYLE_OPTIONS = [
  { id: "default" as BubbleStyle, name: "Default" },
  { id: "modern" as BubbleStyle, name: "Modern" },
  { id: "compact" as BubbleStyle, name: "Compact" },
];

// ─── Accent Colors ───────────────────────────────────────────────
const ACCENT_COLORS = [
  { name: "Blue", hex: "#3b82f6", class: "bg-blue-500" },
  { name: "Green", hex: "#22c55e", class: "bg-green-500" },
  { name: "Orange", hex: "#f97316", class: "bg-orange-500" },
  { name: "Pink", hex: "#ec4899", class: "bg-pink-500" },
  { name: "Purple", hex: "#a855f7", class: "bg-purple-500" },
];

// ─── Export User Data ────────────────────────────────────────────
async function exportUserData() {
  try {
    const threads = await db.threads.toArray();
    const messages = await db.messages.toArray();
    const settings = await db.settings.toArray();

    const exportData = {
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      data: {
        threads,
        messages,
        settings,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mine-ai-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("Export failed:", error);
    return false;
  }
}

// ─── iOS Toggle ──────────────────────────────────────────────────
function IOSToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-green-500" : "bg-zinc-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[27px] w-[27px] rounded-full bg-white shadow-lg transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────
function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="mb-1.5 px-4 text-sm font-medium text-zinc-500">
          {title}
        </h3>
      )}
      <div className="mx-0 overflow-hidden rounded-xl bg-zinc-900/80">
        {children}
      </div>
      {footer && (
        <p className="mt-1.5 px-4 text-xs text-zinc-500 leading-relaxed">
          {footer}
        </p>
      )}
    </div>
  );
}

// ─── Row (nav / info / toggle) ───────────────────────────────────
function Row({
  icon,
  label,
  value,
  onClick,
  toggle,
  toggleValue,
  onToggle,
  isLast = false,
  destructive = false,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  isLast?: boolean;
  destructive?: boolean;
}) {
  const content = (
    <div
      className={`flex min-h-[48px] items-center gap-3 px-4 py-3 ${
        !isLast ? "border-b border-zinc-800/60" : ""
      }`}
    >
      {icon && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400">
          {icon}
        </span>
      )}
      <span
        className={`flex-1 text-[16px] ${destructive ? "text-red-400" : "text-zinc-100"}`}
      >
        {label}
      </span>
      {toggle && onToggle && (
        <IOSToggle checked={toggleValue ?? false} onChange={onToggle} />
      )}
      {!toggle && value && (
        <span className="text-[15px] text-zinc-500">{value}</span>
      )}
      {!toggle && onClick && (
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
      )}
    </div>
  );

  if (onClick && !toggle) {
    return (
      <button
        type="button"
        className="w-full text-left active:bg-zinc-800/60 transition-colors"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return content;
}

// ─── Sub-page header ─────────────────────────────────────────────
function SubHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <div className="relative flex h-14 items-center justify-center px-4 border-b border-zinc-800/40">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 active:bg-zinc-800"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h2 className="text-[17px] font-semibold text-zinc-100">{title}</h2>
      {rightAction && <div className="absolute right-3">{rightAction}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-screens
// ═══════════════════════════════════════════════════════════════

function AISettingsScreen({ onBack }: { onBack: () => void }) {
  const settings = useLiveQuery(() => getAllSettings());
  const [localApiUrl, setLocalApiUrl] = useState("");
  const [localModelName, setLocalModelName] = useState("");
  const [localTemperature, setLocalTemperature] = useState(0.7);
  const [localThinking, setLocalThinking] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  useEffect(() => {
    if (settings) {
      setLocalApiUrl(settings.apiUrl);
      setLocalModelName(settings.modelName);
      setLocalTemperature(settings.temperature);
      setLocalThinking(settings.thinkingEnabled);
    }
  }, [settings]);

  // Fetch models when API URL changes
  useEffect(() => {
    if (!localApiUrl) return;

    const fetchAvailableModels = async () => {
      setIsFetchingModels(true);
      const result = await fetchModels(localApiUrl);
      setIsFetchingModels(false);
      
      if (result.success && result.models.length > 0) {
        setAvailableModels(result.models);
      } else {
        setAvailableModels([]);
      }
    };

    const debounce = setTimeout(fetchAvailableModels, 500);
    return () => clearTimeout(debounce);
  }, [localApiUrl]);

  const handleTestConnection = async () => {
    if (!localApiUrl) {
      alert("Please enter an API URL first.");
      return;
    }

    setConnectionStatus("testing");

    try {
      const result = await fetchModels(localApiUrl);

      if (result.success) {
        setConnectionStatus("success");
        if (result.models.length > 0) {
          setAvailableModels(result.models);
        }
      } else {
        console.error("Connection test failed:", result.error);
        setConnectionStatus("error");
      }
      setTimeout(() => setConnectionStatus("idle"), 3000);
    } catch (error) {
      console.error("Connection test error:", error);
      setConnectionStatus("error");
      setTimeout(() => setConnectionStatus("idle"), 3000);
    }
  };

  const handleSave = async () => {
    await setSetting("apiUrl", localApiUrl);
    await setSetting("modelName", localModelName);
    await setSetting("temperature", localTemperature);
    await setSetting("thinkingEnabled", localThinking);
    onBack();
  };

  if (!settings) return null;

  return (
    <div className="flex h-full flex-col">
      <SubHeader
        title="AI Configuration"
        onBack={onBack}
        rightAction={
          <button
            type="button"
            onClick={handleSave}
            className="flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-[15px] text-zinc-300 active:bg-zinc-800"
          >
            Save
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <Section title="API Endpoint">
          <div className="px-4 py-3">
            <input
              type="text"
              value={localApiUrl}
              onChange={(e) => setLocalApiUrl(e.target.value)}
              placeholder="http://192.168.1.100:11434"
              className="w-full bg-transparent text-[15px] text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={connectionStatus === "testing" || !localApiUrl}
              className={`w-full rounded-lg px-4 py-2.5 text-[14px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                connectionStatus === "success"
                  ? "bg-green-600 text-white"
                  : connectionStatus === "error"
                  ? "bg-red-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {connectionStatus === "testing" && "Testing Connection..."}
              {connectionStatus === "success" && "✅ Connected Successfully"}
              {connectionStatus === "error" && "❌ Connection Failed"}
              {connectionStatus === "idle" && "Test Connection"}
            </button>
          </div>
        </Section>

        <Section
          title="Model Name"
          footer={isFetchingModels ? "Fetching available models..." : availableModels.length > 0 ? `${availableModels.length} models available` : "Enter API URL to fetch models"}
        >
          <div className="px-4 py-3">
            {availableModels.length > 0 ? (
              <select
                value={localModelName}
                onChange={(e) => setLocalModelName(e.target.value)}
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-[15px] text-zinc-200 outline-none border border-zinc-700"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={localModelName}
                onChange={(e) => setLocalModelName(e.target.value)}
                placeholder="llama2"
                className="w-full bg-transparent text-[15px] text-zinc-200 outline-none placeholder:text-zinc-600"
                disabled={isFetchingModels}
              />
            )}
          </div>
        </Section>

        <Section title="Temperature" footer={`Current: ${localTemperature}`}>
          <div className="px-4 py-3">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localTemperature}
              onChange={(e) => setLocalTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </Section>

        <Section title="Features">
          <Row
            icon={<Brain className="h-5 w-5" />}
            label="Show thinking process"
            toggle
            toggleValue={localThinking}
            onToggle={setLocalThinking}
            isLast
          />
        </Section>
      </div>
    </div>
  );
}

function SecurityScreen({ onBack }: { onBack: () => void }) {
  const biometricEnabled = useLiveQuery(() => getSetting("security_biometric"));
  const incognitoActive = useLiveQuery(() => getSetting("incognito_active"));
  const autoLockTimeout = useLiveQuery(() => getSetting("auto_lock_timeout"));

  const handleBiometricToggle = async (value: boolean) => {
    await setSetting("security_biometric", value);
    if (value) {
      alert("🔐 Biometric authentication enabled.\n\nNote: This is a UI demo. In a production app, this would integrate with device biometrics (FaceID/TouchID).");
    }
  };

  const handleIncognitoToggle = async (value: boolean) => {
    await setSetting("incognito_active", value);
    if (value) {
      alert("🕵️ Incognito Mode enabled.\n\nYour conversations won't be saved to history until you disable this mode.");
    }
  };

  const handleAutoLockChange = async () => {
    const options = ["1 minute", "5 minutes", "15 minutes", "30 minutes", "Never"];
    const timeoutMap: Record<string, number> = {
      "1 minute": 1,
      "5 minutes": 5,
      "15 minutes": 15,
      "30 minutes": 30,
      "Never": 0,
    };

    const current = autoLockTimeout || 5;
    const currentLabel = current === 0 ? "Never" : `${current} minute${current > 1 ? "s" : ""}`;

    const selection = prompt(`Select auto-lock timeout:\n\n${options.join("\n")}\n\nCurrent: ${currentLabel}`);
    
    if (selection && timeoutMap[selection] !== undefined) {
      await setSetting("auto_lock_timeout", timeoutMap[selection]);
    }
  };

  const handleChangePasscode = async () => {
    alert("🔑 Change Passcode\n\nIn a production app, this would:\n1. Verify current passcode\n2. Prompt for new passcode\n3. Confirm new passcode\n4. Update secure storage");
  };

  return (
    <div className="flex h-full flex-col">
      <SubHeader title="Security & Privacy" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <Section title="Authentication">
          <Row
            icon={<Fingerprint className="h-5 w-5" />}
            label="Require FaceID/TouchID"
            toggle
            toggleValue={biometricEnabled ?? false}
            onToggle={handleBiometricToggle}
            isLast
          />
        </Section>

        <Section
          title="Privacy"
          footer="Incognito mode prevents conversations from being saved to your history."
        >
          <Row
            icon={<EyeOff className="h-5 w-5" />}
            label="Incognito Mode"
            toggle
            toggleValue={incognitoActive ?? false}
            onToggle={handleIncognitoToggle}
            isLast
          />
        </Section>

        <Section title="App Lock">
          <Row
            icon={<Clock className="h-5 w-5" />}
            label="Auto-lock timeout"
            value={`${autoLockTimeout || 5} min`}
            onClick={handleAutoLockChange}
          />
          <Row
            icon={<Key className="h-5 w-5" />}
            label="Change passcode"
            onClick={handleChangePasscode}
            isLast
          />
        </Section>
      </div>
    </div>
  );
}

function DataScreen({ onBack }: { onBack: () => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    const success = await exportUserData();
    setIsExporting(false);
    
    if (success) {
      alert("✅ Data exported successfully!\n\nCheck your downloads folder for the backup file.");
    } else {
      alert("❌ Export failed.\n\nPlease try again or check the console for errors.");
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("⚠️ DELETE ALL DATA?\n\nThis will permanently delete:\n• All conversations\n• All messages\n• All settings\n\nThis action cannot be undone!")) {
      return;
    }

    const confirmText = prompt("Type 'DELETE' to confirm:");
    if (confirmText !== "DELETE") {
      alert("Deletion cancelled.");
      return;
    }

    setIsDeleting(true);
    try {
      await db.threads.clear();
      await db.messages.clear();
      await db.settings.clear();
      alert("All data deleted successfully. The app will now reload.");
      window.location.reload();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete data. Please try again.");
      setIsDeleting(false);
    }
  };

  const handleDeleteHistory = async () => {
    if (!confirm("🗑️ Delete all conversation history?\n\nThis will delete all threads and messages but keep your settings.\n\nContinue?")) {
      return;
    }

    try {
      await db.threads.clear();
      await db.messages.clear();
      alert("✅ Conversation history deleted successfully.");
      onBack();
    } catch (error) {
      console.error("Delete history failed:", error);
      alert("❌ Failed to delete history. Please try again.");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <SubHeader title="Data Controls" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <Section title="Export">
          <Row
            icon={<Download className="h-5 w-5" />}
            label={isExporting ? "Exporting..." : "Export all data"}
            onClick={isExporting ? undefined : handleExport}
            isLast
          />
        </Section>
        <p className="mb-6 -mt-4 px-4 text-xs text-zinc-500 leading-relaxed">
          Download a complete backup of your conversations, messages, and settings as a JSON file.
        </p>

        <Section title="Delete">
          <Row
            icon={<Archive className="h-5 w-5" />}
            label="Delete conversation history"
            onClick={handleDeleteHistory}
            destructive
          />
          <Row
            icon={<Trash2 className="h-5 w-5" />}
            label={isDeleting ? "Deleting..." : "Delete all data"}
            onClick={isDeleting ? undefined : handleDeleteAll}
            destructive
            isLast
          />
        </Section>
        <p className="mb-6 -mt-4 px-4 text-xs text-zinc-500 leading-relaxed">
          Permanently delete your data. This action cannot be undone.
        </p>

        <Section title="Storage">
          <div className="px-4 py-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[14px] text-zinc-400">Total conversations</span>
              <span className="text-[14px] text-zinc-300">
                {useLiveQuery(() => db.threads.count()) ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-zinc-400">Total messages</span>
              <span className="text-[14px] text-zinc-300">
                {useLiveQuery(() => db.messages.count()) ?? 0}
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  const handleReportBug = () => {
    const subject = encodeURIComponent("mine.ai Bug Report");
    const body = encodeURIComponent(
      "Please describe the bug you encountered:\n\n" +
      "Steps to reproduce:\n1. \n2. \n3. \n\n" +
      "Expected behavior:\n\n" +
      "Actual behavior:\n\n" +
      `App Version: 1.0.0\n` +
      `Browser: ${navigator.userAgent}`
    );
    window.open(`mailto:support@mine-ai.app?subject=${subject}&body=${body}`, "_blank");
  };

  const handleHelpCenter = () => {
    alert("📚 Help Center\n\nOpening help documentation...\n\nIn a production app, this would link to:\nhttps://help.mine-ai.app");
  };

  const handleTermsOfUse = () => {
    alert("📜 Terms of Use\n\nOpening terms of service...\n\nIn a production app, this would link to:\nhttps://mine-ai.app/terms");
  };

  const handlePrivacyPolicy = () => {
    alert("🔒 Privacy Policy\n\nOpening privacy policy...\n\nIn a production app, this would link to:\nhttps://mine-ai.app/privacy");
  };

  return (
    <div className="flex h-full flex-col">
      <SubHeader title="About" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <Section title="Support & Legal">
          <Row icon={<Bug className="h-5 w-5" />} label="Report bug" onClick={handleReportBug} />
          <Row
            icon={<HelpCircle className="h-5 w-5" />}
            label="Help Center"
            onClick={handleHelpCenter}
          />
          <Row
            icon={<FileText className="h-5 w-5" />}
            label="Terms of Use"
            onClick={handleTermsOfUse}
          />
          <Row
            icon={<Lock className="h-5 w-5" />}
            label="Privacy Policy"
            onClick={handlePrivacyPolicy}
          />
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600" />
            </span>
            <div className="flex flex-col">
              <span className="text-[16px] text-zinc-100">mine.ai</span>
              <span className="text-[13px] text-zinc-500">Version 1.0.0</span>
            </div>
          </div>
        </Section>

        <Section title="About mine.ai">
          <div className="px-4 py-3">
            <p className="text-[14px] text-zinc-400 leading-relaxed mb-3">
              mine.ai is a privacy-first, local-first AI chat application. All your conversations are stored locally in your browser using IndexedDB.
            </p>
            <p className="text-[14px] text-zinc-400 leading-relaxed">
              Built with Next.js, Dexie.js, and Tailwind CSS. Designed for users who value privacy and control over their data.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function ArchivedScreen({ onBack }: { onBack: () => void }) {
  const archivedThreads = useLiveQuery(async () => {
    const threads = await db.threads.toArray();
    return threads.filter(t => t.archived === true).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });

  const handleUnarchive = async (threadId: string) => {
    await toggleArchiveThread(threadId);
  };

  const handleDelete = async (threadId: string) => {
    if (confirm("Delete this archived conversation? This action cannot be undone.")) {
      await deleteThread(threadId);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <SubHeader title="Archived Chats" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {!archivedThreads || archivedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Archive className="h-12 w-12 text-zinc-700 mb-3" />
            <p className="text-zinc-400 text-[15px]">No archived conversations</p>
            <p className="text-zinc-600 text-[13px] mt-1">Archived chats will appear here</p>
          </div>
        ) : (
          <Section title={`${archivedThreads.length} Archived ${archivedThreads.length === 1 ? 'Chat' : 'Chats'}`}>
            {archivedThreads.map((thread, index) => (
              <div
                key={thread.id}
                className={`flex items-center gap-3 px-4 py-3 ${index !== archivedThreads.length - 1 ? "border-b border-zinc-800/40" : ""}`}
              >
                <MessageSquare className="h-5 w-5 text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] text-zinc-300 truncate">{thread.title}</p>
                  <p className="text-[13px] text-zinc-600">
                    {new Date(thread.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUnarchive(thread.id)}
                    className="text-[13px] text-blue-400 hover:text-blue-300 px-2 py-1"
                  >
                    Unarchive
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(thread.id)}
                    className="text-[13px] text-red-400 hover:text-red-300 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const accentColor = useLiveQuery(() => getSetting("accent_color"));
  const appearance = useLiveQuery(() => getSetting("appearance"));
  const textSize = useLiveQuery(() => getSetting("font_size_modifier"));
  const bubbleStyle = useLiveQuery(() => getSetting("bubble_style"));

  const handleColorSelect = async (hex: string) => {
    await setSetting("accent_color", hex);
    // Apply to multiple CSS variables for better theme support
    document.documentElement.style.setProperty("--accent-color", hex);
    document.documentElement.style.setProperty("--primary", hex);
    document.documentElement.style.setProperty("--ring", hex);
  };

  const handleBubbleStyleChange = async (style: "default" | "modern" | "compact") => {
    await setSetting("bubble_style", style);
  };

  const handleAppearanceChange = async (value: string) => {
    await setSetting("appearance", value);
  };

  const handleTextSizeChange = async (size: "small" | "medium" | "large") => {
    await setSetting("font_size_modifier", size);
    // Apply text size to document root
    const sizeMap = { small: "14px", medium: "16px", large: "18px" };
    document.documentElement.style.fontSize = sizeMap[size] || "16px";
  };

  // Apply text size on load
  useEffect(() => {
    if (textSize) {
      const sizeMap = { small: "14px", medium: "16px", large: "18px" };
      document.documentElement.style.fontSize = sizeMap[textSize as keyof typeof sizeMap] || "16px";
    }
  }, [textSize]);

  return (
    <div className="flex h-full flex-col">
      <SubHeader title="Appearance" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <Section title="Theme">
          <div className="px-4 py-3">
            <select
              value={appearance || "System"}
              onChange={(e) => handleAppearanceChange(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-[15px] text-zinc-200 outline-none border border-zinc-700"
            >
              <option>System</option>
              <option>Light</option>
              <option>Dark</option>
            </select>
          </div>
        </Section>

        <Section
          title="Accent Color"
          footer="Choose your preferred accent color for buttons and highlights."
        >
          <div className="px-4 py-6">
            <div className="flex items-center justify-center gap-6">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => handleColorSelect(color.hex)}
                  className="relative flex flex-col items-center gap-2 group"
                >
                  <div
                    className={`w-14 h-14 rounded-full ${color.class} flex items-center justify-center transition-all group-hover:scale-110 ${
                      accentColor === color.hex ? "ring-2 ring-zinc-100 ring-offset-2 ring-offset-zinc-950" : ""
                    }`}
                  >
                    {accentColor === color.hex && (
                      <Check className="h-6 w-6 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Text Size">
          <div className="px-4 py-3">
            <select
              value={textSize || "medium"}
              onChange={(e) => handleTextSizeChange(e.target.value as "small" | "medium" | "large")}
              className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-[15px] text-zinc-200 outline-none border border-zinc-700"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </Section>

        <Section title="Message Bubble Style" footer="Choose how your chat messages appear">
          <div className="px-4 py-3">
            <select
              value={bubbleStyle || "default"}
              onChange={(e) => handleBubbleStyleChange(e.target.value as "default" | "modern" | "compact")}
              className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-[15px] text-zinc-200 outline-none border border-zinc-700"
            >
              {BUBBLE_STYLE_OPTIONS.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main settings modal
// ═══════════════════════════════════════════════════════════════

export function SettingsSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("root");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load settings from DB (only for root screen toggles)
  const hapticEnabled = useLiveQuery(() => getSetting("haptic_enabled"));
  const spellingEnabled = useLiveQuery(() => getSetting("spelling_enabled"));
  const notificationsEnabled = useLiveQuery(() => getSetting("notifications_enabled"));
  const accentColor = useLiveQuery(() => getSetting("accent_color"));
  const apiUrl = useLiveQuery(() => getSetting("apiUrl"));
  const userEmail = useLiveQuery(() => getSetting("user_email"));
  const subscriptionTier = useLiveQuery(() => getSetting("subscription_tier"));
  const appLanguage = useLiveQuery(() => getSetting("app_language"));

  // Fetch available models when API URL is set
  useEffect(() => {
    const fetchAvailableModels = async () => {
      if (!apiUrl) return;
      const result = await fetchModels(apiUrl);
      if (result.success && result.models.length > 0) {
        setAvailableModels(result.models);
      }
    };
    fetchAvailableModels();
  }, [apiUrl]);

  // Apply accent color on load and when it changes
  useEffect(() => {
    if (accentColor) {
      document.documentElement.style.setProperty("--accent-color", accentColor);
      document.documentElement.style.setProperty("--primary", accentColor);
      document.documentElement.style.setProperty("--ring", accentColor);
    }
  }, [accentColor]);

  const handleHapticToggle = async (value: boolean) => {
    await setSetting("haptic_enabled", value);
  };

  const handleSpellingToggle = async (value: boolean) => {
    await setSetting("spelling_enabled", value);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    await setSetting("notifications_enabled", value);
  };

  const handleEmailClick = async () => {
    const email = prompt("Enter your email:", userEmail || "");
    if (email !== null) {
      await setSetting("user_email", email);
    }
  };

  const handleSubscriptionClick = () => {
    alert(`📱 Current Plan: ${subscriptionTier || "Free Plan"}\n\nIn a production app, this would show:\n• Current plan details\n• Usage statistics\n• Billing history\n• Plan management options`);
  };

  const handleUpgradeToPro = () => {
    alert("🚀 Upgrade to Pro\n\nPro Features:\n• Unlimited conversations\n• Priority model access\n• Advanced customization\n• Priority support\n\nIn a production app, this would open the subscription flow.");
  };

  const handleLanguageClick = async () => {
    const languages = ["English", "Spanish", "French", "German", "Japanese", "Chinese"];
    const selection = prompt(`Select language:\n\n${languages.join("\n")}\n\nCurrent: ${appLanguage || "English"}`);
    
    if (selection && languages.includes(selection)) {
      await setSetting("app_language", selection);
    }
  };

  // Reset to root when closing
  useEffect(() => {
    if (!isOpen) {
      setScreen("root");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      {/* modal container */}
      <div className="relative z-10 flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-zinc-950 sm:h-[85vh] sm:rounded-3xl">
        {screen === "ai" && <AISettingsScreen onBack={() => setScreen("root")} />}
        {screen === "security" && <SecurityScreen onBack={() => setScreen("root")} />}
        {screen === "data" && <DataScreen onBack={() => setScreen("root")} />}
        {screen === "about" && <AboutScreen onBack={() => setScreen("root")} />}
        {screen === "archived" && <ArchivedScreen onBack={() => setScreen("root")} />}
        {screen === "appearance" && <AppearanceScreen onBack={() => setScreen("root")} />}

        {screen === "root" && (
          <>
            {/* header */}
            <div className="relative flex h-14 shrink-0 items-center justify-center border-b border-zinc-800/40">
              <h2 className="text-[17px] font-semibold text-zinc-100">
                Settings
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 active:bg-zinc-800"
                aria-label="Close settings"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
              {/* ── AI Configuration ──────────────────── */}
              <Section title="AI Configuration">
                <Row
                  icon={<Server className="h-5 w-5" />}
                  label="API & Model"
                  onClick={() => setScreen("ai")}
                  isLast
                />
              </Section>

              {/* ── Appearance & Preferences ─────────── */}
              <Section title="Appearance & Preferences">
                <Row
                  icon={<Palette className="h-5 w-5" />}
                  label="Appearance"
                  onClick={() => setScreen("appearance")}
                />
                <Row
                  icon={<Smartphone className="h-5 w-5" />}
                  label="Haptic feedback"
                  toggle
                  toggleValue={hapticEnabled ?? true}
                  onToggle={handleHapticToggle}
                />
                <Row
                  icon={<Type className="h-5 w-5" />}
                  label="Correct spelling automatically"
                  toggle
                  toggleValue={spellingEnabled ?? true}
                  onToggle={handleSpellingToggle}
                />
                <Row
                  icon={<Globe className="h-5 w-5" />}
                  label="App language"
                  value={appLanguage || "English"}
                  onClick={handleLanguageClick}
                  isLast
                />
              </Section>

              {/* ── Privacy & Security ───────────────── */}
              <Section title="Privacy & Security">
                <Row
                  icon={<Shield className="h-5 w-5" />}
                  label="Security"
                  onClick={() => setScreen("security")}
                />
                <Row
                  icon={<Database className="h-5 w-5" />}
                  label="Data controls"
                  onClick={() => setScreen("data")}
                  isLast
                />
              </Section>

              {/* ── Account ─────────────────────────── */}
              <Section title="Account">
                <Row 
                  icon={<Mail className="h-5 w-5" />} 
                  label="Email" 
                  value={userEmail || "Not set"}
                  onClick={handleEmailClick} 
                />
                <Row
                  icon={<PlusSquare className="h-5 w-5" />}
                  label="Subscription"
                  value={subscriptionTier || "Free Plan"}
                  onClick={handleSubscriptionClick}
                />
                <Row
                  icon={<ArrowUpCircle className="h-5 w-5" />}
                  label="Upgrade to Pro"
                  onClick={handleUpgradeToPro}
                />
                <Row
                  icon={<Bell className="h-5 w-5" />}
                  label="Notifications"
                  toggle
                  toggleValue={notificationsEnabled ?? true}
                  onToggle={handleNotificationsToggle}
                />
                <Row
                  icon={<Archive className="h-5 w-5" />}
                  label="Archived chats"
                  onClick={() => setScreen("archived")}
                  isLast
                />
              </Section>

              {/* ── About ───────────────────────────── */}
              <Section title="About">
                <Row
                  icon={<HelpCircle className="h-5 w-5" />}
                  label="About mine.ai"
                  onClick={() => setScreen("about")}
                  isLast
                />
              </Section>

              {/* ── Danger Zone ─────────────────────── */}
              <div className="overflow-hidden rounded-xl bg-zinc-900/80">
                <Row
                  icon={<LogOut className="h-5 w-5" />}
                  label="Clear all data"
                  onClick={() => {
                    if (confirm("🗑️ Delete all threads and messages?\n\nYour settings will be preserved.\n\nContinue?")) {
                      db.threads.clear();
                      db.messages.clear();
                      alert("✅ All conversations cleared.");
                      onClose();
                    }
                  }}
                  destructive
                  isLast
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
