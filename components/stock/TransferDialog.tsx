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
import { Loader2, ArrowRight, Warehouse as WarehouseIcon } from 'lucide-react';

const transferSchema = z.object({
  fromWarehouseId: z.string().min(1, 'Veuillez sélectionner le dépôt source'),
  toWarehouseId: z.string().min(1, 'Veuillez sélectionner le dépôt de destination'),
  quantity: z.number().min(0.5, 'La quantité doit être d\'au moins 0.5'),
  reason: z.string().optional(),
}).refine(
  (data) => data.fromWarehouseId !== data.toWarehouseId,
  {
    message: 'Les dépôts source et destination doivent être différents',
    path: ['toWarehouseId'],
  }
);

type TransferFormData = z.infer<typeof transferSchema>;

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  warehouses: Warehouse[];
  onTransfer: (params: {
    productId: string;
    product: Product;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    reason?: string;
  }) => Promise<void>;
  isTransferring?: boolean;
}

export function TransferDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  onTransfer,
  isTransferring = false,
}: TransferDialogProps) {
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});
  const [loadingStocks, setLoadingStocks] = useState(true);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromWarehouseId: '',
      toWarehouseId: '',
      quantity: 1,
      reason: '',
    },
  });

  const fromWarehouseId = form.watch('fromWarehouseId');
  const toWarehouseId = form.watch('toWarehouseId');
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

  const availableStock = fromWarehouseId ? (stockByWarehouse[fromWarehouseId] ?? 0) : 0;
  const destinationStock = toWarehouseId ? (stockByWarehouse[toWarehouseId] ?? 0) : 0;
  const isValidQuantity = fromWarehouseId && quantity > 0 && quantity <= availableStock;

  const handleSubmit = async (data: TransferFormData) => {
    if (!isValidQuantity) {
      toast.error(`Stock insuffisant dans le dépôt source (${availableStock} ${product.unit} disponibles)`);
      return;
    }

    try {
      await onTransfer({
        productId: product.id,
        product,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        quantity: data.quantity,
        reason: data.reason || undefined,
      });
      onOpenChange(false);
      form.reset();
      toast.success('Transfert effectué avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du transfert');
    }
  };

  const fromWarehouse = warehouses.find(w => w.id === fromWarehouseId);
  const toWarehouse = warehouses.find(w => w.id === toWarehouseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transférer du stock</DialogTitle>
          <DialogDescription>
            Transférer <span className="font-semibold">{product.name}</span> entre dépôts
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Répartition du stock par dépôt */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Répartition du stock par dépôt</p>
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
                  <div className="flex items-center justify-between text-xs pt-1 border-t mt-1">
                    <span className="font-medium">Total</span>
                    <Badge variant="outline" className="font-semibold">
                      {Object.values(stockByWarehouse).reduce((sum, qty) => sum + qty, 0)} {product.unit}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Dépôt source */}
            <FormField
              control={form.control}
              name="fromWarehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dépôt source</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le dépôt source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses
                        .filter(w => w.id !== toWarehouseId)
                        .map((warehouse) => {
                          const stock = stockByWarehouse[warehouse.id] ?? 0;
                          const isDisabled = stock === 0;
                          return (
                            <SelectItem
                              key={warehouse.id}
                              value={warehouse.id}
                              disabled={isDisabled}
                            >
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
                  {fromWarehouseId && (
                    <FormDescription>
                      Stock disponible : <span className="font-semibold">{availableStock} {product.unit}</span>
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Flèche de transfert */}
            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Dépôt destination */}
            <FormField
              control={form.control}
              name="toWarehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dépôt destination</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le dépôt de destination" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses
                        .filter(w => w.id !== fromWarehouseId)
                        .map((warehouse) => {
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
                  {toWarehouseId && (
                    <FormDescription>
                      Stock actuel : <span className="font-semibold">{destinationStock} {product.unit}</span>
                      {destinationStock > 0 && (
                        <span className="text-muted-foreground">
                          {' '}→ après transfert : {destinationStock + quantity} {product.unit}
                        </span>
                      )}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantité */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité à transférer</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <NumberInput
                        min={0.5}
                        step={0.5}
                        placeholder="1"
                        value={field.value}
                        onChange={field.onChange}
                        className={isValidQuantity ? '' : 'border-orange-500'}
                      />
                      <span className="text-sm text-muted-foreground">{product.unit}</span>
                    </div>
                  </FormControl>
                  {fromWarehouseId && (
                    <FormDescription>
                      Stock disponible : {availableStock} {product.unit}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Récapitulatif du transfert */}
            {fromWarehouse && toWarehouse && quantity > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-1">Récapitulatif du transfert</p>
                <div className="flex items-center justify-between text-sm">
                  <span>{fromWarehouse.name}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{toWarehouse.name}</span>
                </div>
                <div className="mt-2 text-center">
                  <span className={`text-lg font-semibold ${isValidQuantity ? 'text-green-600' : 'text-red-600'}`}>
                    {quantity} {product.unit}
                  </span>
                  {!isValidQuantity && (
                    <p className="text-xs text-red-600 mt-1">
                      Stock insuffisant (max: {availableStock})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Raison */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison (optionnelle)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Raison du transfert..."
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
                disabled={isTransferring}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isTransferring || !fromWarehouseId || !toWarehouseId || !isValidQuantity}
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transfert en cours...
                  </>
                ) : (
                  'Transférer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
