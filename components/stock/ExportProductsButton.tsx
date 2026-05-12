'use client';

import { useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet } from 'lucide-react';
import { exportProductsToExcel, exportProductsToCSV } from '@/lib/utils/excelGenerator';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Product } from '@/types';
import { toast } from 'sonner';

export function ExportProductsButton() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllProducts = async (): Promise<Product[]> => {
    if (!user?.currentCompanyId) return [];

    const q = query(
      collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)),
      orderBy('name')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
  };

  const handleExportExcel = async () => {
    if (!user?.currentCompanyId) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setIsExporting(true);
    try {
      const allProducts = await fetchAllProducts();

      if (allProducts.length === 0) {
        toast.error('Aucun produit à exporter');
        return;
      }

      exportProductsToExcel(allProducts);
      toast.success(`${allProducts.length} produit(s) exporté(s) en Excel`);
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      toast.error('Erreur lors de l\'export Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!user?.currentCompanyId) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setIsExporting(true);
    try {
      const allProducts = await fetchAllProducts();

      if (allProducts.length === 0) {
        toast.error('Aucun produit à exporter');
        return;
      }

      exportProductsToCSV(allProducts);
      toast.success(`${allProducts.length} produit(s) exporté(s) en CSV`);
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Export...' : 'Exporter'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Exporter en Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Exporter en CSV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
