import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

/**
 * Buyer account (marketplace shopper). Global — NOT scoped to a company (a
 * buyer can purchase from any merchant). Separate from ERP `User`.
 * Uses the same access-token infrastructure as User.
 */
export default class StoreAccount extends compose(BaseModel, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(StoreAccount, {
    table: 'store_account_tokens',
    type: 'store_token',
    prefix: 'sat_',
  })
  declare currentAccessToken?: AccessToken

  @column({ isPrimary: true }) declare id: number
  @column() declare email: string
  @column({ serializeAs: null }) declare password: string
  @column() declare fullName: string | null
  @column() declare phone: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}
