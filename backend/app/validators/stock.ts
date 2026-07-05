import vine from '@vinejs/vine'

export const restockValidator = vine.create({
  productId: vine.number().withoutDecimals().min(1),
  warehouseId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1),
  reason: vine.string().trim().maxLength(255).optional(),
})

export const transferValidator = vine.create({
  productId: vine.number().withoutDecimals().min(1),
  fromWarehouseId: vine.number().withoutDecimals().min(1),
  toWarehouseId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1),
  reason: vine.string().trim().maxLength(255).optional(),
})
