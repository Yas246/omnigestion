'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProductsRealtime, useProducts } from '@/lib/api/hooks/useProducts';
import { useProductsStore } from '@/lib/stores/useProductsStore';
import { useStockMovements } from '@/lib/api/hooks/useStock';
import { useSettings } from '@/lib/api/hooks/useSettings';
import { api } from '@/lib/api/client';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/auth-context';
import { PermissionGate } from '@/components/auth';
import type { Product } from '@/types';
import { ProductDialog } from '@/components/products/ProductDialog';
import { ProductsTable } from '@/components/products/ProductsTable';
import { TransferDialog } from '@/components/stock/TransferDialog';
import { RestockDialog } from '@/components/stock/RestockDialog';
import { LossDialog } from '@/components/stock/LossDialog';
import { StockMovementsTable } from '@/components/stock/StockMovementsTable';
import { ProductMovementHistoryDialog } from '@/components/stock/ProductMovementHistoryDialog';
import { ImportProductsModal } from '@/components/stock/ImportProductsModal';
import { ExportProductsButton } from '@/components/stock/ExportProductsButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Plus, Package, AlertTriangle, Upload, RefreshCw, DollarSign } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function StockPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Products come from the API (React Query). Each product already carries its
  // per-warehouse breakdown (warehouseQuantities) from the backend.
  const { products: rawProducts, isLoading } = useProductsRealtime();
  const { createProduct, updateProduct, deleteProduct } = useProducts();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Écouter les changements de filtres dans le store Zustand
  const filters = useProductsStore(state => state.filters);

  // Filtrer les produits localement avec useMemo (maintenant filters est dans les dépendances)
  const filteredProducts = useMemo(() => {
    let filtered = rawProducts;

    // Filtrer par entrepôt
    if (filters.warehouseId) {
      filtered = filtered.filter(p => {
        const warehouseQty = p.warehouseQuantities?.find(wq => wq.warehouseId === filters.warehouseId);
        return warehouseQty && warehouseQty.quantity > 0;
      });
    }

    // Filtrer par catégorie
    if (filters.category) {
      filtered = filtered.filter(p => p.category === filters.category);
    }

    // Filtrer par recherche
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.code && p.code.toLowerCase().includes(search))
      );
    }

    // Filtrer par plage de prix (retailPrice)
    if (filters.minPrice !== null) {
      filtered = filtered.filter(p => p.retailPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
      filtered = filtered.filter(p => p.retailPrice <= filters.maxPrice!);
    }

    return filtered;
  }, [rawProducts, filters]); // ✅ Maintenant filters est dans les dépendances !

  const { warehouses, settings } = useSettings();
  const { canCreateProduct, canAccessModule, getFirstAccessiblePage } = usePermissions();

  // Vérifier les permissions - rediriger si pas d'accès
  useEffect(() => {
    if (!canAccessModule('stock')) {
      router.push(getFirstAccessiblePage());
    }
  }, [canAccessModule, getFirstAccessiblePage, router]);
  const {
    movements,
    loading: movementsLoading,
    hasMore: movementsHasMore,
    loadMore: loadMoreMovements,
    transferStock,
    recordInMovement,
    recordOutMovement,
    fetchMovements,
  } = useStockMovements();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [isLossDialogOpen, setIsLossDialogOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [transferringProduct, setTransferringProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [lossProduct, setLossProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isRestocking, setIsRestocking] = useState(false);
  const [isRecordingLoss, setIsRecordingLoss] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [showMovementsHistory, setShowMovementsHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Global stats derived from the (cached) products list.
  const globalStats = useMemo(() => {
    const activeProducts = rawProducts.filter(p => p.isActive);
    const lowStock = activeProducts.filter(p => p.currentStock > 0 && p.currentStock <= p.alertThreshold).length;
    const outOfStock = activeProducts.filter(p => p.currentStock === 0).length;
    const inStock = activeProducts.length - lowStock - outOfStock;

    // Bénéfice estimé du stock : (prix vente - prix achat) × stock pour chaque produit
    const estimatedProfit = activeProducts.reduce((sum, p) => {
      const profit = ((p.retailPrice || 0) - (p.purchasePrice || 0)) * (p.currentStock || 0);
      return sum + Math.max(0, profit);
    }, 0);

    return {
      total: rawProducts.length,
      active: activeProducts.length,
      inStock,
      lowStock,
      outOfStock,
      estimatedProfit,
    };
  }, [rawProducts]);

  // Mettre à jour le filtre d'entrepôt dans le store Zustand
  useEffect(() => {
    useProductsStore.getState().setWarehouseFilter(selectedWarehouse);
  }, [selectedWarehouse]);

  const handleCreate = async (data: any) => {
    const normalizedName = data.name.trim().toLowerCase();
    const duplicate = rawProducts.find((p) => !p.deletedAt && p.name.trim().toLowerCase() === normalizedName);
    if (duplicate) {
      throw new Error(`Un produit "${duplicate.name}" existe déjà.`);
    }

    setIsSubmitting(true);
    try {
      // 1. Create the product (stock is NOT a product field — it lives in
      //    product_stock_locations, mutated only via stock operations).
      const { currentStock, stockAllocations, ...productData } = data;
      const created: any = await createProduct(productData);
      const newId = created?.id;

      // 2. Create the initial stock: advanced mode → per-depot allocations;
      //    simple mode → the whole quantity in the default depot.
      if (newId) {
        const allocations: Array<{ warehouseId: string; quantity: number }> =
          stockAllocations && stockAllocations.length > 0
            ? stockAllocations
            : currentStock > 0 && settings?.stock?.defaultWarehouseId
              ? [{ warehouseId: settings.stock.defaultWarehouseId, quantity: currentStock }]
              : [];
        for (const a of allocations) {
          if (a.quantity > 0) {
            await api.post('/stock/restock', {
              productId: Number(newId),
              warehouseId: Number(a.warehouseId),
              quantity: Number(a.quantity),
            });
          }
        }
        // Re-invalidate AFTER the restocks complete — createProduct already
        // invalidated ['products'] (racing the refetch against these restocks);
        // without this final invalidate the list refetch can land before the
        // stock_locations exist and show the new product at 0 stock.
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingProduct) return;
    setIsSubmitting(true);
    try {
      // Stock is managed via stock operations (restock/loss/transfer), NOT by
      // editing the product. Only product fields are persisted here.
      const { currentStock, stockAllocations, ...productData } = data;
      await updateProduct(editingProduct.id, productData);
    } catch (error) {
      console.error('[handleUpdate] Erreur:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      return;
    }
    try {
      await deleteProduct(id);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleOpenTransferDialog = (product: Product) => {
    setTransferringProduct(product);
    setIsTransferDialogOpen(true);
  };

  const handleTransfer = async (params: {
    productId: string;
    product: Product;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    reason?: string;
  }) => {
    setIsTransferring(true);
    try {
      await transferStock(params);
      // The mutation's onSuccess invalidates ['stock-movements'] + ['products'],
      // so both the movements history and the products list (stock display)
      // refetch automatically.
      await fetchMovements();
    } finally {
      setIsTransferring(false);
    }
  };

  const handleOpenRestockDialog = (product: Product) => {
    setRestockingProduct(product);
    setIsRestockDialogOpen(true);
  };

  const handleRestock = async (params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reason?: string;
  }) => {
    setIsRestocking(true);
    try {
      await recordInMovement({ ...params, referenceType: 'restock' });
      // The mutation's onSuccess invalidates ['stock-movements'] + ['products'],
      // so both the movements history and the products list (stock display)
      // refetch automatically.
      await fetchMovements();
    } finally {
      setIsRestocking(false);
    }
  };

  const handleOpenLossDialog = (product: Product) => {
    setLossProduct(product);
    setIsLossDialogOpen(true);
  };

  const handleRecordLoss = async (params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reason: string;
  }) => {
    setIsRecordingLoss(true);
    try {
      await recordOutMovement({ ...params, referenceType: 'loss' });
      // The mutation's onSuccess invalidates ['stock-movements'] + ['products'],
      // so both the movements history and the products list (stock display)
      // refetch automatically.
      await fetchMovements();
    } finally {
      setIsRecordingLoss(false);
    }
  };

  const handleFilterByWarehouse = async (warehouseId: string | null) => {
    setIsFiltering(true);
    setSelectedWarehouse(warehouseId);

    // Utiliser le filtre local du store (pas de rechargement Firestore)
    useProductsStore.getState().setWarehouseFilter(warehouseId);

    setIsFiltering(false);
  };

  // Force a refetch of products + stock movements from the API.
  const handleRefreshWarehouseQuantities = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculer les statistiques pour l'affichage (basées sur les produits filtrés)
  const totalProducts = rawProducts.length;
  const activeProducts = rawProducts.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
          <p className="text-muted-foreground">
            Gérez vos produits et vos niveaux de stock
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshWarehouseQuantities}
            disabled={isRefreshing || isLoading}
            title="Actualiser les produits et les mouvements depuis l'API"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <PermissionGate module="stock" action="create">
            <Button onClick={handleOpenDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau produit
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-5">
        <KpiCard variant="info">
          <KpiCardHeader
            title="Total produits"
            icon={<Package className="h-5 w-5" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={isLoading ? '...' : globalStats.total}
            label={`${isLoading ? '...' : globalStats.active} actifs`}
            variant="info"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="En stock"
            icon={<Package className="h-5 w-5" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={isLoading ? '...' : globalStats.inStock}
            label="Stock normal"
            variant="success"
          />
        </KpiCard>

        <KpiCard variant="warning">
          <KpiCardHeader
            title="Stock faible"
            icon={<AlertTriangle className="h-5 w-5" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={isLoading ? '...' : globalStats.lowStock}
            label="Sous le seuil d'alerte"
            variant="warning"
          />
        </KpiCard>

        <KpiCard variant="danger">
          <KpiCardHeader
            title="Rupture de stock"
            icon={<AlertTriangle className="h-5 w-5" />}
            iconVariant="danger"
          />
          <KpiCardValue
            value={isLoading ? '...' : globalStats.outOfStock}
            label="Épuisé"
            variant="danger"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="Bénéfice estimé"
            icon={<DollarSign className="h-5 w-5" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={isLoading ? '...' : `${globalStats.estimatedProfit.toLocaleString()} FCFA`}
            label="Basé sur le stock actuel"
            variant="success"
          />
        </KpiCard>
      </div>

      {/* Liste des produits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Produits</CardTitle>
              <CardDescription>
                Liste de tous vos produits avec leurs niveaux de stock
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <PermissionGate module="stock" action="create">
                <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer
                </Button>
              </PermissionGate>
              <PermissionGate module="stock" action="read">
                <ExportProductsButton />
              </PermissionGate>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProductsTable
            products={filteredProducts}
            warehouses={warehouses}
            loading={isLoading}
            onFilterByWarehouse={handleFilterByWarehouse}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTransfer={handleOpenTransferDialog}
            onRestock={handleOpenRestockDialog}
            onRecordLoss={handleOpenLossDialog}
            onViewHistory={(product) => {
              setHistoryProduct(product);
              setIsHistoryDialogOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Historique des mouvements de stock */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mouvements de stock</CardTitle>
              <CardDescription>
                Historique des transferts et mouvements de stock
              </CardDescription>
            </div>
            <PermissionGate module="stock" action="movements">
              <Button
                variant="outline"
                onClick={() => setShowMovementsHistory(!showMovementsHistory)}
              >
                {showMovementsHistory ? 'Masquer' : 'Afficher'}
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        {showMovementsHistory && (
          <CardContent>
            <StockMovementsTable
              movements={movements.map(m => ({
                ...m,
                productName: rawProducts.find(p => p.id === m.productId)?.name,
                warehouseName: warehouses.find((w: any) => w.id === m.warehouseId)?.name,
              }))}
              loading={movementsLoading}
              hasMore={movementsHasMore}
              onLoadMore={loadMoreMovements}
            />
          </CardContent>
        )}
      </Card>

      {/* Dialog création/édition produit */}
      <ProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        warehouses={warehouses}
        defaultWarehouseId={settings?.stock?.defaultWarehouseId}
        onSubmit={editingProduct ? handleUpdate : handleCreate}
        isSubmitting={isSubmitting}
      />

      {/* Dialog transfert de stock */}
      {transferringProduct && (
        <TransferDialog
          open={isTransferDialogOpen}
          onOpenChange={setIsTransferDialogOpen}
          product={transferringProduct}
          warehouses={warehouses}
          onTransfer={handleTransfer}
          isTransferring={isTransferring}
        />
      )}

      {/* Dialog approvisionnement */}
      {restockingProduct && (
        <RestockDialog
          open={isRestockDialogOpen}
          onOpenChange={setIsRestockDialogOpen}
          product={restockingProduct}
          warehouses={warehouses}
          onRestock={handleRestock}
          isRestocking={isRestocking}
        />
      )}

      {/* Dialog perte de stock */}
      {lossProduct && (
        <LossDialog
          open={isLossDialogOpen}
          onOpenChange={setIsLossDialogOpen}
          product={lossProduct}
          warehouses={warehouses}
          onRecordLoss={handleRecordLoss}
          isRecording={isRecordingLoss}
        />
      )}

      {/* Modal d'import de produits */}
      <ImportProductsModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportComplete={() => {
          // Les KPI se mettront à jour automatiquement via onSnapshot
        }}
      />

      {/* Dialog historique mouvements par produit */}
      <ProductMovementHistoryDialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        product={historyProduct}
      />
    </div>
  );
}
