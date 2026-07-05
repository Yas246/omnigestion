import vine from '@vinejs/vine'

/**
 * Full action set used by the frontend permission matrix (UsersTab
 * AVAILABLE_PERMISSIONS + lib/hooks/usePermissions). MUST stay in sync with the
 * UI — a too-narrow enum here would silently reject legitimate permissions.
 */
const permissionAction = vine.enum([
  'read',
  'create',
  'update',
  'delete',
  'restock',
  'transfer',
  'loss',
  'movements',
  'payment',
  'purchase',
  'close',
  'reports',
])
const permission = vine.object({
  module: vine.string().trim().minLength(1).maxLength(50),
  actions: vine.array(permissionAction).minLength(1),
})

export const createEmployeeValidator = vine.create({
  fullName: vine.string().trim().minLength(1).maxLength(150),
  email: vine.string().trim().email().maxLength(254).unique({ table: 'users', column: 'email' }),
  password: vine.string().minLength(8).maxLength(32),
  position: vine.string().trim().maxLength(150).optional(),
  phone: vine.string().trim().maxLength(40).optional(),
  permissions: vine.array(permission).optional(),
})

/** Email is immutable on update (UI disables it); password optional. */
export const updateEmployeeValidator = vine.create({
  fullName: vine.string().trim().minLength(1).maxLength(150).optional(),
  password: vine.string().minLength(8).maxLength(32).optional(),
  position: vine.string().trim().maxLength(150).optional(),
  phone: vine.string().trim().maxLength(40).optional(),
  permissions: vine.array(permission).optional(),
})
