'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';
import type { UserPreferences } from '@/types';

export function useUserPreferences() {
  const { user, refreshUser } = useAuth();

  /**
   * Mettre à jour les préférences utilisateur
   */
  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    // Récupérer le token d'authentification
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    if (!token) {
      throw new Error('Non authentifié');
    }

    const response = await fetch('/api/auth/update-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        preferences,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la mise à jour des préférences');
    }

    const result = await response.json();

    // Rafraîchir les données utilisateur pour avoir les nouvelles préférences
    if (refreshUser) {
      await refreshUser();
    }

    return result.preferences as UserPreferences;
  }, [user?.id, refreshUser]);

  /**
   * Obtenir les préférences actuelles
   */
  const preferences = user?.preferences || {};

  return {
    preferences,
    updatePreferences,
  };
}
