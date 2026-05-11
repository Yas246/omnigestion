"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  productSchema,
  PRODUCT_UNITS,
  type ProductFormData,
} from "@/lib/validations/product";
import type { Product, Warehouse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, Check, AlertCircle } from "lucide-react";

interface StockAllocation {
  warehouseId: string;
  quantity: number;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  warehouses: Warehouse[];
  defaultWarehouseId?: string;
  onSubmit: (
    data: ProductFormData & { stockAllocations?: StockAllocation[] },
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  defaultWarehouseId,
  onSubmit,
  isSubmitting = false,
}: ProductDialogProps) {
  const [allocationMode, setAllocationMode] = useState<"simple" | "advanced">(
    "simple",
  );
  const [stockAllocations, setStockAllocations] = useState<StockAllocation[]>(
    [],
  );

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      purchasePrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      wholesaleThreshold: 10,
      currentStock: 0,
      alertThreshold: 10,
      unit: "pièce",
      isActive: true,
    },
  });

  // Reset form when product changes or dialog opens
  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name || "",
        description: product.description || "",
        purchasePrice: product.purchasePrice || 0,
        retailPrice: product.retailPrice || 0,
        wholesalePrice: product.wholesalePrice || 0,
        wholesaleThreshold: product.wholesaleThreshold || 10,
        currentStock: product.currentStock || 0,
        alertThreshold: product.alertThreshold || 10,
        unit: (product.unit || "pièce") as any,
        isActive: product.isActive ?? true,
      });
      setAllocationMode("simple");
      setStockAllocations([]);
    } else {
      form.reset({
        name: "",
        description: "",
        purchasePrice: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        wholesaleThreshold: 10,
        currentStock: 0,
        alertThreshold: 10,
        unit: "pièce",
        isActive: true,
      });
      setAllocationMode("simple");
      setStockAllocations([]);
    }
  }, [product, form, open]);

  const currentStock = form.watch("currentStock");
  const totalAllocated = stockAllocations.reduce(
    (sum, alloc) => sum + (alloc.quantity || 0),
    0,
  );
  const isAllocationValid =
    allocationMode === "simple" || totalAllocated === currentStock;

  const addAllocation = () => {
    const availableWarehouses = warehouses.filter(
      (w) => !stockAllocations.find((a) => a.warehouseId === w.id),
    );
    if (availableWarehouses.length > 0) {
      setStockAllocations([
        ...stockAllocations,
        {
          warehouseId: availableWarehouses[0].id,
          quantity: 0,
        },
      ]);
    }
  };

  const removeAllocation = (index: number) => {
    setStockAllocations(stockAllocations.filter((_, i) => i !== index));
  };

  const updateAllocationQuantity = (
    index: number,
    quantity: number | undefined,
  ) => {
    const newAllocations = [...stockAllocations];
    newAllocations[index].quantity = Math.max(0, quantity || 0);
    setStockAllocations(newAllocations);
  };

  const updateAllocationWarehouse = (index: number, warehouseId: string) => {
    const newAllocations = [...stockAllocations];
    newAllocations[index].warehouseId = warehouseId;
    setStockAllocations(newAllocations);
  };

  const handleSubmit = async (data: ProductFormData) => {
    // Validation des répartitions en mode avancé
    if (allocationMode === "advanced" && !isAllocationValid) {
      toast.error(
        `La somme des répartitions (${totalAllocated}) doit correspondre à la quantité (${currentStock})`,
      );
      return;
    }

    try {
      await onSubmit({
        ...data,
        stockAllocations:
          allocationMode === "advanced" ? stockAllocations : undefined,
      });
      onOpenChange(false);
      form.reset();
      setAllocationMode("simple");
      setStockAllocations([]);
      toast.success(
        product ? "Produit mis à jour avec succès" : "Produit créé avec succès",
      );
    } catch (error: any) {
      toast.error(error?.message || (product
        ? "Erreur lors de la mise à jour"
        : "Erreur lors de la création"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? "Modifier le produit" : "Nouveau produit"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Modifiez les informations du produit"
              : "Ajoutez un nouveau produit à votre catalogue"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Informations générales</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du produit *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du produit" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description du produit..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prix */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Tarification</h3>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix d&apos;achat</FormLabel>
                      <FormControl>
                        <NumberInput
                          step={0.01}
                          min={0}
                          placeholder="0.00"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix vente (détail)</FormLabel>
                      <FormControl>
                        <NumberInput
                          step={0.01}
                          min={0}
                          placeholder="0.00"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wholesalePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix gros</FormLabel>
                      <FormControl>
                        <NumberInput
                          step={0.01}
                          min={0}
                          placeholder="0.00"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="wholesaleThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seuil pour prix gros (quantité min)</FormLabel>
                    <FormControl>
                      <NumberInput
                        min={1}
                        placeholder="10"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Stock */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Gestion du stock</h3>

              {/* Mode de répartition */}
              <div className="flex items-center gap-4 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="mode-simple"
                    checked={allocationMode === "simple"}
                    onChange={() => setAllocationMode("simple")}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="mode-simple"
                    className="text-sm cursor-pointer"
                  >
                    Simple (dépôt par défaut)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="mode-advanced"
                    checked={allocationMode === "advanced"}
                    onChange={() => setAllocationMode("advanced")}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="mode-advanced"
                    className="text-sm cursor-pointer"
                  >
                    Avancé (répartition multi-dépôts)
                  </label>
                </div>
              </div>

              {/* Quantité totale */}
              <FormField
                control={form.control}
                name="currentStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité totale *</FormLabel>
                    <FormControl>
                      <NumberInput
                        min={0}
                        step={0.5}
                        placeholder="0"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre total d&apos;unités à répartir
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Répartition avancée */}
              {allocationMode === "advanced" && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base">
                      Répartition par dépôt
                    </FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllocation}
                      disabled={stockAllocations.length >= warehouses.length}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>

                  {stockAllocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Cliquez sur &quot;Ajouter&quot; pour répartir le stock
                      dans plusieurs dépôts
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stockAllocations.map((allocation, index) => {
                        const warehouse = warehouses.find(
                          (w) => w.id === allocation.warehouseId,
                        );
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <select
                              value={allocation.warehouseId}
                              onChange={(e) =>
                                updateAllocationWarehouse(index, e.target.value)
                              }
                              className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {warehouses
                                .filter(
                                  (w) =>
                                    !stockAllocations.find(
                                      (a, i) =>
                                        i !== index && a.warehouseId === w.id,
                                    ),
                                )
                                .map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name} {w.isMain ? "(Principal)" : ""}
                                  </option>
                                ))}
                            </select>
                            <NumberInput
                              min={0}
                              placeholder="Qté"
                              className="w-24"
                              value={allocation.quantity}
                              onChange={(value) =>
                                updateAllocationQuantity(index, value)
                              }
                            />
                            <span className="text-sm text-muted-foreground">
                              {form.watch("unit")}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAllocation(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Validation de la répartition */}
                  {currentStock > 0 && (
                    <div
                      className={`flex items-center gap-2 rounded-md p-3 ${
                        isAllocationValid
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-orange-50 text-orange-700 border border-orange-200"
                      }`}
                    >
                      {isAllocationValid ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        Total réparti : {totalAllocated} / {currentStock}{" "}
                        {form.watch("unit")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Message pour mode simple */}
              {allocationMode === "simple" && defaultWarehouseId && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium">Mode simple :</span> Le stock
                  sera ajouté au dépôt par défaut (
                  {warehouses.find((w) => w.id === defaultWarehouseId)?.name ||
                    "Dépôt principal"}
                  )
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="alertThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seuil d&apos;alerte</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          placeholder="10"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unité de mesure</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une unité" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Statut */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Produit actif</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Un produit inactif n&apos;apparaît pas dans les sélections
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

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
                disabled={
                  isSubmitting ||
                  (allocationMode === "advanced" && !isAllocationValid)
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : product ? (
                  "Modifier"
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
