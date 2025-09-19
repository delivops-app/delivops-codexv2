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

const dns = require('dns').promises

const proxyTarget =
  normalizeProxyTarget(process.env.API_PROXY_TARGET) ??
  normalizeProxyTarget(process.env.API_BASE_INTERNAL) ??
  normalizeProxyTarget('http://localhost:8000')

function resolveFallbackTarget(target) {
  if (!target) {
    return undefined
  }

  try {
    const parsed = new URL(target)
    if (parsed.hostname !== 'api') {
      return undefined
    }

    const rawFallbackHost = process.env.API_PROXY_FALLBACK_HOST
    const normalizedFallbackHost = rawFallbackHost?.trim()
    const fallbackHost = normalizedFallbackHost && normalizedFallbackHost.length > 0 ? normalizedFallbackHost : 'localhost'
    const portSegment = parsed.port ? `:${parsed.port}` : ''

    return normalizeProxyTarget(`${parsed.protocol}//${fallbackHost}${portSegment}`)
  } catch (error) {
    console.warn('Unable to compute fallback proxy target for %s: %s', target, error)
    return undefined
  }
}

async function determineProxyTarget(target) {
  if (!target) {
    return undefined
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch (error) {
    console.warn('Invalid proxy target URL %s: %s', target, error)
    return target
  }

  if (parsed.hostname !== 'api') {
    return target
  }

  const fallbackTarget = resolveFallbackTarget(target)
  if (!fallbackTarget) {
    return target
  }

  try {
    await dns.lookup(parsed.hostname)
    return target
  } catch (error) {
    console.warn(
      'Proxy target host %s is not resolvable; falling back to %s. Original error: %s',
      parsed.hostname,
      fallbackTarget,
      error,
    )
    return fallbackTarget
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (!proxyTarget) {
      return []
    }

    const resolvedTarget = await determineProxyTarget(proxyTarget)
    if (!resolvedTarget) {
      return []
    }

    return [
      {
        source: '/api/proxy/:path*',
        destination: `${resolvedTarget}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
