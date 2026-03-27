'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCashRegistersStore } from '@/lib/stores/useCashRegistersStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const movementSchema = z.object({
  cashRegisterId: z.string().min(1, 'La caisse est requise'),
  type: z.enum(['in', 'out', 'transfer']),
  amount: z.number().min(1, 'Le montant doit être positif'),
  category: z.string().min(1, 'La catégorie est requise'),
  description: z.string().optional(),
  targetCashRegisterId: z.string().optional(),
}).refine((data) => {
  if (data.type === 'transfer' && !data.targetCashRegisterId) {
    return false;
  }
  return true;
}, {
  message: 'La caisse de destination est requise pour les transferts',
  path: ['targetCashRegisterId'],
});

type MovementFormData = z.infer<typeof movementSchema>;

const categories = {
  in: ['sale', 'deposit', 'transfer', 'adjustment'],
  out: ['expense', 'withdrawal', 'supplier', 'transfer', 'adjustment'],
  transfer: ['transfer'],
};

const categoryLabels: Record<string, string> = {
  sale: 'Vente',
  expense: 'Dépense',
  supplier: 'Fournisseur',
  transfer: 'Transfert',
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  adjustment: 'Ajustement',
};

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashRegisterId?: string | null;
  cashRegisters: any[];
  onSuccess?: () => void;
}

export function CashMovementDialog({ open, onOpenChange, cashRegisterId, cashRegisters, onSuccess }: CashMovementDialogProps) {
  const { user } = useAuth();
  const createMovement = useCashRegistersStore((state) => state.createMovement);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      cashRegisterId: cashRegisterId || '',
      type: 'in',
      amount: 0,
      category: 'sale',
      description: '',
      targetCashRegisterId: '',
    },
  });

  const movementType = form.watch('type') as 'in' | 'out' | 'transfer';
  const isTransfer = movementType === 'transfer';

  useEffect(() => {
    if (open) {
      form.reset({
        cashRegisterId: cashRegisterId || '',
        type: 'in',
        amount: 0,
        category: 'sale',
        description: '',
        targetCashRegisterId: '',
      });
    }
  }, [open, cashRegisterId]);

  const onSubmit = async (data: MovementFormData) => {
    if (!user?.currentCompanyId) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setIsSubmitting(true);
    try {
      await createMovement({
        cashRegisterId: data.cashRegisterId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description || undefined,
        targetCashRegisterId: data.type === 'transfer' ? data.targetCashRegisterId : undefined,
        userId: user.id,
      }, user.currentCompanyId);

      toast.success('Mouvement créé avec succès');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du mouvement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCategories = categories[movementType] || [];
  const availableCashRegisters = cashRegisters.filter(cr => cr.id !== form.getValues().cashRegisterId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouveau mouvement de caisse</DialogTitle>
          <DialogDescription>
            Enregistrez une entrée, une sortie ou un transfert de fonds
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Type de mouvement */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de mouvement</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    if (value === 'transfer') {
                      form.setValue('category', 'transfer');
                    } else if (value === 'in') {
                      form.setValue('category', 'sale');
                    } else {
                      form.setValue('category', 'expense');
                    }
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez le type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="in">Entrée</SelectItem>
                      <SelectItem value="out">Sortie</SelectItem>
                      <SelectItem value="transfer">Transfert</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Caisse source */}
            <FormField
              control={form.control}
              name="cashRegisterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caisse {isTransfer ? 'source' : ''}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={!!cashRegisterId}>
                        <SelectValue placeholder="Sélectionnez la caisse" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cashRegisters.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.name} {cr.isMain && '(Principale)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Caisse destination (pour les transferts) */}
            {isTransfer && (
              <FormField
                control={form.control}
                name="targetCashRegisterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caisse destination</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez la caisse de destination" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCashRegisters.map((cr) => (
                          <SelectItem key={cr.id} value={cr.id}>
                            {cr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Le montant sera transféré de la caisse source vers cette caisse
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Montant */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (FCFA)</FormLabel>
                  <FormControl>
                    <NumberInput
                      min={0}
                      step={1}
                      placeholder="0"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Catégorie */}
            {!isTransfer && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez la catégorie" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {categoryLabels[cat] || cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnelle)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Détails du mouvement..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                Créer le mouvement
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
