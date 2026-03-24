import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';

export async function PUT(req: NextRequest) {
  try {
    // Vérifier que l'utilisateur est authentifié et est admin
    const currentUser = await getAuthenticatedAdmin(req);

    if (!currentUser) {
      return forbiddenResponse('Seuls les administrateurs peuvent modifier les utilisateurs');
    }

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

    // Récupérer l'utilisateur à modifier
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json(
        { error: 'Données utilisateur non disponibles' },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur à modifier n'est pas un admin
    if (userData.role === 'admin') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier un compte administrateur' },
        { status: 403 }
      );
    }

    // Vérifier que l'utilisateur n'essaie pas de se promouvoir lui-même en admin
    if (userId === currentUser.uid && role === 'admin') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas vous promouvoir administrateur' },
        { status: 403 }
      );
    }

    // Vérifier que le rôle admin n'est pas assigné via cette API
    if (role === 'admin') {
      return NextResponse.json(
        { error: 'Seul un administrateur existant peut promouvoir un utilisateur en admin' },
        { status: 403 }
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
    // Vérifier que l'utilisateur est authentifié et est admin
    const currentUser = await getAuthenticatedAdmin(req);

    if (!currentUser) {
      return forbiddenResponse('Seuls les administrateurs peuvent modifier les mots de passe');
    }

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

    // Récupérer l'utilisateur à modifier
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json(
        { error: 'Données utilisateur non disponibles' },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur à modifier n'est pas un admin
    if (userData.role === 'admin') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier le mot de passe d\'un administrateur' },
        { status: 403 }
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
