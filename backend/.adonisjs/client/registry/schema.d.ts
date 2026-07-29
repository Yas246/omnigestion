/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_tokens.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'profile.access_tokens.destroy': {
    methods: ["POST"]
    pattern: '/api/v1/account/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['destroy']>>>
    }
  }
  'public_store.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_store.show_product': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug/product/:productId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { slug: ParamValue; productId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'store_auth.signup': {
    methods: ["POST"]
    pattern: '/api/v1/public/auth/signup'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'store_auth.login': {
    methods: ["POST"]
    pattern: '/api/v1/public/auth/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_commerce.checkout': {
    methods: ["POST"]
    pattern: '/api/v1/public/store/:slug/checkout'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_commerce.reviews': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug/product/:productId/reviews'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { slug: ParamValue; productId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_commerce.add_review': {
    methods: ["POST"]
    pattern: '/api/v1/public/store/:slug/product/:productId/reviews'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { slug: ParamValue; productId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.account': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug/account'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.orders': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug/account/orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.order_qr': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug/account/orders/:orderId/qr'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { slug: ParamValue; orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.addresses': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/store/:slug/account/addresses'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.create_address': {
    methods: ["POST"]
    pattern: '/api/v1/public/store/:slug/account/addresses'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.update_address': {
    methods: ["PUT"]
    pattern: '/api/v1/public/store/:slug/account/addresses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { slug: ParamValue; id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'public_delivery.delete_address': {
    methods: ["DELETE"]
    pattern: '/api/v1/public/store/:slug/account/addresses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { slug: ParamValue; id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'dashboard.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'dashboard.profits': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/reports/profits'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'settings.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/settings'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'settings.update': {
    methods: ["PUT"]
    pattern: '/api/v1/settings'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'companies.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'companies.store': {
    methods: ["POST"]
    pattern: '/api/v1/companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'companies.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/companies/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'companies.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/companies/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'clients.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/clients'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'clients.store': {
    methods: ["POST"]
    pattern: '/api/v1/clients'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'clients.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/clients/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'clients.update': {
    methods: ["PUT"]
    pattern: '/api/v1/clients/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'clients.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/clients/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'employees.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/employees'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'employees.store': {
    methods: ["POST"]
    pattern: '/api/v1/employees'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'employees.update': {
    methods: ["PUT"]
    pattern: '/api/v1/employees/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'employees.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/employees/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'storefronts.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/storefront'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'storefronts.update': {
    methods: ["PUT"]
    pattern: '/api/v1/storefront'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'storefronts.publish': {
    methods: ["POST"]
    pattern: '/api/v1/storefront/publish'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'storefronts.update_slug': {
    methods: ["PATCH"]
    pattern: '/api/v1/storefront/slug'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'storefronts.update_enabled': {
    methods: ["PATCH"]
    pattern: '/api/v1/storefront/enabled'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'warehouses.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/warehouses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'warehouses.store': {
    methods: ["POST"]
    pattern: '/api/v1/warehouses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'warehouses.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/warehouses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'warehouses.update': {
    methods: ["PUT"]
    pattern: '/api/v1/warehouses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'warehouses.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/warehouses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'ai_reports.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/ai-reports'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'ai_reports.store': {
    methods: ["POST"]
    pattern: '/api/v1/ai-reports'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'ai_reports.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/ai-reports/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'ai_reports.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/ai-reports/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'products.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'products.store': {
    methods: ["POST"]
    pattern: '/api/v1/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'products.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'products.update': {
    methods: ["PUT"]
    pattern: '/api/v1/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'products.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'products.stock': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/products/:id/stock'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'stock.restock': {
    methods: ["POST"]
    pattern: '/api/v1/stock/restock'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'stock.loss': {
    methods: ["POST"]
    pattern: '/api/v1/stock/loss'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'stock.transfer': {
    methods: ["POST"]
    pattern: '/api/v1/stock/transfer'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'stock.movements': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/stock/movements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'invoices.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'invoices.store': {
    methods: ["POST"]
    pattern: '/api/v1/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'invoices.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/invoices/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'invoices.update': {
    methods: ["PUT"]
    pattern: '/api/v1/invoices/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'invoices.cancel': {
    methods: ["POST"]
    pattern: '/api/v1/invoices/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'credits.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/client-credits'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'credits.store': {
    methods: ["POST"]
    pattern: '/api/v1/client-credits'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'credits.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/client-credits/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'credits.payments': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/client-credit-payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'credits.add_payment': {
    methods: ["POST"]
    pattern: '/api/v1/client-credits/:id/payments'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash.transfer': {
    methods: ["POST"]
    pattern: '/api/v1/cash-registers/transfer'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash_registers.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/cash-registers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash_registers.store': {
    methods: ["POST"]
    pattern: '/api/v1/cash-registers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash_registers.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/cash-registers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash_registers.update': {
    methods: ["PUT"]
    pattern: '/api/v1/cash-registers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash_registers.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/cash-registers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash.movements': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/cash-movements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'cash.store_movement': {
    methods: ["POST"]
    pattern: '/api/v1/cash-movements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'suppliers.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/suppliers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'suppliers.store': {
    methods: ["POST"]
    pattern: '/api/v1/suppliers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'suppliers.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/suppliers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'suppliers.update': {
    methods: ["PUT"]
    pattern: '/api/v1/suppliers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'suppliers.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/suppliers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'purchases.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/purchases'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'purchases.store': {
    methods: ["POST"]
    pattern: '/api/v1/purchases'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'purchases.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/purchases/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'supplier_credits.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/supplier-credits'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'supplier_credits.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/supplier-credits/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'supplier_credits.add_payment': {
    methods: ["POST"]
    pattern: '/api/v1/supplier-credits/:id/payments'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.pending_invoices': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/pending-invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.drivers': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/drivers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.live': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/live'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.performance': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/performance'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.mine': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/mine'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.settlements': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/settlements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.store': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/deliveries/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.assign': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/assign'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.pickup': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/pickup'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.start': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/start'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.update_position': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/position'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.complete': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/complete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.fail': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/fail'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.cancel': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.settlement_create': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/settlements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'deliveries.settlement_validate': {
    methods: ["POST"]
    pattern: '/api/v1/deliveries/settlements/:id/validate'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
