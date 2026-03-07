'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice, Company } from '@/types';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { useSettings } from '@/lib/hooks/useSettings';

interface InvoicePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  company: Company | null;
}

export function InvoicePrintDialog({
  open,
  onOpenChange,
  invoice,
  company,
}: InvoicePrintDialogProps) {
  const { settings } = useSettings();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Réinitialiser quand la facture change
  useEffect(() => {
    if (invoice && open) {
      setIsReady(false);
      // Petit délai pour s'assurer que le contenu est rendu
      setTimeout(() => setIsReady(true), 100);
    }
  }, [invoice, open]);

  const handlePrint = () => {
    if (!contentRef.current) return;

    // Utiliser window.print() sur le contenu de la modal
    const printContent = contentRef.current.innerHTML;
    const originalContent = document.body.innerHTML;

    // Créer une fenêtre d'impression temporaire
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Facture_${invoice?.invoiceNumber}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
              font-size: 11pt;
              line-height: 1.3;
              color: black;
              background: white;
            }
            /* Copier tous les styles de la facture */
            ${getInvoicePrintStyles()}
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (!invoice) return null;

  const showTax = settings?.invoice?.showTax ?? true;
  const showUnitPrice = settings?.invoice?.showUnitPrice ?? true;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const formatDate = (dateValue: string | Date) => {
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      return format(date, 'PPP', { locale: fr });
    } catch {
      return 'Date invalide';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      validated: 'Validée',
      paid: 'Payée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header avec boutons */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
          <h2 className="text-lg font-semibold">Aperçu de la facture</h2>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} disabled={!isReady} size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenu de la facture */}
        <div ref={contentRef} className="invoice-container p-8">
          {/* En-tête entreprise */}
          {company && (
            <div className="print-header mb-6">
              <div className="flex items-start justify-between">
                <div className="company-info flex-1">
                  <h1 className="company-name text-2xl font-bold mb-1">{company.name}</h1>
                  {company.slogan && <p className="slogan text-sm text-muted-foreground mb-2">{company.slogan}</p>}
                  {(company.ifu || company.rccm) && (
                    <p className="identifiers text-sm font-medium mb-2">
                      {company.ifu && <span className="identifier">IFU: {company.ifu}</span>}
                      {company.ifu && company.rccm && <span className="identifier-separator mx-2"> | </span>}
                      {company.rccm && <span className="identifier">RCCM: {company.rccm}</span>}
                    </p>
                  )}
                  {company.phone && <p className="phone text-sm text-muted-foreground">{company.phone}</p>}
                  {company.address && <p className="address text-sm text-muted-foreground">{company.address}</p>}
                  {company.email && <p className="email text-sm text-muted-foreground">{company.email}</p>}
                </div>
                {company.logoUrl && (
                  <div className="logo ml-4">
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="max-w-[120px] max-h-[60px] object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="divider border-t border-black my-4" />

          {/* Informations facture et client */}
          <div className="info-section flex gap-8 mb-4">
            <div className="info-block flex-1">
              <h3 className="info-title text-sm font-bold mb-2">Informations facture</h3>
              <div className="space-y-1 text-sm">
                <p><span className="label text-muted-foreground">N° Facture:</span> <span className="value font-medium">{invoice.invoiceNumber}</span></p>
                <p><span className="label text-muted-foreground">Date:</span> <span>{formatDate(invoice.date)}</span></p>
                {invoice.dueDate && (
                  <p><span className="label text-muted-foreground">Échéance:</span> <span>{formatDate(invoice.dueDate)}</span></p>
                )}
                <p><span className="label text-muted-foreground">Statut:</span> <span>{getStatusLabel(invoice.status)}</span></p>
              </div>
            </div>

            <div className="info-block flex-1">
              <h3 className="info-title text-sm font-bold mb-2">Informations client</h3>
              <div className="space-y-1 text-sm">
                <p className="client-name font-medium">{invoice.clientName || 'Client de passage'}</p>
                {invoice.notes && (
                  <p className="client-notes text-muted-foreground mt-2">{invoice.notes}</p>
                )}
              </div>
            </div>
          </div>

          <div className="divider border-t border-black my-4" />

          {/* Produits */}
          <div className="products-section mb-4">
            <h3 className="section-title text-sm font-bold mb-3">Produits / Services</h3>
            <table className="products-table w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-black px-3 py-2 text-left text-sm font-bold bg-gray-100">Désignation</th>
                  <th className="border border-black px-3 py-2 text-center text-sm font-bold bg-gray-100 w-20">Qté</th>
                  {showUnitPrice && <th className="border border-black px-3 py-2 text-right text-sm font-bold bg-gray-100 w-24">Prix unit.</th>}
                  <th className="border border-black px-3 py-2 text-right text-sm font-bold bg-gray-100 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-black px-3 py-2 text-sm">
                      <span className="font-medium">{item.productName}</span>
                      {item.productCode && (
                        <span className="product-code text-xs text-muted-foreground ml-2">({item.productCode})</span>
                      )}
                      {item.isWholesale && (
                        <span className="wholesale-badge inline-block ml-2 px-2 py-0.5 border border-black text-xs">
                          Gros
                        </span>
                      )}
                    </td>
                    <td className="border border-black px-3 py-2 text-sm text-center">
                      {item.quantity} {item.unit}
                    </td>
                    {showUnitPrice && (
                      <td className="border border-black px-3 py-2 text-sm text-right">
                        {formatPrice(item.unitPrice)} FCFA
                      </td>
                    )}
                    <td className="border border-black px-3 py-2 text-sm text-right font-medium">
                      {formatPrice(item.total)} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="totals-section flex justify-end mb-4">
            <div className="totals-block w-64">
              <div className="total-row flex justify-between py-1 text-sm">
                <span>Sous-total:</span>
                <span>{formatPrice(invoice.subtotal)} FCFA</span>
              </div>
              {showTax && invoice.taxRate > 0 && (
                <div className="total-row flex justify-between py-1 text-sm">
                  <span>TVA ({invoice.taxRate}%):</span>
                  <span>{formatPrice(invoice.taxAmount)} FCFA</span>
                </div>
              )}
              {invoice.discount > 0 && (
                <div className="total-row flex justify-between py-1 text-sm text-green-600">
                  <span>Remise:</span>
                  <span>-{formatPrice(invoice.discount)} FCFA</span>
                </div>
              )}
              <div className="divider border-t border-black my-2" />
              <div className="total-row flex justify-between py-2 text-lg font-bold">
                <span>Total:</span>
                <span>{formatPrice(invoice.total)} FCFA</span>
              </div>
              {invoice.paidAmount > 0 && (
                <>
                  <div className="divider border-t border-black my-2" />
                  <div className="total-row flex justify-between py-1 text-sm">
                    <span>Montant payé:</span>
                    <span className="text-green-600">{formatPrice(invoice.paidAmount)} FCFA</span>
                  </div>
                  {invoice.remainingAmount > 0 && (
                    <div className="total-row flex justify-between py-1 text-sm font-medium text-orange-600">
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
              <div className="divider border-t border-black my-4" />
              <div className="footer-section text-center py-2 border-t border-black">
                <p className="text-sm">{company.invoiceFooter}</p>
              </div>
            </>
          )}

          {/* Informations légales */}
          <div className="legal-section text-xs text-muted-foreground mt-4 pt-2 border-t border-gray-300">
            {company?.taxId && <p className="my-1">N° Contribuable: {company.taxId}</p>}
            {company?.businessRegister && <p className="my-1">Registre Commerce: {company.businessRegister}</p>}
            <p className="my-1">Généré par Omnigestion - {format(new Date(), 'PPP', { locale: fr })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Styles CSS pour l'impression
function getInvoicePrintStyles() {
  return `
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }
    .company-name {
      font-size: 18pt;
      font-weight: bold;
      margin: 0 0 5px 0;
    }
    .slogan, .address, .phone, .email {
      font-size: 10pt;
      margin: 2px 0;
    }
    .identifiers {
      font-size: 9pt;
      margin: 3px 0;
      font-weight: 500;
    }
    .divider {
      border-top: 1px solid #000;
      margin: 12px 0;
    }
    .info-title {
      font-size: 12pt;
      font-weight: bold;
      margin: 0 0 8px 0;
    }
    .products-table th,
    .products-table td {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: left;
      font-size: 10pt;
    }
    .products-table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .wholesale-badge {
      display: inline-block;
      padding: 2px 6px;
      border: 1px solid #000;
      font-size: 8pt;
    }
    @media print {
      body {
        background: white !important;
      }
    }
  `;
}
