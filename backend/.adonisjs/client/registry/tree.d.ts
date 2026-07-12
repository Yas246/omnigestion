/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessTokens: {
      store: typeof routes['auth.access_tokens.store']
    }
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
    }
    accessTokens: {
      destroy: typeof routes['profile.access_tokens.destroy']
    }
  }
  publicStore: {
    show: typeof routes['public_store.show']
  }
  storeAuth: {
    signup: typeof routes['store_auth.signup']
    login: typeof routes['store_auth.login']
  }
  publicCommerce: {
    checkout: typeof routes['public_commerce.checkout']
    reviews: typeof routes['public_commerce.reviews']
    addReview: typeof routes['public_commerce.add_review']
  }
  dashboard: {
    index: typeof routes['dashboard.index']
  }
  settings: {
    index: typeof routes['settings.index']
    update: typeof routes['settings.update']
  }
  companies: {
    index: typeof routes['companies.index']
    store: typeof routes['companies.store']
    show: typeof routes['companies.show']
    update: typeof routes['companies.update']
  }
  clients: {
    index: typeof routes['clients.index']
    store: typeof routes['clients.store']
    show: typeof routes['clients.show']
    update: typeof routes['clients.update']
    destroy: typeof routes['clients.destroy']
  }
  employees: {
    index: typeof routes['employees.index']
    store: typeof routes['employees.store']
    update: typeof routes['employees.update']
    destroy: typeof routes['employees.destroy']
  }
  storefronts: {
    show: typeof routes['storefronts.show']
    update: typeof routes['storefronts.update']
    publish: typeof routes['storefronts.publish']
    updateSlug: typeof routes['storefronts.update_slug']
    updateEnabled: typeof routes['storefronts.update_enabled']
  }
  warehouses: {
    index: typeof routes['warehouses.index']
    store: typeof routes['warehouses.store']
    show: typeof routes['warehouses.show']
    update: typeof routes['warehouses.update']
    destroy: typeof routes['warehouses.destroy']
  }
  products: {
    index: typeof routes['products.index']
    store: typeof routes['products.store']
    show: typeof routes['products.show']
    update: typeof routes['products.update']
    destroy: typeof routes['products.destroy']
    stock: typeof routes['products.stock']
  }
  stock: {
    restock: typeof routes['stock.restock']
    loss: typeof routes['stock.loss']
    transfer: typeof routes['stock.transfer']
    movements: typeof routes['stock.movements']
  }
  invoices: {
    index: typeof routes['invoices.index']
    store: typeof routes['invoices.store']
    show: typeof routes['invoices.show']
    update: typeof routes['invoices.update']
    cancel: typeof routes['invoices.cancel']
  }
  credits: {
    index: typeof routes['credits.index']
    store: typeof routes['credits.store']
    show: typeof routes['credits.show']
    payments: typeof routes['credits.payments']
    addPayment: typeof routes['credits.add_payment']
  }
  cash: {
    transfer: typeof routes['cash.transfer']
    movements: typeof routes['cash.movements']
    storeMovement: typeof routes['cash.store_movement']
  }
  cashRegisters: {
    index: typeof routes['cash_registers.index']
    store: typeof routes['cash_registers.store']
    show: typeof routes['cash_registers.show']
    update: typeof routes['cash_registers.update']
    destroy: typeof routes['cash_registers.destroy']
  }
  suppliers: {
    index: typeof routes['suppliers.index']
    store: typeof routes['suppliers.store']
    show: typeof routes['suppliers.show']
    update: typeof routes['suppliers.update']
    destroy: typeof routes['suppliers.destroy']
  }
  purchases: {
    index: typeof routes['purchases.index']
    store: typeof routes['purchases.store']
    show: typeof routes['purchases.show']
  }
  supplierCredits: {
    index: typeof routes['supplier_credits.index']
    show: typeof routes['supplier_credits.show']
    addPayment: typeof routes['supplier_credits.add_payment']
  }
}
