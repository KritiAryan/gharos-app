/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Admin panel — suppress build-time type errors from untyped Supabase responses
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "www.indianhealthyrecipes.com" },
      { protocol: "https", hostname: "hebbarskitchen.com" },
      { protocol: "https", hostname: "vegrecipesofindia.com" },
      { protocol: "https", hostname: "archanaskitchen.com" },
      { protocol: "https", hostname: "cookwithmanali.com" },
    ],
  },
};

export default nextConfig;
