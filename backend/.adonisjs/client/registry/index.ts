/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.new_account.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [{"old":"/api/v1/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.new_account.store']['types'],
  },
  'auth.access_tokens.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.access_tokens.store']['types'],
  },
  'profile.profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.show']['types'],
  },
  'profile.access_tokens.destroy': {
    methods: ["POST"],
    pattern: '/api/v1/account/logout',
    tokens: [{"old":"/api/v1/account/logout","type":0,"val":"api","end":""},{"old":"/api/v1/account/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/account/logout","type":0,"val":"account","end":""},{"old":"/api/v1/account/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['profile.access_tokens.destroy']['types'],
  },
  'public_store.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/public/store/:slug',
    tokens: [{"old":"/api/v1/public/store/:slug","type":0,"val":"api","end":""},{"old":"/api/v1/public/store/:slug","type":0,"val":"v1","end":""},{"old":"/api/v1/public/store/:slug","type":0,"val":"public","end":""},{"old":"/api/v1/public/store/:slug","type":0,"val":"store","end":""},{"old":"/api/v1/public/store/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['public_store.show']['types'],
  },
  'public_store.show_product': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/public/store/:slug/product/:productId',
    tokens: [{"old":"/api/v1/public/store/:slug/product/:productId","type":0,"val":"api","end":""},{"old":"/api/v1/public/store/:slug/product/:productId","type":0,"val":"v1","end":""},{"old":"/api/v1/public/store/:slug/product/:productId","type":0,"val":"public","end":""},{"old":"/api/v1/public/store/:slug/product/:productId","type":0,"val":"store","end":""},{"old":"/api/v1/public/store/:slug/product/:productId","type":1,"val":"slug","end":""},{"old":"/api/v1/public/store/:slug/product/:productId","type":0,"val":"product","end":""},{"old":"/api/v1/public/store/:slug/product/:productId","type":1,"val":"productId","end":""}],
    types: placeholder as Registry['public_store.show_product']['types'],
  },
  'store_auth.signup': {
    methods: ["POST"],
    pattern: '/api/v1/public/auth/signup',
    tokens: [{"old":"/api/v1/public/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/public/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/public/auth/signup","type":0,"val":"public","end":""},{"old":"/api/v1/public/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/public/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['store_auth.signup']['types'],
  },
  'store_auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/public/auth/login',
    tokens: [{"old":"/api/v1/public/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/public/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/public/auth/login","type":0,"val":"public","end":""},{"old":"/api/v1/public/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/public/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['store_auth.login']['types'],
  },
  'public_commerce.checkout': {
    methods: ["POST"],
    pattern: '/api/v1/public/store/:slug/checkout',
    tokens: [{"old":"/api/v1/public/store/:slug/checkout","type":0,"val":"api","end":""},{"old":"/api/v1/public/store/:slug/checkout","type":0,"val":"v1","end":""},{"old":"/api/v1/public/store/:slug/checkout","type":0,"val":"public","end":""},{"old":"/api/v1/public/store/:slug/checkout","type":0,"val":"store","end":""},{"old":"/api/v1/public/store/:slug/checkout","type":1,"val":"slug","end":""},{"old":"/api/v1/public/store/:slug/checkout","type":0,"val":"checkout","end":""}],
    types: placeholder as Registry['public_commerce.checkout']['types'],
  },
  'public_commerce.reviews': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/public/store/:slug/product/:productId/reviews',
    tokens: [{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"api","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"v1","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"public","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"store","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":1,"val":"slug","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"product","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":1,"val":"productId","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"reviews","end":""}],
    types: placeholder as Registry['public_commerce.reviews']['types'],
  },
  'public_commerce.add_review': {
    methods: ["POST"],
    pattern: '/api/v1/public/store/:slug/product/:productId/reviews',
    tokens: [{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"api","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"v1","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"public","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"store","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":1,"val":"slug","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"product","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":1,"val":"productId","end":""},{"old":"/api/v1/public/store/:slug/product/:productId/reviews","type":0,"val":"reviews","end":""}],
    types: placeholder as Registry['public_commerce.add_review']['types'],
  },
  'dashboard.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/dashboard',
    tokens: [{"old":"/api/v1/dashboard","type":0,"val":"api","end":""},{"old":"/api/v1/dashboard","type":0,"val":"v1","end":""},{"old":"/api/v1/dashboard","type":0,"val":"dashboard","end":""}],
    types: placeholder as Registry['dashboard.index']['types'],
  },
  'dashboard.profits': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/reports/profits',
    tokens: [{"old":"/api/v1/reports/profits","type":0,"val":"api","end":""},{"old":"/api/v1/reports/profits","type":0,"val":"v1","end":""},{"old":"/api/v1/reports/profits","type":0,"val":"reports","end":""},{"old":"/api/v1/reports/profits","type":0,"val":"profits","end":""}],
    types: placeholder as Registry['dashboard.profits']['types'],
  },
  'settings.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/settings',
    tokens: [{"old":"/api/v1/settings","type":0,"val":"api","end":""},{"old":"/api/v1/settings","type":0,"val":"v1","end":""},{"old":"/api/v1/settings","type":0,"val":"settings","end":""}],
    types: placeholder as Registry['settings.index']['types'],
  },
  'settings.update': {
    methods: ["PUT"],
    pattern: '/api/v1/settings',
    tokens: [{"old":"/api/v1/settings","type":0,"val":"api","end":""},{"old":"/api/v1/settings","type":0,"val":"v1","end":""},{"old":"/api/v1/settings","type":0,"val":"settings","end":""}],
    types: placeholder as Registry['settings.update']['types'],
  },
  'companies.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/companies',
    tokens: [{"old":"/api/v1/companies","type":0,"val":"api","end":""},{"old":"/api/v1/companies","type":0,"val":"v1","end":""},{"old":"/api/v1/companies","type":0,"val":"companies","end":""}],
    types: placeholder as Registry['companies.index']['types'],
  },
  'companies.store': {
    methods: ["POST"],
    pattern: '/api/v1/companies',
    tokens: [{"old":"/api/v1/companies","type":0,"val":"api","end":""},{"old":"/api/v1/companies","type":0,"val":"v1","end":""},{"old":"/api/v1/companies","type":0,"val":"companies","end":""}],
    types: placeholder as Registry['companies.store']['types'],
  },
  'companies.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/companies/:id',
    tokens: [{"old":"/api/v1/companies/:id","type":0,"val":"api","end":""},{"old":"/api/v1/companies/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/companies/:id","type":0,"val":"companies","end":""},{"old":"/api/v1/companies/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['companies.show']['types'],
  },
  'companies.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/companies/:id',
    tokens: [{"old":"/api/v1/companies/:id","type":0,"val":"api","end":""},{"old":"/api/v1/companies/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/companies/:id","type":0,"val":"companies","end":""},{"old":"/api/v1/companies/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['companies.update']['types'],
  },
  'clients.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/clients',
    tokens: [{"old":"/api/v1/clients","type":0,"val":"api","end":""},{"old":"/api/v1/clients","type":0,"val":"v1","end":""},{"old":"/api/v1/clients","type":0,"val":"clients","end":""}],
    types: placeholder as Registry['clients.index']['types'],
  },
  'clients.store': {
    methods: ["POST"],
    pattern: '/api/v1/clients',
    tokens: [{"old":"/api/v1/clients","type":0,"val":"api","end":""},{"old":"/api/v1/clients","type":0,"val":"v1","end":""},{"old":"/api/v1/clients","type":0,"val":"clients","end":""}],
    types: placeholder as Registry['clients.store']['types'],
  },
  'clients.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/clients/:id',
    tokens: [{"old":"/api/v1/clients/:id","type":0,"val":"api","end":""},{"old":"/api/v1/clients/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/clients/:id","type":0,"val":"clients","end":""},{"old":"/api/v1/clients/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['clients.show']['types'],
  },
  'clients.update': {
    methods: ["PUT"],
    pattern: '/api/v1/clients/:id',
    tokens: [{"old":"/api/v1/clients/:id","type":0,"val":"api","end":""},{"old":"/api/v1/clients/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/clients/:id","type":0,"val":"clients","end":""},{"old":"/api/v1/clients/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['clients.update']['types'],
  },
  'clients.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/clients/:id',
    tokens: [{"old":"/api/v1/clients/:id","type":0,"val":"api","end":""},{"old":"/api/v1/clients/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/clients/:id","type":0,"val":"clients","end":""},{"old":"/api/v1/clients/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['clients.destroy']['types'],
  },
  'employees.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/employees',
    tokens: [{"old":"/api/v1/employees","type":0,"val":"api","end":""},{"old":"/api/v1/employees","type":0,"val":"v1","end":""},{"old":"/api/v1/employees","type":0,"val":"employees","end":""}],
    types: placeholder as Registry['employees.index']['types'],
  },
  'employees.store': {
    methods: ["POST"],
    pattern: '/api/v1/employees',
    tokens: [{"old":"/api/v1/employees","type":0,"val":"api","end":""},{"old":"/api/v1/employees","type":0,"val":"v1","end":""},{"old":"/api/v1/employees","type":0,"val":"employees","end":""}],
    types: placeholder as Registry['employees.store']['types'],
  },
  'employees.update': {
    methods: ["PUT"],
    pattern: '/api/v1/employees/:id',
    tokens: [{"old":"/api/v1/employees/:id","type":0,"val":"api","end":""},{"old":"/api/v1/employees/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/employees/:id","type":0,"val":"employees","end":""},{"old":"/api/v1/employees/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['employees.update']['types'],
  },
  'employees.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/employees/:id',
    tokens: [{"old":"/api/v1/employees/:id","type":0,"val":"api","end":""},{"old":"/api/v1/employees/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/employees/:id","type":0,"val":"employees","end":""},{"old":"/api/v1/employees/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['employees.destroy']['types'],
  },
  'storefronts.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/storefront',
    tokens: [{"old":"/api/v1/storefront","type":0,"val":"api","end":""},{"old":"/api/v1/storefront","type":0,"val":"v1","end":""},{"old":"/api/v1/storefront","type":0,"val":"storefront","end":""}],
    types: placeholder as Registry['storefronts.show']['types'],
  },
  'storefronts.update': {
    methods: ["PUT"],
    pattern: '/api/v1/storefront',
    tokens: [{"old":"/api/v1/storefront","type":0,"val":"api","end":""},{"old":"/api/v1/storefront","type":0,"val":"v1","end":""},{"old":"/api/v1/storefront","type":0,"val":"storefront","end":""}],
    types: placeholder as Registry['storefronts.update']['types'],
  },
  'storefronts.publish': {
    methods: ["POST"],
    pattern: '/api/v1/storefront/publish',
    tokens: [{"old":"/api/v1/storefront/publish","type":0,"val":"api","end":""},{"old":"/api/v1/storefront/publish","type":0,"val":"v1","end":""},{"old":"/api/v1/storefront/publish","type":0,"val":"storefront","end":""},{"old":"/api/v1/storefront/publish","type":0,"val":"publish","end":""}],
    types: placeholder as Registry['storefronts.publish']['types'],
  },
  'storefronts.update_slug': {
    methods: ["PATCH"],
    pattern: '/api/v1/storefront/slug',
    tokens: [{"old":"/api/v1/storefront/slug","type":0,"val":"api","end":""},{"old":"/api/v1/storefront/slug","type":0,"val":"v1","end":""},{"old":"/api/v1/storefront/slug","type":0,"val":"storefront","end":""},{"old":"/api/v1/storefront/slug","type":0,"val":"slug","end":""}],
    types: placeholder as Registry['storefronts.update_slug']['types'],
  },
  'storefronts.update_enabled': {
    methods: ["PATCH"],
    pattern: '/api/v1/storefront/enabled',
    tokens: [{"old":"/api/v1/storefront/enabled","type":0,"val":"api","end":""},{"old":"/api/v1/storefront/enabled","type":0,"val":"v1","end":""},{"old":"/api/v1/storefront/enabled","type":0,"val":"storefront","end":""},{"old":"/api/v1/storefront/enabled","type":0,"val":"enabled","end":""}],
    types: placeholder as Registry['storefronts.update_enabled']['types'],
  },
  'warehouses.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/warehouses',
    tokens: [{"old":"/api/v1/warehouses","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses","type":0,"val":"warehouses","end":""}],
    types: placeholder as Registry['warehouses.index']['types'],
  },
  'warehouses.store': {
    methods: ["POST"],
    pattern: '/api/v1/warehouses',
    tokens: [{"old":"/api/v1/warehouses","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses","type":0,"val":"warehouses","end":""}],
    types: placeholder as Registry['warehouses.store']['types'],
  },
  'warehouses.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/warehouses/:id',
    tokens: [{"old":"/api/v1/warehouses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['warehouses.show']['types'],
  },
  'warehouses.update': {
    methods: ["PUT"],
    pattern: '/api/v1/warehouses/:id',
    tokens: [{"old":"/api/v1/warehouses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['warehouses.update']['types'],
  },
  'warehouses.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/warehouses/:id',
    tokens: [{"old":"/api/v1/warehouses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['warehouses.destroy']['types'],
  },
  'ai_reports.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/ai-reports',
    tokens: [{"old":"/api/v1/ai-reports","type":0,"val":"api","end":""},{"old":"/api/v1/ai-reports","type":0,"val":"v1","end":""},{"old":"/api/v1/ai-reports","type":0,"val":"ai-reports","end":""}],
    types: placeholder as Registry['ai_reports.index']['types'],
  },
  'ai_reports.store': {
    methods: ["POST"],
    pattern: '/api/v1/ai-reports',
    tokens: [{"old":"/api/v1/ai-reports","type":0,"val":"api","end":""},{"old":"/api/v1/ai-reports","type":0,"val":"v1","end":""},{"old":"/api/v1/ai-reports","type":0,"val":"ai-reports","end":""}],
    types: placeholder as Registry['ai_reports.store']['types'],
  },
  'ai_reports.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/ai-reports/:id',
    tokens: [{"old":"/api/v1/ai-reports/:id","type":0,"val":"api","end":""},{"old":"/api/v1/ai-reports/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/ai-reports/:id","type":0,"val":"ai-reports","end":""},{"old":"/api/v1/ai-reports/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['ai_reports.show']['types'],
  },
  'ai_reports.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/ai-reports/:id',
    tokens: [{"old":"/api/v1/ai-reports/:id","type":0,"val":"api","end":""},{"old":"/api/v1/ai-reports/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/ai-reports/:id","type":0,"val":"ai-reports","end":""},{"old":"/api/v1/ai-reports/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['ai_reports.destroy']['types'],
  },
  'products.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/products',
    tokens: [{"old":"/api/v1/products","type":0,"val":"api","end":""},{"old":"/api/v1/products","type":0,"val":"v1","end":""},{"old":"/api/v1/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.index']['types'],
  },
  'products.store': {
    methods: ["POST"],
    pattern: '/api/v1/products',
    tokens: [{"old":"/api/v1/products","type":0,"val":"api","end":""},{"old":"/api/v1/products","type":0,"val":"v1","end":""},{"old":"/api/v1/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.store']['types'],
  },
  'products.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/products/:id',
    tokens: [{"old":"/api/v1/products/:id","type":0,"val":"api","end":""},{"old":"/api/v1/products/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/products/:id","type":0,"val":"products","end":""},{"old":"/api/v1/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.show']['types'],
  },
  'products.update': {
    methods: ["PUT"],
    pattern: '/api/v1/products/:id',
    tokens: [{"old":"/api/v1/products/:id","type":0,"val":"api","end":""},{"old":"/api/v1/products/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/products/:id","type":0,"val":"products","end":""},{"old":"/api/v1/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.update']['types'],
  },
  'products.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/products/:id',
    tokens: [{"old":"/api/v1/products/:id","type":0,"val":"api","end":""},{"old":"/api/v1/products/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/products/:id","type":0,"val":"products","end":""},{"old":"/api/v1/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.destroy']['types'],
  },
  'products.stock': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/products/:id/stock',
    tokens: [{"old":"/api/v1/products/:id/stock","type":0,"val":"api","end":""},{"old":"/api/v1/products/:id/stock","type":0,"val":"v1","end":""},{"old":"/api/v1/products/:id/stock","type":0,"val":"products","end":""},{"old":"/api/v1/products/:id/stock","type":1,"val":"id","end":""},{"old":"/api/v1/products/:id/stock","type":0,"val":"stock","end":""}],
    types: placeholder as Registry['products.stock']['types'],
  },
  'stock.restock': {
    methods: ["POST"],
    pattern: '/api/v1/stock/restock',
    tokens: [{"old":"/api/v1/stock/restock","type":0,"val":"api","end":""},{"old":"/api/v1/stock/restock","type":0,"val":"v1","end":""},{"old":"/api/v1/stock/restock","type":0,"val":"stock","end":""},{"old":"/api/v1/stock/restock","type":0,"val":"restock","end":""}],
    types: placeholder as Registry['stock.restock']['types'],
  },
  'stock.loss': {
    methods: ["POST"],
    pattern: '/api/v1/stock/loss',
    tokens: [{"old":"/api/v1/stock/loss","type":0,"val":"api","end":""},{"old":"/api/v1/stock/loss","type":0,"val":"v1","end":""},{"old":"/api/v1/stock/loss","type":0,"val":"stock","end":""},{"old":"/api/v1/stock/loss","type":0,"val":"loss","end":""}],
    types: placeholder as Registry['stock.loss']['types'],
  },
  'stock.transfer': {
    methods: ["POST"],
    pattern: '/api/v1/stock/transfer',
    tokens: [{"old":"/api/v1/stock/transfer","type":0,"val":"api","end":""},{"old":"/api/v1/stock/transfer","type":0,"val":"v1","end":""},{"old":"/api/v1/stock/transfer","type":0,"val":"stock","end":""},{"old":"/api/v1/stock/transfer","type":0,"val":"transfer","end":""}],
    types: placeholder as Registry['stock.transfer']['types'],
  },
  'stock.movements': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/stock/movements',
    tokens: [{"old":"/api/v1/stock/movements","type":0,"val":"api","end":""},{"old":"/api/v1/stock/movements","type":0,"val":"v1","end":""},{"old":"/api/v1/stock/movements","type":0,"val":"stock","end":""},{"old":"/api/v1/stock/movements","type":0,"val":"movements","end":""}],
    types: placeholder as Registry['stock.movements']['types'],
  },
  'invoices.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/invoices',
    tokens: [{"old":"/api/v1/invoices","type":0,"val":"api","end":""},{"old":"/api/v1/invoices","type":0,"val":"v1","end":""},{"old":"/api/v1/invoices","type":0,"val":"invoices","end":""}],
    types: placeholder as Registry['invoices.index']['types'],
  },
  'invoices.store': {
    methods: ["POST"],
    pattern: '/api/v1/invoices',
    tokens: [{"old":"/api/v1/invoices","type":0,"val":"api","end":""},{"old":"/api/v1/invoices","type":0,"val":"v1","end":""},{"old":"/api/v1/invoices","type":0,"val":"invoices","end":""}],
    types: placeholder as Registry['invoices.store']['types'],
  },
  'invoices.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/invoices/:id',
    tokens: [{"old":"/api/v1/invoices/:id","type":0,"val":"api","end":""},{"old":"/api/v1/invoices/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/invoices/:id","type":0,"val":"invoices","end":""},{"old":"/api/v1/invoices/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['invoices.show']['types'],
  },
  'invoices.update': {
    methods: ["PUT"],
    pattern: '/api/v1/invoices/:id',
    tokens: [{"old":"/api/v1/invoices/:id","type":0,"val":"api","end":""},{"old":"/api/v1/invoices/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/invoices/:id","type":0,"val":"invoices","end":""},{"old":"/api/v1/invoices/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['invoices.update']['types'],
  },
  'invoices.cancel': {
    methods: ["POST"],
    pattern: '/api/v1/invoices/:id/cancel',
    tokens: [{"old":"/api/v1/invoices/:id/cancel","type":0,"val":"api","end":""},{"old":"/api/v1/invoices/:id/cancel","type":0,"val":"v1","end":""},{"old":"/api/v1/invoices/:id/cancel","type":0,"val":"invoices","end":""},{"old":"/api/v1/invoices/:id/cancel","type":1,"val":"id","end":""},{"old":"/api/v1/invoices/:id/cancel","type":0,"val":"cancel","end":""}],
    types: placeholder as Registry['invoices.cancel']['types'],
  },
  'credits.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/client-credits',
    tokens: [{"old":"/api/v1/client-credits","type":0,"val":"api","end":""},{"old":"/api/v1/client-credits","type":0,"val":"v1","end":""},{"old":"/api/v1/client-credits","type":0,"val":"client-credits","end":""}],
    types: placeholder as Registry['credits.index']['types'],
  },
  'credits.store': {
    methods: ["POST"],
    pattern: '/api/v1/client-credits',
    tokens: [{"old":"/api/v1/client-credits","type":0,"val":"api","end":""},{"old":"/api/v1/client-credits","type":0,"val":"v1","end":""},{"old":"/api/v1/client-credits","type":0,"val":"client-credits","end":""}],
    types: placeholder as Registry['credits.store']['types'],
  },
  'credits.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/client-credits/:id',
    tokens: [{"old":"/api/v1/client-credits/:id","type":0,"val":"api","end":""},{"old":"/api/v1/client-credits/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/client-credits/:id","type":0,"val":"client-credits","end":""},{"old":"/api/v1/client-credits/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['credits.show']['types'],
  },
  'credits.payments': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/client-credit-payments',
    tokens: [{"old":"/api/v1/client-credit-payments","type":0,"val":"api","end":""},{"old":"/api/v1/client-credit-payments","type":0,"val":"v1","end":""},{"old":"/api/v1/client-credit-payments","type":0,"val":"client-credit-payments","end":""}],
    types: placeholder as Registry['credits.payments']['types'],
  },
  'credits.add_payment': {
    methods: ["POST"],
    pattern: '/api/v1/client-credits/:id/payments',
    tokens: [{"old":"/api/v1/client-credits/:id/payments","type":0,"val":"api","end":""},{"old":"/api/v1/client-credits/:id/payments","type":0,"val":"v1","end":""},{"old":"/api/v1/client-credits/:id/payments","type":0,"val":"client-credits","end":""},{"old":"/api/v1/client-credits/:id/payments","type":1,"val":"id","end":""},{"old":"/api/v1/client-credits/:id/payments","type":0,"val":"payments","end":""}],
    types: placeholder as Registry['credits.add_payment']['types'],
  },
  'cash.transfer': {
    methods: ["POST"],
    pattern: '/api/v1/cash-registers/transfer',
    tokens: [{"old":"/api/v1/cash-registers/transfer","type":0,"val":"api","end":""},{"old":"/api/v1/cash-registers/transfer","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-registers/transfer","type":0,"val":"cash-registers","end":""},{"old":"/api/v1/cash-registers/transfer","type":0,"val":"transfer","end":""}],
    types: placeholder as Registry['cash.transfer']['types'],
  },
  'cash_registers.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/cash-registers',
    tokens: [{"old":"/api/v1/cash-registers","type":0,"val":"api","end":""},{"old":"/api/v1/cash-registers","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-registers","type":0,"val":"cash-registers","end":""}],
    types: placeholder as Registry['cash_registers.index']['types'],
  },
  'cash_registers.store': {
    methods: ["POST"],
    pattern: '/api/v1/cash-registers',
    tokens: [{"old":"/api/v1/cash-registers","type":0,"val":"api","end":""},{"old":"/api/v1/cash-registers","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-registers","type":0,"val":"cash-registers","end":""}],
    types: placeholder as Registry['cash_registers.store']['types'],
  },
  'cash_registers.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/cash-registers/:id',
    tokens: [{"old":"/api/v1/cash-registers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/cash-registers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-registers/:id","type":0,"val":"cash-registers","end":""},{"old":"/api/v1/cash-registers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['cash_registers.show']['types'],
  },
  'cash_registers.update': {
    methods: ["PUT"],
    pattern: '/api/v1/cash-registers/:id',
    tokens: [{"old":"/api/v1/cash-registers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/cash-registers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-registers/:id","type":0,"val":"cash-registers","end":""},{"old":"/api/v1/cash-registers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['cash_registers.update']['types'],
  },
  'cash_registers.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/cash-registers/:id',
    tokens: [{"old":"/api/v1/cash-registers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/cash-registers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-registers/:id","type":0,"val":"cash-registers","end":""},{"old":"/api/v1/cash-registers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['cash_registers.destroy']['types'],
  },
  'cash.movements': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/cash-movements',
    tokens: [{"old":"/api/v1/cash-movements","type":0,"val":"api","end":""},{"old":"/api/v1/cash-movements","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-movements","type":0,"val":"cash-movements","end":""}],
    types: placeholder as Registry['cash.movements']['types'],
  },
  'cash.store_movement': {
    methods: ["POST"],
    pattern: '/api/v1/cash-movements',
    tokens: [{"old":"/api/v1/cash-movements","type":0,"val":"api","end":""},{"old":"/api/v1/cash-movements","type":0,"val":"v1","end":""},{"old":"/api/v1/cash-movements","type":0,"val":"cash-movements","end":""}],
    types: placeholder as Registry['cash.store_movement']['types'],
  },
  'suppliers.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/suppliers',
    tokens: [{"old":"/api/v1/suppliers","type":0,"val":"api","end":""},{"old":"/api/v1/suppliers","type":0,"val":"v1","end":""},{"old":"/api/v1/suppliers","type":0,"val":"suppliers","end":""}],
    types: placeholder as Registry['suppliers.index']['types'],
  },
  'suppliers.store': {
    methods: ["POST"],
    pattern: '/api/v1/suppliers',
    tokens: [{"old":"/api/v1/suppliers","type":0,"val":"api","end":""},{"old":"/api/v1/suppliers","type":0,"val":"v1","end":""},{"old":"/api/v1/suppliers","type":0,"val":"suppliers","end":""}],
    types: placeholder as Registry['suppliers.store']['types'],
  },
  'suppliers.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/suppliers/:id',
    tokens: [{"old":"/api/v1/suppliers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/suppliers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/suppliers/:id","type":0,"val":"suppliers","end":""},{"old":"/api/v1/suppliers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['suppliers.show']['types'],
  },
  'suppliers.update': {
    methods: ["PUT"],
    pattern: '/api/v1/suppliers/:id',
    tokens: [{"old":"/api/v1/suppliers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/suppliers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/suppliers/:id","type":0,"val":"suppliers","end":""},{"old":"/api/v1/suppliers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['suppliers.update']['types'],
  },
  'suppliers.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/suppliers/:id',
    tokens: [{"old":"/api/v1/suppliers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/suppliers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/suppliers/:id","type":0,"val":"suppliers","end":""},{"old":"/api/v1/suppliers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['suppliers.destroy']['types'],
  },
  'purchases.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/purchases',
    tokens: [{"old":"/api/v1/purchases","type":0,"val":"api","end":""},{"old":"/api/v1/purchases","type":0,"val":"v1","end":""},{"old":"/api/v1/purchases","type":0,"val":"purchases","end":""}],
    types: placeholder as Registry['purchases.index']['types'],
  },
  'purchases.store': {
    methods: ["POST"],
    pattern: '/api/v1/purchases',
    tokens: [{"old":"/api/v1/purchases","type":0,"val":"api","end":""},{"old":"/api/v1/purchases","type":0,"val":"v1","end":""},{"old":"/api/v1/purchases","type":0,"val":"purchases","end":""}],
    types: placeholder as Registry['purchases.store']['types'],
  },
  'purchases.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/purchases/:id',
    tokens: [{"old":"/api/v1/purchases/:id","type":0,"val":"api","end":""},{"old":"/api/v1/purchases/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/purchases/:id","type":0,"val":"purchases","end":""},{"old":"/api/v1/purchases/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['purchases.show']['types'],
  },
  'supplier_credits.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/supplier-credits',
    tokens: [{"old":"/api/v1/supplier-credits","type":0,"val":"api","end":""},{"old":"/api/v1/supplier-credits","type":0,"val":"v1","end":""},{"old":"/api/v1/supplier-credits","type":0,"val":"supplier-credits","end":""}],
    types: placeholder as Registry['supplier_credits.index']['types'],
  },
  'supplier_credits.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/supplier-credits/:id',
    tokens: [{"old":"/api/v1/supplier-credits/:id","type":0,"val":"api","end":""},{"old":"/api/v1/supplier-credits/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/supplier-credits/:id","type":0,"val":"supplier-credits","end":""},{"old":"/api/v1/supplier-credits/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['supplier_credits.show']['types'],
  },
  'supplier_credits.add_payment': {
    methods: ["POST"],
    pattern: '/api/v1/supplier-credits/:id/payments',
    tokens: [{"old":"/api/v1/supplier-credits/:id/payments","type":0,"val":"api","end":""},{"old":"/api/v1/supplier-credits/:id/payments","type":0,"val":"v1","end":""},{"old":"/api/v1/supplier-credits/:id/payments","type":0,"val":"supplier-credits","end":""},{"old":"/api/v1/supplier-credits/:id/payments","type":1,"val":"id","end":""},{"old":"/api/v1/supplier-credits/:id/payments","type":0,"val":"payments","end":""}],
    types: placeholder as Registry['supplier_credits.add_payment']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
