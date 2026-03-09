'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useCashRegisters } from '@/lib/hooks/useCashRegisters';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import type { CashRegister } from '@/types';

const cashRegisterSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  isMain: z.boolean(),
  isActive: z.boolean(),
});

type CashRegisterFormData = z.infer<typeof cashRegisterSchema>;

interface CashRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  cashRegister?: CashRegister | null; // Pour le mode édition
}

export function CashRegisterDialog({ open, onOpenChange, onSuccess, cashRegister }: CashRegisterDialogProps) {
  const { createCashRegister, updateCashRegister, cashRegisters } = useCashRegisters();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!cashRegister;

  const form = useForm<CashRegisterFormData>({
    resolver: zodResolver(cashRegisterSchema),
    defaultValues: {
      name: cashRegister?.name || '',
      isMain: cashRegister?.isMain || cashRegisters.length === 0,
      isActive: cashRegister?.isActive ?? true,
    },
  });

  // Générer le code automatiquement (seulement en création)
  const generateCode = () => {
    if (isEditMode) return cashRegister?.code || '';
    const nextNumber = cashRegisters.length + 1;
    return `CAISSE-${String(nextNumber).padStart(2, '0')}`;
  };

  // Réinitialiser le formulaire quand la boîte s'ouvre
  useEffect(() => {
    if (open) {
      form.reset({
        name: cashRegister?.name || '',
        isMain: cashRegister?.isMain || cashRegisters.length === 0,
        isActive: cashRegister?.isActive ?? true,
      });
    }
  }, [open, cashRegister, cashRegisters.length, form]);

  const onSubmit = async (data: CashRegisterFormData) => {
    setIsSubmitting(true);
    try {
      if (isEditMode && cashRegister) {
        // Mode édition
        await updateCashRegister(cashRegister.id, data);
        toast.success('Caisse mise à jour avec succès');
      } else {
        // Mode création
        await createCashRegister({
          ...data,
          code: generateCode(),
          currentBalance: 0,  // Solde initial
        });
        toast.success('Caisse créée avec succès');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || `Erreur lors de l'${isEditMode ? 'édition' : 'création'} de la caisse`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Modifier la caisse' : 'Nouvelle caisse'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Modifiez les informations de la caisse' : 'Créez une nouvelle caisse pour gérer votre trésorerie'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la caisse</FormLabel>
                  <FormControl>
                    <Input placeholder="Caisse principale, Caisse secondaire..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border p-3 bg-muted/50">
              <FormLabel>Code</FormLabel>
              <p className="text-sm font-medium mt-1">{generateCode()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ce code est généré automatiquement par le système
              </p>
            </div>

            <FormField
              control={form.control}
              name="isMain"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Caisse principale</FormLabel>
                    <FormDescription className="text-xs">
                      Cette caisse sera utilisée par défaut pour les ventes
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={cashRegisters.length === 0}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Caisse active</FormLabel>
                    <FormDescription className="text-xs">
                      Une caisse inactive ne peut pas recevoir de mouvements
                    </FormDescription>
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

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditMode ? 'Mettre à jour' : 'Créer la caisse'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
