import * as XLSX from 'xlsx';
import type { Product } from '@/types';

/**
 * Exporte les produits vers un fichier Excel
 */
export function exportProductsToExcel(products: Product[]): void {
  // Préparer les données pour l'export
  const data = products.map((product) => ({
    'Produit': product.name || '',
    'Code': product.code || '',
    'Unité': product.unit || 'Pièce',
    'Quantité': product.currentStock || 0,
    'Prix d\'achat': product.purchasePrice || 0,
    'Prix de vente': product.retailPrice || 0,
    'Prix de gros': product.wholesalePrice || product.retailPrice || 0,
    'Seuil gros': product.wholesaleThreshold || 10,
    'Seuil alerte': product.alertThreshold || 5,
    'Dépôt': product.warehouseId || 'Principal',
    'Actif': product.isActive ? 'Oui' : 'Non',
    'Catégorie': product.category || '',
  }));

  // Créer la worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Définir la largeur des colonnes
  worksheet['!cols'] = [
    { wch: 30 }, // Produit
    { wch: 15 }, // Code
    { wch: 10 }, // Unité
    { wch: 10 }, // Quantité
    { wch: 12 }, // Prix d'achat
    { wch: 12 }, // Prix de vente
    { wch: 12 }, // Prix de gros
    { wch: 10 }, // Seuil gros
    { wch: 12 }, // Seuil alerte
    { wch: 15 }, // Dépôt
    { wch: 8 },  // Actif
    { wch: 20 }, // Catégorie
  ];

  // Créer le workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produits');

  // Générer le nom du fichier avec la date
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const fileName = `produits-stock-${dateStr}.xlsx`;

  // Télécharger le fichier
  XLSX.writeFile(workbook, fileName);
}

/**
 * Exporte les produits vers un fichier CSV
 */
export function exportProductsToCSV(products: Product[]): void {
  // Préparer les données pour l'export
  const data = products.map((product) => ({
    'Produit': product.name || '',
    'Code': product.code || '',
    'Unité': product.unit || 'Pièce',
    'Quantité': product.currentStock || 0,
    'Prix d\'achat': product.purchasePrice || 0,
    'Prix de vente': product.retailPrice || 0,
    'Prix de gros': product.wholesalePrice || product.retailPrice || 0,
    'Seuil gros': product.wholesaleThreshold || 10,
    'Seuil alerte': product.alertThreshold || 5,
    'Dépôt': product.warehouseId || 'Principal',
    'Actif': product.isActive ? 'Oui' : 'Non',
    'Catégorie': product.category || '',
  }));

  // Créer la worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Créer le workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produits');

  // Générer le nom du fichier avec la date
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const fileName = `produits-stock-${dateStr}.csv`;

  // Télécharger le fichier
  XLSX.writeFile(workbook, fileName);
}
