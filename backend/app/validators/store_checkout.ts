import vine from '@vinejs/vine'

/**
 * Public storefront endpoints validation. These routes are anonymous (buyer auth
 * only, no ERP auth/tenancy), so the input MUST be strictly bounded to prevent
 * arbitrary invoice creation / DoS (huge item arrays, absurd quantities).
 */

const checkoutItem = vine.object({
  productId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1).max(1000),
})

/** POST /public/store/:slug/checkout */
export const storeCheckoutValidator = vine.create({
  items: vine.array(checkoutItem).minLength(1).maxLength(50),
})

/** POST /public/store/:slug/product/:productId/reviews */
export const storeReviewValidator = vine.create({
  rating: vine.number().withoutDecimals().min(1).max(5),
  comment: vine.string().trim().maxLength(1000).optional(),
})
