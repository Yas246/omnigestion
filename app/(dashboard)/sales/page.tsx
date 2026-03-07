'use client';

import { useState } from 'react';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { useClientCredits } from '@/lib/hooks/useClientCredits';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSettings } from '@/lib/hooks/useSettings';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PermissionGate } from '@/components/auth';
import type { Invoice } from '@/types';
import { InvoiceDialog } from '@/components/invoices/InvoiceDialog';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';

export default function SalesPage() {
  const {
    invoices,
    loading,
    error,
    hasMore,
    searchQuery,
    setSearchQuery,
    fetchInvoices,
    loadMore,
    createInvoice,
    deleteInvoice,
  } = useInvoices();

  const { credits } = useClientCredits();
  const { user } = useAuth();
  const { company, settings } = useSettings();
  const { canCreateSale, canDeleteSale } = usePermissions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateInvoice = async (data: any) => {
    setIsSubmitting(true);
    try {
      await createInvoice(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette facture ?')) {
      return;
    }

    try {
      await deleteInvoice(id);
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    // Ouvrir la page d'impression dans un nouvel onglet
    window.open(`/sales/print/${invoice.id}`, '_blank');
  };

  // Calculer les statistiques du jour
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    invDate.setHours(0, 0, 0, 0);
    return invDate.getTime() === today.getTime();
  });

  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const todayPaid = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const todayInvoicesCount = todayInvoices.length;

  // Calculer le total des crédits actifs (à partir des crédits réels, pas des factures)
  const activeCredits = credits
    .filter(c => c.status !== 'paid' && c.status !== 'cancelled')
    .reduce((sum, c) => sum + c.remainingAmount, 0);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ventes</h1>
          <p className="text-muted-foreground">
            Gérez vos factures et vos ventes
          </p>
        </div>
        <PermissionGate module="sales" action="create">
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle facture
          </Button>
        </PermissionGate>
      </div>

      {/* Statistiques du jour */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures du jour</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayInvoicesCount}</div>
            <p className="text-xs text-muted-foreground">
              Aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {todayRevenue.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Total facturé aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encaissé</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {todayPaid.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Montant payé aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crédits actifs</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {activeCredits.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Reste à payer total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des factures */}
      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
          <CardDescription>
            Liste de toutes vos factures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTable
            invoices={invoices}
            loading={loading}
            hasMore={hasMore}
            onSearch={setSearchQuery}
            searchQuery={searchQuery}
            onLoadMore={loadMore}
            onView={handleViewInvoice}
            onDelete={handleDeleteInvoice}
          />
        </CardContent>
      </Card>

      {/* Dialog création facture */}
      <InvoiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateInvoice={handleCreateInvoice}
        isSubmitting={isSubmitting}
      />

      {/* Dialog détail facture */}
      <InvoiceDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        invoice={selectedInvoice}
        company={company}
        onPrint={handlePrintInvoice}
      />
    </div>
  );
}
