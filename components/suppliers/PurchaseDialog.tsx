'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Package, AlertTriangle } from 'lucide-react';
import { useProducts } from '@/lib/hooks/useProducts';
import { useWarehouses } from '@/lib/hooks/useWarehouses';
import { useSupplierPurchases } from '@/lib/hooks/useSupplierPurchases';
import type { Product } from '@/types';

// Hook pour le debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

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

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Le fournisseur est requis'),
  paymentMethod: z.enum(['cash', 'bank', 'mobile', 'credit']),
  paidAmount: z.number().min(0),
  addToStockNow: z.boolean(),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Array<{ id: string; name: string }>;
}

export function PurchaseDialog({ open, onOpenChange, suppliers }: PurchaseDialogProps) {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();
  const { createPurchase } = useSupplierPurchases();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Debouncing pour les recherches (300ms)
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300);

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: '',
      paymentMethod: 'cash',
      paidAmount: 0,
      addToStockNow: true,
      warehouseId: '',
      notes: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const addToStockNow = form.watch('addToStockNow');

  // Filtrer les produits selon la recherche (min 3 caractères)
  const filteredProducts = products.filter(p => {
    if (debouncedProductSearch.length < 3) return false;
    return p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      p.code?.toLowerCase().includes(debouncedProductSearch.toLowerCase());
  });

  // Filtrer les fournisseurs selon la recherche (min 3 caractères)
  const filteredSuppliers = suppliers.filter(s => {
    if (debouncedSupplierSearch.length < 3) return false;
    return s.name.toLowerCase().includes(debouncedSupplierSearch.toLowerCase());
  });

  // Réinitialiser la recherche du fournisseur à l'ouverture
  useEffect(() => {
    if (open) {
      setSupplierSearch('');
      setProductSearch('');
    }
  }, [open]);

  // Fermer le dropdown du fournisseur quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSupplierDropdown(false);
    };

    if (showSupplierDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSupplierDropdown]);

  // Calculer les totaux
  const total = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const remainingAmount = total - form.watch('paidAmount');

  // Ajouter un produit à l'achat
  const addProduct = () => {
    if (!selectedProductId) return;
    addProductById(selectedProductId);
    setSelectedProductId('');
  };

  const addProductById = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Vérifier si le produit est déjà dans l'achat
    const existingItemIndex = items.findIndex(item => item.productId === product.id);

    if (existingItemIndex >= 0) {
      toast.error('Ce produit est déjà dans la liste');
      return;
    }

    const newItem: PurchaseItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.purchasePrice || 0,
    };
    setItems([...items, newItem]);
    setProductSearch('');
  };

  // Supprimer un produit de l'achat
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Mettre à jour la quantité d'un item
  const updateItemQuantity = (index: number, quantity: number) => {
    const updatedItems = [...items];
    updatedItems[index].quantity = Math.max(1, quantity);
    setItems(updatedItems);
  };

  // Mettre à jour le prix unitaire d'un item
  const updateItemPrice = (index: number, price: number) => {
    const updatedItems = [...items];
    updatedItems[index].unitPrice = Math.max(0, price);
    setItems(updatedItems);
  };

  const handleSubmit = async (data: PurchaseFormData) => {
    if (items.length === 0) {
      toast.error('Ajoutez au moins un produit');
      return;
    }

    if (data.addToStockNow && !data.warehouseId) {
      toast.error('Sélectionnez un dépôt pour ajouter au stock');
      return;
    }

    if (data.paymentMethod !== 'credit' && data.paidAmount > total) {
      toast.error('Le montant payé ne peut pas dépasser le total');
      return;
    }

    setIsSubmitting(true);
    try {
      const supplier = suppliers.find(s => s.id === data.supplierId);
      if (!supplier) throw new Error('Fournisseur non trouvé');

      await createPurchase({
        supplierId: supplier.id,
        supplierName: supplier.name,
        items,
        paymentMethod: data.paymentMethod,
        paidAmount: data.paymentMethod === 'credit' ? 0 : data.paidAmount,
        addToStockNow: data.addToStockNow,
        warehouseId: data.warehouseId,
        notes: data.notes,
      });

      onOpenChange(false);
      form.reset();
      setItems([]);
      toast.success('Achat enregistré avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de l\'achat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel achat fournisseur</DialogTitle>
          <DialogDescription>
            Enregistrez un achat auprès d'un fournisseur
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Fournisseur */}
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fournisseur *</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        placeholder="Rechercher un fournisseur (min 3 caractères)..."
                        value={supplierSearch}
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setShowSupplierDropdown(true);
                        }}
                        onFocus={() => setShowSupplierDropdown(true)}
                      />
                    </FormControl>
                    {showSupplierDropdown && debouncedSupplierSearch.length >= 3 && filteredSuppliers.length > 0 && (
                      <div
                        className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {filteredSuppliers.map((supplier) => (
                          <div
                            key={supplier.id}
                            className="px-3 py-2 hover:bg-muted cursor-pointer"
                            onClick={() => {
                              field.onChange(supplier.id);
                              setSupplierSearch(supplier.name);
                              setShowSupplierDropdown(false);
                            }}
                          >
                            <span className="font-medium">{supplier.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {field.value && !showSupplierDropdown && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        Sélectionné: <span className="font-medium">{suppliers.find(s => s.id === field.value)?.name}</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="ml-2 h-auto p-0"
                          onClick={() => {
                            field.onChange('');
                            setSupplierSearch('');
                          }}
                        >
                          Changer
                        </Button>
                      </div>
                    )}
                    {debouncedSupplierSearch.length >= 3 && filteredSuppliers.length === 0 && (
                      <div
                        className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-3 text-sm text-muted-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Aucun fournisseur trouvé
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ajout de produits avec recherche */}
            <div className="space-y-3">
              <FormLabel>Ajouter des produits</FormLabel>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Rechercher un produit par nom ou code (min 3 caractères)..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch.length > 0 && productSearch.length < 3 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                      Continuez à taper... (min 3 caractères)
                    </div>
                  )}
                  {debouncedProductSearch.length >= 3 && filteredProducts.length > 0 && (
                    <div
                      className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {filteredProducts.slice(0, 10).map((product) => (
                        <div
                          key={product.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            addProductById(product.id);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              {product.code && (
                                <span className="text-xs text-muted-foreground">{product.code}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground">
                                Prix actuel: {product.purchasePrice?.toLocaleString() || 0} FCFA
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {debouncedProductSearch.length >= 3 && filteredProducts.length === 0 && (
                    <div
                      className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-3 text-sm text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Aucun produit trouvé
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={addProduct}
                  disabled={!selectedProductId}
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Liste des produits */}
            {items.length > 0 && (
              <div className="space-y-2">
                <FormLabel>Produits ajoutés</FormLabel>
                <div className="rounded-lg border">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium">
                    <div className="col-span-4">Produit</div>
                    <div className="col-span-2 text-center">Qté</div>
                    <div className="col-span-3 text-right">Prix achat</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  {items.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const systemPrice = product?.purchasePrice || 0;
                    const priceChanged = item.unitPrice !== systemPrice;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 p-3 border-t">
                        <div className="col-span-4">
                          <div className="font-medium text-sm">{item.productName}</div>
                        </div>
                        <div className="col-span-2">
                          <NumberInput
                            min={1}
                            placeholder="1"
                            value={item.quantity}
                            onChange={(value) => updateItemQuantity(index, value || 1)}
                            className="text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <div className="relative">
                            <NumberInput
                              min={0}
                              placeholder="0"
                              value={item.unitPrice}
                              onChange={(value) => updateItemPrice(index, value || 0)}
                              className="text-right pr-8"
                            />
                            {priceChanged && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full" title="Prix modifié (sera mis à jour dans le système)" />
                              </div>
                            )}
                          </div>
                          {product && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Système: {formatPrice(systemPrice)} FCFA
                              {priceChanged && (
                                <span className="text-orange-600 ml-1">→ {formatPrice(item.unitPrice)} FCFA</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <div className="font-medium">{formatPrice(item.unitPrice * item.quantity)} FCFA</div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode de paiement */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Paiement</h3>

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode de paiement</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="mobile">Mobile Money</SelectItem>
                        <SelectItem value="bank">Paiement bancaire</SelectItem>
                        <SelectItem value="credit">À crédit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {paymentMethod !== 'credit' && (
                <FormField
                  control={form.control}
                  name="paidAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant payé</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          placeholder="0"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {remainingAmount > 0 ? (
                          <span className="text-orange-600">
                            Reste à payer: {formatPrice(remainingAmount)} FCFA
                          </span>
                        ) : remainingAmount < 0 ? (
                          <span className="text-green-600">
                            À rendre: {formatPrice(Math.abs(remainingAmount))} FCFA
                          </span>
                        ) : (
                          <span className="text-green-600">Payé intégralement</span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Gestion du stock */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Gestion du stock</h3>

              <FormField
                control={form.control}
                name="addToStockNow"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ajouter au stock maintenant</FormLabel>
                      <FormDescription className="text-sm">
                        Cochez cette case si les produits sont livrés immédiatement
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {addToStockNow && (
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dépôt *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez le dépôt" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name} {warehouse.isMain && '(Principal)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnelles)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes ou conditions particulières..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Récapitulatif */}
            {items.length > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total:</span>
                  <span className="flex items-center gap-1 font-bold text-lg">
                    <Package className="h-4 w-4" />
                    {formatPrice(total)} FCFA
                  </span>
                </div>
                {paymentMethod !== 'credit' && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Payé:</span>
                      <span>{formatPrice(form.watch('paidAmount'))} FCFA</span>
                    </div>
                    {remainingAmount > 0 && (
                      <div className="flex justify-between text-sm text-orange-600 font-medium">
                        <span>Reste à payer:</span>
                        <span>{formatPrice(remainingAmount)} FCFA</span>
                      </div>
                    )}
                  </>
                )}
                {remainingAmount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Un crédit fournisseur sera créé automatiquement</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Enregistrer l'achat
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
