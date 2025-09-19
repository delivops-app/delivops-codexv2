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

const DEFAULT_PROXY_TARGET = 'http://localhost:8000'

const proxyTarget =
  normalizeProxyTarget(process.env.API_PROXY_TARGET) ??
  DEFAULT_PROXY_TARGET

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
