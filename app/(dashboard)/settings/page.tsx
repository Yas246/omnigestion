"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettingsRealtime } from "@/lib/react-query/useSettingsRealtime";
import { useWarehousesListener } from "@/lib/react-query/useStockLocationsRealtime"; // Pour les entrepôts
import { useSettings } from "@/lib/hooks/useSettings"; // Garder pour les fonctions CRUD si nécessaires
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyTab } from "@/components/settings/CompanyTab";
import { InvoiceTab } from "@/components/settings/InvoiceTab";
import { StockTab } from "@/components/settings/StockTab";
import { UsersTab } from "@/components/settings/UsersTab";
import { SystemTab } from "@/components/settings/SystemTab";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { PermissionGate } from "@/components/auth";

export default function SettingsPage() {
  const router = useRouter();
  const { hasPermission, isAdmin, getFirstAccessiblePage } = usePermissions();

  // NOUVEAU hook React Query + onSnapshot pour temps réel
  const { settings, isLoading, error } = useSettingsRealtime();

  // NOTE: Les warehouses viennent déjà du listener warehouses dans RealtimeService
  // On peut les récupérer depuis le cache React Query
  // Pour l'instant, on garde l'ancien système pour les warehouses

  // Garder l'ancien hook pour les fonctions CRUD (refresh, etc.)
  const { refresh: legacyRefresh } = useSettings();

  const [activeTab, setActiveTab] = useState("company");

  const hasAccess = isAdmin || hasPermission("settings", "read");

  useEffect(() => {
    if (!hasAccess) {
      const timer = setTimeout(() => {
        router.push(getFirstAccessiblePage());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, router, getFirstAccessiblePage]);

  // Fonction refresh qui utilise maintenant onSnapshot automatiquement
  const refresh = () => {
    // NOTE: Plus besoin de refresh manuel - onSnapshot met à jour automatiquement
    // Mais on garde la fonction pour la compatibilité avec ThemeSelector
    console.log('[SettingsPage] Refresh - les données sont synchronisées automatiquement via onSnapshot');
  };

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
              Vous n&apos;avez pas la permission requise pour accéder à cette
              page.
            </p>
          </div>
          <Button onClick={() => router.push(getFirstAccessiblePage())}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !settings) {
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

      {/* Sélecteur de thème - accessible à tous les utilisateurs */}
      <ThemeSelector onThemeChanged={refresh} />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="!flex !flex-wrap !w-full gap-2 mb-8 lg:!grid lg:grid-cols-5 lg:gap-0 lg:mb-0">
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
                  Vous n&apos;avez pas la permission de modifier les paramètres
                  de l&apos;entreprise.
                </CardContent>
              </Card>
            )}
          >
            <CompanyTab company={settings} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres
                  de facturation.
                </CardContent>
              </Card>
            )}
          >
            <InvoiceTab settings={settings?.invoiceSettings || settings?.invoice} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres
                  de stock.
                </CardContent>
              </Card>
            )}
          >
            <StockTab
              settings={settings?.stockSettings || settings?.stock}
              warehouses={settings?.warehouses || []}
              onSaved={refresh}
            />
          </PermissionGate>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {isAdmin ? (
            <UsersTab />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Vous n&apos;avez pas la permission de gérer les utilisateurs.
                Cette fonctionnalité est réservée aux administrateurs.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <PermissionGate
            module="settings"
            action="update"
            renderNoAccess={() => (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Vous n&apos;avez pas la permission de modifier les paramètres
                  système.
                </CardContent>
              </Card>
            )}
          >
            <SystemTab settings={settings?.systemSettings || settings?.system} onSaved={refresh} />
          </PermissionGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
