import { useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook pour vérifier les permissions de l'utilisateur
 * Les admins ont tous les droits, les employés ont des permissions granulaires
 */
export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   * @param module - Le module (ex: 'sales', 'stock', 'cash', 'clients', 'credits', 'reports', 'settings')
   * @param action - L'action (ex: 'create', 'read', 'update', 'delete', 'restock', 'transfer', etc.)
   */
  const hasPermission = (module: string, action: string): boolean => {
    // Les admins ont toutes les permissions
    if (isAdmin) return true;

    // Vérifier les permissions granulaires pour les employés
    if (!user?.permissions) return false;

    const modulePermissions = user.permissions.find((p) => p.module === module);
    return modulePermissions?.actions.includes(action) || false;
  };

  /**
   * Vérifie si l'utilisateur a au moins une des permissions spécifiées
   */
  const hasAnyPermission = (module: string, actions: string[]): boolean => {
    if (isAdmin) return true;
    return actions.some((action) => hasPermission(module, action));
  };

  /**
   * Vérifie si l'utilisateur a toutes les permissions spécifiées
   */
  const hasAllPermissions = (module: string, actions: string[]): boolean => {
    if (isAdmin) return true;
    return actions.every((action) => hasPermission(module, action));
  };

  /**
   * Vérifie si l'utilisateur peut accéder à un module (au moins read)
   */
  const canAccessModule = (module: string): boolean => {
    if (isAdmin) return true;
    if (module === 'dashboard') return true; // Tout le monde peut voir le dashboard
    return hasPermission(module, 'read');
  };

  /**
   * Récupère les modules accessibles par l'utilisateur
   */
  const getAccessibleModules = (): string[] => {
    if (isAdmin) {
      return ['dashboard', 'sales', 'stock', 'cash', 'clients', 'credits/clients', 'suppliers', 'reports', 'settings'];
    }

    if (!user?.permissions) return ['dashboard'];

    const modules = user.permissions.map((p) => p.module);
    const accessibleModules: string[] = [];

    // Dashboard toujours accessible
    accessibleModules.push('dashboard');

    if (modules.includes('sales')) accessibleModules.push('sales');
    if (modules.includes('stock')) accessibleModules.push('stock');
    if (modules.includes('cash')) accessibleModules.push('cash');
    if (modules.includes('clients')) accessibleModules.push('clients');
    if (modules.includes('credits')) {
      accessibleModules.push('credits/clients');
      accessibleModules.push('suppliers');
    }
    if (modules.includes('reports')) accessibleModules.push('reports');
    if (modules.includes('settings')) accessibleModules.push('settings');

    return accessibleModules;
  };

  // ========== Permissions spécifiques par module ==========

  /** VENTES */
  const canCreateSale = () => hasPermission('sales', 'create');
  const canUpdateSale = () => hasPermission('sales', 'update');
  const canDeleteSale = () => hasPermission('sales', 'delete');
  const canPrintSale = () => hasPermission('sales', 'read'); // Imprimer = lire

  /** STOCK */
  const canCreateProduct = () => hasPermission('stock', 'create');
  const canUpdateProduct = () => hasPermission('stock', 'update');
  const canDeleteProduct = () => hasPermission('stock', 'delete');
  const canRestock = () => hasPermission('stock', 'restock');
  const canTransferStock = () => hasPermission('stock', 'transfer');
  const canRecordLoss = () => hasPermission('stock', 'loss');
  const canViewStockMovements = () => hasPermission('stock', 'movements');

  /** CAISSE */
  const canCreateCashOperation = () => hasPermission('cash', 'create');
  const canCloseCashRegister = () => hasPermission('cash', 'close');
  const canViewCashReports = () => hasPermission('cash', 'reports');

  /** CLIENTS */
  const canCreateClient = () => hasPermission('clients', 'create');
  const canUpdateClient = () => hasPermission('clients', 'update');
  const canDeleteClient = () => hasPermission('clients', 'delete');

  /** CRÉDITS */
  const canCreateCredit = () => hasPermission('credits', 'create');
  const canUpdateCredit = () => hasPermission('credits', 'update');
  const canRecordPayment = () => hasPermission('credits', 'payment');
  const canCancelCredit = () => hasPermission('credits', 'delete');

  /** RAPPORTS */
  const canViewReports = () => hasPermission('reports', 'read');

  /** PARAMÈTRES */
  const canUpdateSettings = () => hasPermission('settings', 'update');

  /** GENERIC PERMISSIONS */
  const canCreate = (module: string) => hasPermission(module, 'create');
  const canUpdate = (module: string) => hasPermission(module, 'update');
  const canDelete = (module: string) => hasPermission(module, 'delete');

  return {
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessModule,
    canCreate,
    canUpdate,
    canDelete,
    canRead: (module: string) => hasPermission(module, 'read'),
    getAccessibleModules,
    // Ventes
    canCreateSale,
    canUpdateSale,
    canDeleteSale,
    canPrintSale,
    // Stock
    canCreateProduct,
    canUpdateProduct,
    canDeleteProduct,
    canRestock,
    canTransferStock,
    canRecordLoss,
    canViewStockMovements,
    // Caisse
    canCreateCashOperation,
    canCloseCashRegister,
    canViewCashReports,
    // Clients
    canCreateClient,
    canUpdateClient,
    canDeleteClient,
    // Crédits
    canCreateCredit,
    canUpdateCredit,
    canRecordPayment,
    canCancelCredit,
    // Rapports
    canViewReports,
    // Paramètres
    canUpdateSettings,
  };
}
