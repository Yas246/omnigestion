import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
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
    console.log('[API Notifications] Notification reçue:', notification);

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

    console.log(`[API Notifications] ${usersSnapshot.size} utilisateur(s) trouvé(s) pour la compagnie ${notification.companyId}`);

    if (usersSnapshot.empty) {
      return NextResponse.json(
        { error: 'Aucun utilisateur trouvé pour cette compagnie' },
        { status: 404 }
      );
    }

    // Filtrer par rôle et collecter les tokens FCM
    const tokens: string[] = [];
    const userIds: string[] = [];
    let adminsCount = 0;
    let usersWithTokens = 0;

    usersSnapshot.docs.forEach((doc) => {
      const user = doc.data();

      // Filtrer par rôle (admin uniquement par défaut)
      if (notification.targetRole === 'admin' && user.role !== 'admin') return;

      if (user.role === 'admin') {
        adminsCount++;
        console.log(`[API Notifications] Admin trouvé: ${doc.id}, a ${user.fcmTokens?.length || 0} tokens`);

        // Collecter les tokens FCM
        if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
          if (user.fcmTokens.length > 0) {
            usersWithTokens++;
          }
          user.fcmTokens.forEach((fcmToken: any) => {
            if (fcmToken.token) {
              tokens.push(fcmToken.token);
              userIds.push(doc.id);
            }
          });
        }
      }
    });

    console.log(`[API Notifications] ${adminsCount} admin(s) trouvé(s), ${usersWithTokens} avec des tokens FCM`);

    if (tokens.length === 0) {
      console.log('[API Notifications] Aucun token FCM trouvé - les admins n\'ont pas encore activé les notifications');
      return NextResponse.json(
        { error: 'Aucun token FCM trouvé pour les utilisateurs ciblés' },
        { status: 404 }
      );
    }

    console.log(`[API Notifications] ${tokens.length} token(s) FCM collecté(s)`);

    // Envoyer la notification via FCM (un par un pour avoir plus de détails)
    const messaging = getMessaging();

    // Pour les notifications web, on doit utiliser le format correct
    const promises = tokens.slice(0, 500).map(async (token) => {
      const message = {
        token: token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...notification.data,
          click_action: '/',
        },
        webpush: {
          fcmOptions: {
            link: '/',
          },
        },
      };

      console.log(`[API Notifications] Envoi au token ${token.substring(0, 20)}...`);

      try {
        const response = await messaging.send(message);
        console.log(`[API Notifications] ✓ Succès pour token ${token.substring(0, 20)}...`);
        return { success: true, token };
      } catch (error: any) {
        console.error(`[API Notifications] ✗ Erreur pour token ${token.substring(0, 20)}...:`, error.code, error.message);
        return { success: false, token, error: error.code };
      }
    });

    const results = await Promise.all(promises);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[API Notifications] Notification envoyée: ${successCount} succès, ${failureCount} échecs`);

    // Nettoyer les tokens expirés
    const failedTokens: string[] = [];
    const invalidTokenCodes = [
      'messaging/registration-token-not-registered',    // Token désenregistré
      'messaging/invalid-registration-token',           // Token invalide
      'messaging/mismatched-sender-id',                 // Mauvais sender ID
    ];

    results.forEach((result) => {
      if (!result.success && result.error && invalidTokenCodes.includes(result.error)) {
        failedTokens.push(result.token);
        console.log(`[API Notifications] Token invalide détecté (${result.error}): ${result.token.substring(0, 20)}...`);
      } else if (!result.success) {
        // Autres erreurs (timeout, indisponibilité, etc.) - ne pas supprimer le token
        console.warn(`[API Notifications] Erreur temporaire pour token ${result.token.substring(0, 20)}...: ${result.error || 'unknown'}`);
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

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
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
