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
import { Loader2, XCircle, Warehouse as WarehouseIcon } from 'lucide-react';

const lossSchema = z.object({
  warehouseId: z.string().min(1, 'Veuillez sélectionner un dépôt'),
  quantity: z.number().min(0.5, 'La quantité doit être d\'au moins 0.5'),
  reason: z.string().min(3, 'Veuillez indiquer la raison de la perte'),
});

type LossFormData = z.infer<typeof lossSchema>;

interface LossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  warehouses: Warehouse[];
  onRecordLoss: (params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reason: string;
  }) => Promise<void>;
  isRecording?: boolean;
}

export function LossDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  onRecordLoss,
  isRecording = false,
}: LossDialogProps) {
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});
  const [loadingStocks, setLoadingStocks] = useState(true);

  const form = useForm<LossFormData>({
    resolver: zodResolver(lossSchema),
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
  const newStock = currentStock - quantity;
  const isValidQuantity = warehouseId && quantity > 0 && quantity <= currentStock;

  const handleSubmit = async (data: LossFormData) => {
    if (!isValidQuantity) {
      toast.error(`Stock insuffisant (${currentStock} ${product.unit} disponibles)`);
      return;
    }

    try {
      await onRecordLoss({
        productId: product.id,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        reason: data.reason,
      });
      onOpenChange(false);
      form.reset();
      toast.success('Perte enregistrée avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enregistrer une perte</DialogTitle>
          <DialogDescription>
            Enregistrer une perte de stock pour <span className="font-semibold">{product.name}</span>
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

            {/* Dépôt */}
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dépôt concerné</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le dépôt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((warehouse) => {
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
                  {warehouseId && (
                    <FormDescription>
                      Stock disponible : <span className="font-semibold">{currentStock} {product.unit}</span>
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantité perdue */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité perdue</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <NumberInput
                        min={0.5}
                        step={0.5}
                        placeholder="1"
                        value={field.value}
                        onChange={field.onChange}
                        className={isValidQuantity ? '' : 'border-red-500'}
                      />
                      <span className="text-sm text-muted-foreground">{product.unit}</span>
                    </div>
                  </FormControl>
                  {warehouseId && quantity > 0 && (
                    <FormDescription>
                      {isValidQuantity ? (
                        <span className="text-green-600">
                          Nouveau stock : {newStock} {product.unit}
                        </span>
                      ) : (
                        <span className="text-red-600">
                          Stock insuffisant (max: {currentStock})
                        </span>
                      )}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Récapitulatif */}
            {selectedWarehouse && quantity > 0 && (
              <div className={`rounded-lg border p-3 ${
                isValidQuantity
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  <XCircle className={`h-4 w-4 ${isValidQuantity ? 'text-orange-600' : 'text-red-600'}`} />
                  Récapitulatif de la perte
                </p>
                <div className={`text-sm ${isValidQuantity ? 'text-orange-700' : 'text-red-700'}`}>
                  <p>Dépôt : {selectedWarehouse.name}</p>
                  <p>Stock actuel : {currentStock} {product.unit}</p>
                  <p>Perte : -{quantity} {product.unit}</p>
                  <p className="font-semibold mt-1">
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
                  <FormLabel>Raison de la perte *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Inondation, casse, vol, péremption, défaut qualité..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Décrivez la cause de la perte (inondation, vol, casse, péremption, etc.)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isRecording}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isRecording || !warehouseId || !isValidQuantity}
              >
                {isRecording ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Enregistrer la perte
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
