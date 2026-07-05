import vine from '@vinejs/vine'

const price = () => vine.number().withoutDecimals().min(0)

export const createProductValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(200),
  code: vine.string().trim().maxLength(100).optional(),
  category: vine.string().trim().maxLength(100).optional(),
  description: vine.string().trim().maxLength(500).optional(),
  purchasePrice: price(),
  retailPrice: price(),
  wholesalePrice: price().optional(),
  wholesaleThreshold: vine.number().withoutDecimals().min(0).optional(),
  alertThreshold: vine.number().withoutDecimals().min(0).optional(),
  warehouseId: vine.number().withoutDecimals().min(1).optional(),
  unit: vine.string().trim().maxLength(30).optional(),
})

export const updateProductValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(200).optional(),
  code: vine.string().trim().maxLength(100).optional(),
  category: vine.string().trim().maxLength(100).optional(),
  description: vine.string().trim().maxLength(500).optional(),
  purchasePrice: price().optional(),
  retailPrice: price().optional(),
  wholesalePrice: price().optional(),
  wholesaleThreshold: vine.number().withoutDecimals().min(0).optional(),
  alertThreshold: vine.number().withoutDecimals().min(0).optional(),
  warehouseId: vine.number().withoutDecimals().min(1).optional(),
  unit: vine.string().trim().maxLength(30).optional(),
  isActive: vine.boolean().optional(),
})
