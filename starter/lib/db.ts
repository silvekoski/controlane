import "server-only"

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// DEMO_READONLY=1 opens demo/db.tar.gz in memory, so a demo needs no Postgres server.
// "npm run demo:snapshot" writes that file from the local database.
export const readonly = process.env.DEMO_READONLY === "1"

function connect() {
  if (readonly) {
    const snapshot = readFileSync(join(process.cwd(), "demo", "db.tar.gz"))
    const client = new PGlite({ loadDataDir: new Blob([snapshot]) })
    // Both drivers run the same queries. The cast keeps one type for the callers.
    return drizzlePglite(client, { schema }) as unknown as ReturnType<typeof drizzle<typeof schema>>
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required. See starter/README.md.")
  return drizzle(postgres(url, { max: 5 }), { schema })
}

export const db = connect()
