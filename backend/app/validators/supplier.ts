import vine from '@vinejs/vine'

export const createSupplierValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(150),
  code: vine.string().trim().maxLength(50).optional(),
  phone: vine.string().trim().maxLength(30).optional(),
  email: vine.string().trim().email().maxLength(254).optional(),
  address: vine.string().trim().maxLength(255).optional(),
})

export const updateSupplierValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(150).optional(),
  code: vine.string().trim().maxLength(50).optional(),
  phone: vine.string().trim().maxLength(30).optional(),
  email: vine.string().trim().email().maxLength(254).optional(),
  address: vine.string().trim().maxLength(255).optional(),
  isActive: vine.boolean().optional(),
})
