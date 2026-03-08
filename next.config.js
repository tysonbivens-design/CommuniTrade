/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['covers.openlibrary.org', 'hzwiiuhpdakntntxxihs.supabase.co'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
