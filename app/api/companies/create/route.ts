import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedAdmin, forbiddenResponse } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthenticatedAdmin(req);
    if (!currentUser) {
      return forbiddenResponse('Seuls les administrateurs peuvent créer des entreprises');
    }

    const body = await req.json();
    const { name, businessSector, currency, ...rest } = body;

    if (!name || !businessSector) {
      return NextResponse.json(
        { error: 'Le nom et le secteur d\'activité sont obligatoires' },
        { status: 400 }
      );
    }

    const companyRef = adminDb.collection('companies').doc();
    const companyId = companyRef.id;

    await adminDb.runTransaction(async (transaction) => {
      // Créer l'entreprise
      transaction.set(companyRef, {
        name,
        businessSector,
        currency: currency || 'XAF',
        ...rest,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mettre à jour l'utilisateur : ajouter companyId + basculer vers la nouvelle
      const userRef = adminDb.collection('users').doc(currentUser.uid);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('Document utilisateur introuvable');
      }

      const existingCompanyIds: string[] = userDoc.data()?.companyIds || [];
      transaction.update(userRef, {
        companyIds: [...existingCompanyIds, companyId],
        currentCompanyId: companyId,
        updatedAt: new Date(),
      });
    });

    return NextResponse.json({ success: true, companyId });
  } catch (error: any) {
    console.error('Erreur lors de la création de l\'entreprise:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de l\'entreprise' },
      { status: 500 }
    );
  }
}
