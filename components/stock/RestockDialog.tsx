'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Product, Warehouse } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Warehouse as WarehouseIcon } from 'lucide-react';

const restockSchema = z.object({
  warehouseId: z.string().min(1, 'Veuillez sélectionner un dépôt'),
  quantity: z.number().int().min(1, 'La quantité doit être d\'au moins 1'),
  reason: z.string().optional(),
});

type RestockFormData = z.infer<typeof restockSchema>;

interface RestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  warehouses: Warehouse[];
  onRestock: (params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reason?: string;
  }) => Promise<void>;
  isRestocking?: boolean;
}

export function RestockDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  onRestock,
  isRestocking = false,
}: RestockDialogProps) {
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});
  const [loadingStocks, setLoadingStocks] = useState(true);

  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      warehouseId: '',
      quantity: 1,
      reason: '',
    },
  });

  const warehouseId = form.watch('warehouseId');
  const quantity = form.watch('quantity');

  // Charger les répartitions de stock depuis les données du produit (warehouse_quantities)
  useEffect(() => {
    if (open) {
      const stocks: Record<string, number> = {};
      if (product.warehouseQuantities) {
        product.warehouseQuantities.forEach((wq) => {
          stocks[wq.warehouseId] = wq.quantity;
        });
      }
      setStockByWarehouse(stocks);
      setLoadingStocks(false);
    }
  }, [open, product.warehouseQuantities]);

  const currentStock = warehouseId ? (stockByWarehouse[warehouseId] ?? 0) : 0;
  const newStock = currentStock + quantity;

  const handleSubmit = async (data: RestockFormData) => {
    try {
      await onRestock({
        productId: product.id,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        reason: data.reason || undefined,
      });
      onOpenChange(false);
      form.reset();
      toast.success('Approvisionnement effectué avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'approvisionnement');
    }
  };

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approvisionner le stock</DialogTitle>
          <DialogDescription>
            Ajouter du stock pour <span className="font-semibold">{product.name}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Stock actuel par dépôt */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Stock actuel par dépôt</p>
              </div>
              {loadingStocks ? (
                <p className="text-xs text-muted-foreground">Chargement...</p>
              ) : (
                <div className="space-y-1">
                  {warehouses.map((warehouse) => {
                    const stock = stockByWarehouse[warehouse.id] ?? 0;
                    return (
                      <div key={warehouse.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {warehouse.name} {warehouse.isMain ? '(Principal)' : ''}
                        </span>
                        <Badge variant={stock > 0 ? "default" : "secondary"} className="text-xs">
                          {stock} {product.unit}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dépôt à approvisionner */}
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dépôt à approvisionner</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le dépôt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((warehouse) => {
                        const stock = stockByWarehouse[warehouse.id] ?? 0;
                        return (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                {warehouse.name} {warehouse.isMain ? '(Principal)' : ''}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {stock} {product.unit}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {warehouseId && (
                    <FormDescription>
                      Stock actuel : <span className="font-semibold">{currentStock} {product.unit}</span>
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantité à ajouter */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité à ajouter</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <NumberInput
                        min={1}
                        placeholder="1"
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <span className="text-sm text-muted-foreground">{product.unit}</span>
                    </div>
                  </FormControl>
                  {warehouseId && quantity > 0 && (
                    <FormDescription>
                      Nouveau stock : <span className="font-semibold text-green-600">{newStock} {product.unit}</span>
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Récapitulatif */}
            {selectedWarehouse && quantity > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-medium mb-1 text-green-800">Récapitulatif de l'approvisionnement</p>
                <div className="text-sm text-green-700">
                  <p>Dépôt : {selectedWarehouse.name}</p>
                  <p>Stock actuel : {currentStock} {product.unit}</p>
                  <p>À ajouter : +{quantity} {product.unit}</p>
                  <p className="font-semibold text-green-800 mt-1">
                    Nouveau stock : {newStock} {product.unit}
                  </p>
                </div>
              </div>
            )}

            {/* Raison */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison / Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Approvisionnement fournisseur ABC, Bon #123..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isRestocking}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isRestocking || !warehouseId || quantity <= 0}
              >
                {isRestocking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approvisionnement...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Approvisionner
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
