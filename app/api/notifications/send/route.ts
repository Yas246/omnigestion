import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getMessaging, SendResponse } from 'firebase-admin/messaging';
import type { PushNotification } from '@/types';

/**
 * API Route pour envoyer des notifications push FCM
 * POST /api/notifications/send
 *
 * Envoie des notifications push aux admins d'une compagnie
 */
export async function POST(request: NextRequest) {
  try {
    const notification: PushNotification = await request.json();

    // Validation basique des champs requis
    if (!notification.companyId || !notification.title || !notification.body) {
      return NextResponse.json(
        { error: 'Champs manquants: companyId, title, body requis' },
        { status: 400 }
      );
    }

    // Récupérer tous les utilisateurs de la compagnie
    const usersSnapshot = await adminDb
      .collection('users')
      .where('companyIds', 'array-contains', notification.companyId)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json(
        { error: 'Aucun utilisateur trouvé pour cette compagnie' },
        { status: 404 }
      );
    }

    // Filtrer par rôle et collecter les tokens FCM
    const tokens: string[] = [];
    const userIds: string[] = [];

    usersSnapshot.docs.forEach((doc) => {
      const user = doc.data();

      // Filtrer par rôle (admin uniquement par défaut)
      if (notification.targetRole === 'admin' && user.role !== 'admin') return;

      // Collecter les tokens FCM
      if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
        user.fcmTokens.forEach((fcmToken: any) => {
          if (fcmToken.token) {
            tokens.push(fcmToken.token);
            userIds.push(doc.id);
          }
        });
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Aucun token FCM trouvé pour les utilisateurs ciblés' },
        { status: 404 }
      );
    }

    // Envoyer la notification via FCM (multicast pour plusieurs tokens)
    const messaging = getMessaging();
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens.slice(0, 500), // FCM supporte jusqu'à 500 tokens par requête
    };

    const response = await messaging.sendEachForMulticast(message);

    // Nettoyer les tokens expirés
    const failedTokens: string[] = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp: SendResponse, idx: number) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(tokens[idx]);
        }
      });

      // Supprimer les tokens expirés de Firestore
      if (failedTokens.length > 0) {
        const uniqueUserIds = [...new Set(userIds)];
        for (const userId of uniqueUserIds) {
          const userRef = adminDb.collection('users').doc(userId);
          const userDoc = await userRef.get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData && userData.fcmTokens) {
              const updatedTokens = userData.fcmTokens.filter(
                (t: any) => !failedTokens.includes(t.token)
              );

              await userRef.update({
                fcmTokens: updatedTokens,
                updatedAt: new Date(),
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de la notification', details: error.message },
      { status: 500 }
    );
  }
}
