'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Eye, Trash2, FileText, Receipt, DollarSign, Pencil } from 'lucide-react';
import { PermissionGate } from '@/components/auth';
import { getInvoiceStatusBadge } from '@/lib/utils/invoice-helpers';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { formatPrice } from '@/lib/utils';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading?: boolean;
  hasMore?: boolean;
  searchQuery?: string;
  onLoadMore?: () => void;
  onSearch?: (searchTerm: string) => void;
  onFilterByStatus?: (status: string | null) => void;
  onView?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (id: string) => void;
  totalLoaded?: number;
}

export function InvoiceTable({
  invoices,
  loading = false,
  hasMore = false,
  searchQuery = '',
  onLoadMore,
  onSearch,
  onFilterByStatus,
  onView,
  onEdit,
  onDelete,
  totalLoaded = 0,
}: InvoiceTableProps) {
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Debouncing de 300ms pour la recherche
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Sync searchTerm with searchQuery prop
  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);

  // Déclencher la recherche seulement après le debouncing et minimum 3 caractères
  useEffect(() => {
    if (onSearch) {
      if (debouncedSearchTerm.length >= 3 || debouncedSearchTerm.length === 0) {
        onSearch(debouncedSearchTerm);
      }
    }
  }, [debouncedSearchTerm, onSearch]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    if (onFilterByStatus) {
      onFilterByStatus(status === 'all' ? null : status);
    }
  };

  const getPaymentMethodBadge = (method?: string) => {
    if (!method) return <span className="text-muted-foreground">-</span>;

    switch (method) {
      case 'cash':
        return <Badge variant="outline" className="gap-1"><DollarSign className="h-3 w-3" /> Espèces</Badge>;
      case 'transfer':
        return <Badge variant="outline" className="gap-1">Transfer</Badge>;
      case 'mobile':
        return <Badge variant="outline" className="gap-1">Mobile</Badge>;
      case 'card':
        return <Badge variant="outline" className="gap-1">Carte</Badge>;
      case 'credit':
        return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500">Crédit</Badge>;
      default:
        return <Badge variant="secondary">{method}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Recherche et filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par N° facture, client... (min. 3 caractères)"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select onValueChange={handleStatusFilter} value={selectedStatus}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="validated">Validées</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Facture</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead className="hidden lg:table-cell">Paiement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? 'Aucune facture trouvée pour cette recherche'
                        : 'Aucune facture. Créez votre première facture pour commencer.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                  </TableCell>
                  <TableCell className="text-sm hidden md:table-cell">
                    {format(new Date(invoice.date), 'PPP', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{invoice.clientName || 'Client de passage'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatPrice(invoice.total)} FCFA</span>
                      {invoice.remainingAmount > 0 && invoice.status !== 'cancelled' && (
                        <span className="text-xs text-orange-600">
                          Reste: {formatPrice(invoice.remainingAmount)} FCFA
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {getPaymentMethodBadge(invoice.paymentMethod)}
                  </TableCell>
                  <TableCell>
                    {getInvoiceStatusBadge(invoice.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(invoice)}
                          title="Voir les détails"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <PermissionGate module="sales" action="delete">
                        {onEdit && invoice.status !== 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(invoice)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate module="sales" action="delete">
                        {onDelete && invoice.status !== 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(invoice.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Charger plus de factures depuis Firestore */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Chargement...' : `Charger plus de factures (${totalLoaded} chargées)`}
          </Button>
        </div>
      )}
    </div>
  );
}
