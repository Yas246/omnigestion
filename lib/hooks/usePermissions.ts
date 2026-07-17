import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook pour vérifier les permissions de l'utilisateur
 * Les admins ont tous les droits, les employés ont des permissions granulaires
 */
export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  // Les permissions sont la seule donnée utilisateur dont dépendent les helpers.
  // On extrait une référence stable pour keyer les useCallback/useMemo.
  const permissions = user?.permissions;

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   * @param module - Le module (ex: 'dashboard', 'sales', 'stock', 'cash', 'clients', 'credits', 'suppliers', 'reports', 'settings')
   * @param action - L'action (ex: 'create', 'read', 'update', 'delete', 'restock', 'transfer', etc.)
   */
  const hasPermission = useCallback(
    (module: string, action: string): boolean => {
      // Les admins ont toutes les permissions
      if (isAdmin) return true;

      // Vérifier les permissions granulaires pour les employés
      if (!permissions) return false;

      const modulePermissions = permissions.find((p) => p.module === module);
      return modulePermissions?.actions.includes(action) || false;
    },
    [isAdmin, permissions],
  );

  /**
   * Vérifie si l'utilisateur a au moins une des permissions spécifiées
   */
  const hasAnyPermission = useCallback(
    (module: string, actions: string[]): boolean => {
      if (isAdmin) return true;
      return actions.some((action) => hasPermission(module, action));
    },
    [isAdmin, hasPermission],
  );

  /**
   * Vérifie si l'utilisateur a toutes les permissions spécifiées
   */
  const hasAllPermissions = useCallback(
    (module: string, actions: string[]): boolean => {
      if (isAdmin) return true;
      return actions.every((action) => hasPermission(module, action));
    },
    [isAdmin, hasPermission],
  );

  /**
   * Vérifie si l'utilisateur peut accéder à un module (au moins read)
   */
  const canAccessModule = useCallback(
    (module: string): boolean => {
      if (isAdmin) return true;
      return hasPermission(module, 'read');
    },
    [isAdmin, hasPermission],
  );

  /**
   * Retourne la première page accessible à l'utilisateur
   * Ordre de priorité : dashboard > sales > stock > cash > clients > credits > suppliers > reports
   */
  const getFirstAccessiblePage = useCallback((): string => {
    if (isAdmin) return '/';

    const priorityOrder = [
      { module: 'dashboard', path: '/' },
      { module: 'sales', path: '/sales' },
      { module: 'stock', path: '/stock' },
      { module: 'cash', path: '/cash' },
      { module: 'clients', path: '/clients' },
      { module: 'credits', path: '/credits/clients' },
      { module: 'suppliers', path: '/suppliers' },
      { module: 'reports', path: '/reports' },
    ];

    for (const { module, path } of priorityOrder) {
      if (hasPermission(module, 'read')) {
        return path;
      }
    }

    // Fallback : si aucune permission, rediriger vers les paramètres (accès de base)
    return '/settings';
  }, [isAdmin, hasPermission]);

  /**
   * Récupère les modules accessibles par l'utilisateur
   */
  const getAccessibleModules = useCallback((): string[] => {
    if (isAdmin) {
      return ['dashboard', 'sales', 'stock', 'cash', 'clients', 'credits/clients', 'suppliers', 'reports', 'settings'];
    }

    if (!permissions) return [];

    const modules = permissions.map((p) => p.module);
    const accessibleModules: string[] = [];

    // Vérifier chaque module
    if (hasPermission('dashboard', 'read')) accessibleModules.push('dashboard');
    if (modules.includes('sales')) accessibleModules.push('sales');
    if (modules.includes('stock')) accessibleModules.push('stock');
    if (modules.includes('cash')) accessibleModules.push('cash');
    if (modules.includes('clients')) accessibleModules.push('clients');
    if (modules.includes('credits')) accessibleModules.push('credits/clients');
    if (modules.includes('suppliers')) accessibleModules.push('suppliers');
    if (modules.includes('reports')) accessibleModules.push('reports');
    if (modules.includes('settings')) accessibleModules.push('settings');

    return accessibleModules;
  }, [isAdmin, permissions, hasPermission]);

  // ========== Permissions spécifiques par module ==========

  /** VENTES */
  const canCreateSale = useCallback(() => hasPermission('sales', 'create'), [hasPermission]);
  const canUpdateSale = useCallback(() => hasPermission('sales', 'update'), [hasPermission]);
  const canDeleteSale = useCallback(() => hasPermission('sales', 'delete'), [hasPermission]);
  const canPrintSale = useCallback(() => hasPermission('sales', 'read'), [hasPermission]); // Imprimer = lire

  /** STOCK */
  const canCreateProduct = useCallback(() => hasPermission('stock', 'create'), [hasPermission]);
  const canUpdateProduct = useCallback(() => hasPermission('stock', 'update'), [hasPermission]);
  const canDeleteProduct = useCallback(() => hasPermission('stock', 'delete'), [hasPermission]);
  const canRestock = useCallback(() => hasPermission('stock', 'restock'), [hasPermission]);
  const canTransferStock = useCallback(() => hasPermission('stock', 'transfer'), [hasPermission]);
  const canRecordLoss = useCallback(() => hasPermission('stock', 'loss'), [hasPermission]);
  const canViewStockMovements = useCallback(() => hasPermission('stock', 'movements'), [hasPermission]);

  /** CAISSE */
  const canCreateCashOperation = useCallback(() => hasPermission('cash', 'create'), [hasPermission]);
  const canCloseCashRegister = useCallback(() => hasPermission('cash', 'close'), [hasPermission]);
  const canViewCashReports = useCallback(() => hasPermission('cash', 'reports'), [hasPermission]);

  /** CLIENTS */
  const canCreateClient = useCallback(() => hasPermission('clients', 'create'), [hasPermission]);
  const canUpdateClient = useCallback(() => hasPermission('clients', 'update'), [hasPermission]);
  const canDeleteClient = useCallback(() => hasPermission('clients', 'delete'), [hasPermission]);

  /** CRÉDITS CLIENTS */
  const canRecordCreditPayment = useCallback(() => hasPermission('credits', 'payment'), [hasPermission]);

  /** FOURNISSEURS */
  const canCreateSupplier = useCallback(() => hasPermission('suppliers', 'create'), [hasPermission]);
  const canCreatePurchase = useCallback(() => hasPermission('suppliers', 'purchase'), [hasPermission]);
  const canUpdateSupplier = useCallback(() => hasPermission('suppliers', 'update'), [hasPermission]);
  const canRecordSupplierPayment = useCallback(() => hasPermission('suppliers', 'payment'), [hasPermission]);
  const canDeleteSupplier = useCallback(() => hasPermission('suppliers', 'delete'), [hasPermission]);

  /** RAPPORTS */
  const canViewReports = useCallback(() => hasPermission('reports', 'read'), [hasPermission]);

  /** PARAMÈTRES */
  const canUpdateSettings = useCallback(() => hasPermission('settings', 'update'), [hasPermission]);

  /** GENERIC PERMISSIONS */
  const canCreate = useCallback((module: string) => hasPermission(module, 'create'), [hasPermission]);
  const canUpdate = useCallback((module: string) => hasPermission(module, 'update'), [hasPermission]);
  const canDelete = useCallback((module: string) => hasPermission(module, 'delete'), [hasPermission]);
  const canRead = useCallback((module: string) => hasPermission(module, 'read'), [hasPermission]);

  return useMemo(
    () => ({
      isAdmin,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessModule,
      canCreate,
      canUpdate,
      canDelete,
      canRead,
      getAccessibleModules,
      getFirstAccessiblePage,
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
      // Crédits clients
      canRecordCreditPayment,
      // Fournisseurs
      canCreateSupplier,
      canCreatePurchase,
      canUpdateSupplier,
      canRecordSupplierPayment,
      canDeleteSupplier,
      // Rapports
      canViewReports,
      // Paramètres
      canUpdateSettings,
    }),
    [
      isAdmin,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessModule,
      canCreate,
      canUpdate,
      canDelete,
      canRead,
      getAccessibleModules,
      getFirstAccessiblePage,
      canCreateSale,
      canUpdateSale,
      canDeleteSale,
      canPrintSale,
      canCreateProduct,
      canUpdateProduct,
      canDeleteProduct,
      canRestock,
      canTransferStock,
      canRecordLoss,
      canViewStockMovements,
      canCreateCashOperation,
      canCloseCashRegister,
      canViewCashReports,
      canCreateClient,
      canUpdateClient,
      canDeleteClient,
      canRecordCreditPayment,
      canCreateSupplier,
      canCreatePurchase,
      canUpdateSupplier,
      canRecordSupplierPayment,
      canDeleteSupplier,
      canViewReports,
      canUpdateSettings,
    ],
  );
}
