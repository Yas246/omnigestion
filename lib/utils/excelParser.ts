import * as XLSX from 'xlsx';

export interface ParsedProduct {
  name: string;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  wholesaleThreshold: number;
  alertThreshold: number;
  category?: string;
  unit: string;
  rowNumber: number;
  errors: string[];
  warnings: string[];
}

export interface ImportResult {
  validProducts: ParsedProduct[];
  duplicates: number;
  errors: string[];
  warnings: string[];
  totalRows: number;
}

/**
 * Normalise le nom d'une colonne pour la comparaison
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Trouve l'index d'une colonne par son nom (avec variations possibles)
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(normalizeColumnName);

  for (const name of possibleNames) {
    const normalizedName = normalizeColumnName(name);
    const index = normalizedHeaders.findIndex(h => h === normalizedName);
    if (index !== -1) return index;
  }

  return -1;
}

/**
 * Parse un fichier Excel/CSV et extrait les produits
 */
export async function parseProductFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Impossible de lire le fichier'));
          return;
        }

        // Lire le workbook
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir en JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          reject(new Error('Le fichier est vide ou ne contient pas de données'));
          return;
        }

        // Extraire les en-têtes
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);

        // Trouver les indices des colonnes
        const nameColIndex = findColumnIndex(headers, ['produit', 'product', 'name', 'designation']);
        const quantityColIndex = findColumnIndex(headers, ['quantité', 'quantite', 'quantity', 'qté', 'qte', 'stock']);
        const purchasePriceColIndex = findColumnIndex(headers, ['prix d\'achat', 'prixd\'achat', 'purchase price', 'prix achat', 'prixAchat']);
        const retailPriceColIndex = findColumnIndex(headers, ['prix de vente', 'prixdevente', 'selling price', 'prix vente', 'prixVente', 'prix']);
        const wholesalePriceColIndex = findColumnIndex(headers, ['prix de gros', 'prixgros', 'wholesale price', 'prix gros', 'prixF Gros', 'grossiste']);
        const wholesaleThresholdColIndex = findColumnIndex(headers, ['seuil de gros', 'seuilgros', 'wholesale threshold', 'seuil gros', 'seuilGros']);
        const alertThresholdColIndex = findColumnIndex(headers, ['seuil d\'alerte', 'seuilalerte', 'alert threshold', 'seuil alerte', 'seuilAlerte', 'seuil']);
        const categoryColIndex = findColumnIndex(headers, ['catégorie', 'categorie', 'category', 'famille']);
        const unitColIndex = findColumnIndex(headers, ['unité', 'unite', 'unit', 'u']);

        // Vérifications
        if (nameColIndex === -1) {
          reject(new Error('Colonne "Produit" introuvable. Vérifiez les en-têtes de votre fichier.'));
          return;
        }

        // Parser les lignes
        const parsedProducts: ParsedProduct[] = [];
        let duplicateCount = 0;
        const seenNames = new Set<string>();

        rows.forEach((row, index) => {
          const rowNumber = index + 2; // +2 car ligne 1 = en-têtes, index commence à 0
          const errors: string[] = [];
          const warnings: string[] = [];

          // Extraire le nom (obligatoire)
          const name = row[nameColIndex]?.toString()?.trim();
          if (!name) {
            errors.push('Nom du produit manquant');
            return; // Ignorer cette ligne
          }

          // Vérifier les doublons
          if (seenNames.has(name.toLowerCase())) {
            duplicateCount++;
            errors.push('Produit en doublon (même nom déjà présent dans le fichier)');
            return;
          }
          seenNames.add(name.toLowerCase());

          // Extraire la quantité
          let quantity = 0;
          if (quantityColIndex !== -1) {
            const quantityValue = row[quantityColIndex];
            if (quantityValue !== undefined && quantityValue !== null && quantityValue !== '') {
              quantity = parseFloat(quantityValue.toString());
              if (isNaN(quantity)) {
                errors.push('Quantité invalide');
                quantity = 0;
              }
            } else {
              warnings.push('Quantité vide, valeur par défaut: 0');
            }
          } else {
            warnings.push('Colonne Quantité introuvable, valeur par défaut: 0');
          }

          // Vérifier que la quantité n'est pas négative
          if (quantity < 0) {
            errors.push('La quantité ne peut pas être négative');
            quantity = 0;
          }

          // Extraire le prix d'achat
          let purchasePrice = 0;
          if (purchasePriceColIndex !== -1) {
            const purchasePriceValue = row[purchasePriceColIndex];
            if (purchasePriceValue !== undefined && purchasePriceValue !== null && purchasePriceValue !== '') {
              purchasePrice = parseFloat(purchasePriceValue.toString());
              if (isNaN(purchasePrice)) {
                errors.push('Prix d\'achat invalide');
                purchasePrice = 0;
              }
            } else {
              warnings.push('Prix d\'achat vide, valeur par défaut: 0');
            }
          } else {
            warnings.push('Colonne Prix d\'achat introuvable, valeur par défaut: 0');
          }

          // Vérifier que le prix d'achat n'est pas négatif
          if (purchasePrice < 0) {
            errors.push('Le prix d\'achat ne peut pas être négatif');
            purchasePrice = 0;
          }

          // Extraire le prix de vente
          let retailPrice = 0;
          if (retailPriceColIndex !== -1) {
            const retailPriceValue = row[retailPriceColIndex];
            if (retailPriceValue !== undefined && retailPriceValue !== null && retailPriceValue !== '') {
              retailPrice = parseFloat(retailPriceValue.toString());
              if (isNaN(retailPrice)) {
                errors.push('Prix de vente invalide');
                retailPrice = 0;
              }
            } else {
              warnings.push('Prix de vente vide, valeur par défaut: 0');
            }
          } else {
            warnings.push('Colonne Prix de vente introuvable, valeur par défaut: 0');
          }

          // Vérifier que le prix de vente n'est pas négatif
          if (retailPrice < 0) {
            errors.push('Le prix de vente ne peut pas être négatif');
            retailPrice = 0;
          }

          // Extraire le prix de gros
          let wholesalePrice = 0;
          if (wholesalePriceColIndex !== -1) {
            const wholesalePriceValue = row[wholesalePriceColIndex];
            if (wholesalePriceValue !== undefined && wholesalePriceValue !== null && wholesalePriceValue !== '') {
              wholesalePrice = parseFloat(wholesalePriceValue.toString());
              if (isNaN(wholesalePrice)) {
                errors.push('Prix de gros invalide');
                wholesalePrice = 0;
              }
            } else {
              warnings.push('Prix de gros vide, valeur par défaut: 0');
            }
          } else {
            warnings.push('Colonne Prix de gros introuvable, valeur par défaut: 0');
          }

          // Vérifier que le prix de gros n'est pas négatif
          if (wholesalePrice < 0) {
            errors.push('Le prix de gros ne peut pas être négatif');
            wholesalePrice = 0;
          }

          // Extraire le seuil de gros
          let wholesaleThreshold = 10;
          if (wholesaleThresholdColIndex !== -1) {
            const wholesaleThresholdValue = row[wholesaleThresholdColIndex];
            if (wholesaleThresholdValue !== undefined && wholesaleThresholdValue !== null && wholesaleThresholdValue !== '') {
              wholesaleThreshold = parseFloat(wholesaleThresholdValue.toString());
              if (isNaN(wholesaleThreshold)) {
                errors.push('Seuil de gros invalide');
                wholesaleThreshold = 10;
              }
            } else {
              warnings.push('Seuil de gros vide, valeur par défaut: 10');
            }
          } else {
            warnings.push('Colonne Seuil de gros introuvable, valeur par défaut: 10');
          }

          // Vérifier que le seuil de gros n'est pas négatif
          if (wholesaleThreshold < 0) {
            errors.push('Le seuil de gros ne peut pas être négatif');
            wholesaleThreshold = 10;
          }

          // Extraire le seuil d'alerte
          let alertThreshold = 5;
          if (alertThresholdColIndex !== -1) {
            const alertThresholdValue = row[alertThresholdColIndex];
            if (alertThresholdValue !== undefined && alertThresholdValue !== null && alertThresholdValue !== '') {
              alertThreshold = parseFloat(alertThresholdValue.toString());
              if (isNaN(alertThreshold)) {
                errors.push('Seuil d\'alerte invalide');
                alertThreshold = 5;
              }
            } else {
              warnings.push('Seuil d\'alerte vide, valeur par défaut: 5');
            }
          } else {
            warnings.push('Colonne Seuil d\'alerte introuvable, valeur par défaut: 5');
          }

          // Vérifier que le seuil d'alerte n'est pas négatif
          if (alertThreshold < 0) {
            errors.push('Le seuil d\'alerte ne peut pas être négatif');
            alertThreshold = 5;
          }

          // Extraire la catégorie
          let category: string | undefined = undefined;
          if (categoryColIndex !== -1) {
            const categoryValue = row[categoryColIndex];
            if (categoryValue && categoryValue.toString().trim() !== '') {
              category = categoryValue.toString().trim();
            }
          }

          // Extraire l'unité
          let unit = 'Pièce';
          if (unitColIndex !== -1) {
            const unitValue = row[unitColIndex];
            if (unitValue && unitValue.toString().trim() !== '') {
              unit = unitValue.toString().trim();
            } else {
              warnings.push('Unité vide, valeur par défaut: Pièce');
            }
          } else {
            warnings.push('Colonne Unité introuvable, valeur par défaut: Pièce');
          }

          // Ajouter le produit si pas d'erreurs bloquantes
          if (errors.length === 0) {
            parsedProducts.push({
              name,
              quantity,
              purchasePrice,
              retailPrice,
              wholesalePrice,
              wholesaleThreshold,
              alertThreshold,
              category,
              unit,
              rowNumber,
              errors,
              warnings,
            });
          }
        });

        const totalErrors = parsedProducts.reduce((sum, p) => sum + p.errors.length, 0);
        const totalWarnings = parsedProducts.reduce((sum, p) => sum + p.warnings.length, 0);

        resolve({
          validProducts: parsedProducts,
          duplicates: duplicateCount,
          errors: totalErrors > 0 ? [`${totalErrors} erreur(s) de validation sur des lignes`] : [],
          warnings: totalWarnings > 0 ? [`${totalWarnings} avertissement(s) de valeurs par défaut`] : [],
          totalRows: rows.length,
        });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Erreur lors de la lecture du fichier'));
    };

    reader.readAsBinaryString(file);
  });
}
