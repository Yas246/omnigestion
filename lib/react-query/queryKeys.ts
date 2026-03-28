/**
 * Clés de cache hiérarchiques pour React Query
 *
 * Structure:
 * - ['companies', companyId, 'products']
 * - ['companies', companyId, 'invoices', 'today']
 */

export const queryKeys = {
  // Racine
  root: ['root'] as const,

  // Compagnie
  companies: {
    all: ['companies'] as const,
    details: (id: string) => ['companies', id] as const,
    current: () => ['companies', 'current'] as const,

    // Entités sous une compagnie
    products: {
      all: (companyId: string) => ['companies', companyId, 'products'] as const,
      lists: (companyId: string) => ['companies', companyId, 'products', 'list'] as const,
      detail: (companyId: string, productId: string) =>
        ['companies', companyId, 'products', productId] as const,
    },

    invoices: {
      all: (companyId: string) => ['companies', companyId, 'invoices'] as const,
      lists: (companyId: string) => ['companies', companyId, 'invoices', 'list'] as const,
      detail: (companyId: string, invoiceId: string) =>
        ['companies', companyId, 'invoices', invoiceId] as const,
      today: (companyId: string) => ['companies', companyId, 'invoices', 'today'] as const,
    },

    clients: {
      all: (companyId: string) => ['companies', companyId, 'clients'] as const,
      lists: (companyId: string) => ['companies', companyId, 'clients', 'list'] as const,
      detail: (companyId: string, clientId: string) =>
        ['companies', companyId, 'clients', clientId] as const,
    },

    warehouses: {
      all: (companyId: string) => ['companies', companyId, 'warehouses'] as const,
    },

    // NOUVELLES entités
    cashRegisters: {
      all: (companyId: string) => ['companies', companyId, 'cashRegisters'] as const,
    },

    cashMovements: {
      all: (companyId: string) => ['companies', companyId, 'cashMovements'] as const,
    },

    clientCredits: {
      all: (companyId: string) => ['companies', companyId, 'clientCredits'] as const,
      detail: (companyId: string, creditId: string) =>
        ['companies', companyId, 'clientCredits', creditId] as const,
    },

    suppliers: {
      all: (companyId: string) => ['companies', companyId, 'suppliers'] as const,
      detail: (companyId: string, supplierId: string) =>
        ['companies', companyId, 'suppliers', supplierId] as const,
    },

    supplierCredits: {
      all: (companyId: string) => ['companies', companyId, 'supplierCredits'] as const,
      detail: (companyId: string, creditId: string) =>
        ['companies', companyId, 'supplierCredits', creditId] as const,
    },

    purchases: {
      all: (companyId: string) => ['companies', companyId, 'purchases'] as const,
    },

    settings: {
      current: (companyId: string) => ['companies', companyId, 'settings'] as const,
    },

    stockMovements: {
      all: (companyId: string) => ['companies', companyId, 'stockMovements'] as const,
    },
  },
} as const;
