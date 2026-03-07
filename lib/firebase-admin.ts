import admin from 'firebase-admin';
import { getApps, cert } from 'firebase-admin/app';

// Vérifier si l'app est déjà initialisée
if (!getApps().length) {
  try {
    // Récupérer la clé de service depuis la variable d'environnement
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    }

    // Décoder la clé de service (base64)
    const decodedKey = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedKey);

    admin.initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de Firebase Admin:', error);
    throw new Error('Failed to initialize Firebase Admin SDK. Please check your FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
