/** @type {import('next').NextConfig} */
const BASE_PATH = '/dashboard';
const nextConfig = {
  // Produces a self-contained server bundle for a small Docker image.
  output: "standalone",
  basePath: BASE_PATH,
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
};

export default nextConfig;
