'use client';

import { useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Control } from 'react-hook-form';

interface PaymentMethodSectionProps {
  control: Control<any>;
  isWalkInCustomer: boolean;
  total: number;
  remainingAmount: number;
  showPaidAmount?: boolean;
}

/**
 * Payment method radio + conditional fields (Mobile Money, bank) + paid amount.
 * Fields are conditionally rendered based on the selected payment method:
 *   - mobile → numéro de téléphone
 *   - bank → nom de la banque + numéro de compte + numéro de transaction
 */
export function PaymentMethodSection({
  control,
  isWalkInCustomer,
  total,
  remainingAmount,
  showPaidAmount = true,
}: PaymentMethodSectionProps) {
  const paymentMethod = useWatch({ control, name: 'paymentMethod' });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">Paiement</h3>

      <FormField
        control={control}
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
                  Crédit {isWalkInCustomer && '(réservé aux clients enregistrés)'}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Mobile Money — only when method is 'mobile' */}
      {paymentMethod === 'mobile' && (
        <FormField
          control={control}
          name="mobileNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro de téléphone</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 699123456" {...field} />
              </FormControl>
              <FormDescription>Numéro de téléphone utilisé pour le paiement</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Bank fields — only when method is 'bank' */}
      {paymentMethod === 'bank' && (
        <>
          <FormField
            control={control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la banque</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Société Générale, BICEC, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="accountNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de compte</FormLabel>
                <FormControl>
                  <Input placeholder="Numéro de compte" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="transactionNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de transaction (optionnel)</FormLabel>
                <FormControl>
                  <Input placeholder="Référence de la transaction" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {/* Paid amount — hidden when credit */}
      {showPaidAmount && paymentMethod !== 'credit' && (
        <FormField
          control={control}
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
                  className={isWalkInCustomer ? 'bg-muted' : ''}
                />
              </FormControl>
              <FormDescription>
                {isWalkInCustomer ? (
                  <span className="text-muted-foreground">
                    Les clients de passage doivent payer la totalité
                  </span>
                ) : remainingAmount > 0 ? (
                  <span className="tabular-nums text-orange-600">
                    Reste à payer: {remainingAmount.toLocaleString()} FCFA
                  </span>
                ) : remainingAmount < 0 ? (
                  <span className="tabular-nums text-green-600">
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
  );
}
