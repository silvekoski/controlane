import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { PGlite } from "@electric-sql/pglite"

// Freezes the local database into demo/db.tar.gz for a read-only demo (see lib/db.ts).
// It reads the compose database, so run "docker compose up -d" and "npm run db:seed" first.
const dump = execFileSync(
  "docker",
  ["compose", "exec", "-T", "db", "pg_dump", "-U", "controlroom", "-d", "controlroom", "--no-owner", "--no-privileges", "--inserts", "--rows-per-insert=500"],
  { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
)
// pg_dump writes psql commands such as \restrict. PGlite runs plain SQL only.
const sql = dump.split("\n").filter((line) => !line.startsWith("\\")).join("\n")

async function main() {
  const pg = new PGlite()
  await pg.exec(sql)
  const { rows } = await pg.query<{ n: number }>("select count(*)::int as n from public.orders")
  const file = await pg.dumpDataDir("gzip")
  mkdirSync("demo", { recursive: true })
  const out = join("demo", "db.tar.gz")
  writeFileSync(out, Buffer.from(await file.arrayBuffer()))
  await pg.close()
  console.log(`Wrote ${out} with ${rows[0].n} orders`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
