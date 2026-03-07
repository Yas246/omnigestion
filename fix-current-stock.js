/**
 * Script pour synchroniser currentStock avec la somme des stockLocations
 * Corrige le problème où currentStock est désynchronisé
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Charger .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const serviceAccountMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
const serviceAccountKey = serviceAccountMatch[1];
const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function syncCurrentStock(companyId) {
  console.log('🔄 Synchronisation des stocks pour la compagnie:', companyId);
  console.log('');

  const productsRef = db.collection(`companies/${companyId}/products`);
  const snapshot = await productsRef.get();

  console.log(`📦 ${snapshot.docs.length} produits trouvés`);
  console.log('');

  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const product = doc.data();
    const productId = doc.id;

    // Récupérer les stockLocations
    const stockLocationsRef = db.collection(`companies/${companyId}/products/${productId}/stockLocations`);
    const locationsSnapshot = await stockLocationsRef.get();

    if (locationsSnapshot.empty) {
      console.log(`⏭️  ${product.name}: pas de stockLocations, ignoré`);
      continue;
    }

    // Calculer la somme
    let totalStock = 0;
    locationsSnapshot.forEach((locDoc) => {
      const location = locDoc.data();
      totalStock += location.quantity || 0;
    });

    const currentStock = product.currentStock || 0;

    if (totalStock !== currentStock) {
      console.log(`📝 ${product.name}:`);
      console.log(`   currentStock actuel: ${currentStock}`);
      console.log(`   Somme stockLocations: ${totalStock}`);
      console.log(`   Différence: ${totalStock - currentStock}`);

      // Mettre à jour currentStock
      await doc.ref.update({
        currentStock: totalStock,
        updatedAt: new Date(),
      });

      console.log(`   ✅ Mis à jour vers: ${totalStock}`);
      updatedCount++;
    } else {
      console.log(`✅ ${product.name}: déjà synchronisé (${totalStock})`);
    }
  }

  console.log('');
  console.log('🎉 Terminé!');
  console.log(`📊 ${updatedCount} produits mis à jour`);
}

// Récupérer companyId depuis les arguments
const companyId = process.argv[2];

if (!companyId) {
  console.log('Usage: node fix-current-stock.js <companyId>');
  console.log('');
  console.log('Pour trouver votre companyId:');
  console.log('1. Va dans Firebase Console > Firestore Database');
  console.log('2. Regarde dans la collection "companies"');
  console.log('3. Copie l\'ID de ta compagnie');
  process.exit(1);
}

syncCurrentStock(companyId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
