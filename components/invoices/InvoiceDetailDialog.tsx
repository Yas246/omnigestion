'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice, Company } from '@/types';
import { useSettings } from '@/lib/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { FileText, Printer, Share, Mail, Edit } from 'lucide-react';

interface InvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  company: Company | null;
  onPrint?: (invoice: Invoice) => void;
  onShare?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
}

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  company,
  onPrint,
  onShare,
  onEdit,
}: InvoiceDetailDialogProps) {
  const { settings } = useSettings();
  const [isPrinting, setIsPrinting] = useState(false);

  // Utiliser les paramètres de facturation existants
  const showTax = settings?.invoice?.showTax ?? true;
  const showUnitPrice = settings?.invoice?.showUnitPrice ?? true;

  // Précharger la page d'impression dans le cache du service worker
  // Cela permet d'imprimer même en mode hors ligne
  useEffect(() => {
    if (open && invoice && typeof window !== 'undefined' && navigator.onLine) {
      // Précharger la page d'impression pour la mettre en cache via prefetch
      const prefetchTimeout = setTimeout(() => {
        const printUrl = `/sales/print/${invoice.id}`;
        console.log('[InvoiceDetailDialog] Préchargement de la page d\'impression:', printUrl);

        // Créer un lien de prefetch dynamique
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = printUrl;
        link.as = 'document';

        // Ajouter au head du document
        document.head.appendChild(link);

        // Nettoyer après le chargement
        link.onload = () => {
          console.log('[InvoiceDetailDialog] Page d\'impression préchargée avec succès');
          // Garder le lien pour le cache, mais on pourrait le supprimer si voulu
          setTimeout(() => {
            if (link.parentNode) {
              link.parentNode.removeChild(link);
            }
          }, 1000);
        };

        link.onerror = () => {
          console.warn('[InvoiceDetailDialog] Impossible de précharger la page d\'impression');
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        };
      }, 300); // Petit délai pour ne pas surcharger

      return () => clearTimeout(prefetchTimeout);
    }
  }, [open, invoice]);

  if (!invoice) return null;

  const handlePrint = async () => {
    // Stocker les données de la facture et l'entreprise dans sessionStorage pour l'impression hors ligne
    try {
      const printData = {
        invoice,
        company,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(`invoice_print_${invoice.id}`, JSON.stringify(printData));
    } catch (error) {
      console.error('Erreur lors du stockage des données d\'impression:', error);
    }

    // Ouvrir la page d'impression dans un nouvel onglet
    window.open(`/sales/print/${invoice.id}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>;
      case 'validated':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Validée</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-600">Payée</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulée</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-175 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Facture {invoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription>
                Détails de la facture
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {onEdit && invoice.status === 'draft' && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onEdit(invoice)}
                  title="Modifier"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onShare && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onShare(invoice)}
                  title="Partager"
                >
                  <Share className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrint}
                disabled={isPrinting}
                title="Imprimer"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Contenu de la facture */}
        <div className="space-y-6">
          {/* En-tête entreprise */}
          {company && (
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{company.name}</h2>
                {company.slogan && <p className="text-sm text-muted-foreground">{company.slogan}</p>}
                {company.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
                {company.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
                {company.email && <p className="text-sm text-muted-foreground">{company.email}</p>}
              </div>
              {company.logoUrl && (
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="h-16 w-auto object-contain"
                />
              )}
            </div>
          )}

          <Separator />

          {/* Informations facture */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Informations facture</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">N° Facture:</span> <span className="font-medium">{invoice.invoiceNumber}</span></p>
                <p><span className="text-muted-foreground">Date:</span> {format(new Date(invoice.date), 'PPP', { locale: fr })}</p>
                {invoice.dueDate && (
                  <p><span className="text-muted-foreground">Échéance:</span> {format(new Date(invoice.dueDate), 'PPP', { locale: fr })}</p>
                )}
                <p><span className="text-muted-foreground">Statut:</span> {getStatusBadge(invoice.status)}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Informations client</h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{invoice.clientName || 'Client de passage'}</p>
                {invoice.notes && (
                  <p className="text-muted-foreground mt-2">{invoice.notes}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Produits */}
          <div>
            <h3 className="font-semibold mb-3">Produits / Services</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-center">Qté</TableHead>
                    {showUnitPrice && <TableHead className="text-right">Prix unit.</TableHead>}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.productName}</span>
                          {item.productCode && (
                            <span className="text-xs text-muted-foreground ml-2">({item.productCode})</span>
                          )}
                          {item.isWholesale && (
                            <Badge variant="outline" className="ml-2 text-xs">Gros</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity} {item.unit}
                      </TableCell>
                      {showUnitPrice && (
                        <TableCell className="text-right">
                          {formatPrice(item.unitPrice)} FCFA
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatPrice(item.total)} FCFA
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sous-total:</span>
                <span>{formatPrice(invoice.subtotal)} FCFA</span>
              </div>
              {showTax && invoice.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span>TVA ({invoice.taxRate}%):</span>
                  <span>{formatPrice(invoice.taxAmount)} FCFA</span>
                </div>
              )}
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Remise:</span>
                  <span>-{formatPrice(invoice.discount)} FCFA</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatPrice(invoice.total)} FCFA</span>
              </div>
              {invoice.paidAmount > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>Montant payé:</span>
                    <span className="text-green-600">{formatPrice(invoice.paidAmount)} FCFA</span>
                  </div>
                  {invoice.remainingAmount > 0 && (
                    <div className="flex justify-between text-sm font-medium text-orange-600">
                      <span>Reste à payer:</span>
                      <span>{formatPrice(invoice.remainingAmount)} FCFA</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          {company?.invoiceFooter && (
            <>
              <Separator />
              <div className="text-center text-sm text-muted-foreground">
                <p>{company.invoiceFooter}</p>
              </div>
            </>
          )}

          {/* Informations légales */}
          <div className="text-xs text-muted-foreground space-y-1">
            {company?.taxId && <p>N° Contribuable: {company.taxId}</p>}
            {company?.businessRegister && <p>Registre Commerce: {company.businessRegister}</p>}
            <p>Généré par Omnigestion - {format(new Date(), 'PPP à HH:mm', { locale: fr })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
