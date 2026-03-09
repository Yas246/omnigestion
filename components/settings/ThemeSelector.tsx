'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useThemeWithSettings } from '@/lib/hooks/useThemeWithSettings';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Monitor, Loader2 } from 'lucide-react';

interface ThemeSelectorProps {
  onThemeChanged?: () => void;
}

/**
 * Sélecteur de thème accessible à tous les utilisateurs
 *
 * Le thème est une préférence utilisateur personnelle et stocké dans le document utilisateur.
 * Chaque utilisateur peut avoir son propre thème, indépendamment des autres.
 */
export function ThemeSelector({ onThemeChanged }: ThemeSelectorProps) {
  const { setTheme } = useThemeWithSettings();
  const { preferences, updatePreferences } = useUserPreferences();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Priorité : préférences utilisateur > localStorage > 'system'
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(
    preferences?.theme ||
    (typeof window !== 'undefined' && (localStorage.getItem('theme') as 'light' | 'dark' | 'system')) ||
    'system'
  );

  useEffect(() => {
    if (preferences?.theme) {
      setThemeState(preferences.theme);
    }
  }, [preferences?.theme]);

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    if (!user?.id) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Appliquer le thème immédiatement (localStorage + UI)
      await setTheme(newTheme);
      setThemeState(newTheme);

      // 2. Sauvegarder dans les préférences utilisateur
      await updatePreferences({ theme: newTheme });

      toast.success('Thème mis à jour avec succès');
      onThemeChanged?.();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du thème');
      // En cas d'erreur, on garde quand même le changement en localStorage
      await setTheme(newTheme);
      setThemeState(newTheme);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence</CardTitle>
        <CardDescription>
          Choisissez votre thème préféré. Ce paramètre est personnel et ne sera pas appliqué aux autres utilisateurs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            disabled={isSubmitting}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              theme === 'light'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent'
            }`}
          >
            <Sun className="h-5 w-5" />
            <span className="text-sm">Clair</span>
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            disabled={isSubmitting}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              theme === 'dark'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent'
            }`}
          >
            <Moon className="h-5 w-5" />
            <span className="text-sm">Sombre</span>
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('system')}
            disabled={isSubmitting}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              theme === 'system'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent'
            }`}
          >
            <Monitor className="h-5 w-5" />
            <span className="text-sm">Système</span>
          </button>
        </div>
        {isSubmitting && (
          <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Application du thème...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
