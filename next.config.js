/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Only optimize images from our own media storage — a "**" wildcard would
    // let anyone use this site's image optimizer as a free proxy.
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "media.2ndlifejm.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google profile photos
    ],
  },
};

module.exports = nextConfig;
