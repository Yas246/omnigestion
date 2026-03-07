const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputIcon = path.join(__dirname, '../public/logo.svg');
const outputDir = path.join(__dirname, '../public/icons');

// Créer le dossier si nécessaire
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('Génération des icônes PWA...\n');

  for (const size of sizes) {
    const filename = `icon-${size}x${size}.png`;
    const outputPath = path.join(outputDir, filename);

    try {
      await sharp(inputIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0.2, g: 0.2, b: 0.2, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ ${filename} généré`);
    } catch (error) {
      console.error(`✗ Erreur pour ${filename}:`, error.message);
    }
  }

  console.log('\n✅ Tous les icônes ont été générés dans public/icons/');
}

generateIcons().catch(console.error);
