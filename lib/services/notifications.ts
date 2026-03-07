/**
 * Service d'envoi de notifications push FCM
 * Permet d'envoyer des notifications pour les ventes et alertes de stock
 */

/**
 * Données pour une notification de nouvelle vente
 */
export interface SaleNotificationData {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  employeeName: string;
  clientName?: string;
}

/**
 * Données pour une alerte de stock faible
 */
export interface StockAlertData {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  warehouseName?: string;
}

/**
 * Envoyer une notification de nouvelle vente aux admins
 *
 * @param data Données de la vente
 * @param companyId ID de la compagnie
 */
export async function notifyNewSale(data: SaleNotificationData, companyId: string) {
  try {
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_sale',
        title: '🎉 Nouvelle vente enregistrée',
        body: `Facture ${data.invoiceNumber} - ${data.total.toLocaleString('fr-FR')} FCFA\nPar: ${data.employeeName}${data.clientName ? `\nClient: ${data.clientName}` : ''}`,
        data: {
          invoiceId: data.invoiceId,
          type: 'sale',
        },
        companyId,
        targetRole: 'admin', // Uniquement les admins
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[notifyNewSale] Erreur lors de l\'envoi:', error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log('[notifyNewSale] Notification envoyée:', result);
    return { success: true, result };
  } catch (error) {
    console.error('[notifyNewSale] Erreur lors de la notification de vente:', error);
    return { success: false, error };
  }
}

/**
 * Envoyer une alerte de stock faible aux admins
 *
 * @param data Données du produit
 * @param companyId ID de la compagnie
 */
export async function notifyLowStock(data: StockAlertData, companyId: string) {
  try {
    const warehouseInfo = data.warehouseName ? ` à ${data.warehouseName}` : '';

    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stock_alert',
        title: `⚠️ Stock faible: ${data.productName}`,
        body: `Stock actuel: ${data.currentStock} (seuil: ${data.threshold})${warehouseInfo}`,
        data: {
          productId: data.productId,
          type: 'stock_low',
        },
        companyId,
        targetRole: 'admin',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[notifyLowStock] Erreur lors de l\'envoi:', error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log('[notifyLowStock] Alerte envoyée:', result);
    return { success: true, result };
  } catch (error) {
    console.error('[notifyLowStock] Erreur lors de l\'alerte de stock:', error);
    return { success: false, error };
  }
}

/**
 * Envoyer une alerte de stock épuisé aux admins
 *
 * @param data Données du produit
 * @param companyId ID de la compagnie
 */
export async function notifyOutOfStock(data: Omit<StockAlertData, 'currentStock' | 'threshold'>, companyId: string) {
  try {
    const warehouseInfo = data.warehouseName ? ` à ${data.warehouseName}` : '';

    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stock_alert',
        title: `🚨 Stock épuisé: ${data.productName}`,
        body: `Produit en rupture de stock${warehouseInfo}`,
        data: {
          productId: data.productId,
          type: 'stock_out',
        },
        companyId,
        targetRole: 'admin',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[notifyOutOfStock] Erreur lors de l\'envoi:', error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log('[notifyOutOfStock] Alerte envoyée:', result);
    return { success: true, result };
  } catch (error) {
    console.error('[notifyOutOfStock] Erreur lors de l\'alerte de rupture:', error);
    return { success: false, error };
  }
}
