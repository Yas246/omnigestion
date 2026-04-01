'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useProductsRealtime } from '@/lib/react-query/useProductsRealtime';
import { useClientsRealtime } from '@/lib/react-query/useClientsRealtime';
import { useSettings } from '@/lib/hooks/useSettings';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { invoiceSchema, type InvoiceFormData } from '@/lib/validations/invoice';
import { useInvoices, type InvoiceItemInput } from '@/lib/hooks/useInvoices';
import type { Client, Product, Invoice } from '@/types';
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
import { Loader2, Plus, Trash2, AlertTriangle, DollarSign, Receipt } from 'lucide-react';

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

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateInvoice: (data: {
    clientId?: string;
    items: InvoiceItemInput[];
    taxRate: number;
    discount: number;
    paymentMethod?: 'cash' | 'bank' | 'mobile' | 'credit';
    paidAmount: number;
    saleDate?: Date;
    dueDate?: Date;
    notes?: string;
    mobileNumber?: string;
    bankName?: string;
    accountNumber?: string;
    transactionNumber?: string;
  }) => Promise<any>;
  onUpdateInvoice?: (invoiceId: string, data: {
    clientId?: string;
    clientName?: string;
    items: InvoiceItemInput[];
    taxRate: number;
    discount: number;
    paymentMethod?: 'cash' | 'bank' | 'mobile' | 'credit';
    paidAmount: number;
    saleDate?: Date;
    dueDate?: Date;
    notes?: string;
    mobileNumber?: string;
    bankName?: string;
    accountNumber?: string;
    transactionNumber?: string;
  }) => Promise<any>;
  editInvoice?: Invoice | null;
  isSubmitting?: boolean;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  onCreateInvoice,
  onUpdateInvoice,
  editInvoice,
  isSubmitting = false,
}: InvoiceDialogProps) {
  const { products } = useProductsRealtime();
  const { clients } = useClientsRealtime();
  const { settings } = useSettings();
  const { isAdmin } = usePermissions();
  const [items, setItems] = useState<InvoiceItemInput[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Ref pour détecter les clics en dehors du dropdown de produits
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown]);

  // Debouncing pour les recherches (300ms)
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const debouncedClientSearch = useDebounce(clientSearch, 300);

  // Utiliser les paramètres de facturation existants
  const showTax = settings?.invoice?.showTax ?? true;
  const defaultTaxRate = settings?.invoice?.defaultTaxRate ?? 0;
  const defaultTerms = settings?.invoice?.defaultTerms;

  const form = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      taxRate: defaultTaxRate,
      discount: 0,
      paidAmount: 0,
      saleDate: new Date(), // Date du jour par défaut
      notes: defaultTerms || '',
      clientSearch: '',
      mobileNumber: '',
      bankName: '',
      accountNumber: '',
      transactionNumber: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const clientId = form.watch('clientId');
  const taxRate = form.watch('taxRate');
  const discount = form.watch('discount');
  const paidAmount = paymentMethod === 'credit' ? 0 : form.watch('paidAmount');

  // Déterminer si c'est un client de passage
  const isWalkInCustomer = !clientId;

  // Réinitialiser le mode de paiement si c'est un client de passage et que le mode était "crédit"
  useEffect(() => {
    if (isWalkInCustomer && paymentMethod === 'credit') {
      form.setValue('paymentMethod', 'cash');
    }
  }, [isWalkInCustomer, paymentMethod, form]);

  // Filtrer les produits selon la recherche (min 3 caractères)
  const filteredProducts = products.filter(p => {
    // Ne filtrer que si la recherche est vide ou a minimum 3 caractères
    if (debouncedProductSearch.length > 0 && debouncedProductSearch.length < 3) {
      return false;
    }
    const matchesSearch = !debouncedProductSearch ||
      p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      p.code?.toLowerCase().includes(debouncedProductSearch.toLowerCase());
    const isActiveAndInStock = p.isActive && p.currentStock > 0;
    return matchesSearch && isActiveAndInStock;
  });

  // Filtrer les clients selon la recherche (min 3 caractères)
  const filteredClients = clients.filter(c => {
    // Ne filtrer que si la recherche est vide ou a minimum 3 caractères
    if (debouncedClientSearch.length > 0 && debouncedClientSearch.length < 3) {
      return false;
    }
    return !debouncedClientSearch ||
      c.name.toLowerCase().includes(debouncedClientSearch.toLowerCase()) ||
      c.phone?.includes(debouncedClientSearch);
  });

  // Calculer les totaux
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal - discount + taxAmount;
  const remainingAmount = total - paidAmount;

  // Pour les clients de passage, le montant payé doit toujours être égal au total
  useEffect(() => {
    if (isWalkInCustomer && paymentMethod !== 'credit') {
      form.setValue('paidAmount', total);
    }
  }, [isWalkInCustomer, total, paymentMethod, form]);

  // Ajouter un produit à la facture
  const addProduct = () => {
    if (!selectedProductId) return;
    addProductById(selectedProductId);
    setSelectedProductId('');
  };

  // Ajouter un produit par ID (utilisé pour la recherche)
  const addProductById = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Vérifier si le produit est déjà dans la facture
    const existingItemIndex = items.findIndex(item => item.productId === product.id);

    if (existingItemIndex >= 0) {
      // Incrémenter la quantité si le produit existe déjà
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += 1;
      setItems(updatedItems);
    } else {
      // Ajouter le nouveau produit
      const newItem: InvoiceItemInput = {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: 1,
        unit: product.unit || 'pièce',
        unitPrice: product.retailPrice,
        purchasePrice: product.purchasePrice,
        isWholesale: false,
      };
      setItems([...items, newItem]);
    }
  };

  // Supprimer un produit de la facture
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Mettre à jour la quantité d'un item
  const updateItemQuantity = (index: number, quantity: number | undefined) => {
    const updatedItems = [...items];
    const item = updatedItems[index];
    const product = products.find(p => p.id === item.productId);

    const finalQuantity = quantity || 0;
    item.quantity = finalQuantity;

    // Appliquer automatiquement le prix gros si la quantité dépasse le seuil
    if (product && finalQuantity >= product.wholesaleThreshold && !item.isWholesale) {
      item.isWholesale = true;
      item.unitPrice = product.wholesalePrice;
    } else if (product && finalQuantity < product.wholesaleThreshold && item.isWholesale) {
      // Revenir au prix détail si on descend sous le seuil
      item.isWholesale = false;
      item.unitPrice = product.retailPrice;
    }

    setItems(updatedItems);
  };

  // Mettre à jour le prix unitaire d'un item
  const updateItemPrice = (index: number, price: number | undefined) => {
    const updatedItems = [...items];
    updatedItems[index].unitPrice = price || 0;
    setItems(updatedItems);
  };

  // Changer entre prix détail et gros
  const toggleWholesale = (index: number, product: Product) => {
    const updatedItems = [...items];
    const item = updatedItems[index];

    if (item.isWholesale) {
      // Passer au prix détail
      item.isWholesale = false;
      item.unitPrice = product.retailPrice;
    } else {
      // Passer au prix gros
      item.isWholesale = true;
      item.unitPrice = product.wholesalePrice;
    }

    setItems(updatedItems);
  };

  // Valider les prix anti-perte
  const validatePrices = () => {
    for (const item of items) {
      if (item.purchasePrice && item.unitPrice < item.purchasePrice) {
        toast.error(
          `Prix de vente invalide pour ${item.productName}: ${item.unitPrice} < ${item.purchasePrice} (prix d'achat)`
        );
        return false;
      }
    }
    return true;
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Mode édition
  const isEditMode = !!editInvoice;

  // Pré-remplir le formulaire quand editInvoice change
  useEffect(() => {
    if (editInvoice && open) {
      // Remplir les champs du formulaire
      form.reset({
        clientId: editInvoice.clientId || undefined,
        taxRate: editInvoice.taxRate || 0,
        discount: editInvoice.discount || 0,
        paymentMethod: editInvoice.paymentMethod || 'cash',
        paidAmount: editInvoice.paidAmount || 0,
        saleDate: editInvoice.date ? new Date(editInvoice.date) : new Date(),
        notes: editInvoice.notes || '',
        clientSearch: '',
        mobileNumber: (editInvoice as any).mobileNumber || '',
        bankName: (editInvoice as any).bankName || '',
        accountNumber: (editInvoice as any).accountNumber || '',
        transactionNumber: (editInvoice as any).transactionNumber || '',
      });

      // Remplir les items
      const invoiceItems: InvoiceItemInput[] = (editInvoice.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        unit: item.unit || 'pièce',
        unitPrice: item.unitPrice,
        purchasePrice: item.purchasePrice,
        isWholesale: item.isWholesale || false,
      }));
      setItems(invoiceItems);

      // Remplir la recherche client
      if (editInvoice.clientName) {
        setClientSearch(editInvoice.clientName);
      }
    } else if (!open) {
      // Réinitialiser à la fermeture
      setItems([]);
      setClientSearch('');
      setProductSearch('');
    }
  }, [editInvoice, open, form]);

  const handleSubmit = async (data: InvoiceFormData) => {
    if (items.length === 0) {
      toast.error('Ajoutez au moins un produit à la facture');
      return;
    }

    if (!validatePrices()) {
      return;
    }

    const invoiceData = {
      clientId: data.clientId,
      clientName: editInvoice?.clientName || clients.find(c => c.id === data.clientId)?.name,
      items,
      taxRate: data.taxRate,
      discount: data.discount,
      paymentMethod: data.paymentMethod,
      paidAmount: data.paymentMethod === 'credit' ? 0 : data.paidAmount,
      saleDate: data.saleDate,
      notes: data.notes,
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

      onOpenChange(false);
      form.reset();
      setItems([]);
    } catch (error: any) {
      toast.error(error.message || `Erreur lors de ${isEditMode ? 'la modification' : 'la création'} de la facture`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isEditMode ? `Modifier la facture ${editInvoice?.invoiceNumber || ''}` : 'Nouvelle facture'}
          </DialogTitle>
          <DialogDescription>
            Créez une nouvelle facture de vente
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client avec recherche */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-0">
                  <FormLabel>Client (optionnel)</FormLabel>
                  <div className="relative">
                    <Input
                      placeholder="Rechercher un client par nom ou téléphone... (min. 3 caractères)"
                      value={clientSearch}
                      onChange={(e) => {
                        const value = e.target.value;
                        setClientSearch(value);
                        setShowClientDropdown(true);
                        // Si la recherche est vide, réinitialiser la sélection
                        if (!value) {
                          field.onChange(undefined);
                        }
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    />
                    {showClientDropdown && debouncedClientSearch && filteredClients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredClients.map((client) => (
                          <div
                            key={client.id}
                            className="px-3 py-2 hover:bg-muted cursor-pointer flex flex-col"
                            onPointerDown={() => {
                              field.onChange(client.id);
                              setClientSearch(client.name);
                              setShowClientDropdown(false);
                            }}
                          >
                            <span className="font-medium">{client.name}</span>
                            {client.phone && (
                              <span className="text-xs text-muted-foreground">{client.phone}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormDescription>
                    {field.value
                      ? `Client sélectionné: ${clients.find(c => c.id === field.value)?.name}`
                      : 'Laissez vide pour un client de passage'
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date de la vente */}
            <FormField
              control={form.control}
              name="saleDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de la vente</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      disabled={!isAdmin}
                      className={!isAdmin ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </FormControl>
                  <FormDescription>
                    {!isAdmin
                      ? "Date du jour (non modifiable)"
                      : "Sélectionnez la date de la vente (passée ou future)"
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ajout de produits avec recherche */}
            <div className="space-y-3">
              <FormLabel>Ajouter des produits</FormLabel>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={productDropdownRef}>
                  <Input
                    placeholder="Rechercher un produit par nom ou code..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                  />
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-96 overflow-y-auto">
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            addProductById(product.id);
                            setProductSearch('');
                            setShowProductDropdown(false);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              {product.code && (
                                <span className="text-xs text-muted-foreground">{product.code}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {product.currentStock} {product.unit} - {product.retailPrice.toLocaleString()} FCFA
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedProductId) {
                      addProduct();
                      setProductSearch('');
                      setShowProductDropdown(false);
                    }
                  }}
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
                  {/* Header desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium">
                    <div className="col-span-4">Produit</div>
                    <div className="col-span-1 text-center">Qté</div>
                    <div className="col-span-3 text-right">Prix unit.</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-2"></div>
                  </div>
                  {items.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const itemTotal = item.unitPrice * item.quantity;
                    const isLoss = item.purchasePrice && item.unitPrice < item.purchasePrice;
                    const isAutoWholesale = product && item.quantity >= product.wholesaleThreshold && product.wholesaleThreshold > 0;

                    return (
                      <div key={index} className={`border-t ${isLoss ? 'bg-red-50' : ''}`}>
                        {/* Desktop layout */}
                        <div className="hidden md:grid grid-cols-12 gap-2 p-3">
                          <div className="col-span-4">
                            <div className="font-medium text-sm">{item.productName}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {isLoss && (
                                <div className="flex items-center gap-1 text-xs text-red-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Prix d'achat: {item.purchasePrice} FCFA
                                </div>
                              )}
                              {item.isWholesale && (
                                <Badge variant="secondary" className="text-xs">Prix gros</Badge>
                              )}
                              {isAutoWholesale && (
                                <span className="text-xs text-muted-foreground">(≥ {product.wholesaleThreshold} {product.unit})</span>
                              )}
                            </div>
                          </div>
                          <div className="col-span-1">
                            <NumberInput
                              min={1}
                              placeholder="1"
                              value={item.quantity}
                              onChange={(value) => updateItemQuantity(index, value)}
                              className="text-center"
                            />
                          </div>
                          <div className="col-span-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <NumberInput
                                  min={0}
                                  placeholder="0"
                                  value={item.unitPrice}
                                  onChange={(value) => updateItemPrice(index, value)}
                                  className="text-right"
                                  disabled={!item.isWholesale}
                                />
                                {product && (
                                  <Button
                                    type="button"
                                    variant={item.isWholesale ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleWholesale(index, product)}
                                    title={item.isWholesale ? "Passer au prix détail" : "Passer au prix gros"}
                                    className="px-2"
                                  >
                                    {item.isWholesale ? "Gros" : "Détail"}
                                  </Button>
                                )}
                              </div>
                              {product && (
                                <div className="text-xs text-muted-foreground">
                                  Détail: {product.retailPrice} | Gros: {product.wholesalePrice}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="col-span-2 text-right">
                            <div className="font-medium">{itemTotal.toLocaleString()} FCFA</div>
                          </div>
                          <div className="col-span-2 flex justify-end">
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

                        {/* Mobile layout */}
                        <div className="md:hidden p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{item.productName}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {isLoss && (
                                  <div className="flex items-center gap-1 text-xs text-red-600">
                                    <AlertTriangle className="h-3 w-3" />
                                    Achat: {item.purchasePrice}
                                  </div>
                                )}
                                {item.isWholesale && (
                                  <Badge variant="secondary" className="text-xs">Prix gros</Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="shrink-0 -mt-1 -mr-2"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          <div className="flex gap-2">
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-xs text-muted-foreground">Qté</label>
                              <NumberInput
                                min={1}
                                placeholder="1"
                                value={item.quantity}
                                onChange={(value) => updateItemQuantity(index, value)}
                                className="text-center"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-xs text-muted-foreground">Prix unit.</label>
                              <NumberInput
                                min={0}
                                placeholder="0"
                                value={item.unitPrice}
                                onChange={(value) => updateItemPrice(index, value)}
                                className="text-right"
                                disabled={!item.isWholesale}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            {product ? (
                              <Button
                                type="button"
                                variant={item.isWholesale ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleWholesale(index, product)}
                                className="px-3"
                              >
                                {item.isWholesale ? "Gros" : "Détail"}
                              </Button>
                            ) : (
                              <span></span>
                            )}
                            <div className="font-medium">{itemTotal.toLocaleString()} FCFA</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TVA et Remise */}
            <div className={`grid gap-4 ${showTax ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showTax && (
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux de TVA (%)</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          step={0.1}
                          placeholder="0"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remise (FCFA)</FormLabel>
                    <FormControl>
                      <NumberInput
                        min={0}
                        placeholder="0"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Paiement */}
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
                        <SelectItem value="credit" disabled={isWalkInCustomer}>
                          Crédit {isWalkInCustomer && "(réservé aux clients enregistrés)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mobile Money - Numéro de téléphone */}
              {paymentMethod === 'mobile' && (
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de téléphone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: 699123456"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Numéro de téléphone utilisé pour le paiement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Paiement bancaire - Informations */}
              {paymentMethod === 'bank' && (
                <>
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la banque</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Société Générale, BICEC, etc."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro de compte</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Numéro de compte"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro de transaction (optionnel)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Référence de la transaction"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Montant payé (sauf crédit) */}
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
                          value={isWalkInCustomer ? total : field.value}
                          onChange={field.onChange}
                          disabled={isWalkInCustomer}
                          className={isWalkInCustomer ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormDescription>
                        {isWalkInCustomer ? (
                          <span className="text-muted-foreground">
                            Les clients de passage doivent payer la totalité de la facture
                          </span>
                        ) : remainingAmount > 0 ? (
                          <span className="text-orange-600">
                            Reste à payer: {remainingAmount.toLocaleString()} FCFA
                          </span>
                        ) : remainingAmount < 0 ? (
                          <span className="text-green-600">
                            À rendre: {Math.abs(remainingAmount).toLocaleString()} FCFA
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

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
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
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sous-total:</span>
                <span>{subtotal.toLocaleString()} FCFA</span>
              </div>
              {showTax && taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span>TVA ({taxRate}%):</span>
                  <span>{taxAmount.toLocaleString()} FCFA</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Remise:</span>
                  <span>-{discount.toLocaleString()} FCFA</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {total.toLocaleString()} FCFA
                </span>
              </div>
            </div>

            <DialogFooter>
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
                    {isEditMode ? 'Modification...' : 'Création...'}
                  </>
                ) : (
                  <>
                    <Receipt className="mr-2 h-4 w-4" />
                    {isEditMode ? 'Mettre à jour' : 'Créer la facture'}
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
