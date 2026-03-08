'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Product, Warehouse } from '@/types';
import { useProductsStore } from '@/lib/stores/useProductsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, Trash2, Search, Package, AlertCircle, Filter, ArrowRight, Plus, XCircle, X } from 'lucide-react';
import { PermissionGate } from '@/components/auth';

// Custom hook pour le debouncing
function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface ProductsTableProps {
  products: Array<Product & { displayQuantity?: number }>;
  warehouses: Warehouse[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFilterByWarehouse?: (warehouseId: string | null) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onTransfer?: (product: Product) => void;
  onRestock?: (product: Product) => void;
  onRecordLoss?: (product: Product) => void;
  onFilterByStatus?: (status: 'all' | 'ok' | 'low' | 'out' | 'inactive') => void;
  totalLoaded?: number; // Nombre total de produits chargés depuis Firestore
}

export function ProductsTable({
  products,
  warehouses,
  loading = false,
  hasMore = false,
  onLoadMore,
  onFilterByWarehouse,
  onEdit,
  onDelete,
  onTransfer,
  onRestock,
  onRecordLoss,
  onFilterByStatus,
  totalLoaded = 0,
}: ProductsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'ok' | 'low' | 'out' | 'inactive'>('all');

  // Filtrer les produits par recherche et statut (côté client)
  // IMPORTANT: Utiliser useMemo pour éviter les boucles infinies de re-render
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtre par statut
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((product) => {
        const isActive = product.isActive ?? true;

        switch (selectedStatus) {
          case 'ok':
            return isActive && product.status === 'ok';
          case 'low':
            return isActive && product.status === 'low';
          case 'out':
            return isActive && product.status === 'out';
          case 'inactive':
            return !isActive;
          default:
            return true;
        }
      });
    }

    // Filtre par recherche (si minimum 3 caractères)
    if (searchTerm.length >= 3) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.code && p.code.toLowerCase().includes(searchLower)) ||
          (p.category && p.category.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [products, selectedStatus, searchTerm]); // Dépendances correctes

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleWarehouseFilter = (warehouseId: string) => {
    const newFilter = warehouseId === 'all' ? null : warehouseId;
    setSelectedWarehouse(newFilter);
    if (onFilterByWarehouse) {
      onFilterByWarehouse(newFilter);
    }
  };

  const handleStatusFilter = (status: 'all' | 'ok' | 'low' | 'out' | 'inactive') => {
    setSelectedStatus(status);
    if (onFilterByStatus) {
      onFilterByStatus(status);
    }
  };

  const getStatusBadge = (status: 'ok' | 'low' | 'out', isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inactif</Badge>;
    }

    switch (status) {
      case 'out':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Rupture
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500">
            <AlertCircle className="h-3 w-3" />
            Stock faible
          </Badge>
        );
      default:
        return <Badge variant="default">En stock</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-4">
      {/* Recherche et filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, code... (min. 3 caractères)"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-10"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {warehouses && warehouses.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select onValueChange={handleWarehouseFilter} value={selectedWarehouse || 'all'}>
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Tous les dépôts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les dépôts</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Filtre par statut */}
        <div className="flex items-center gap-2">
          <Select onValueChange={handleStatusFilter} value={selectedStatus}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ok">En stock</SelectItem>
              <SelectItem value="low">Stock faible</SelectItem>
              <SelectItem value="out">Rupture de stock</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Prix achat</TableHead>
              <TableHead className="text-right">Prix vente</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm
                        ? 'Aucun produit trouvé pour cette recherche'
                        : selectedStatus !== 'all'
                        ? `Aucun produit avec ce statut`
                        : selectedWarehouse
                        ? `Aucun produit trouvé dans ce dépôt`
                        : 'Aucun produit. Créez votre premier produit pour commencer.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.code && (
                        <span className="text-xs text-muted-foreground">{product.code}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.purchasePrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.retailPrice)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">
                      {useProductsStore.getState().getProductDisplayStock(product.id)}
                      {product.unit && ` ${product.unit}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(product.status, product.isActive ?? true)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <PermissionGate module="stock" action="restock">
                        {onRestock && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRestock(product)}
                            title="Approvisionner"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate module="stock" action="loss">
                        {onRecordLoss && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRecordLoss(product)}
                            title="Enregistrer une perte"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate module="stock" action="transfer">
                        {onTransfer && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onTransfer(product)}
                            title="Transférer du stock"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate module="stock" action="update">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate module="stock" action="delete">
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Charger plus de produits depuis Firestore */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Chargement...' : `Charger plus de produits (${totalLoaded} chargés)`}
          </Button>
        </div>
      )}
    </div>
  );
}
