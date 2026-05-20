import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedAdmin, forbiddenResponse } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthenticatedAdmin(req);
    if (!currentUser) {
      return forbiddenResponse('Seuls les administrateurs peuvent supprimer des utilisateurs');
    }

    const body = await req.json();
    const { userId, companyId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'L\'identifiant de l\'utilisateur est obligatoire' },
        { status: 400 }
      );
    }

    // Empêcher l'auto-suppression
    if (userId === currentUser.uid) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 400 }
      );
    }

    // Récupérer le document de l'utilisateur cible
    const targetRef = adminDb.collection('users').doc(userId);
    const targetDoc = await targetRef.get();

    if (!targetDoc.exists) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    const targetData = targetDoc.data();

    // Empêcher la suppression d'un admin
    if (targetData?.role === 'admin') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer un compte administrateur' },
        { status: 403 }
      );
    }

    // Vérifier que l'admin et la cible partagent une compagnie
    const adminDoc = await adminDb.collection('users').doc(currentUser.uid).get();
    const adminCompanyIds: string[] = adminDoc.data()?.companyIds || [];
    const targetCompanyIds: string[] = targetData?.companyIds || [];
    const sharedCompanies = targetCompanyIds.filter((id: string) => adminCompanyIds.includes(id));

    if (sharedCompanies.length === 0) {
      return forbiddenResponse('Cet utilisateur n\'appartient pas à votre entreprise');
    }

    // Si companyId est fourni et l'utilisateur appartient à plusieurs compagnies,
    // le retirer uniquement de cette compagnie
    if (companyId && targetCompanyIds.length > 1) {
      const updatedCompanyIds = targetCompanyIds.filter((id: string) => id !== companyId);
      const updateData: Record<string, any> = {
        companyIds: updatedCompanyIds,
        updatedAt: new Date(),
      };
      // Si currentCompanyId était la compagnie retirée, basculer vers la première restante
      if (targetData?.currentCompanyId === companyId && updatedCompanyIds.length > 0) {
        updateData.currentCompanyId = updatedCompanyIds[0];
      }
      await targetRef.update(updateData);
      return NextResponse.json({ success: true, action: 'removed_from_company' });
    }

    // Suppression complète : document Firestore + compte Auth
    await adminDb.collection('users').doc(userId).delete();

    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: any) {
      // Le compte Auth peut déjà avoir été supprimé — ne pas bloquer
      if (!authError.code?.includes('user-not-found')) {
        console.error('Erreur lors de la suppression du compte Auth:', authError);
      }
    }

    return NextResponse.json({ success: true, action: 'deleted' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression de l\'utilisateur' },
      { status: 500 }
    );
  }
}
