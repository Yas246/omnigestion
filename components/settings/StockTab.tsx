'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSettings } from '@/lib/hooks/useSettings';
import { stockSettingsSchema, warehouseSchema, type StockSettingsFormData, type WarehouseFormData } from '@/lib/validations/settings';
import type { StockSettings, Warehouse } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Plus, Pencil, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';

interface StockTabProps {
  settings?: StockSettings;
  warehouses: Warehouse[];
  onSaved?: () => void;
}

export function StockTab({ settings, warehouses, onSaved }: StockTabProps) {
  const { updateStockSettings, createWarehouse, updateWarehouse, deleteWarehouse } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Formulaire paramètres stock
  const settingsForm = useForm<StockSettingsFormData>({
    resolver: zodResolver(stockSettingsSchema),
    defaultValues: {
      defaultAlertThreshold: 10,
      defaultWarehouseId: '',
    },
  });

  // Formulaire dépôt
  const warehouseForm = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      isMain: false,
      isActive: true,
    },
  });

  // Mettre à jour le formulaire quand les settings changent
  useEffect(() => {
    if (settings) {
      settingsForm.reset({
        defaultAlertThreshold: settings.defaultAlertThreshold || 10,
        defaultWarehouseId: settings.defaultWarehouseId || '',
      });
    }
  }, [settings, settingsForm]);

  const onSettingsSubmit = async (data: StockSettingsFormData) => {
    setIsSubmitting(true);
    try {
      await updateStockSettings(data);
      onSaved?.();
      toast.success('Paramètres de stock mis à jour avec succès');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des paramètres');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onWarehouseSubmit = async (data: WarehouseFormData) => {
    setIsSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, data);
      } else {
        await createWarehouse(data);
      }
      onSaved?.();
      setIsDialogOpen(false);
      setEditingWarehouse(null);
      warehouseForm.reset();
      toast.success(editingWarehouse ? 'Dépôt mis à jour avec succès' : 'Dépôt créé avec succès');
    } catch (error) {
      toast.error(editingWarehouse ? 'Erreur lors de la mise à jour' : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    warehouseForm.reset({
      name: warehouse.name,
      code: warehouse.code || '',
      address: warehouse.address || '',
      isMain: warehouse.isMain,
      isActive: warehouse.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce dépôt ?')) {
      return;
    }

    try {
      await deleteWarehouse(id);
      toast.success('Dépôt supprimé avec succès');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleOpenDialog = () => {
    setEditingWarehouse(null);
    warehouseForm.reset({
      name: '',
      code: '',
      address: '',
      isMain: false,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Paramètres de stock */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres de stock</CardTitle>
          <CardDescription>
            Configurez les seuils d&apos;alerte et le dépôt par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
              <FormField
                control={settingsForm.control}
                name="defaultAlertThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seuil d&apos;alerte par défaut</FormLabel>
                    <FormControl>
                      <NumberInput
                        min={0}
                        placeholder="10"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Niveau de stock minimum avant déclenchement d&apos;une alerte
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={settingsForm.control}
                name="defaultWarehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dépôt par défaut</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Sélectionner un dépôt</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.isMain ? '(Principal)' : ''}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Dépôt utilisé par défaut pour les opérations de stock
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer les modifications'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Gestion des dépôts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dépôts de stock</CardTitle>
              <CardDescription>
                Gérez vos différents lieux de stockage
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau dépôt
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingWarehouse ? 'Modifier le dépôt' : 'Nouveau dépôt'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingWarehouse
                      ? 'Modifiez les informations du dépôt'
                      : 'Créez un nouveau dépôt de stock'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...warehouseForm}>
                  <form onSubmit={warehouseForm.handleSubmit(onWarehouseSubmit)} className="space-y-4">
                    <FormField
                      control={warehouseForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du dépôt *</FormLabel>
                          <FormControl>
                            <Input placeholder="Dépôt Principal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={warehouseForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code</FormLabel>
                          <FormControl>
                            <Input placeholder="DP-01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={warehouseForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Rue Example" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {editingWarehouse ? 'Modification...' : 'Création...'}
                          </>
                        ) : editingWarehouse ? (
                          'Modifier'
                        ) : (
                          'Créer'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {warehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <WarehouseIcon className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                Aucun dépôt configuré. Créez votre premier dépôt pour commencer.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {warehouses.map((warehouse) => (
                <div
                  key={warehouse.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <WarehouseIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {warehouse.name}
                        {warehouse.isMain && (
                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            Principal
                          </span>
                        )}
                      </p>
                      {warehouse.code && (
                        <p className="text-sm text-muted-foreground">{warehouse.code}</p>
                      )}
                      {warehouse.address && (
                        <p className="text-sm text-muted-foreground">{warehouse.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(warehouse)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(warehouse.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
