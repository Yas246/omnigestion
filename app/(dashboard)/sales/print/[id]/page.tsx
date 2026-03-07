'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

interface InvoiceItem {
  productName: string;
  productCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  isWholesale?: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  clientName: string;
  notes?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
  slogan?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  invoiceFooter?: string;
  taxId?: string;
  businessRegister?: string;
  ifu?: string;
  rccm?: string;
}

export default function PrintInvoicePage() {
  const params = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasPrinted = useRef(false);
  const hasClosed = useRef(false);

  useEffect(() => {
    // Définir le titre du document avec le numéro de facture
    if (invoice?.invoiceNumber) {
      document.title = `Facture_${invoice.invoiceNumber}`;
    }
  }, [invoice]);

  useEffect(() => {
    async function loadData() {
      if (!params.id) {
        setError('Impossible de charger la facture');
        setLoading(false);
        return;
      }

      try {
        // Essayer de charger depuis sessionStorage d'abord (mode hors ligne)
        const cachedData = sessionStorage.getItem(`invoice_print_${params.id}`);
        if (cachedData) {
          const { invoice: cachedInvoice, company: cachedCompany, timestamp } = JSON.parse(cachedData);

          // Vérifier que les données ne sont pas trop vieilles (24h max)
          const age = Date.now() - timestamp;
          if (age < 24 * 60 * 60 * 1000) {
            console.log('[Print] Données chargées depuis sessionStorage (mode hors ligne)');
            setInvoice(cachedInvoice);
            setCompany(cachedCompany);

            // Imprimer automatiquement
            if (!hasPrinted.current) {
              hasPrinted.current = true;
              setTimeout(() => {
                window.print();
                setTimeout(() => {
                  if (!hasClosed.current) {
                    hasClosed.current = true;
                    window.close();
                  }
                }, 1000);
              }, 500);
            }

            setLoading(false);
            return;
          } else {
            // Données trop vieilles, les supprimer
            sessionStorage.removeItem(`invoice_print_${params.id}`);
          }
        }

        // Si pas de données cached ou trop vieilles, charger depuis Firestore
        if (!user?.currentCompanyId) {
          setError('Impossible de charger la facture');
          setLoading(false);
          return;
        }

        // Récupérer la facture
        const invoiceRef = doc(db, 'companies', user.currentCompanyId, 'invoices', params.id as string);
        const invoiceSnap = await getDoc(invoiceRef);

        if (!invoiceSnap.exists()) {
          setError('Facture non trouvée');
          setLoading(false);
          return;
        }

        const data = invoiceSnap.data();
        const invoiceData = {
          id: invoiceSnap.id,
          ...data,
          // Convertir les dates Firestore en chaînes ISO
          date: data?.date?.toDate?.()?.toISOString() || data?.date || new Date().toISOString(),
          dueDate: data?.dueDate?.toDate?.()?.toISOString() || data?.dueDate || undefined,
        } as Invoice;
        setInvoice(invoiceData);

        // Récupérer l'entreprise
        if (invoiceData.companyId) {
          const companyRef = doc(db, 'companies', invoiceData.companyId);
          const companySnap = await getDoc(companyRef);

          if (companySnap.exists()) {
            setCompany({
              id: companySnap.id,
              ...companySnap.data()
            } as Company);
          }
        }

        // Imprimer automatiquement après le chargement (une seule fois)
        if (!hasPrinted.current) {
          hasPrinted.current = true;
          setTimeout(() => {
            window.print();

            // Fermer l'onglet après l'impression (ou annulation)
            setTimeout(() => {
              if (!hasClosed.current) {
                hasClosed.current = true;
                window.close();
              }
            }, 1000);
          }, 500);
        }

      } catch (err) {
        console.error('Erreur lors du chargement de la facture:', err);
        setError('Erreur lors du chargement de la facture');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, user]);

  // Écouter l'événement afterprint pour fermer la fenêtre
  useEffect(() => {
    const handleAfterPrint = () => {
      if (!hasClosed.current) {
        hasClosed.current = true;
        setTimeout(() => {
          window.close();
        }, 100);
      }
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">{error || 'Facture non trouvée'}</p>
      </div>
    );
  }

  return (
    <div className="invoice-container">
      {/* En-tête entreprise */}
      {company && (
        <div className="print-header">
          <div className="company-info">
            <h1 className="company-name">{company.name}</h1>
            {company.slogan && <p className="slogan">{company.slogan}</p>}
            {(company.ifu || company.rccm) && (
              <p className="identifiers">
                {company.ifu && <span className="identifier">IFU: {company.ifu}</span>}
                {company.ifu && company.rccm && <span className="identifier-separator"> | </span>}
                {company.rccm && <span className="identifier">RCCM: {company.rccm}</span>}
              </p>
            )}
            {company.phone && <p className="phone">{company.phone}</p>}
            {company.address && <p className="address">{company.address}</p>}
            {company.email && <p className="email">{company.email}</p>}
          </div>
          {company.logoUrl && (
            <div className="logo">
              <img src={company.logoUrl} alt={company.name} />
            </div>
          )}
        </div>
      )}

      <div className="divider" />

      {/* Informations facture et client */}
      <div className="info-section">
        <div className="info-block">
          <h3 className="info-title">Informations facture</h3>
          <div className="info-row">
            <span className="label">N° Facture:</span>
            <span className="value">{invoice.invoiceNumber}</span>
          </div>
          <div className="info-row">
            <span className="label">Date:</span>
            <span className="value">{formatDate(invoice.date)}</span>
          </div>
          {invoice.dueDate && (
            <div className="info-row">
              <span className="label">Échéance:</span>
              <span className="value">{formatDate(invoice.dueDate)}</span>
            </div>
          )}
          <div className="info-row">
            <span className="label">Statut:</span>
            <span className="value">{getStatusLabel(invoice.status)}</span>
          </div>
        </div>

        <div className="info-block">
          <h3 className="info-title">Informations client</h3>
          <p className="client-name">{invoice.clientName || 'Client de passage'}</p>
          {invoice.notes && <p className="client-notes">{invoice.notes}</p>}
        </div>
      </div>

      <div className="divider" />

      {/* Produits */}
      <div className="products-section">
        <h3 className="section-title">Produits / Services</h3>
        <table className="products-table">
          <thead>
            <tr>
              <th className="col-designation">Désignation</th>
              <th className="col-qty">Qté</th>
              <th className="col-price">Prix unit.</th>
              <th className="col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td className="col-designation">
                  <span className="product-name">{item.productName}</span>
                  {item.productCode && <span className="product-code">({item.productCode})</span>}
                  {item.isWholesale && <span className="wholesale-badge">Gros</span>}
                </td>
                <td className="col-qty">{item.quantity} {item.unit}</td>
                <td className="col-price">{formatPrice(item.unitPrice)} FCFA</td>
                <td className="col-total">{formatPrice(item.total)} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totaux */}
      <div className="totals-section">
        <div className="totals-block">
          <div className="total-row">
            <span className="total-label">Sous-total:</span>
            <span className="total-value">{formatPrice(invoice.subtotal)} FCFA</span>
          </div>
          {invoice.taxRate > 0 && (
            <div className="total-row">
              <span className="total-label">TVA ({invoice.taxRate}%):</span>
              <span className="total-value">{formatPrice(invoice.taxAmount)} FCFA</span>
            </div>
          )}
          {invoice.discount > 0 && (
            <div className="total-row discount">
              <span className="total-label">Remise:</span>
              <span className="total-value">-{formatPrice(invoice.discount)} FCFA</span>
            </div>
          )}
          <div className="divider" />
          <div className="total-row grand-total">
            <span className="total-label">Total:</span>
            <span className="total-value">{formatPrice(invoice.total)} FCFA</span>
          </div>
          {invoice.paidAmount > 0 && (
            <>
              <div className="divider" />
              <div className="total-row">
                <span className="total-label">Montant payé:</span>
                <span className="total-value paid">{formatPrice(invoice.paidAmount)} FCFA</span>
              </div>
              {invoice.remainingAmount > 0 && (
                <div className="total-row">
                  <span className="total-label remaining">Reste à payer:</span>
                  <span className="total-value remaining">{formatPrice(invoice.remainingAmount)} FCFA</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      {company?.invoiceFooter && (
        <>
          <div className="divider" />
          <div className="footer-section">
            <p>{company.invoiceFooter}</p>
          </div>
        </>
      )}

      {/* Informations légales */}
      <div className="legal-section">
        <p>Généré par Omnigestion - {format(new Date(), 'PPP', { locale: fr })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      <style jsx global>{`
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

        .invoice-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }

        .company-info {
          flex: 1;
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

        .identifier {
          color: #333;
        }

        .identifier-separator {
          margin: 0 8px;
        }

        .logo img {
          max-width: 120px;
          max-height: 60px;
          object-fit: contain;
        }

        .divider {
          border-top: 1px solid #000;
          margin: 12px 0;
        }

        .info-section {
          display: flex;
          gap: 30px;
          margin: 12px 0;
        }

        .info-block {
          flex: 1;
        }

        .info-title {
          font-size: 12pt;
          font-weight: bold;
          margin: 0 0 8px 0;
        }

        .info-row {
          display: flex;
          margin: 4px 0;
          font-size: 10pt;
        }

        .label {
          font-weight: normal;
          margin-right: 8px;
        }

        .value {
          font-weight: bold;
        }

        .client-name {
          font-size: 11pt;
          font-weight: bold;
          margin: 0 0 5px 0;
        }

        .client-notes {
          font-size: 10pt;
          margin: 5px 0 0 0;
        }

        .products-section {
          margin: 15px 0;
        }

        .section-title {
          font-size: 12pt;
          font-weight: bold;
          margin: 0 0 10px 0;
        }

        .products-table {
          width: 100%;
          border-collapse: collapse;
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

        .col-designation {
          width: 45%;
        }

        .col-qty {
          width: 15%;
          text-align: center;
        }

        .col-price {
          width: 20%;
          text-align: right;
        }

        .col-total {
          width: 20%;
          text-align: right;
        }

        .product-name {
          font-weight: bold;
        }

        .product-code {
          font-size: 9pt;
          margin-left: 5px;
        }

        .wholesale-badge {
          display: inline-block;
          padding: 2px 6px;
          margin-left: 5px;
          border: 1px solid #000;
          font-size: 8pt;
        }

        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin: 15px 0;
        }

        .totals-block {
          width: 220px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 10pt;
        }

        .total-row.grand-total {
          font-size: 13pt;
          font-weight: bold;
          padding: 10px 0;
        }

        .footer-section {
          text-align: center;
          margin: 15px 0;
          padding: 10px;
          border-top: 1px solid #000;
        }

        .footer-section p {
          margin: 0;
          font-size: 10pt;
        }

        .legal-section {
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px solid #ccc;
          font-size: 8pt;
          color: #666;
        }

        .legal-section p {
          margin: 3px 0;
        }

        @media print {
          /* Masquer les éléments d'interface spécifiques */
          nav, header, footer, aside, .no-print {
            display: none !important;
          }

          /* Masquer les éléments avec data-slot spécifiques (Radix UI, etc) */
          [data-slot="dialog-overlay"],
          [data-slot="dialog-close"],
          [role="dialog"] {
            display: none !important;
          }

          /* S'assurer que le body et le conteneur de facture sont visibles */
          body, #__next, #root, div {
            background: white !important;
          }

          .invoice-container {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
