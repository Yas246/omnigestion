// Configuration Firebase pour Omnigestion
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';

// Configuration Firebase
// Remplacez ces valeurs par vos propres credentials Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialiser Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let messaging: Messaging;

if (typeof window !== 'undefined') {
  // Client-side only
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Initialiser Firebase Messaging pour les notifications push
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('[Firebase] Messaging non disponible:', error);
  }
}

// Export des instances Firebase
export { app, auth, db, storage, messaging };

// Helper pour vérifier si Firebase est configuré
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
}

// Collections paths helpers
export const COLLECTIONS = {
  companies: 'companies',
  users: 'users',

  // Sous-collections companies
  companyProducts: (companyId: string) => `companies/${companyId}/products`,
  companyClients: (companyId: string) => `companies/${companyId}/clients`,
  companySuppliers: (companyId: string) => `companies/${companyId}/suppliers`,
  companyInvoices: (companyId: string) => `companies/${companyId}/invoices`,
  companyWarehouses: (companyId: string) => `companies/${companyId}/warehouses`,
  companyCashRegisters: (companyId: string) => `companies/${companyId}/cash_registers`,
  companyCashMovements: (companyId: string) => `companies/${companyId}/cash_movements`,
  companyClientCredits: (companyId: string) => `companies/${companyId}/client_credits`,
  companyClientCreditPayments: (companyId: string) => `companies/${companyId}/client_credit_payments`,
  companySupplierCredits: (companyId: string) => `companies/${companyId}/supplier_credits`,
  companySupplierCreditPayments: (companyId: string) => `companies/${companyId}/supplier_credit_payments`,
  companyPurchases: (companyId: string) => `companies/${companyId}/purchases`,
  companyStockMovements: (companyId: string) => `companies/${companyId}/stock_movements`,
  companyStockAlerts: (companyId: string) => `companies/${companyId}/stock_alerts`,
  companyAuditLog: (companyId: string) => `companies/${companyId}/audit_log`,
  companyDailyStats: (companyId: string) => `companies/${companyId}/daily_stats`,
  companySettings: (companyId: string) => `companies/${companyId}/settings`,
} as const;

// Sous-collections des entités
export const SUB_COLLECTIONS = {
  invoiceLines: (companyId: string, invoiceId: string) =>
    `companies/${companyId}/invoices/${invoiceId}/lines`,
  creditPayments: (companyId: string, creditId: string, type: 'client' | 'supplier') =>
    `companies/${companyId}/${type}_credits/${creditId}/payments`,
} as const;
