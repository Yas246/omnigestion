import vine from '@vinejs/vine'

export const createWarehouseValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(150),
  code: vine.string().trim().maxLength(50).optional(),
  address: vine.string().trim().maxLength(255).optional(),
  isMain: vine.boolean().optional(),
})

export const updateWarehouseValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(150).optional(),
  code: vine.string().trim().maxLength(50).optional(),
  address: vine.string().trim().maxLength(255).optional(),
  isMain: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
})
