/**
 * Script pour créer un utilisateur admin dans Firebase
 * Usage: node create-admin-user.js <email> <password>
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Charger le fichier .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Extraire FIREBASE_SERVICE_ACCOUNT_KEY
const serviceAccountMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
if (!serviceAccountMatch) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY non trouvé dans .env.local');
  process.exit(1);
}

const serviceAccountKey = serviceAccountMatch[1];
const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function createAdminUser(email, password) {
  try {
    // Vérifier si l'utilisateur existe déjà
    try {
      const existingUser = await auth.getUserByEmail(email);
      console.log('✅ Utilisateur déjà existant:', existingUser.uid);
      console.log('Email:', existingUser.email);
      console.log('Créé le:', new Date(existingUser.userRecord.metadata.creationTime).toLocaleString('fr-FR'));

      // Si tu veux réinitialiser le mot de passe, décommente la ligne suivante:
      const link = await auth.generatePasswordResetLink(email);
      console.log('🔗 Lien de réinitialisation:', link);

      return;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // L'utilisateur n'existe pas, on continue la création
    }

    // Créer l'utilisateur
    const user = await auth.createUser({
      email: email,
      password: password,
      emailVerified: false,
    });

    console.log('✅ Utilisateur créé avec succès!');
    console.log('UID:', user.uid);
    console.log('Email:', user.email);
    console.log('\n📝 Tu peux maintenant te connecter avec:');
    console.log('   Email:', email);
    console.log('   Mot de passe:', password);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Récupérer les arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node create-admin-user.js <email> <password>');
  console.log('\nExemple:');
  console.log('  node create-admin-user.js admin@example.com MonMotDePasse123!');
  process.exit(1);
}

console.log('🔐 Création de l\'utilisateur admin...');
console.log('Email:', email);
console.log('Mot de passe:', '*'.repeat(password.length));
console.log('');

createAdminUser(email, password)
  .then(() => {
    console.log('\n✅ Terminé!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
