'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash2, Search, Plus } from 'lucide-react';
import { PermissionGate } from '@/components/auth';
import { ClientDialog } from './ClientDialog';

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

interface ClientsTableProps {
  clients: Client[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onCreate?: (data: any) => Promise<void>;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ClientsTable({
  clients,
  loading = false,
  hasMore = false,
  onLoadMore,
  onCreate,
  onUpdate,
  onDelete,
  isSubmitting = false,
}: ClientsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Debouncing de 300ms pour la recherche
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredClients = clients.filter((client) => {
    // Ne filtrer que si la recherche est vide ou a minimum 3 caractères
    if (debouncedSearchQuery.length > 0 && debouncedSearchQuery.length < 3) {
      return false; // Masquer tous les résultats si moins de 3 caractères
    }

    const searchLower = debouncedSearchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(debouncedSearchQuery) ||
      client.code?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = async (data: any) => {
    if (!onCreate) return;
    await onCreate(data);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleUpdate = async (data: any) => {
    if (!onUpdate || !editingClient) return;
    await onUpdate(editingClient.id, data);
    setEditingClient(null);
  };

  const handleDelete = async (client: Client) => {
    if (!onDelete) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le client "${client.name}" ?`)) {
      return;
    }

    try {
      await onDelete(client.id);
      // Le toast est géré par le composant parent
    } catch (error) {
      // L'erreur est gérée par le composant parent
    }
  };

  return (
    <div className="space-y-4">
      {/* Header avec recherche et bouton créer */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client... (min. 3 caractères)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <PermissionGate module="clients" action="create">
          {onCreate && (
            <Button onClick={() => { setEditingClient(null); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau client
            </Button>
          )}
        </PermissionGate>
      </div>

      {/* Tableau des clients */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {debouncedSearchQuery ? 'Aucun client trouvé' : 'Aucun client. Créez votre premier client.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.code || '-'}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email || '-'}</TableCell>
                  <TableCell>
                    {client.isActive ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">Actif</Badge>
                    ) : (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <PermissionGate module="clients" action="update">
                          {onUpdate && (
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                        </PermissionGate>
                        <PermissionGate module="clients" action="delete">
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(client)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </PermissionGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {hasMore && !debouncedSearchQuery && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Chargement...' : 'Charger plus'}
          </Button>
        </div>
      )}

      {/* Dialog de création/modification */}
      {(onCreate || onUpdate) && (
        <ClientDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          client={editingClient}
          onSubmit={editingClient ? handleUpdate : handleCreate}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
