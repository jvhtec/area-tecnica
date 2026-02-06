import { useEffect, useState } from 'react';
import { Theme } from '@/components/technician/types';
import { useUserPreferences } from './useUserPreferences';

export const useTechnicianTheme = () => {
  const { preferences } = useUserPreferences();

  // Get initial theme from localStorage (synchronous, no flash!)
  const getInitialDarkMode = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme-preference');
      if (stored !== null) {
        return stored === 'dark';
      }
    }
    // Fallback to document class or system preference
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return true;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; // Default to dark
  };

  const [isDark, setIsDark] = useState(getInitialDarkMode);

  // Sync with user preferences when they load from database
  useEffect(() => {
    if (preferences?.dark_mode !== undefined) {
      setIsDark(preferences.dark_mode);
    }
  }, [preferences]);

  const theme: Theme = {
    bg: isDark ? "bg-[#05070a]" : "bg-slate-50",
    nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
    card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
    textMain: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    input: isDark ? "bg-[#0a0c10] border-[#2a2e3b] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
    modalOverlay: isDark ? "bg-black/90 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-md",
    divider: isDark ? "border-[#1f232e]" : "border-slate-100",
    danger: isDark ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-red-700 bg-red-50 border-red-200",
    success: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    warning: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-700 bg-amber-50 border-amber-200",
    cluster: isDark ? "bg-white text-black" : "bg-slate-900 text-white"
  };

  return { theme, isDark };
};
