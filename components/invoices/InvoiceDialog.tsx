'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useProductsRealtime } from '@/lib/api/hooks/useProducts';
import { useClientsRealtime } from '@/lib/api/hooks/useClients';
import { useSettings } from '@/lib/api/hooks/useSettings';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useInvoiceTotals } from '@/lib/hooks/useInvoiceTotals';
import { invoiceSchema, type InvoiceFormData } from '@/lib/validations/invoice';
import type { Product, Invoice, InvoiceItemInput } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Loader2, Plus, Trash2, AlertTriangle, DollarSign, Receipt } from 'lucide-react';
import { ClientPicker } from './ClientPicker';
import { ProductPicker } from './ProductPicker';
import { PaymentMethodSection } from './PaymentMethodSection';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateInvoice: (data: any) => Promise<any>;
  onUpdateInvoice?: (invoiceId: string, data: any) => Promise<any>;
  editInvoice?: Invoice | null;
  isSubmitting?: boolean;
}

export function InvoiceDialog({
  open, onOpenChange, onCreateInvoice, onUpdateInvoice, editInvoice, isSubmitting = false,
}: InvoiceDialogProps) {
  const { products } = useProductsRealtime();
  const { clients } = useClientsRealtime();
  const { settings } = useSettings();
  const { isAdmin } = usePermissions();
  const [items, setItems] = useState<InvoiceItemInput[]>([]);

  const showTax = settings?.invoice?.showTax ?? true;
  const defaultTaxRate = settings?.invoice?.defaultTaxRate ?? 0;
  const defaultTerms = settings?.invoice?.defaultTerms;

  const form = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      taxRate: defaultTaxRate, discount: 0, paidAmount: 0,
      saleDate: new Date(), notes: defaultTerms || '',
      clientSearch: '', mobileNumber: '', bankName: '', accountNumber: '', transactionNumber: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const clientId = form.watch('clientId');
  const taxRate = form.watch('taxRate');
  const discount = form.watch('discount');
  const isWalkInCustomer = !clientId;
  const paidAmount = paymentMethod === 'credit' ? 0 : form.watch('paidAmount');

  const { subtotal, taxAmount, total, remainingAmount } = useInvoiceTotals(items, taxRate, discount, paidAmount);

  useEffect(() => {
    if (isWalkInCustomer && paymentMethod === 'credit') form.setValue('paymentMethod', 'cash');
  }, [isWalkInCustomer, paymentMethod, form]);

  useEffect(() => {
    if (isWalkInCustomer && paymentMethod !== 'credit') form.setValue('paidAmount', total);
  }, [isWalkInCustomer, total, paymentMethod, form]);

  // Edit mode prefill
  const isEditMode = !!editInvoice;
  useEffect(() => {
    if (editInvoice && open) {
      form.reset({
        clientId: editInvoice.clientId || undefined,
        taxRate: editInvoice.taxRate || 0, discount: editInvoice.discount || 0,
        paymentMethod: editInvoice.paymentMethod || 'cash', paidAmount: editInvoice.paidAmount || 0,
        saleDate: editInvoice.date ? new Date(editInvoice.date) : new Date(),
        notes: editInvoice.notes || '', clientSearch: '',
        mobileNumber: (editInvoice as any).mobileNumber || '', bankName: (editInvoice as any).bankName || '',
        accountNumber: (editInvoice as any).accountNumber || '', transactionNumber: (editInvoice as any).transactionNumber || '',
      });
      setItems((editInvoice.items || []).map((item: any) => ({
        productId: item.productId, productName: item.productName, productCode: item.productCode,
        quantity: item.quantity, unit: item.unit || 'pièce', unitPrice: item.unitPrice,
        purchasePrice: item.purchasePrice, isWholesale: item.isWholesale || false,
      })));
    } else if (!open) { setItems([]); }
  }, [editInvoice, open, form]);

  // Product management
  const addProductById = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const existing = items.findIndex((it) => it.productId === product.id);
    if (existing >= 0) {
      const updated = [...items]; updated[existing].quantity += 1; setItems(updated);
    } else {
      setItems([...items, {
        productId: product.id, productName: product.name, productCode: product.code,
        quantity: 1, unit: product.unit || 'pièce', unitPrice: product.retailPrice,
        purchasePrice: product.purchasePrice, isWholesale: false,
      }]);
    }
  };

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const updateItemQuantity = (index: number, quantity: number | undefined) => {
    const updated = [...items]; const item = updated[index];
    const product = products.find((p) => p.id === item.productId);
    const q = quantity || 0; item.quantity = q;
    if (product && q >= product.wholesaleThreshold && !item.isWholesale) {
      item.isWholesale = true; item.unitPrice = product.wholesalePrice;
    } else if (product && q < product.wholesaleThreshold && item.isWholesale) {
      item.isWholesale = false; item.unitPrice = product.retailPrice;
    }
    setItems(updated);
  };

  const updateItemPrice = (index: number, price: number | undefined) => {
    const updated = [...items]; updated[index].unitPrice = price || 0; setItems(updated);
  };

  const toggleWholesale = (index: number, product: Product) => {
    const updated = [...items]; const item = updated[index];
    if (item.isWholesale) { item.isWholesale = false; item.unitPrice = product.retailPrice; }
    else { item.isWholesale = true; item.unitPrice = product.wholesalePrice; }
    setItems(updated);
  };

  const validatePrices = () => {
    for (const item of items) {
      if (item.purchasePrice && item.unitPrice < item.purchasePrice) {
        toast.error(`Opération non validée pour ${item.productName}`); return false;
      }
    }
    return true;
  };

  const handleSubmit = async (data: InvoiceFormData) => {
    if (items.length === 0) { toast.error('Ajoutez au moins un produit à la facture'); return; }
    if (!validatePrices()) return;
    const invoiceData = {
      clientId: data.clientId,
      clientName: editInvoice?.clientName || clients.find((c) => c.id === data.clientId)?.name,
      items, taxRate: data.taxRate, discount: data.discount,
      paymentMethod: data.paymentMethod,
      paidAmount: data.paymentMethod === 'credit' ? 0 : data.paidAmount,
      saleDate: data.saleDate, notes: data.notes,
      mobileNumber: data.paymentMethod === 'mobile' ? data.mobileNumber : undefined,
      bankName: data.paymentMethod === 'bank' ? data.bankName : undefined,
      accountNumber: data.paymentMethod === 'bank' ? data.accountNumber : undefined,
      transactionNumber: data.paymentMethod === 'bank' ? data.transactionNumber : undefined,
    };
    try {
      if (isEditMode && editInvoice && onUpdateInvoice) {
        await onUpdateInvoice(editInvoice.id, invoiceData);
        toast.success('Facture modifiée avec succès');
      } else {
        await onCreateInvoice(invoiceData);
        toast.success('Facture créée avec succès');
      }
      onOpenChange(false); form.reset(); setItems([]);
    } catch (error: any) {
      toast.error(error.message || `Erreur lors de ${isEditMode ? 'la modification' : 'la création'} de la facture`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-225 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isEditMode ? `Modifier la facture ${editInvoice?.invoiceNumber || ''}` : 'Nouvelle facture'}
          </DialogTitle>
          <DialogDescription>Créez une nouvelle facture de vente</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client */}
            <ClientPicker clients={clients} control={form.control} />

            {/* Date */}
            <FormField control={form.control} name="saleDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Date de la vente</FormLabel>
                <FormControl>
                  <Input type="date" {...field}
                    value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                    disabled={!isAdmin} className={!isAdmin ? 'bg-muted cursor-not-allowed' : ''} />
                </FormControl>
                <FormDescription>{!isAdmin ? 'Date du jour (non modifiable)' : 'Sélectionnez la date de la vente'}</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* Products */}
            <div className="space-y-3">
              <FormLabel>Ajouter des produits</FormLabel>
              <ProductPicker products={products} onAdd={addProductById} />
            </div>

            {/* Items list */}
            {items.length > 0 && (
              <div className="space-y-2">
                <FormLabel>Produits ajoutés</FormLabel>
                <div className="rounded-lg border">
                  <div className="hidden md:grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium">
                    <div className="col-span-4">Produit</div>
                    <div className="col-span-1 text-center">Qté</div>
                    <div className="col-span-3 text-right">Prix unit.</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-2"></div>
                  </div>
                  {items.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId);
                    const itemTotal = item.unitPrice * item.quantity;
                    const isLoss = item.purchasePrice && item.unitPrice < item.purchasePrice;
                    const isAutoWholesale = product && item.quantity >= product.wholesaleThreshold && product.wholesaleThreshold > 0;
                    return (
                      <div key={index} className={`border-t ${isLoss ? 'bg-red-50' : ''}`}>
                        {/* Desktop */}
                        <div className="hidden md:grid grid-cols-12 gap-2 p-3">
                          <div className="col-span-4">
                            <div className="text-sm font-medium">{item.productName}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {isLoss && (<div className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3 w-3" />Opération non validée</div>)}
                              {item.isWholesale && <Badge variant="secondary" className="text-xs">Prix gros</Badge>}
                              {isAutoWholesale && <span className="text-xs text-muted-foreground">(≥ {product.wholesaleThreshold} {product.unit})</span>}
                            </div>
                          </div>
                          <div className="col-span-1">
                            <NumberInput min={0.5} step={0.5} placeholder="1" value={item.quantity} onChange={(v) => updateItemQuantity(index, v)} className="text-center" />
                          </div>
                          <div className="col-span-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <NumberInput min={0} placeholder="0" value={item.unitPrice} onChange={(v) => updateItemPrice(index, v)} className="text-right" disabled={!item.isWholesale} />
                                {product && <Button type="button" variant={item.isWholesale ? 'default' : 'outline'} size="sm" onClick={() => toggleWholesale(index, product)} className="px-2">{item.isWholesale ? 'Gros' : 'Détail'}</Button>}
                              </div>
                              {product && <div className="tabular-nums text-xs text-muted-foreground">Détail: {product.retailPrice} | Gros: {product.wholesalePrice}</div>}
                            </div>
                          </div>
                          <div className="col-span-2 text-right"><div className="tabular-nums font-medium">{itemTotal.toLocaleString()} FCFA</div></div>
                          <div className="col-span-2 flex justify-end"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                        </div>
                        {/* Mobile */}
                        <div className="space-y-2 p-3 md:hidden">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{item.productName}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {isLoss && (<div className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3 w-3" />Opération non validée</div>)}
                                {item.isWholesale && <Badge variant="secondary" className="text-xs">Prix gros</Badge>}
                              </div>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="-mr-2 -mt-1 shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex flex-1 flex-col gap-1"><label className="text-xs text-muted-foreground">Qté</label><NumberInput min={0.5} step={0.5} placeholder="1" value={item.quantity} onChange={(v) => updateItemQuantity(index, v)} className="text-center" /></div>
                            <div className="flex flex-1 flex-col gap-1"><label className="text-xs text-muted-foreground">Prix unit.</label><NumberInput min={0} placeholder="0" value={item.unitPrice} onChange={(v) => updateItemPrice(index, v)} className="text-right" disabled={!item.isWholesale} /></div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            {product ? <Button type="button" variant={item.isWholesale ? 'default' : 'outline'} size="sm" onClick={() => toggleWholesale(index, product)} className="px-3">{item.isWholesale ? 'Gros' : 'Détail'}</Button> : <span />}
                            <div className="tabular-nums font-medium">{itemTotal.toLocaleString()} FCFA</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tax + Discount */}
            <div className={`grid gap-4 ${showTax ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showTax && (
                <FormField control={form.control} name="taxRate" render={({ field }) => (
                  <FormItem><FormLabel>Taux de TVA (%)</FormLabel><FormControl><NumberInput min={0} step={0.1} placeholder="0" value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              <FormField control={form.control} name="discount" render={({ field }) => (
                <FormItem><FormLabel>Remise (FCFA)</FormLabel><FormControl><NumberInput min={0} placeholder="0" value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Payment */}
            <PaymentMethodSection control={form.control} isWalkInCustomer={isWalkInCustomer} total={total} remainingAmount={remainingAmount} showPaidAmount={paymentMethod !== 'credit'} />

            {/* Notes */}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes (optionnel)</FormLabel><FormControl><Textarea placeholder="Notes ou conditions particulières..." className="resize-none" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            {/* Summary */}
            <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
              <div className="flex justify-between text-sm"><span>Sous-total:</span><span className="tabular-nums">{subtotal.toLocaleString()} FCFA</span></div>
              {showTax && taxRate > 0 && <div className="flex justify-between text-sm"><span>TVA ({taxRate}%):</span><span className="tabular-nums">{taxAmount.toLocaleString()} FCFA</span></div>}
              {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Remise:</span><span className="tabular-nums">-{discount.toLocaleString()} FCFA</span></div>}
              <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total:</span><span className="flex items-center gap-1 tabular-nums"><DollarSign className="h-4 w-4" />{total.toLocaleString()} FCFA</span></div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting || items.length === 0}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditMode ? 'Modification...' : 'Création...'}</> : <><Receipt className="mr-2 h-4 w-4" />{isEditMode ? 'Mettre à jour' : 'Créer la facture'}</>}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
