'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useClientsRealtime } from '@/lib/react-query/useClientsRealtime';
import { useClients as useClientsHelpers } from '@/lib/hooks/useClients';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function ClientsPage() {
  const router = useRouter();
  const { canAccessModule, getFirstAccessiblePage } = usePermissions();

  // React Query + onSnapshot hook
  const { clients, isLoading: loading } = useClientsRealtime();
  const hasMore = false; // Plus de pagination - onSnapshot synchronise tout

  // Vérifier les permissions - rediriger si pas d'accès
  useEffect(() => {
    if (!canAccessModule('clients')) {
      router.push(getFirstAccessiblePage());
    }
  }, [canAccessModule, getFirstAccessiblePage, router]);

  // Helper functions for CRUD (keep using hook)
  const { createClient, updateClient, deleteClient } = useClientsHelpers();

  // Auth user for store initialization
  const { user } = useAuth();

  // ⚠️ Plus besoin de charger les données - onSnapshot gère tout automatiquement

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (data: any) => {
    setIsSubmitting(true);
    try {
      await createClient(data);
      toast.success('Client créé avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    setIsSubmitting(true);
    try {
      await updateClient(id, data);
      toast.success('Client mis à jour avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await deleteClient(id);
      toast.success('Client supprimé avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression du client');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clientèle</h1>
        <p className="text-muted-foreground">
          Gérez vos clients et leurs informations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            {clients.length} client{clients.length > 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsTable
            clients={clients}
            loading={loading}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
