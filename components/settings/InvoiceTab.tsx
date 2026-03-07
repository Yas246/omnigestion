'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSettings } from '@/lib/hooks/useSettings';
import { invoiceSettingsSchema, type InvoiceSettingsFormData } from '@/lib/validations/settings';
import type { InvoiceSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface InvoiceTabProps {
  settings?: InvoiceSettings;
  onSaved?: () => void;
}

export function InvoiceTab({ settings, onSaved }: InvoiceTabProps) {
  const { updateInvoiceSettings } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InvoiceSettingsFormData>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: {
      prefix: 'FAC-',
      nextNumber: 1,
      showTax: false,
      showUnitPrice: true,
      defaultTerms: '',
      template: 'standard',
    },
  });

  // Mettre à jour le formulaire quand les settings changent
  useEffect(() => {
    if (settings) {
      form.reset({
        prefix: settings.prefix || 'FAC-',
        nextNumber: settings.nextNumber || 1,
        showTax: settings.showTax ?? false,
        showUnitPrice: settings.showUnitPrice ?? true,
        defaultTerms: settings.defaultTerms || '',
        template: settings.template || 'standard',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: InvoiceSettingsFormData) => {
    setIsSubmitting(true);
    try {
      await updateInvoiceSettings(data);
      onSaved?.();
      toast.success('Paramètres de facturation mis à jour avec succès');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des paramètres');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres de facturation</CardTitle>
        <CardDescription>
          Configurez la numérotation et l&apos;affichage des factures.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Numérotation */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Numérotation automatique</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Préfixe</FormLabel>
                      <FormControl>
                        <Input placeholder="FAC-" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prochain numéro</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={1}
                          placeholder="1"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Exemple: {form.watch('prefix')}{form.watch('nextNumber')}
              </p>
            </div>

            {/* Options d'affichage */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Options d&apos;affichage</h3>

              <FormField
                control={form.control}
                name="showTax"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Afficher la TVA</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Afficher les montants de TVA sur les factures
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showUnitPrice"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Afficher le prix unitaire</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Afficher le prix unitaire sur chaque ligne de facture
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Conditions de vente */}
            <FormField
              control={form.control}
              name="defaultTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conditions de vente par défaut</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paiement à réception de facture. Délai de paiement: 30 jours."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Template */}
            <FormField
              control={form.control}
              name="template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modèle d&apos;impression</FormLabel>
                  <FormControl>
                    <div className="grid gap-4 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => field.onChange('standard')}
                        className={`rounded-lg border-2 p-4 text-left transition-colors ${
                          field.value === 'standard'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">Standard</div>
                        <div className="text-sm text-muted-foreground">
                          Modèle simple et efficace
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('detailed')}
                        className={`rounded-lg border-2 p-4 text-left transition-colors ${
                          field.value === 'detailed'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">Détaillé</div>
                        <div className="text-sm text-muted-foreground">
                          Modèle avec plus d&apos;informations
                        </div>
                      </button>
                    </div>
                  </FormControl>
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
  );
}
