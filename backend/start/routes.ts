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

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    // Public auth routes
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
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

    // Company-scoped business routes (auth + tenancy)
    router
      .group(() => {
        // Dashboard (read-only aggregates)
        router.get('dashboard', [DashboardController, 'index'])

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

        // Warehouses
        router.get('warehouses', [WarehousesController, 'index'])
        router.post('warehouses', [WarehousesController, 'store'])
        router.get('warehouses/:id', [WarehousesController, 'show'])
        router.put('warehouses/:id', [WarehousesController, 'update'])
        router.delete('warehouses/:id', [WarehousesController, 'destroy'])

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
