/**
 * Script de migration : stock_locations → warehouse_quantities
 *
 * STRATÉGIE : COPIE UNIQUE - PAS DE SUPPRESSION DES DONNÉES ORIGINALES
 * Cela permet un rollback facile en cas de problème.
 *
 * Exécution : node scripts/migrate-to-warehouse-quantities.js <companyId>
 */

const admin = require('firebase-admin');

// Charger la clé de compte de service depuis la variable d'environnement
const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKeyBase64) {
  console.error('❌ Erreur: Variable d\'environnement FIREBASE_SERVICE_ACCOUNT_KEY non trouvée');
  console.error('❌ Veuillez exécuter ce script avec: dotenv -e .env.local node scripts/migrate-to-warehouse-quantities.js <companyId>');
  process.exit(1);
}

let serviceAccount;
try {
  // Décoder la clé base64
  const serviceAccountJson = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf-8');
  serviceAccount = JSON.parse(serviceAccountJson);
  console.log('✅ Clé de compte de service chargée depuis .env.local');
} catch (error) {
  console.error('❌ Erreur lors du décodage de la clé de compte de service:', error.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COMPANY_ID = process.argv[2];

if (!COMPANY_ID) {
  console.error('❌ Usage: node migrate-to-warehouse-quantities.js <companyId>');
  console.error('   Exemple: node migrate-to-warehouse-quantities.js QC77hKl8RV20nOLZa6OQ');
  process.exit(1);
}

console.log(`🔄 Migration pour la compagnie : ${COMPANY_ID}`);
console.log('⚠️  COPIE SEULE - Les données originales sont CONSERVÉES pour rollback');

async function migrate() {
  try {
    // 1. Récupérer tous les produits
    console.log('\n📦 Étape 1 : Récupération des produits...');
    const productsSnapshot = await db
      .collection('companies')
      .doc(COMPANY_ID)
      .collection('products')
      .get();

    const products = productsSnapshot.docs;
    console.log(`✅ ${products.length} produits trouvés`);

    if (products.length === 0) {
      console.log('⚠️  Aucun produit à migrer');
      return;
    }

    // 2. Récupérer tous les entrepôts pour avoir leurs noms
    console.log('\n🏭 Étape 2 : Récupération des entrepôts...');
    const warehousesSnapshot = await db
      .collection('companies')
      .doc(COMPANY_ID)
      .collection('warehouses')
      .where('isActive', '==', true)
      .get();

    const warehousesMap = new Map();
    warehousesSnapshot.docs.forEach(doc => {
      warehousesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    console.log(`✅ ${warehousesSnapshot.docs.length} entrepôts trouvés`);

    // Afficher les entrepôts trouvés
    warehousesMap.forEach((warehouse, id) => {
      console.log(`  - ${warehouse.name || id} (${id})`);
    });

    // 3. Pour chaque produit, récupérer ses stock_locations et créer le document warehouse_quantities
    console.log('\n📋 Étape 3 : Migration des quantités par entrepôt...');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const productDoc of products) {
      const productId = productDoc.id;
      const product = productDoc.data();

      try {
        // Récupérer les stock_locations du produit
        const stockLocationsSnapshot = await db
          .collection(`companies/${COMPANY_ID}/products/${productId}/stock_locations`)
          .get();

        if (stockLocationsSnapshot.empty) {
          console.log(`⚠️  Produit "${product.name}" (${productId}) : Aucun stock_location`);
          skippedCount++;
          continue;
        }

        // Construire le tableau quantities[]
        const quantities = stockLocationsSnapshot.docs.map(doc => {
          const data = doc.data();
          const warehouse = warehousesMap.get(data.warehouseId);

          return {
            warehouseId: data.warehouseId,
            warehouseName: warehouse?.name || data.warehouseId,
            quantity: data.quantity || 0,
          };
        });

        // Créer le document warehouse_quantities
        const warehouseQuantitiesRef = db
          .collection('companies')
          .doc(COMPANY_ID)
          .collection('warehouse_quantities')
          .doc(productId);

        batch.set(warehouseQuantitiesRef, {
          productId: productId,
          quantities: quantities,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        batchCount++;

        // Exécuter le batch toutes les BATCH_SIZE opérations
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Batch de ${batchCount} documents exécuté`);
          batch = db.batch();
          batchCount = 0;
        }

        successCount++;
        console.log(`  ✓ "${product.name}" (${productId}) : ${quantities.length} dépôt(s), ${quantities.reduce((sum, q) => sum + q.quantity, 0)} unités totales`);

        // Afficher les détails des quantités par dépôt
        quantities.forEach(q => {
          console.log(`    - ${q.warehouseName}: ${q.quantity} unités`);
        });

      } catch (error) {
        errorCount++;
        console.error(`  ❌ ERREUR pour "${product.name}" (${productId}):`, error.message);
      }
    }

    // Exécuter le dernier batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n✅ Dernier batch de ${batchCount} documents exécuté`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(60));
    console.log(`✅ Produits migrés avec succès : ${successCount}`);
    console.log(`⚠️  Produits ignorés (pas de stock_locations) : ${skippedCount}`);
    console.log(`❌ Erreurs : ${errorCount}`);
    console.log(`📁 Collection cible : companies/${COMPANY_ID}/warehouse_quantities`);
    console.log(`📁 Collection source (CONSERVÉE) : companies/${COMPANY_ID}/products/*/stock_locations`);
    console.log('\n✅ Migration terminée ! Les stock_locations originaux sont INTACTS.');
    console.log('🔄 Pour rollback : Supprimez simplement la collection warehouse_quantities.');

    // Vérifier que tous les produits ont un document warehouse_quantities
    console.log('\n🔍 Étape 4 : Vérification de la migration...');
    const warehouseQuantitiesSnapshot = await db
      .collection('companies')
      .doc(COMPANY_ID)
      .collection('warehouse_quantities')
      .get();

    console.log(`✅ ${warehouseQuantitiesSnapshot.docs.length} documents warehouse_quantities créés`);

    if (warehouseQuantitiesSnapshot.docs.length !== successCount) {
      console.warn('⚠️  Attention : Le nombre de documents créés ne correspond pas au nombre de succès !');
    }

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE lors de la migration :', error);
    process.exit(1);
  }
}

// Exécuter la migration
migrate().then(() => {
  console.log('\n✅ Script terminé avec succès');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script terminé avec erreur :', error);
  process.exit(1);
});
