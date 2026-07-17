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
  async store({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user, ['*'], { expiresIn: '30d' })
    const tokenValue = token.value!.release()

    // Set HttpOnly cookie so XSS can't steal the token. SameSite=Lax allows
    // top-level navigations (the browser sends the cookie on the initial HTML
    // load) while blocking CSRF from cross-origin POSTs. The frontend keeps
    // credentials:'include' on fetch so the cookie rides every API call.
    response.cookie('omnigestion_token', tokenValue, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days — matches expiresIn
      path: '/',
    })

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tenantId: user.tenantId,
        isOwner: user.isOwner,
      },
      token: tokenValue, // Still returned for backward compat (frontend transition)
    }
  }

  async destroy({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }
    response.clearCookie('omnigestion_token', { path: '/' })

    return { message: 'Logged out successfully' }
  }
}
