import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedAdmin, forbiddenResponse } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthenticatedAdmin(req);
    if (!currentUser) {
      return forbiddenResponse('Seuls les administrateurs peuvent lister les utilisateurs');
    }

    const body = await req.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'L\'identifiant de l\'entreprise est obligatoire' },
        { status: 400 }
      );
    }

    // Vérifier que l'admin appartient à cette compagnie
    const adminDoc = await adminDb.collection('users').doc(currentUser.uid).get();
    const adminData = adminDoc.data();
    const adminCompanyIds: string[] = adminData?.companyIds || [];

    if (!adminCompanyIds.includes(companyId)) {
      return forbiddenResponse('Vous n\'appartenez pas à cette entreprise');
    }

    // Lister les utilisateurs de la compagnie
    const snapshot = await adminDb
      .collection('users')
      .where('companyIds', 'array-contains', companyId)
      .get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Exclure les champs sensibles
      const { fcmTokens, ...safeData } = data;
      return {
        id: doc.id,
        ...safeData,
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Erreur lors du chargement des utilisateurs:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du chargement des utilisateurs' },
      { status: 500 }
    );
  }
}
