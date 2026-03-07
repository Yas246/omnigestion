'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks/useSettings';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompanyTab } from '@/components/settings/CompanyTab';
import { InvoiceTab } from '@/components/settings/InvoiceTab';
import { StockTab } from '@/components/settings/StockTab';
import { UsersTab } from '@/components/settings/UsersTab';
import { SystemTab } from '@/components/settings/SystemTab';
import { PermissionGate } from '@/components/auth';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const { company, settings, warehouses, loading, error, refresh } = useSettings();
  const [activeTab, setActiveTab] = useState('company');

  const hasAccess = isAdmin || hasPermission('settings', 'read');

  useEffect(() => {
    if (!hasAccess) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, router]);

  if (!hasAccess) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex justify-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n&apos;avez pas la permission requise pour accéder à cette page.
            </p>
          </div>
          <Button onClick={() => router.push('/')}>
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Configurez votre entreprise et les préférences de l&apos;application
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="company">Entreprise</TabsTrigger>
          <TabsTrigger value="invoice">Facturation</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="system">Système</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres de l&apos;entreprise.
                </CardContent>
              </Card>
            )}
          >
            <CompanyTab company={company} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres de facturation.
                </CardContent>
              </Card>
            )}
          >
            <InvoiceTab settings={settings?.invoice} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres de stock.
                </CardContent>
              </Card>
            )}
          >
            <StockTab settings={settings?.stock} warehouses={warehouses} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UsersTab />
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres système.
                </CardContent>
              </Card>
            )}
          >
            <SystemTab settings={settings?.system} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
