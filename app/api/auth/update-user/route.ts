import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      firstName,
      lastName,
      phone,
      position,
      role,
      permissions,
    } = body;

    // Validation
    if (!userId || !firstName || !lastName || !phone || !position || !role) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      );
    }

    // Mettre à jour le document utilisateur dans Firestore
    await adminDb.collection('users').doc(userId).update({
      displayName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone,
      position,
      role,
      permissions: role === 'admin' ? [] : permissions || [],
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);

    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour de l\'utilisateur' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, newPassword } = body;

    // Validation
    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'L\'ID utilisateur et le nouveau mot de passe sont requis' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Mettre à jour le mot de passe avec Firebase Admin
    await adminAuth.updateUser(userId, {
      password: newPassword,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du mot de passe:', error);

    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour du mot de passe' },
      { status: 500 }
    );
  }
}
