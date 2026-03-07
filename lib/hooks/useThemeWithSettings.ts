'use client';

import { useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { useSettings } from './useSettings';

export function useThemeWithSettings() {
  const { theme, setTheme } = useNextTheme();
  const { settings, updateSystemSettings } = useSettings();

  // Appliquer le thème depuis les settings au chargement
  useEffect(() => {
    if (settings?.system?.theme) {
      setTheme(settings.system.theme);
    }
  }, [settings?.system?.theme, setTheme]);

  // Fonction pour changer le thème et le sauvegarder dans Firebase
  const updateTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    await updateSystemSettings({ theme: newTheme } as any);
  };

  return {
    theme: theme as 'light' | 'dark' | 'system' | undefined,
    setTheme: updateTheme,
  };
}
