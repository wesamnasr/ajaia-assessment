/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
  webpack: (config, { dev }) => {
    // Prevent Windows NTFS junction realpath resolution from breaking vendor-chunks in next dev
    config.resolve.symlinks = false;
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
