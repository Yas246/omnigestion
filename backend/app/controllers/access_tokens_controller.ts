import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Login (issue access token) + logout (revoke current token).
 *
 * NOTE: returns plain objects instead of Tuyau's `ctx.serialize()`. The kit's
 * `serialize()` needs a defined Tuyau response type to expose fields; without it
 * the token was dropped. Plain objects are predictable and work for the
 * decoupled REST API. (Revisit Tuyau response types later if we adopt Tuyau
 * end-to-end on the frontend.)
 */
export default class AccessTokensController {
  async store({ request }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user)

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tenantId: user.tenantId,
        isOwner: user.isOwner,
      },
      token: token.value!.release(),
    }
  }

  async destroy({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }

    return { message: 'Logged out successfully' }
  }
}
