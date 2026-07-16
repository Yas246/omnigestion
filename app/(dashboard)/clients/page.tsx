'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useClientsRealtime, useClients as useClientsHelpers } from '@/lib/api/hooks/useClients';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from "@/components/ui/page-header";
import { Loader2 } from 'lucide-react';

export default function ClientsPage() {
  const router = useRouter();
  const { canAccessModule, getFirstAccessiblePage } = usePermissions();

  const { clients, isLoading: loading } = useClientsRealtime();

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
      <PageHeader
        eyebrow="Commercial"
        title="Clientèle"
        description="Gérez vos clients et leurs informations"
      />

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
