'use client';

import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';

const MIGRATION_DOC = 'credit-payments-denormalization';
const MIGRATION_KEY = `migration-${MIGRATION_DOC}-done`;

interface MigrationStatus {
  done: boolean;
  migratedAt?: Date;
  clientCreditsProcessed?: number;
  supplierCreditsProcessed?: number;
}

async function getMigrationStatus(companyId: string): Promise<MigrationStatus> {
  const ref = doc(db, `companies/${companyId}/migrations`, MIGRATION_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { done: false };
  return snap.data() as MigrationStatus;
}

async function markMigrationDone(companyId: string, stats: { client: number; supplier: number }) {
  const ref = doc(db, `companies/${companyId}/migrations`, MIGRATION_DOC);
  await setDoc(ref, {
    done: true,
    migratedAt: new Date(),
    clientCreditsProcessed: stats.client,
    supplierCreditsProcessed: stats.supplier,
  }, { merge: true });
}

async function migrateCreditType(
  companyId: string,
  creditType: 'client' | 'supplier'
): Promise<number> {
  const creditsCollection = `${creditType}_credits`;
  const paymentsCollection = `${creditType}_credit_payments`;

  const creditsSnapshot = await getDocs(
    query(collection(db, `companies/${companyId}/${creditsCollection}`))
  );

  let processed = 0;

  for (const creditDoc of creditsSnapshot.docs) {
    const creditData = creditDoc.data();

    // Skip si déjà migré (payments array présent)
    if (Array.isArray(creditData.payments) && creditData.payments.length > 0) {
      continue;
    }

    // Lire les paiements depuis l'ancienne collection
    const paymentsSnapshot = await getDocs(
      query(
        collection(db, `companies/${companyId}/${paymentsCollection}`),
        // where('creditId', '==', creditDoc.id) -- skip pour éviter le besoin d'index
      )
    );

    const payments = paymentsSnapshot.docs
      .filter(p => p.data().creditId === creditDoc.id)
      .map(p => {
        const data = p.data();
        return {
          id: p.id,
          creditId: data.creditId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          notes: data.notes || null,
          userId: data.userId || null,
          createdAt: data.createdAt,
        };
      })
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

    if (payments.length === 0) {
      // Pas de paiements mais on pose quand même un tableau vide pour signaler la migration
      await updateDoc(creditDoc.ref, { payments: [] });
    } else {
      await updateDoc(creditDoc.ref, { payments });
    }
    processed++;
  }

  return processed;
}

/**
 * Migre les paiements de crédits vers le format dénormalisé (tableau embarqué).
 * Idempotent : peut être relancé sans risque. Utilise un flag Firestore pour
 * ne s'exécuter qu'une fois par compagnie.
 *
 * Transparent pour l'utilisateur : pas d'UI, lancé en arrière-plan au login admin.
 */
export async function migrateCreditPaymentsIfNeeded(companyId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Double verrou : flag localStorage pour éviter les appels Firestore inutiles
  const localFlag = sessionStorage.getItem(MIGRATION_KEY);
  if (localFlag === 'done') return;

  try {
    const status = await getMigrationStatus(companyId);
    if (status.done) {
      sessionStorage.setItem(MIGRATION_KEY, 'done');
      return;
    }

    console.log(`[migration] Dénormalisation des paiements de crédits pour ${companyId}...`);

    const clientCount = await migrateCreditType(companyId, 'client');
    const supplierCount = await migrateCreditType(companyId, 'supplier');

    await markMigrationDone(companyId, { client: clientCount, supplier: supplierCount });
    sessionStorage.setItem(MIGRATION_KEY, 'done');

    console.log(`[migration] ✅ Terminé : ${clientCount} crédit(s) client, ${supplierCount} crédit(s) fournisseur`);
  } catch (err) {
    console.error('[migration] Erreur (sera retenté à la prochaine session) :', err);
    // On ne pose pas le flag — la migration sera retentée à la prochaine session
  }
}
