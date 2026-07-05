import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   */
  connection: 'pg',

  connections: {
    /**
     * PostgreSQL connection (multi-tenant SaaS).
     * The app connects as a non-superuser role (`omnigestion_app`) so that
     * Row-Level Security policies are enforced (superusers bypass RLS).
     */
    pg: {
      client: 'pg',

      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },

      migrations: {
        /**
         * Sort migration files naturally by filename.
         */
        naturalSort: true,

        /**
         * Paths containing migration files.
         */
        paths: ['database/migrations'],
      },

      // Schema generation disabled: we use classic Lucid models (manual @column)
      // to support a shared multi-tenant base model with global scoping + hooks.
      schemaGeneration: {
        enabled: false,
      },

      debug: app.inDev,
    },
  },
})

export default dbConfig
