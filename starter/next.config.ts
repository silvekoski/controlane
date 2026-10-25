import type { NextConfig } from "next"

// For a Vercel demo, "npm run demo:prepare" copies the attachments, a control room snapshot and a database snapshot
// into this folder. The trace includes put them in the server bundle.
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./attachments/**", "./demo/**"] },
}

export default config
