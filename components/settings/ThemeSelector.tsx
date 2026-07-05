'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Monitor } from 'lucide-react';

interface ThemeSelectorProps {
  onThemeChanged?: () => void;
}

/**
 * Sélecteur de thème — 100% local (next-themes → localStorage).
 * Préférence personnelle par navigateur, aucune persistence backend (plus de
 * Firebase). Default "light" (blanc) défini dans app/layout.tsx.
 */
export function ThemeSelector({ onThemeChanged }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  // next-themes renvoie undefined au 1er render (SSR) → on attend le mount pour
  // éviter un flash / mismatch d'hydratation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (mounted ? theme : 'light') as 'light' | 'dark' | 'system';

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    onThemeChanged?.();
  };

  const options: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence</CardTitle>
        <CardDescription>
          Choisissez votre thème. Préférence personnelle enregistrée dans ce navigateur.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleThemeChange(value)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                current === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
