/**
 * Service de gestion des factures hors ligne
 * Utilise IndexedDB (via Dexie) pour stocker les factures créées hors ligne
 */

import Dexie, { Table } from 'dexie';
import type { InvoiceCreateInput } from '@/lib/hooks/useInvoices';

interface PendingInvoice {
  id: string;
  data: InvoiceCreateInput;
  timestamp: number;
  syncAttempts: number;
  lastSyncAttempt?: number;
}

export class OfflineInvoicesDB extends Dexie {
  pendingInvoices!: Table<PendingInvoice>;

  constructor() {
    super('OmnigestionOfflineDB');
    this.version(1).stores({
      pendingInvoices: 'id, timestamp, syncAttempts',
    });
  }
}

export const offlineDb = new OfflineInvoicesDB();

/**
 * Service pour gérer les factures hors ligne
 */
export class OfflineInvoicesService {
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours

  /**
   * Ajouter une facture à la file d'attente
   */
  async addPendingInvoice(data: InvoiceCreateInput): Promise<string> {
    const id = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pendingInvoice: PendingInvoice = {
      id,
      data,
      timestamp: Date.now(),
      syncAttempts: 0,
    };

    await offlineDb.pendingInvoices.add(pendingInvoice);
    console.log('[OfflineInvoices] Facture ajoutée à la file d\'attente:', id);

    return id;
  }

  /**
   * Récupérer toutes les factures en attente
   */
  async getPendingInvoices(): Promise<PendingInvoice[]> {
    return await offlineDb.pendingInvoices.toArray();
  }

  /**
   * Compter les factures en attente
   */
  async getPendingCount(): Promise<number> {
    return await offlineDb.pendingInvoices.count();
  }

  /**
   * Supprimer une facture de la file d'attente (après synchronisation réussie)
   */
  async removePendingInvoice(id: string): Promise<void> {
    await offlineDb.pendingInvoices.delete(id);
    console.log('[OfflineInvoices] Facture supprimée de la file d\'attente:', id);
  }

  /**
   * Vider toutes les factures en attente
   */
  async clearAll(): Promise<void> {
    await offlineDb.pendingInvoices.clear();
    console.log('[OfflineInvoices] Toutes les factures en attente ont été supprimées');
  }

  /**
   * Marquer une tentative de synchronisation échouée
   */
  async markSyncFailed(id: string): Promise<void> {
    const invoice = await offlineDb.pendingInvoices.get(id);
    if (invoice) {
      invoice.syncAttempts++;
      invoice.lastSyncAttempt = Date.now();
      await offlineDb.pendingInvoices.put(invoice);
    }
  }

  /**
   * Nettoyer les anciennes factures en attente (plus de 7 jours)
   */
  async cleanupOldInvoices(): Promise<number> {
    const sevenDaysAgo = Date.now() - this.CACHE_DURATION;
    const oldInvoices = await offlineDb.pendingInvoices
      .where('timestamp')
      .below(sevenDaysAgo)
      .toArray();

    if (oldInvoices.length > 0) {
      await offlineDb.pendingInvoices.bulkDelete(
        oldInvoices.map(inv => inv.id)
      );
      console.log(`[OfflineInvoices] ${oldInvoices.length} anciennes factures nettoyées`);
    }

    return oldInvoices.length;
  }
}

// Exporter une instance singleton
export const offlineInvoices = new OfflineInvoicesService();
