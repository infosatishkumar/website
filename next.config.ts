import type { NextConfig } from "next";

// HOSTINGER_EXPORT=1 builds a static site for shared hosting (see hostinger/build.sh).
const staticExport = process.env.HOSTINGER_EXPORT === "1";

const nextConfig: NextConfig = staticExport
  ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
  : {};

export default nextConfig;
