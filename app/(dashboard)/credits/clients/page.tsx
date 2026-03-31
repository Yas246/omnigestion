'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, DollarSign, Calendar, CreditCard } from 'lucide-react';
import { useClientCreditsRealtime } from '@/lib/react-query/useClientCreditsRealtime';
import { useClientCredits } from '@/lib/hooks/useClientCredits'; // Garder pour les fonctions CRUD
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PermissionGate } from '@/components/auth';
import { CreditPaymentDialog } from '@/components/credits/CreditPaymentDialog';
import { ManualCreditDialog } from '@/components/credits/ManualCreditDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

// Custom hook pour le debouncing
function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type StatusFilter = 'all' | 'active' | 'overdue' | 'paid';

export default function CreditsPage() {
  const router = useRouter();
  const { canAccessModule, getFirstAccessiblePage } = usePermissions();

  // NOUVEAU hook React Query + onSnapshot pour temps réel
  const { credits, isLoading } = useClientCreditsRealtime();

  // Garder l'ancien hook pour les fonctions CRUD (addPayment)
  const { addPayment } = useClientCredits();

  // Vérifier les permissions - rediriger si pas d'accès
  useEffect(() => {
    if (!canAccessModule('credits')) {
      router.push(getFirstAccessiblePage());
    }
  }, [canAccessModule, getFirstAccessiblePage, router]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active'); // Par défaut: uniquement les actifs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<any>(null);
  const [isManualCreditDialogOpen, setIsManualCreditDialogOpen] = useState(false);

  // Debouncing de 300ms pour la recherche
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; variant: any }> = {
      active: { label: 'En cours', variant: 'default' },
      partial: { label: 'En cours', variant: 'default' }, // Même affichage que active
      paid: { label: 'Payé', variant: 'outline' },
      overdue: { label: 'En retard', variant: 'destructive' },
      cancelled: { label: 'Annulé', variant: 'outline' },
    };
    return labels[status] || { label: status, variant: 'outline' };
  };

  // Filtrage local optimisé avec useMemo
  const filteredCredits = useMemo(() => {
    return credits.filter((credit) => {
      // 'active' inclut à la fois 'active' et 'partial'
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (credit.status === 'active' || credit.status === 'partial')) ||
        credit.status === statusFilter;

      // Ne filtrer que si la recherche est vide ou a minimum 3 caractères
      if (debouncedSearchQuery.length > 0 && debouncedSearchQuery.length < 3) {
        return false; // Masquer tous les résultats si moins de 3 caractères
      }
      const matchesSearch =
        debouncedSearchQuery === '' ||
        credit.clientName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        credit.invoiceNumber?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [credits, statusFilter, debouncedSearchQuery]);

  // Crédits actifs uniquement (ni payés, ni annulés) pour les statistiques - optimisé avec useMemo
  const { totalCredits, totalPaid, totalRemaining, activeCreditsCount } = useMemo(() => {
    const activeCredits = credits.filter((c) => c.status !== 'paid' && c.status !== 'cancelled');
    return {
      totalCredits: activeCredits.reduce((sum, c) => sum + (c.amount || 0), 0),
      totalPaid: activeCredits.reduce((sum, c) => sum + (c.amountPaid || 0), 0),
      totalRemaining: activeCredits.reduce((sum, c) => sum + (c.remainingAmount || 0), 0),
      activeCreditsCount: activeCredits.length,
    };
  }, [credits]);

  const handlePayment = async (data: any) => {
    if (!selectedCredit) return;
    try {
      await addPayment(selectedCredit.id, data);
      setShowPaymentDialog(false);
      setSelectedCredit(null);
      toast.success('Paiement enregistré avec succès');
      // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
    } catch (error: any) {
      console.error('Erreur lors du paiement:', error);
      toast.error('Erreur lors de l\'enregistrement du paiement');
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crédits clients</h1>
          <p className="text-muted-foreground">
            Suivi et gestion des créances clients
          </p>
        </div>
        <Button onClick={() => setIsManualCreditDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau crédit
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard variant="warning">
          <KpiCardHeader
            title="Total créances"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={`${formatPrice(totalCredits)} FCFA`}
            label={`${activeCreditsCount} crédit(s) actif(s)`}
            variant="warning"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="Total payé"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={`${formatPrice(totalPaid)} FCFA`}
            variant="success"
          />
        </KpiCard>

        <KpiCard variant="info">
          <KpiCardHeader
            title="Reste à percevoir"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={`${formatPrice(totalRemaining)} FCFA`}
            variant="info"
          />
        </KpiCard>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des crédits</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <Input
                placeholder="Rechercher client, facture... (min. 3 caractères)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">En cours</SelectItem>
                  <SelectItem value="overdue">En retard</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCredits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {debouncedSearchQuery ? 'Aucun crédit trouvé' : 'Aucun crédit trouvé'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="flex flex-wrap items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors sm:flex-nowrap sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium">{credit.clientName}</span>
                      {credit.invoiceNumber && (
                        <span className="text-sm text-muted-foreground">
                          Facture {credit.invoiceNumber}
                        </span>
                      )}
                      <Badge variant={getStatusLabel(credit.status).variant}>
                        {getStatusLabel(credit.status).label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Total : {formatPrice(credit.amount || 0)} FCFA
                      </span>
                      <span className="text-[oklch(0.65_0.12_145)]">
                        Payé : {formatPrice(credit.amountPaid || 0)} FCFA
                      </span>
                      <span className="text-[oklch(0.75_0.15_75)] font-medium">
                        Reste : {formatPrice(credit.remainingAmount || 0)} FCFA
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(credit.createdAt || credit.date), 'dd/MM/yyyy', { locale: fr })}
                      </span>
                      {credit.dueDate && (
                        <span className="text-muted-foreground">
                          Échéance : {format(new Date(credit.dueDate), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                  <PermissionGate module="credits" action="payment">
                    {credit.status !== 'paid' && credit.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedCredit(credit);
                          setShowPaymentDialog(true);
                        }}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        <span>Enregistrer paiement</span>
                      </Button>
                    )}
                  </PermissionGate>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de paiement */}
      <CreditPaymentDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) setSelectedCredit(null);
        }}
        credit={selectedCredit}
        onSubmit={handlePayment}
      />

      {/* Dialog de crédit manuel */}
      <ManualCreditDialog
        open={isManualCreditDialogOpen}
        onOpenChange={setIsManualCreditDialogOpen}
      />
    </div>
  );
}
