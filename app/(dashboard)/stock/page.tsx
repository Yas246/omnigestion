'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/lib/hooks/useProducts';
import { useStockMovements } from '@/lib/hooks/useStockMovements';
import { useSettings } from '@/lib/hooks/useSettings';
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
import { ImportProductsModal } from '@/components/stock/ImportProductsModal';
import { ExportProductsButton } from '@/components/stock/ExportProductsButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Package, AlertTriangle, Upload, RefreshCw } from 'lucide-react';

export default function StockPage() {
  const { user } = useAuth();
  const {
    products,
    loading,
    error,
    hasMore,
    fetchProducts,
    loadMore,
    createProduct,
    updateProduct,
    deleteProduct,
    filterByWarehouse,
  } = useProducts();

  const { warehouses, settings } = useSettings();
  const { canCreateProduct } = usePermissions();
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
  const [filteredProducts, setFilteredProducts] = useState<Array<Product & { displayQuantity?: number }>>(products);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [showMovementsHistory, setShowMovementsHistory] = useState(false);

  // Statistiques globales (tous les produits)
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    active: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Mettre à jour la liste filtrée quand les produits changent
  useEffect(() => {
    if (!selectedWarehouse) {
      setFilteredProducts(products);
    }
  }, [products, selectedWarehouse]);

  // Charger les statistiques globales depuis Firestore
  const fetchGlobalStats = async () => {
    if (!user?.currentCompanyId) return;

    setIsLoadingStats(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db, COLLECTIONS } = await import('@/lib/firebase');

      const q = query(
        collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)),
        where('companyId', '==', user.currentCompanyId)
      );

      const snapshot = await getDocs(q);
      const allProducts = snapshot.docs.map(doc => doc.data() as Product);

      // Calculer les statistiques
      const activeProducts = allProducts.filter(p => p.isActive);
      const lowStock = activeProducts.filter(p => p.currentStock > 0 && p.currentStock <= p.alertThreshold).length;
      const outOfStock = activeProducts.filter(p => p.currentStock === 0).length;
      const inStock = activeProducts.length - lowStock - outOfStock;

      setGlobalStats({
        total: allProducts.length,
        active: activeProducts.length,
        inStock,
        lowStock,
        outOfStock,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Charger les stats au montage et après import
  useEffect(() => {
    fetchGlobalStats();
  }, [user?.currentCompanyId]);

  const handleCreate = async (data: any) => {
    setIsSubmitting(true);
    try {
      await createProduct(data);
      fetchProducts();
      fetchGlobalStats();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingProduct) return;
    setIsSubmitting(true);
    try {
      await updateProduct(editingProduct.id, data);
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
      await fetchProducts();
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
      await recordInMovement(params);
      await fetchProducts();
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
      await recordOutMovement(params);
      await fetchProducts();
      await fetchMovements();
    } finally {
      setIsRecordingLoss(false);
    }
  };

  const handleFilterByWarehouse = async (warehouseId: string | null) => {
    setIsFiltering(true);
    setSelectedWarehouse(warehouseId);

    if (!warehouseId) {
      // Afficher tous les produits avec quantité totale
      const productsWithQuantities = await filterByWarehouse(null);
      setFilteredProducts(productsWithQuantities);
    } else {
      // Filtrer par dépôt avec les quantités spécifiques
      const productsWithQuantities = await filterByWarehouse(warehouseId);
      setFilteredProducts(productsWithQuantities);
    }

    setIsFiltering(false);
  };

  // Calculer les statistiques pour l'affichage (basées sur les produits filtrés)
  const totalProducts = filteredProducts.length;
  const activeProducts = filteredProducts.filter((p) => p.isActive).length;

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
            onClick={() => fetchProducts(true)}
            disabled={loading}
            title="Forcer le rechargement depuis Firestore"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total produits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingStats ? '...' : globalStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {isLoadingStats ? '...' : globalStats.active} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En stock</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoadingStats ? '...' : globalStats.inStock}
            </div>
            <p className="text-xs text-muted-foreground">
              Stock normal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock faible</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{isLoadingStats ? '...' : globalStats.lowStock}</div>
            <p className="text-xs text-muted-foreground">
              Sous le seuil d&apos;alerte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rupture de stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{isLoadingStats ? '...' : globalStats.outOfStock}</div>
            <p className="text-xs text-muted-foreground">
              Épuisé
            </p>
          </CardContent>
        </Card>
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
            products={selectedWarehouse ? filteredProducts : products}
            warehouses={warehouses}
            loading={loading}
            hasMore={selectedWarehouse ? false : hasMore}
            onLoadMore={selectedWarehouse ? undefined : loadMore}
            onFilterByWarehouse={handleFilterByWarehouse}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTransfer={handleOpenTransferDialog}
            onRestock={handleOpenRestockDialog}
            onRecordLoss={handleOpenLossDialog}
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
                productName: products.find(p => p.id === m.productId)?.name,
                warehouseName: warehouses.find(w => w.id === m.warehouseId)?.name,
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
          // Forcer le rechargement depuis Firestore pour synchroniser les IDs
          fetchProducts(true);
          fetchGlobalStats();
        }}
      />
    </div>
  );
}
