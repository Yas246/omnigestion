'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet } from 'lucide-react';
import { exportProductsToExcel, exportProductsToCSV } from '@/lib/utils/excelGenerator';
import { useAuth } from '@/lib/auth-context';
import type { Product } from '@/types';
import { toast } from 'sonner';

export function ExportProductsButton() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllProducts = async (): Promise<Product[]> => {
    const res = await api.get<{ data: any[] } | any[]>('/products?limit=500');
    const arr = Array.isArray(res) ? res : (res as any).data ?? [];
    return arr.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      code: p.code ?? '',
      category: p.category ?? '',
      purchasePrice: Number(p.purchasePrice),
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      currentStock: p.currentStock,
      alertThreshold: p.alertThreshold,
      status: p.status,
      unit: p.unit ?? '',
      isActive: p.isActive,
    })) as Product[];
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
