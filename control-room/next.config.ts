import type { NextConfig } from "next";

// The app reads the challenge packet from ../dataset at run time (see lib/data.ts).
// For a Vercel demo, "npm run demo:prepare" copies the packet into this folder,
// and the trace includes below put those files in the server bundle.
const config: NextConfig = {
  outputFileTracingIncludes: { "/**": ["./dataset/data/**", "./attachments/**", "./demo/**", "./eval/**"] },
};

export default config;
