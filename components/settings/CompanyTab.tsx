'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSettings } from '@/lib/hooks/useSettings';
import { companySchema, type CompanyFormData } from '@/lib/validations/settings';
import type { Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Upload } from 'lucide-react';

interface CompanyTabProps {
  company: Company | null;
  onSaved?: () => void;
}

export function CompanyTab({ company, onSaved }: CompanyTabProps) {
  const { updateCompany, uploadLogo } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      slogan: '',
      description: '',
      taxId: '',
      businessRegister: '',
      ifu: '',
      rccm: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      currency: 'FCFA',
      invoiceFooter: '',
    },
  });

  // Mettre à jour le formulaire quand les données entreprise changent
  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || '',
        slogan: company.slogan || '',
        description: company.description || '',
        taxId: company.taxId || '',
        businessRegister: company.businessRegister || '',
        ifu: company.ifu || '',
        rccm: company.rccm || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        currency: company.currency || 'FCFA',
        invoiceFooter: company.invoiceFooter || '',
      });
    }
  }, [company, form]);

  const onSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);
    try {
      await updateCompany(data);
      onSaved?.();
      toast.success('Informations de l\'entreprise mises à jour avec succès');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des informations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      // 2MB
      toast.error('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setIsUploadingLogo(true);
    try {
      await uploadLogo(file);
      // Rafraîchir les données de l'entreprise pour afficher le nouveau logo
      onSaved?.();
      toast.success('Logo mis à jour avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'upload du logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations de l&apos;entreprise</CardTitle>
        <CardDescription>
          Configurez les informations de base de votre entreprise qui apparaîtront sur vos factures et documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo de l&apos;entreprise</Label>
              <div className="flex items-center gap-4">
                {company?.logoUrl && (
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border bg-white">
                    <img
                      src={company.logoUrl}
                      alt="Logo entreprise"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Label
                    htmlFor="logo-upload"
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 hover:bg-accent"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Upload en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Choisir un logo
                      </>
                    )}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG jusqu&apos;à 2 Mo
                  </p>
                </div>
              </div>
            </div>

            {/* Informations générales */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l&apos;entreprise *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ma Société SARL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slogan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slogan</FormLabel>
                    <FormControl>
                      <Input placeholder="Votre partenaire de confiance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description de votre entreprise..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Identifiants fiscaux */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Identifiants fiscaux</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="ifu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFU (Identifiant Fiscal Unique)</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rccm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RCCM (Registre du Commerce)</FormLabel>
                      <FormControl>
                        <Input placeholder="RC-123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Coordonnées */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Coordonnées</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Rue Example, Ville" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@entreprise.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site web</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://www.entreprise.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Devise */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Devise</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Footer facture */}
            <FormField
              control={form.control}
              name="invoiceFooter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes légales (footer facture)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Conditions de vente, mentions légales..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
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
