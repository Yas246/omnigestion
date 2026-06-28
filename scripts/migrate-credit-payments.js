/**
 * Script de migration : dénormalisation des paiements de crédits
 *
 * Avant : paiements stockés dans une collection séparée (client_credit_payments / supplier_credit_payments)
 * Après : tableau `payments` embarqué dans le doc crédit (client_credits / supplier_credits)
 *
 * STRATÉGIE : COPIE UNIQUE - PAS DE SUPPRESSION DES DONNÉES ORIGINALES
 * Cela permet un rollback facile en cas de problème.
 *
 * Exécution : node scripts/migrate-credit-payments.js <companyId>
 */

const admin = require('firebase-admin');

const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKeyBase64) {
  console.error('Erreur: Variable d\'environnement FIREBASE_SERVICE_ACCOUNT_KEY non trouvée');
  console.error('Utilisation: require(\'dotenv\').config() puis node scripts/migrate-credit-payments.js <companyId>');
  process.exit(1);
}

let serviceAccount;
try {
  const serviceAccountJson = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf-8');
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  console.error('Erreur lors du decodage de la cle de compte de service:', error.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COMPANY_ID = process.argv[2];

if (!COMPANY_ID) {
  console.error('Usage: node migrate-credit-payments.js <companyId>');
  process.exit(1);
}

console.log(`Migration des paiements de credits pour la compagnie : ${COMPANY_ID}`);
console.log('COPIE SEULE - Les donnees originales sont conservees pour rollback');

async function migrateCredits(creditType) {
  const creditsCollection = `${creditType}_credits`;
  const paymentsCollection = `${creditType}_credit_payments`;

  console.log(`\n--- Migration ${creditType === 'client' ? 'clients' : 'fournisseurs'} ---`);

  const creditsSnapshot = await db
    .collection('companies')
    .doc(COMPANY_ID)
    .collection(creditsCollection)
    .get();

  console.log(`${creditsSnapshot.size} credits ${creditType} trouves`);

  let migrated = 0;
  let skipped = 0;

  for (const creditDoc of creditsSnapshot.docs) {
    const creditData = creditDoc.data();

    if (Array.isArray(creditData.payments) && creditData.payments.length > 0) {
      console.log(`  [skip] Credit ${creditDoc.id} a deja un tableau payments`);
      skipped++;
      continue;
    }

    const paymentsSnapshot = await db
      .collection('companies')
      .doc(COMPANY_ID)
      .collection(paymentsCollection)
      .where('creditId', '==', creditDoc.id)
      .get();

    const payments = paymentsSnapshot.docs.map(p => {
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
    }).sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    await creditDoc.ref.update({ payments });
    console.log(`  [ok] Credit ${creditDoc.id} : ${payments.length} paiement(s) embarque(s)`);
    migrated++;
  }

  console.log(`Termine : ${migrated} credits migres, ${skipped} ignores (deja migrés)`);
}

async function migrate() {
  try {
    await migrateCredits('client');
    await migrateCredits('supplier');
    console.log('\nMigration terminee avec succes');
    process.exit(0);
  } catch (error) {
    console.error('\nErreur pendant la migration:', error);
    process.exit(1);
  }
}

migrate();
