/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import ClientsController from '#controllers/clients_controller'
import ProductsController from '#controllers/products_controller'
import WarehousesController from '#controllers/warehouses_controller'
import StockController from '#controllers/stock_controller'
import EmployeesController from '#controllers/employees_controller'
import InvoicesController from '#controllers/invoices_controller'
import CreditsController from '#controllers/credits_controller'
import CashRegistersController from '#controllers/cash_registers_controller'
import CashController from '#controllers/cash_controller'
import SuppliersController from '#controllers/suppliers_controller'
import PurchasesController from '#controllers/purchases_controller'
import SupplierCreditsController from '#controllers/supplier_credits_controller'
import DashboardController from '#controllers/dashboard_controller'
import SettingsController from '#controllers/settings_controller'
import CompaniesController from '#controllers/companies_controller'
import StorefrontsController from '#controllers/storefronts_controller'
import PublicStoreController from '#controllers/public_store_controller'
import PublicCommerceController from '#controllers/public_commerce_controller'
import StoreAuthController from '#controllers/store_auth_controller'
import AiReportsController from '#controllers/ai_reports_controller'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    // Public auth routes
    router
      .group(() => {
        router
          .post('signup', [controllers.NewAccount, 'store'])
          .use(middleware.throttle({ rate: 3, period: 60 }))
        router
          .post('login', [controllers.AccessTokens, 'store'])
          .use(middleware.throttle({ rate: 5, period: 60 }))
      })
      .prefix('auth')
      .as('auth')

    // Authenticated account routes
    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

    // Public storefront (no auth — resolved by company slug)
    router.get('public/store/:slug', [PublicStoreController, 'show'])
        router.get('public/store/:slug/product/:productId', [PublicStoreController, 'showProduct'])
        router
          .post('public/auth/signup', [StoreAuthController, 'signup'])
          .use(middleware.throttle({ rate: 3, period: 60 }))
        router
          .post('public/auth/login', [StoreAuthController, 'login'])
          .use(middleware.throttle({ rate: 5, period: 60 }))
        router
          .post('public/store/:slug/checkout', [PublicCommerceController, 'checkout'])
          .use(middleware.throttle({ rate: 10, period: 60 }))
        router.get('public/store/:slug/product/:productId/reviews', [PublicCommerceController, 'reviews'])
        router.post('public/store/:slug/product/:productId/reviews', [PublicCommerceController, 'addReview'])

    // Company-scoped business routes (auth + tenancy)
    router
      .group(() => {
        // Dashboard (read-only aggregates)
        router.get('dashboard', [DashboardController, 'index'])
        router.get('reports/profits', [DashboardController, 'profits'])

        // Settings (per-company)
        router.get('settings', [SettingsController, 'index'])
        router.put('settings', [SettingsController, 'update'])

        // Companies (tenant-level: owner sees all; employee sees memberships)
        router.get('companies', [CompaniesController, 'index'])
        router.post('companies', [CompaniesController, 'store'])
        router.get('companies/:id', [CompaniesController, 'show'])
        router.patch('companies/:id', [CompaniesController, 'update'])

        // Clients (create + delete gated by permission)
        router.get('clients', [ClientsController, 'index'])
        router
          .post('clients', [ClientsController, 'store'])
          .use(middleware.permission({ module: 'clients', action: 'create' }))
        router.get('clients/:id', [ClientsController, 'show'])
        router.put('clients/:id', [ClientsController, 'update'])
        router
          .delete('clients/:id', [ClientsController, 'destroy'])
          .use(middleware.permission({ module: 'clients', action: 'delete' }))

        // Employees (owner invites employees into the current company)
        router.get('employees', [EmployeesController, 'index'])
        router.post('employees', [EmployeesController, 'store'])
        router.put('employees/:id', [EmployeesController, 'update'])
        router.delete('employees/:id', [EmployeesController, 'destroy'])

        // Storefront (site vitrine) — config draft/publish + slug/enabled
        router.get('storefront', [StorefrontsController, 'show'])
        router.put('storefront', [StorefrontsController, 'update'])
        router.post('storefront/publish', [StorefrontsController, 'publish'])
        router.patch('storefront/slug', [StorefrontsController, 'updateSlug'])
        router.patch('storefront/enabled', [StorefrontsController, 'updateEnabled'])

        // Warehouses
        router.get('warehouses', [WarehousesController, 'index'])
        router.post('warehouses', [WarehousesController, 'store'])
        router.get('warehouses/:id', [WarehousesController, 'show'])
        router.put('warehouses/:id', [WarehousesController, 'update'])
        router.delete('warehouses/:id', [WarehousesController, 'destroy'])

        // AI reports ( Analyse IA ) — list/read open to reports readers; save/delete gated
        router.get('ai-reports', [AiReportsController, 'index']).use(middleware.permission({ module: 'reports', action: 'read' }))
        router.post('ai-reports', [AiReportsController, 'store']).use(middleware.permission({ module: 'reports', action: 'create' }))
        router.get('ai-reports/:id', [AiReportsController, 'show']).use(middleware.permission({ module: 'reports', action: 'read' }))
        router.delete('ai-reports/:id', [AiReportsController, 'destroy']).use(middleware.permission({ module: 'reports', action: 'delete' }))

        // Products
        router.get('products', [ProductsController, 'index'])
        router.post('products', [ProductsController, 'store'])
        router.get('products/:id', [ProductsController, 'show'])
        router.put('products/:id', [ProductsController, 'update'])
        router.delete('products/:id', [ProductsController, 'destroy'])
        router.get('products/:id/stock', [ProductsController, 'stock'])

        // Stock operations
        router.post('stock/restock', [StockController, 'restock'])
        router.post('stock/loss', [StockController, 'loss'])
        router.post('stock/transfer', [StockController, 'transfer'])
        router.get('stock/movements', [StockController, 'movements'])

        // Invoices (Sales) — the transactional core
        router.get('invoices', [InvoicesController, 'index'])
        router
          .post('invoices', [InvoicesController, 'store'])
          .use(middleware.permission({ module: 'sales', action: 'create' }))
        router.get('invoices/:id', [InvoicesController, 'show'])
        router.put('invoices/:id', [InvoicesController, 'update'])
        router
          .post('invoices/:id/cancel', [InvoicesController, 'cancel'])
          .use(middleware.permission({ module: 'sales', action: 'delete' }))

        // Client credits + payments
        router.get('client-credits', [CreditsController, 'index'])
        router.post('client-credits', [CreditsController, 'store'])
        router.get('client-credits/:id', [CreditsController, 'show'])
        router.get('client-credit-payments', [CreditsController, 'payments'])
        router
          .post('client-credits/:id/payments', [CreditsController, 'addPayment'])
          .use(middleware.permission({ module: 'credits', action: 'create' }))

        // Cash registers
        router.post('cash-registers/transfer', [CashController, 'transfer']).use(middleware.permission({ module: 'cash', action: 'create' }))
        router.get('cash-registers', [CashRegistersController, 'index'])
        router.post('cash-registers', [CashRegistersController, 'store'])
        router.get('cash-registers/:id', [CashRegistersController, 'show'])
        router.put('cash-registers/:id', [CashRegistersController, 'update'])
        router.delete('cash-registers/:id', [CashRegistersController, 'destroy'])

        // Cash movements (manual in/out + listing)
        router.get('cash-movements', [CashController, 'movements'])
        router.post('cash-movements', [CashController, 'storeMovement']).use(middleware.permission({ module: 'cash', action: 'create' }))

        // Suppliers
        router.get('suppliers', [SuppliersController, 'index'])
        router.post('suppliers', [SuppliersController, 'store'])
        router.get('suppliers/:id', [SuppliersController, 'show'])
        router.put('suppliers/:id', [SuppliersController, 'update'])
        router.delete('suppliers/:id', [SuppliersController, 'destroy'])

        // Purchases (stock IN + supplier debt)
        router.get('purchases', [PurchasesController, 'index'])
        router
          .post('purchases', [PurchasesController, 'store'])
          .use(middleware.permission({ module: 'purchases', action: 'create' }))
        router.get('purchases/:id', [PurchasesController, 'show'])

        // Supplier credits + payments
        router.get('supplier-credits', [SupplierCreditsController, 'index'])
        router.get('supplier-credits/:id', [SupplierCreditsController, 'show'])
        router
          .post('supplier-credits/:id/payments', [SupplierCreditsController, 'addPayment'])
          .use(middleware.permission({ module: 'purchases', action: 'create' }))
      })
      .use([middleware.auth(), middleware.tenancy()])
  })
  .prefix('/api/v1')
