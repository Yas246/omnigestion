'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSettings } from '@/lib/hooks/useSettings';
import { useThemeWithSettings } from '@/lib/hooks/useThemeWithSettings';
import { useAuth } from '@/lib/auth-context';
import { systemSettingsSchema, type SystemSettingsFormData } from '@/lib/validations/settings';
import type { SystemSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Moon, Sun, Monitor, Download, Upload, Building2, Plus, Bell, BellOff } from 'lucide-react';
import { useFCM } from '@/lib/hooks/useFCM';
import { CreateCompanyDialog } from '@/components/settings/CreateCompanyDialog';

interface SystemTabProps {
  settings?: SystemSettings;
  onSaved?: () => void;
}

export function SystemTab({ settings, onSaved }: SystemTabProps) {
  const { updateSystemSettings } = useSettings();
  const { setTheme } = useThemeWithSettings();
  const { user, companies, switchCompany } = useAuth();
  const { permissionStatus, token, loading: fcmLoading, initializeFCM, disableNotifications } = useFCM();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateCompanyDialogOpen, setIsCreateCompanyDialogOpen] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);

  const form = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      theme: 'system',
      language: 'fr',
    },
  });

  // Mettre à jour le formulaire quand les settings changent
  useEffect(() => {
    if (settings) {
      form.reset({
        theme: settings.theme || 'system',
        language: settings.language || 'fr',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: SystemSettingsFormData) => {
    setIsSubmitting(true);
    try {
      await updateSystemSettings(data);
      // Appliquer le thème immédiatement
      await setTheme(data.theme as 'light' | 'dark' | 'system');
      // Sauvegarder aussi localement pour accès immédiat
      localStorage.setItem('omnigestion_language', data.language);
      onSaved?.();
      toast.success('Paramètres système mis à jour avec succès');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des paramètres');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportData = () => {
    toast.info('Fonctionnalité d\'export à venir');
  };

  const handleImportData = () => {
    toast.info('Fonctionnalité d\'import à venir');
  };

  const handleSwitchCompany = async (companyId: string) => {
    try {
      await switchCompany(companyId);
      window.location.reload(); // Recharger pour appliquer le changement
    } catch (error) {
      console.error('Erreur lors du changement d\'entreprise:', error);
      toast.error('Erreur lors du changement d\'entreprise');
    }
  };

  return (
    <div className="space-y-6">
      {/* Gestion des entreprises */}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Mes entreprises</CardTitle>
            <CardDescription>
              Gérez vos entreprises. Basculer entre elles pour modifier leurs paramètres.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {company.businessSector === 'commerce' ? 'Commerce' : 'Commerce et services'} • {company.currency}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={company.id === user.currentCompanyId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSwitchCompany(company.id)}
                    disabled={company.id === user.currentCompanyId}
                  >
                    {company.id === user.currentCompanyId ? 'Actuelle' : 'Sélectionner'}
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsCreateCompanyDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer une nouvelle entreprise
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Import / Export */}
      <Card>
        <CardHeader>
          <CardTitle>Import / Export</CardTitle>
          <CardDescription>
            Exportez vos données ou importez des données depuis un fichier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleExportData}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter toutes les données
            </Button>

            <Button
              variant="outline"
              onClick={handleImportData}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importer des données
            </Button>
          </div>

          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Vous pouvez également glisser-déposer un fichier d&apos;import ici
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {token ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              Notifications
            </CardTitle>
            <CardDescription>
              Gérez les notifications push de l&apos;application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {token
                    ? 'Notifications activées'
                    : permissionStatus === 'denied'
                      ? 'Notifications bloquées'
                      : 'Notifications non configurées'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {token
                    ? 'Vous recevez les alertes de ventes et de stock'
                    : permissionStatus === 'denied'
                      ? 'Autorisez les notifications dans les paramètres de votre navigateur'
                      : 'Activez les notifications pour recevoir les alertes en temps réel'}
                </p>
              </div>
              <Button
                variant={token ? 'outline' : 'default'}
                size="sm"
                disabled={isTogglingNotifications || fcmLoading}
                onClick={async () => {
                  setIsTogglingNotifications(true);
                  try {
                    if (token) {
                      await disableNotifications();
                      toast.success('Notifications désactivées');
                    } else {
                      await initializeFCM();
                      toast.success('Notifications activées');
                    }
                  } catch {
                    toast.error('Erreur lors de la modification');
                  } finally {
                    setIsTogglingNotifications(false);
                  }
                }}
              >
                {isTogglingNotifications || fcmLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : token ? (
                  <BellOff className="mr-2 h-4 w-4" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                {token ? 'Désactiver' : 'Activer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations système */}
      <Card>
        <CardHeader>
          <CardTitle>Informations système</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Environnement</span>
            <span className="font-medium capitalize">{process.env.NODE_ENV}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Framework</span>
            <span className="font-medium">Next.js 16</span>
          </div>
        </CardContent>
      </Card>

      {/* À propos */}
      <Card>
        <CardHeader>
          <CardTitle>À propos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Omnigestion</strong> est une application web de gestion d&apos;entreprise
            destinée aux petites et moyennes structures.
          </p>
          <p>Elle permet de gérer les ventes, les stocks, la caisse, les crédits et bien plus encore.</p>
        </CardContent>
      </Card>

      <CreateCompanyDialog
        open={isCreateCompanyDialogOpen}
        onOpenChange={setIsCreateCompanyDialogOpen}
        onSuccess={onSaved}
      />
    </div>
  );
}
