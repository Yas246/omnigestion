'use client';

/**
 * Theme — purely local (next-themes + localStorage). No DB sync.
 *
 * The theme is a personal UI preference: stored in the browser's localStorage
 * by next-themes (key "theme"), default "light". Previously this hooked into
 * user preferences + company_settings (Firebase-era) which caused auth errors
 * — removed. Every user keeps their own theme, per browser.
 */
import { useTheme as useNextTheme } from 'next-themes';

export function useThemeWithSettings() {
  const { theme, setTheme } = useNextTheme();
  return {
    theme: theme as 'light' | 'dark' | 'system' | undefined,
    setTheme: (t: 'light' | 'dark' | 'system') => setTheme(t),
  };
}
