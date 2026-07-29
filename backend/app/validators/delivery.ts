import vine from '@vinejs/vine'

/**
 * Delivery validators. Money (cod/amounts) is integer FCFA (withoutDecimals),
 * matching the BIGINT columns. Lat/lng are decimal degrees.
 */

/** Dispatcher creates a delivery from a storefront invoice (channel='store'). */
export const createDeliveryValidator = vine.create({
  invoiceId: vine.number().withoutDecimals().min(1),
  deliveryAddressId: vine.number().withoutDecimals().min(1).optional(),
  // Inline address snapshot (used when the buyer has no saved address).
  address: vine.string().trim().maxLength(500).optional(),
  latitude: vine.number().min(-90).max(90).optional(),
  longitude: vine.number().min(-180).max(180).optional(),
  city: vine.string().trim().maxLength(120).optional(),
  scheduledAt: vine.string().optional(),
})

/** Attribute a delivery to a driver — generates the QR token. */
export const assignDeliveryValidator = vine.create({
  driverUserId: vine.number().withoutDecimals().min(1),
})

/** Driver posts a live position (throttled to ~1 req/20s on the route). */
export const updatePositionValidator = vine.create({
  latitude: vine.number().min(-90).max(90),
  longitude: vine.number().min(-180).max(180),
})

/**
 * Driver confirms delivery. `scannedQrToken` must match the delivery's qr_token
 * (assigned at attribution). `codPaymentMethod` records how the COD was taken.
 */
export const completeDeliveryValidator = vine.create({
  scannedQrToken: vine.string().trim().maxLength(64).optional(),
  codPaymentMethod: vine.enum(['cash', 'mobile', 'bank']).optional(),
})

/** Mark a delivery as failed (with a reason). */
export const failDeliveryValidator = vine.create({
  reason: vine.string().trim().minLength(1).maxLength(300),
})

/** Driver (or admin) opens/submits a settlement for a period. */
export const createSettlementValidator = vine.create({
  driverUserId: vine.number().withoutDecimals().min(1).optional(),
  actualCash: vine.number().withoutDecimals().min(0).optional(),
  actualMobile: vine.number().withoutDecimals().min(0).optional(),
  notes: vine.string().trim().maxLength(500).optional(),
})

/** Admin validates (or corrects) a submitted settlement. */
export const validateSettlementValidator = vine.create({
  actualCash: vine.number().withoutDecimals().min(0).optional(),
  actualMobile: vine.number().withoutDecimals().min(0).optional(),
  notes: vine.string().trim().maxLength(500).optional(),
})

/** Buyer address book CRUD (global, scoped to the StoreAccount). */
export const addressValidator = vine.create({
  label: vine.string().trim().minLength(1).maxLength(60),
  recipientName: vine.string().trim().maxLength(150).optional(),
  address: vine.string().trim().minLength(3).maxLength(500),
  latitude: vine.number().min(-90).max(90).optional(),
  longitude: vine.number().min(-180).max(180).optional(),
  city: vine.string().trim().maxLength(120).optional(),
  isDefault: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).optional(),
})
