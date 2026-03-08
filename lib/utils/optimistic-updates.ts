import { useProductsStore } from '@/lib/stores/useProductsStore';
import { useInvoicesStore } from '@/lib/stores/useInvoicesStore';
import { useClientsStore } from '@/lib/stores/useClientsStore';
import type { Product, Invoice, Client } from '@/types';
import * as productsApi from '@/lib/firestore/products';
import * as invoicesApi from '@/lib/firestore/invoices';
import * as clientsApi from '@/lib/firestore/clients';

/**
 * Utilitaires pour les optimistic updates
 *
 * Ces helpers permettent de mettre à jour l'UI instantanément tout en
 * synchronisant avec Firestore en arrière-plan.
 */

/**
 * Créer un produit avec optimistic update
 */
export async function createProductWithOptimisticUpdate(
  companyId: string,
  data: productsApi.CreateProductData
): Promise<Product> {
  // 1. Créer un ID temporaire et un produit optimiste
  const tempId = `temp-${Date.now()}`;
  const optimisticProduct: Product = {
    id: tempId,
    companyId,
    name: data.name,
    code: data.code,
    description: data.description,
    category: data.category,
    purchasePrice: data.cost || data.price, // cost → purchasePrice
    retailPrice: data.price, // price → retailPrice
    wholesalePrice: data.price * 0.9, // 10% de réduction pour gros par défaut
    wholesaleThreshold: 5,
    currentStock: data.currentStock || 0,
    alertThreshold: data.alertThreshold || 10,
    status: 'ok',
    unit: data.unit,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 2. Mettre à jour le store immédiatement (UI se met à jour instantanément)
  useProductsStore.getState().optimisticCreateProduct(optimisticProduct);

  try {
    // 3. Créer dans Firestore en arrière-plan
    const realProduct = await productsApi.createProduct(companyId, data);

    // 4. Remplacer le produit optimiste par le réel
    useProductsStore.getState().optimisticUpdateProduct(tempId, realProduct);

    console.log('[createProductWithOptimisticUpdate] Succès', {
      tempId,
      realId: realProduct.id,
    });

    return realProduct;
  } catch (error) {
    // 5. En cas d'erreur, retirer le produit optimiste (rollback)
    useProductsStore.getState().optimisticDeleteProduct(tempId);
    console.error('[createProductWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Mettre à jour un produit avec optimistic update
 */
export async function updateProductWithOptimisticUpdate(
  companyId: string,
  productId: string,
  updates: productsApi.UpdateProductData
): Promise<void> {
  // 1. Sauvegarder l'ancien état pour le rollback
  const oldProduct = useProductsStore.getState().getProductById(productId);
  if (!oldProduct) {
    throw new Error(`Produit ${productId} non trouvé dans le store`);
  }

  // 2. Optimistic update immédiat
  useProductsStore.getState().optimisticUpdateProduct(productId, updates);

  try {
    // 3. Synchroniser avec Firestore en arrière-plan
    await productsApi.updateProduct(companyId, productId, updates);

    console.log('[updateProductWithOptimisticUpdate] Succès', { productId });
  } catch (error) {
    // 4. En cas d'erreur, restaurer l'ancien état (rollback)
    useProductsStore.getState().optimisticUpdateProduct(productId, oldProduct);
    console.error('[updateProductWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Supprimer un produit avec optimistic update
 */
export async function deleteProductWithOptimisticUpdate(
  companyId: string,
  productId: string
): Promise<void> {
  // 1. Sauvegarder l'ancien état pour le rollback
  const oldProduct = useProductsStore.getState().getProductById(productId);
  if (!oldProduct) {
    throw new Error(`Produit ${productId} non trouvé dans le store`);
  }

  // 2. Optimistic delete immédiat
  useProductsStore.getState().optimisticDeleteProduct(productId);

  try {
    // 3. Supprimer dans Firestore en arrière-plan (soft delete)
    await productsApi.deleteProduct(companyId, productId);

    console.log('[deleteProductWithOptimisticUpdate] Succès', { productId });
  } catch (error) {
    // 4. En cas d'erreur, restaurer le produit (rollback)
    useProductsStore.getState().optimisticCreateProduct(oldProduct);
    console.error('[deleteProductWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Créer une facture avec optimistic update
 */
export async function createInvoiceWithOptimisticUpdate(
  companyId: string,
  userId: string,
  data: invoicesApi.CreateInvoiceData
): Promise<Invoice> {
  // 1. Créer un ID temporaire et une facture optimiste
  const tempId = `temp-${Date.now()}`;

  // Calculer paidAmount et remainingAmount basé sur le status
  const isPaid = data.status === 'paid';
  const paidAmount = isPaid ? data.total : 0;
  const remainingAmount = data.total - paidAmount;

  const optimisticInvoice: Invoice = {
    id: tempId,
    companyId,
    invoiceNumber: data.invoiceNumber,
    date: new Date(),
    items: data.items,
    subtotal: data.subtotal,
    taxRate: data.taxRate,
    taxAmount: data.taxAmount,
    discount: data.discount,
    total: data.total,
    status: data.status,
    paymentMethod: data.paymentMethod as any, // Cast pour paymentMethod string -> PaymentMethod
    paidAmount,
    remainingAmount,
    userId,
    userName: undefined, // Sera rempli plus tard
    createdAt: new Date(),
    updatedAt: new Date(),
    // Champs optionnels de data
    ...(data.clientId && { clientId: data.clientId }),
    ...(data.dueDate && { dueDate: data.dueDate }),
  };

  // 2. Mettre à jour le store immédiatement
  useInvoicesStore.getState().optimisticCreateInvoice(optimisticInvoice);

  try {
    // 3. Créer dans Firestore en arrière-plan (avec transaction pour stock)
    const realInvoice = await invoicesApi.createInvoice(companyId, userId, data);

    // 4. Remplacer la facture optimiste par la réelle
    useInvoicesStore.getState().optimisticUpdateInvoice(tempId, realInvoice);

    console.log('[createInvoiceWithOptimisticUpdate] Succès', {
      tempId,
      realId: realInvoice.id,
    });

    return realInvoice;
  } catch (error) {
    // 5. En cas d'erreur, retirer la facture optimiste (rollback)
    useInvoicesStore.getState().optimisticDeleteInvoice(tempId);
    console.error('[createInvoiceWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Mettre à jour une facture avec optimistic update
 */
export async function updateInvoiceWithOptimisticUpdate(
  companyId: string,
  invoiceId: string,
  updates: invoicesApi.UpdateInvoiceData
): Promise<void> {
  // 1. Sauvegarder l'ancien état pour le rollback
  const oldInvoice = useInvoicesStore.getState().getInvoiceById(invoiceId);
  if (!oldInvoice) {
    throw new Error(`Facture ${invoiceId} non trouvée dans le store`);
  }

  // 2. Optimistic update immédiat
  useInvoicesStore.getState().optimisticUpdateInvoice(invoiceId, updates as Partial<Invoice>);

  try {
    // 3. Synchroniser avec Firestore en arrière-plan
    await invoicesApi.updateInvoice(companyId, invoiceId, updates);

    console.log('[updateInvoiceWithOptimisticUpdate] Succès', { invoiceId });
  } catch (error) {
    // 4. En cas d'erreur, restaurer l'ancien état (rollback)
    useInvoicesStore.getState().optimisticUpdateInvoice(invoiceId, oldInvoice);
    console.error('[updateInvoiceWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Supprimer une facture avec optimistic update
 */
export async function deleteInvoiceWithOptimisticUpdate(
  companyId: string,
  invoiceId: string
): Promise<void> {
  // 1. Sauvegarder l'ancien état pour le rollback
  const oldInvoice = useInvoicesStore.getState().getInvoiceById(invoiceId);
  if (!oldInvoice) {
    throw new Error(`Facture ${invoiceId} non trouvée dans le store`);
  }

  // 2. Optimistic delete immédiat
  useInvoicesStore.getState().optimisticDeleteInvoice(invoiceId);

  try {
    // 3. Supprimer dans Firestore en arrière-plan (soft delete)
    await invoicesApi.deleteInvoice(companyId, invoiceId);

    console.log('[deleteInvoiceWithOptimisticUpdate] Succès', { invoiceId });
  } catch (error) {
    // 4. En cas d'erreur, restaurer la facture (rollback)
    useInvoicesStore.getState().optimisticCreateInvoice(oldInvoice);
    console.error('[deleteInvoiceWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Créer un client avec optimistic update
 */
export async function createClientWithOptimisticUpdate(
  companyId: string,
  data: clientsApi.CreateClientData
): Promise<Client> {
  // 1. Créer un ID temporaire et un client optimiste
  const tempId = `temp-${Date.now()}`;
  const optimisticClient: Client = {
    id: tempId,
    companyId,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    totalPurchases: 0,
    totalAmount: 0,
    currentCredit: data.currentBalance || 0, // currentBalance dans CreateClientData -> currentCredit dans Client
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 2. Mettre à jour le store immédiatement
  useClientsStore.getState().optimisticCreateClient(optimisticClient);

  try {
    // 3. Créer dans Firestore en arrière-plan
    const realClient = await clientsApi.createClient(companyId, data);

    // 4. Remplacer le client optimiste par le réel
    useClientsStore.getState().optimisticUpdateClient(tempId, realClient);

    console.log('[createClientWithOptimisticUpdate] Succès', {
      tempId,
      realId: realClient.id,
    });

    return realClient;
  } catch (error) {
    // 5. En cas d'erreur, retirer le client optimiste (rollback)
    useClientsStore.getState().optimisticDeleteClient(tempId);
    console.error('[createClientWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Mettre à jour un client avec optimistic update
 */
export async function updateClientWithOptimisticUpdate(
  companyId: string,
  clientId: string,
  updates: clientsApi.UpdateClientData
): Promise<void> {
  // 1. Sauvegarder l'ancien état pour le rollback
  const oldClient = useClientsStore.getState().getClientById(clientId);
  if (!oldClient) {
    throw new Error(`Client ${clientId} non trouvé dans le store`);
  }

  // 2. Optimistic update immédiat
  useClientsStore.getState().optimisticUpdateClient(clientId, updates);

  try {
    // 3. Synchroniser avec Firestore en arrière-plan
    await clientsApi.updateClient(companyId, clientId, updates);

    console.log('[updateClientWithOptimisticUpdate] Succès', { clientId });
  } catch (error) {
    // 4. En cas d'erreur, restaurer l'ancien état (rollback)
    useClientsStore.getState().optimisticUpdateClient(clientId, oldClient);
    console.error('[updateClientWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}

/**
 * Supprimer un client avec optimistic update
 */
export async function deleteClientWithOptimisticUpdate(
  companyId: string,
  clientId: string
): Promise<void> {
  // 1. Sauvegarder l'ancien état pour le rollback
  const oldClient = useClientsStore.getState().getClientById(clientId);
  if (!oldClient) {
    throw new Error(`Client ${clientId} non trouvé dans le store`);
  }

  // 2. Optimistic delete immédiat
  useClientsStore.getState().optimisticDeleteClient(clientId);

  try {
    // 3. Supprimer dans Firestore en arrière-plan (soft delete)
    await clientsApi.deleteClient(companyId, clientId);

    console.log('[deleteClientWithOptimisticUpdate] Succès', { clientId });
  } catch (error) {
    // 4. En cas d'erreur, restaurer le client (rollback)
    useClientsStore.getState().optimisticCreateClient(oldClient);
    console.error('[deleteClientWithOptimisticUpdate] Erreur:', error);
    throw error;
  }
}
