function normalizeProxyTarget(input) {
  if (!input) {
    return undefined
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/\/+$/, '')
}

const proxyTarget =
  normalizeProxyTarget(process.env.API_PROXY_TARGET) ??
  normalizeProxyTarget(process.env.API_BASE_INTERNAL) ??
  normalizeProxyTarget('http://localhost:8000')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (!proxyTarget) {
      return []
    }

    return [
      {
        source: '/api/proxy/:path*',
        destination: `${proxyTarget}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
