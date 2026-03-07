import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any, row: any) => string | number;
  width?: number;
}

export interface ExportData {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
}

/**
 * Export des données en Excel avec formatage
 */
export function exportToExcel(exportData: ExportData, fileName?: string): void {
  const { title, subtitle, columns, data } = exportData;

  // Préparer les en-têtes
  const headers = columns.map(col => col.header);

  // Préparer les données
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value, row) : value;
    })
  );

  // Créer le workbook
  const wb = XLSX.utils.book_new();

  // Créer la feuille avec les données
  const wsData = [
    [title], // Titre principal
    ...(subtitle ? [[subtitle]] : []), // Sous-titre
    [], // Ligne vide
    headers, // En-têtes de colonnes
    ...rows, // Données
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Définir les largeurs de colonnes
  const colWidths = columns.map(col => ({
    wch: col.width || (col.header.length + 10),
  }));
  ws['!cols'] = colWidths;

  // Fusionner les cellules du titre
  if (headers.length > 0) {
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, // Titre
      ...(subtitle ? [{ s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }] : []), // Sous-titre
    ];
  }

  // Ajouter la feuille au workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Rapport');

  // Générer le nom du fichier
  const defaultFileName = `${title}_${format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: fr })}.xlsx`;
  const finalFileName = fileName || defaultFileName;

  // Télécharger le fichier
  XLSX.writeFile(wb, finalFileName);
}

/**
 * Export des données en CSV
 */
export function exportToCSV(exportData: ExportData, fileName?: string): void {
  const { title, columns, data } = exportData;

  // Préparer les en-têtes
  const headers = columns.map(col => col.header).join(',');

  // Préparer les données
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      const formattedValue = col.format ? col.format(value, row) : value;
      // Échapper les guillemets et mettre entre guillemets si contient une virgule
      const stringValue = String(formattedValue ?? '');
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  // Combiner tout
  const csvContent = [headers, ...rows].join('\n');

  // Créer le blob et télécharger
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const defaultFileName = `${title}_${format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: fr })}.csv`;
  const finalFileName = fileName || defaultFileName;

  link.setAttribute('href', url);
  link.setAttribute('download', finalFileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formateurs de données courants
 */
export const DataFormatters = {
  currency: (value: number) => value ? new Intl.NumberFormat('fr-FR').format(value) : '0',
  currencyWithSymbol: (value: number) => value ? `${new Intl.NumberFormat('fr-FR').format(value)} FCFA` : '0 FCFA',
  percent: (value: number, decimals: number = 1) => value ? `${value.toFixed(decimals)}%` : '0%',
  date: (value: Date | string) => {
    if (!value) return '-';
    return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: fr });
  },
  dateOnly: (value: Date | string) => {
    if (!value) return '-';
    return format(new Date(value), 'dd/MM/yyyy', { locale: fr });
  },
  number: (value: number, decimals: number = 0) => value ? value.toFixed(decimals) : '0',
  quantity: (value: number, unit?: string) => {
    if (!value) return '0';
    return unit ? `${value} ${unit}` : `${value}`;
  },
};
