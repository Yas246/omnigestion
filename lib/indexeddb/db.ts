import Dexie, { Table } from 'dexie';
import type { Product } from '@/types';

export class ProductsDB extends Dexie {
  products!: Table<Product>;

  constructor() {
    super('OmnigestionDB');
    this.version(1).stores({
      products: 'id, companyId, name, code, category, status, isActive, warehouseId, updatedAt',
    });
  }
}

export const db = new ProductsDB();

/**
 * Service pour gérer le cache des produits dans IndexedDB
 */
export class ProductsCacheService {
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures

  /**
   * Récupère tous les produits depuis le cache
   */
  async getAllProducts(): Promise<Product[]> {
    return await db.products.toArray();
  }

  /**
   * Récupère un produit par son ID depuis le cache
   */
  async getProductById(id: string): Promise<Product | undefined> {
    return await db.products.get(id);
  }

  /**
   * Récupère les produits pour une compagnie spécifique
   */
  async getProductsByCompany(companyId: string): Promise<Product[]> {
    return await db.products.where('companyId').equals(companyId).toArray();
  }

  /**
   * Sauvegarde tous les produits dans le cache (remplace tout)
   */
  async setProducts(products: Product[]): Promise<void> {
    await db.products.clear();
    await db.products.bulkPut(products);
  }

  /**
   * Ajoute ou met à jour un produit dans le cache
   */
  async upsertProduct(product: Product): Promise<void> {
    await db.products.put(product);
  }

  /**
   * Supprime un produit du cache
   */
  async deleteProduct(id: string): Promise<void> {
    await db.products.delete(id);
  }

  /**
   * Met à jour plusieurs produits dans le cache
   */
  async updateProducts(products: Product[]): Promise<void> {
    await db.products.bulkPut(products);
  }

  /**
   * Vérifie si le cache est périmé
   */
  async isCacheExpired(companyId: string): Promise<boolean> {
    const products = await this.getProductsByCompany(companyId);

    if (products.length === 0) return true;

    // Vérifier la date de mise à jour la plus récente
    const latestUpdate = Math.max(...products.map(p => new Date(p.updatedAt).getTime()));
    const now = Date.now();

    return (now - latestUpdate) > this.CACHE_DURATION;
  }

  /**
   * Compte le nombre de produits dans le cache
   */
  async count(): Promise<number> {
    return await db.products.count();
  }

  /**
   * Vide tout le cache
   */
  async clear(): Promise<void> {
    await db.products.clear();
  }
}

export const productsCache = new ProductsCacheService();
