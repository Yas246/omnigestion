'use client';

import { useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { useSettings } from './useSettings';
import { useAuth } from '@/lib/auth-context';

export function useThemeWithSettings() {
  const { theme, setTheme } = useNextTheme();
  const { settings } = useSettings();
  const { user } = useAuth();

  // Appliquer le thème depuis les préférences utilisateur au chargement
  // Si pas de préférences utilisateur, utiliser les settings système (fallback)
  useEffect(() => {
    const userTheme = user?.preferences?.theme;
    const systemTheme = settings?.system?.theme;

    // Priorité : préférences utilisateur > settings système > 'system' (défaut)
    const themeToApply = userTheme || systemTheme || 'system';

    if (themeToApply) {
      setTheme(themeToApply);
    }
  }, [user?.preferences?.theme, settings?.system?.theme, setTheme]);

  // Fonction pour changer le thème (ne sauvegarde plus automatiquement dans Firebase,
  // c'est le composant ThemeSelector qui gère ça maintenant)
  const updateTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  return {
    theme: theme as 'light' | 'dark' | 'system' | undefined,
    setTheme: updateTheme,
  };
}
