/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server bundle for a small Docker image.
  output: "standalone",
  basePath: '/dashboard',
};

export default nextConfig;
