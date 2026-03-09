import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { UserPreferences } from '@/types';

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, preferences } = body;

    // Validation
    if (!userId) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Préférences invalides' },
        { status: 400 }
      );
    }

    // Valider les valeurs autorisées
    if (preferences.theme && !['light', 'dark', 'system'].includes(preferences.theme)) {
      return NextResponse.json(
        { error: 'Thème invalide. Valeurs autorisées: light, dark, system' },
        { status: 400 }
      );
    }

    // Mettre à jour uniquement les préférences de l'utilisateur
    await adminDb.collection('users').doc(userId).update({
      preferences: preferences,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour des préférences:', error);

    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour des préférences' },
      { status: 500 }
    );
  }
}
