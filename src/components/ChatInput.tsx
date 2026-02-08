import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Send, Paperclip, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, file?: File) => void;
  isTyping: boolean;
}

// Extend Window interface for webkit speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// Speech recognition types (browser APIs don't have official TypeScript types)
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    item(index: number): { transcript: string; confidence: number }[];
    [index: number]: { transcript: string; confidence: number }[];
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

export function ChatInput({ value, onChange, onSubmit, isTyping }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const valueRef = useRef(value);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const MAX_ROWS = 4;
  const LINE_HEIGHT = 20;
  const MAX_HEIGHT = LINE_HEIGHT * MAX_ROWS;

  // Keep valueRef in sync with prop
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          // Use ref for current value to avoid stale closure
          onChange(valueRef.current + transcript);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!value.trim() && !selectedFile) return;
    onSubmit(value, selectedFile || undefined);
    setSelectedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Auto-grow textarea up to MAX_ROWS
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
  }, [value, MAX_HEIGHT]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-black/60 backdrop-blur-xl border-t border-zinc-800/40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {/* File Pill */}
      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/60 rounded-full text-[12px] text-zinc-300"
        >
          <Paperclip size={12} className="text-zinc-500" />
          <span className="max-w-[200px] truncate">{selectedFile.name}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="p-0.5 rounded-full hover:bg-zinc-700/60 transition-colors"
            aria-label="Remove file"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-end gap-2 bg-zinc-900/80 rounded-2xl px-3 py-2 border border-zinc-800/60 focus-within:border-blue-500/30 transition-colors"
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 mb-0.5"
          aria-label="Attach file"
        >
          <Paperclip size={17} />
        </motion.button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message mine.ai..."
          className="flex-1 bg-transparent text-[13.5px] text-zinc-100 placeholder:text-zinc-600 resize-none outline-none leading-[20px] py-1 tracking-tight"
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
          aria-label="Message input"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={toggleListening}
          className={cn(
            "p-1.5 rounded-lg transition-colors shrink-0 mb-0.5",
            isListening
              ? "text-red-500 hover:text-red-400"
              : "text-zinc-500 hover:text-zinc-200"
          )}
          animate={isListening ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: isListening ? Infinity : 0, duration: 1.5 }}
          aria-label={isListening ? "Stop recording" : "Voice input"}
        >
          <Mic size={17} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="submit"
          disabled={(!value.trim() && !selectedFile) || isTyping}
          className={cn(
            "p-2 rounded-xl shrink-0 transition-all duration-200 mb-0.5",
            (value.trim() || selectedFile) && !isTyping
              ? "text-zinc-100 hover:opacity-90 shadow-lg shadow-blue-600/20"
              : "bg-zinc-800 text-zinc-600",
          )}
          style={(value.trim() || selectedFile) && !isTyping ? { background: "var(--accent-color)" } : {}}
          aria-label="Send message"
        >
          <Send size={15} />
        </motion.button>
      </form>
      <p className="text-center text-[10px] text-zinc-600 mt-2.5 tracking-tight">
        {"mine.ai can make mistakes. Verify important information."}
      </p>
    </div>
  );
}
