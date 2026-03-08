'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ProductWithStockInfo {
  productId: string;
  productName: string;
  requiredQuantity: number;
  availableInPrimary: number;
  missingQuantity: number;
  availableInOtherWarehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    availableQuantity: number;
  }>;
}

interface StockTransferModalProps {
  open: boolean;
  onClose: () => void;
  products: ProductWithStockInfo[];
  onConfirm: (transfers: Array<{ productId: string; fromWarehouseId: string; quantity: number }>) => Promise<void>;
  isLoading?: boolean;
}

export function StockTransferModal({
  open,
  onClose,
  products,
  onConfirm,
  isLoading = false,
}: StockTransferModalProps) {
  // État pour stocker les sélections de l'utilisateur
  const [transfers, setTransfers] = useState<Record<string, { fromWarehouseId: string; quantity: number }>>({});

  // Initialiser les transferts par défaut quand les produits changent
  useEffect(() => {
    const defaultTransfers: Record<string, { fromWarehouseId: string; quantity: number }> = {};

    products.forEach((product) => {
      if (product.availableInOtherWarehouses.length > 0) {
        // Choisir le premier dépôt qui a assez de stock
        const suitableWarehouse = product.availableInOtherWarehouses.find(
          (w) => w.availableQuantity >= product.missingQuantity
        );

        if (suitableWarehouse) {
          defaultTransfers[product.productId] = {
            fromWarehouseId: suitableWarehouse.warehouseId,
            quantity: product.missingQuantity,
          };
        } else {
          // Sinon, choisir le premier et prendre tout ce qu'il a
          const firstWarehouse = product.availableInOtherWarehouses[0];
          defaultTransfers[product.productId] = {
            fromWarehouseId: firstWarehouse.warehouseId,
            quantity: Math.min(firstWarehouse.availableQuantity, product.missingQuantity),
          };
        }
      }
    });

    setTransfers(defaultTransfers);
  }, [products]);

  const handleConfirm = async () => {
    // Convertir l'objet en tableau
    const transfersArray = Object.entries(transfers).map(([productId, transfer]) => ({
      productId,
      fromWarehouseId: transfer.fromWarehouseId,
      quantity: transfer.quantity,
    }));

    // Vérifier que tous les produits ont un transfert configuré
    const missingTransfers = products.filter(
      (p) => !transfers[p.productId] || transfers[p.productId].quantity === 0
    );

    if (missingTransfers.length > 0) {
      toast.error('Veuillez configurer les transferts pour tous les produits');
      return;
    }

    await onConfirm(transfersArray);
  };

  const canConfirm = products.every(
    (p) => transfers[p.productId] && transfers[p.productId].quantity > 0
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Transfert de stock nécessaire
          </DialogTitle>
          <DialogDescription>
            Certains produits n&apos;ont pas assez de stock dans le dépôt principal.
            Veuillez sélectionner les transferts à effectuer pour pouvoir créer la facture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {products.map((product) => {
            const transfer = transfers[product.productId] || { fromWarehouseId: '', quantity: 0 };

            return (
              <div key={product.productId} className="border rounded-lg p-4 space-y-3">
                {/* En-tête du produit */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{product.productName}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Requis : <span className="font-semibold text-foreground">{product.requiredQuantity}</span>
                  </div>
                </div>

                {/* Informations de stock */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Stock dépôt principal</div>
                    <div className="font-semibold text-red-600">{product.availableInPrimary}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Manquant</div>
                    <div className="font-semibold text-orange-600">{product.missingQuantity}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Disponible ailleurs</div>
                    <div className="font-semibold text-green-600">
                      {product.availableInOtherWarehouses.reduce((sum, w) => sum + w.availableQuantity, 0)}
                    </div>
                  </div>
                </div>

                {/* Sélection du transfert */}
                {product.availableInOtherWarehouses.length > 0 ? (
                  <div className="flex items-center gap-4 pt-2 border-t">
                    <div className="flex-1">
                      <label className="text-sm text-muted-foreground mb-1 block">
                        Transférer depuis
                      </label>
                      <Select
                        value={transfer.fromWarehouseId}
                        onValueChange={(value) =>
                          setTransfers((prev) => ({
                            ...prev,
                            [product.productId]: {
                              ...prev[product.productId],
                              fromWarehouseId: value,
                              quantity: Math.min(
                                product.availableInOtherWarehouses.find((w) => w.warehouseId === value)
                                  ?.availableQuantity || 0,
                                product.missingQuantity
                              ),
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un dépôt" />
                        </SelectTrigger>
                        <SelectContent>
                          {product.availableInOtherWarehouses.map((warehouse) => (
                            <SelectItem
                              key={warehouse.warehouseId}
                              value={warehouse.warehouseId}
                              disabled={warehouse.availableQuantity < product.missingQuantity}
                            >
                              {warehouse.warehouseName} ({warehouse.availableQuantity} disponibles)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />

                    <div className="w-32">
                      <label className="text-sm text-muted-foreground mb-1 block">
                        Quantité
                      </label>
                      <div className="font-semibold text-lg">
                        {transfer.quantity || product.missingQuantity}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-600 pt-2 border-t">
                    Aucun stock disponible dans les autres dépôts
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler la facture
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? 'Transfert en cours...' : 'Effectuer les transferts et créer la facture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
