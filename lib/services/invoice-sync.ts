/**
 * Service de synchronisation des factures hors ligne
 * Écoute les événements de connexion et synchronise automatiquement
 */

import { offlineInvoices } from '@/lib/indexeddb/offline-invoices';
import type { InvoiceCreateInput } from '@/lib/hooks/useInvoices';

interface SyncOptions {
  onSyncStart?: (count: number) => void;
  onSyncProgress?: (current: number, total: number) => void;
  onSyncComplete?: (success: number, failed: number) => void;
  onSyncError?: (error: Error) => void;
}

interface SyncResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ invoiceId: string; error: string }>;
}

class InvoiceSyncService {
  private isSyncing = false;
  private syncCallbacks: SyncOptions = {};

  /**
   * Définir les callbacks de synchronisation
   */
  setCallbacks(callbacks: SyncOptions) {
    this.syncCallbacks = callbacks;
  }

  /**
   * Démarrer la synchronisation des factures en attente
   */
  async syncPendingInvoices(
    createInvoiceFn: (data: InvoiceCreateInput) => Promise<any>
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[InvoiceSync] Synchronisation déjà en cours...');
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    try {
      this.isSyncing = true;

      // Récupérer les factures en attente
      const pendingInvoices = await offlineInvoices.getPendingInvoices();

      if (pendingInvoices.length === 0) {
        console.log('[InvoiceSync] Aucune facture à synchroniser');
        return { total: 0, success: 0, failed: 0, errors: [] };
      }

      console.log(`[InvoiceSync] Début synchronisation de ${pendingInvoices.length} factures`);

      // Notifier le début de la synchronisation
      this.syncCallbacks.onSyncStart?.(pendingInvoices.length);

      const result: SyncResult = {
        total: pendingInvoices.length,
        success: 0,
        failed: 0,
        errors: [],
      };

      // Trier par timestamp (plus ancien en premier)
      pendingInvoices.sort((a, b) => a.timestamp - b.timestamp);

      // Synchroniser chaque facture
      for (let i = 0; i < pendingInvoices.length; i++) {
        const pendingInvoice = pendingInvoices[i];

        // Notifier la progression
        this.syncCallbacks.onSyncProgress?.(i + 1, pendingInvoices.length);

        try {
          console.log(`[InvoiceSync] Synchronisation facture ${i + 1}/${pendingInvoices.length}:`, pendingInvoice.id);

          // Créer la facture dans Firestore
          await createInvoiceFn(pendingInvoice.data);

          // Supprimer de la file d'attente
          await offlineInvoices.removePendingInvoice(pendingInvoice.id);

          result.success++;
          console.log(`[InvoiceSync] ✓ Facture synchronisée: ${pendingInvoice.id}`);
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            invoiceId: pendingInvoice.id,
            error: error.message || 'Erreur inconnue',
          });

          // Marquer la tentative échouée
          await offlineInvoices.markSyncFailed(pendingInvoice.id);

          console.error(`[InvoiceSync] ✗ Erreur synchronisation facture ${pendingInvoice.id}:`, error);
        }
      }

      // Notifier la fin de la synchronisation
      this.syncCallbacks.onSyncComplete?.(result.success, result.failed);

      console.log('[InvoiceSync] Synchronisation terminée:', result);
      return result;
    } catch (error) {
      const syncError = error as Error;
      this.syncCallbacks.onSyncError?.(syncError);
      console.error('[InvoiceSync] Erreur lors de la synchronisation:', syncError);
      throw syncError;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Vérifier si une synchronisation est en cours
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Obtenir le nombre de factures en attente
   */
  async getPendingCount(): Promise<number> {
    return await offlineInvoices.getPendingCount();
  }

  /**
   * Nettoyer les anciennes factures en attente
   */
  async cleanup(): Promise<number> {
    return await offlineInvoices.cleanupOldInvoices();
  }
}

// Exporter une instance singleton
export const invoiceSync = new InvoiceSyncService();

/**
 * Hook pour écouter les événements de connexion et lancer la synchronisation
 */
export function setupInvoiceSyncAutoSync(
  createInvoiceFn: (data: InvoiceCreateInput) => Promise<any>,
  callbacks?: SyncOptions
) {
  if (callbacks) {
    invoiceSync.setCallbacks(callbacks);
  }

  // Écouter l'événement de reconnexion
  const handleOnline = async () => {
    console.log('[InvoiceSync] Connexion rétablie, démarrage synchronisation...');

    // Attendre un peu pour s'assurer que la connexion est stable
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await invoiceSync.syncPendingInvoices(createInvoiceFn);
    } catch (error) {
      console.error('[InvoiceSync] Erreur lors de la synchronisation automatique:', error);
    }
  };

  // Écouter les événements du navigateur
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);

    // Nettoyer l'écouteur lors du démontage
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }

  return () => {};
}
