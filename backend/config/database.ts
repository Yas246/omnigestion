import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   *
   * Tests run against a SEPARATE database (`omnigestion_test`) so the Japa
   * suite's TRUNCATE cleanup never wipes the developer's `omnigestion_dev`
   * data. Only the test runner (NODE_ENV=test) uses pg_test; dev/prod keep pg.
   */
  connection: process.env.NODE_ENV === 'test' ? 'pg_test' : 'pg',

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

    /**
     * Test database — same server/role as `pg`, different database. Used only
     * when NODE_ENV=test (bin/test.ts). Schema is applied via
     * `node ace migration:run --connection=pg_test`.
     */
    pg_test: {
      client: 'pg',

      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: 'omnigestion_test',
      },

      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },

      schemaGeneration: { enabled: false },
      debug: false,
    },
  },
})

export default dbConfig
