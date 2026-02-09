"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

// ─── Theme Presets ───────────────────────────────────────────────
export const THEME_PRESETS = [
  { id: "default", name: "Default", bg: "#09090b", surface: "#18181b", border: "#27272a", accent: "#3b82f6" },
  { id: "midnight", name: "Midnight", bg: "#0c1222", surface: "#131c33", border: "#1e2d4a", accent: "#60a5fa" },
  { id: "oled", name: "OLED Black", bg: "#000000", surface: "#0a0a0a", border: "#171717", accent: "#e4e4e7" },
  { id: "nebula", name: "Nebula", bg: "#0f0a1a", surface: "#1a1030", border: "#2a1d4a", accent: "#a78bfa" },
  { id: "cyberpunk", name: "Cyberpunk", bg: "#0a0e12", surface: "#0f1419", border: "#1a2332", accent: "#22d3ee" },
  { id: "dracula", name: "Dracula", bg: "#282a36", surface: "#343746", border: "#44475a", accent: "#ff79c6" },
  { id: "nord", name: "Nord", bg: "#2e3440", surface: "#3b4252", border: "#434c5e", accent: "#88c0d0" },
  { id: "sunset", name: "Sunset", bg: "#1a0f0f", surface: "#261515", border: "#3a2020", accent: "#f97316" },
];

// ─── Hex → HSL for Tailwind CSS variable support ────────────────
function hexToHSL(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ThemeManager() {
  // ─── Watch all theme-related DB keys in real-time ─────────────
  const theme = useLiveQuery(() => db.settings.where("key").equals("theme_mode").first());
  const accent = useLiveQuery(() => db.settings.where("key").equals("accent_color").first());
  const wallpaper = useLiveQuery(() => db.settings.where("key").equals("wallpaper_url").first());
  const glassMode = useLiveQuery(() => db.settings.where("key").equals("glass_mode").first());
  const themePreset = useLiveQuery(() => db.settings.where("key").equals("theme_preset").first());

  // 1. DARK / LIGHT MODE
  useEffect(() => {
    const root = document.documentElement;
    const mode = theme?.value || "dark";

    let effectiveMode = mode;
    if (mode === "system") {
      effectiveMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    if (effectiveMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if ((theme?.value || "dark") === "system") {
        if (e.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  // 2. ACCENT COLOR
  useEffect(() => {
    const root = document.documentElement;
    const colorHex = (accent?.value as string) || "#3b82f6";

    root.style.setProperty("--primary-hex", colorHex);
    const hsl = hexToHSL(colorHex);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
    }
  }, [accent]);

  // 3. THEME PRESET (background colours)
  useEffect(() => {
    const presetId = (themePreset?.value as string) || "default";
    const preset = THEME_PRESETS.find(p => p.id === presetId) || THEME_PRESETS[0];
    const root = document.documentElement;

    root.style.setProperty("--mine-bg", preset.bg);
    root.style.setProperty("--mine-surface", preset.surface);
    root.style.setProperty("--mine-border", preset.border);

    // Update --background so Tailwind's bg-background tracks the preset
    root.style.setProperty("--background", preset.bg);
    document.body.style.backgroundColor = preset.bg;
  }, [themePreset]);

  // 4. WALLPAPER
  useEffect(() => {
    const url = (wallpaper?.value as string) || "";
    const body = document.body;

    if (url) {
      body.style.backgroundImage = `url(${url})`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundRepeat = "no-repeat";
      body.classList.add("has-wallpaper");
    } else {
      body.style.backgroundImage = "";
      body.classList.remove("has-wallpaper");
    }
  }, [wallpaper]);

  // 5. GLASS MODE
  useEffect(() => {
    const enabled = glassMode?.value === true;
    if (enabled) {
      document.documentElement.classList.add("glass-mode");
    } else {
      document.documentElement.classList.remove("glass-mode");
    }
  }, [glassMode]);

  return null; // Invisible — watches DB and applies styles globally
}