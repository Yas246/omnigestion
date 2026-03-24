import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedAdmin, forbiddenResponse } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    // Vérifier que l'utilisateur est authentifié et est admin
    const currentUser = await getAuthenticatedAdmin(req);

    if (!currentUser) {
      return forbiddenResponse('Seuls les administrateurs peuvent créer des utilisateurs');
    }

    const body = await req.json();
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      position,
      role,
      permissions,
      companyId,
    } = body;

    // Validation
    if (!email || !password || !firstName || !lastName || !phone || !position || !role || !companyId) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Empêcher la création d'admin via cette API
    if (role === 'admin') {
      return NextResponse.json(
        { error: 'La création de comptes administrateur n\'est pas autorisée via cette API' },
        { status: 403 }
      );
    }

    // Vérifier que l'admin a le droit de créer des utilisateurs pour cette compagnie
    if (currentUser.currentCompanyId !== companyId) {
      return NextResponse.json(
        { error: 'Vous n\'avez pas le droit de créer des utilisateurs pour cette compagnie' },
        { status: 403 }
      );
    }

    // Créer l'utilisateur avec Firebase Admin (ne change pas la session client)
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // Créer le document utilisateur dans Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      email,
      displayName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone,
      position,
      role,
      companyIds: [companyId],
      currentCompanyId: companyId,
      permissions: role === 'admin' ? [] : permissions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      userId: userRecord.uid,
    });
  } catch (error: any) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);

    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'Cette adresse email est déjà utilisée' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/invalid-password') {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de l\'utilisateur' },
      { status: 500 }
    );
  }
}
