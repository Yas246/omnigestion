import { NextRequest } from 'next/server';
import { adminDb } from './firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: 'admin' | 'employee';
  currentCompanyId?: string;
}

/**
 * Vérifie l'authentification depuis un header Authorization
 * @param request La requête Next.js
 * @returns L'utilisateur authentifié ou null
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Supprimer "Bearer "

    // Vérifier le token avec Firebase Admin
    const { adminAuth } = await import('./firebase-admin');
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    if (!decodedToken.uid) {
      return null;
    }

    // Récupérer les données utilisateur depuis Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: userData?.role || 'employee',
      currentCompanyId: userData?.currentCompanyId,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie que l'utilisateur est authentifié et est admin
 * @param request La requête Next.js
 * @returns L'utilisateur admin ou null
 */
export async function getAuthenticatedAdmin(request: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(request);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return user;
}

/**
 * Retourne une réponse d'erreur 401
 */
export function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Non authentifié' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Retourne une réponse d'erreur 403
 */
export function forbiddenResponse(message = 'Accès refusé') {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
