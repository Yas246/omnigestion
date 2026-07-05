import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
    'dashboard.index': { paramsTuple?: []; params?: {} }
    'settings.index': { paramsTuple?: []; params?: {} }
    'settings.update': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.store': { paramsTuple?: []; params?: {} }
    'companies.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'companies.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.store': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.index': { paramsTuple?: []; params?: {} }
    'employees.store': { paramsTuple?: []; params?: {} }
    'employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.index': { paramsTuple?: []; params?: {} }
    'warehouses.store': { paramsTuple?: []; params?: {} }
    'warehouses.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.stock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock.restock': { paramsTuple?: []; params?: {} }
    'stock.loss': { paramsTuple?: []; params?: {} }
    'stock.transfer': { paramsTuple?: []; params?: {} }
    'stock.movements': { paramsTuple?: []; params?: {} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.store': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.index': { paramsTuple?: []; params?: {} }
    'credits.store': { paramsTuple?: []; params?: {} }
    'credits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.payments': { paramsTuple?: []; params?: {} }
    'credits.add_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash.transfer': { paramsTuple?: []; params?: {} }
    'cash_registers.index': { paramsTuple?: []; params?: {} }
    'cash_registers.store': { paramsTuple?: []; params?: {} }
    'cash_registers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash_registers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash_registers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash.movements': { paramsTuple?: []; params?: {} }
    'cash.store_movement': { paramsTuple?: []; params?: {} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'purchases.index': { paramsTuple?: []; params?: {} }
    'purchases.store': { paramsTuple?: []; params?: {} }
    'purchases.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'supplier_credits.index': { paramsTuple?: []; params?: {} }
    'supplier_credits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'supplier_credits.add_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'dashboard.index': { paramsTuple?: []; params?: {} }
    'settings.index': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.index': { paramsTuple?: []; params?: {} }
    'warehouses.index': { paramsTuple?: []; params?: {} }
    'warehouses.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.stock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock.movements': { paramsTuple?: []; params?: {} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.index': { paramsTuple?: []; params?: {} }
    'credits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.payments': { paramsTuple?: []; params?: {} }
    'cash_registers.index': { paramsTuple?: []; params?: {} }
    'cash_registers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash.movements': { paramsTuple?: []; params?: {} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'purchases.index': { paramsTuple?: []; params?: {} }
    'purchases.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'supplier_credits.index': { paramsTuple?: []; params?: {} }
    'supplier_credits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'dashboard.index': { paramsTuple?: []; params?: {} }
    'settings.index': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.index': { paramsTuple?: []; params?: {} }
    'warehouses.index': { paramsTuple?: []; params?: {} }
    'warehouses.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.stock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock.movements': { paramsTuple?: []; params?: {} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.index': { paramsTuple?: []; params?: {} }
    'credits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.payments': { paramsTuple?: []; params?: {} }
    'cash_registers.index': { paramsTuple?: []; params?: {} }
    'cash_registers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash.movements': { paramsTuple?: []; params?: {} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'purchases.index': { paramsTuple?: []; params?: {} }
    'purchases.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'supplier_credits.index': { paramsTuple?: []; params?: {} }
    'supplier_credits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
    'companies.store': { paramsTuple?: []; params?: {} }
    'clients.store': { paramsTuple?: []; params?: {} }
    'employees.store': { paramsTuple?: []; params?: {} }
    'warehouses.store': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'stock.restock': { paramsTuple?: []; params?: {} }
    'stock.loss': { paramsTuple?: []; params?: {} }
    'stock.transfer': { paramsTuple?: []; params?: {} }
    'invoices.store': { paramsTuple?: []; params?: {} }
    'invoices.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'credits.store': { paramsTuple?: []; params?: {} }
    'credits.add_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash.transfer': { paramsTuple?: []; params?: {} }
    'cash_registers.store': { paramsTuple?: []; params?: {} }
    'cash.store_movement': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'purchases.store': { paramsTuple?: []; params?: {} }
    'supplier_credits.add_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'settings.update': { paramsTuple?: []; params?: {} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash_registers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'companies.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'clients.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cash_registers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}