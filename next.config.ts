import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
const nextConfig: NextConfig = {
 distDir: process.env.LUUN_VERIFY_BUILD === "1" ? ".next-verification" : ".next",
 webpack(config) {
  // Local reuse of an already-installed dependency, without writing through the original node_modules symlink.
  const fallback=path.join(process.cwd(),".workspace-dependencies/lucide-react/dist/cjs/lucide-react.js");
  if(!fs.existsSync(path.join(process.cwd(),"node_modules/lucide-react"))&&fs.existsSync(fallback))config.resolve.alias["lucide-react"]=fallback;
  return config;
 }
};
export default nextConfig;
