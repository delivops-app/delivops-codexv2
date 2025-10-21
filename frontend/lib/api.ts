import { getAccessToken } from '@auth0/nextjs-auth0'

const API_BASE_EXTERNAL = process.env.NEXT_PUBLIC_API_BASE?.trim()
const API_BASE_INTERNAL = process.env.API_BASE_INTERNAL?.trim()

const TENANT_HEADER_NAME = 'X-Tenant-Id'

function normalizeTenantId(value?: string | null): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const ENV_TENANT_ID = normalizeTenantId(process.env.NEXT_PUBLIC_TENANT_ID)

const DEV_DEFAULT_TENANT_ID =
  process.env.NODE_ENV !== 'production' ? '1' : undefined

function deriveTenantIdFromHostname(
  hostname?: string | null,
): string | undefined {
  if (!hostname) {
    return undefined
  }

  const normalized = hostname.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    /^[0-9.]+$/.test(normalized)
  ) {
    return undefined
  }

  const parts = normalized.split('.')
  if (parts.length === 0) {
    return undefined
  }

  const [first] = parts
  if (!first || first === 'www') {
    return undefined
  }

  return first
}

export function resolveTenantId(): string | undefined {
  if (ENV_TENANT_ID) {
    return ENV_TENANT_ID
  }

  if (typeof window !== 'undefined') {
    const derived = deriveTenantIdFromHostname(window.location?.hostname)
    if (derived) {
      return derived
    }
  }

  return DEV_DEFAULT_TENANT_ID
}

const rawDevRole = process.env.NEXT_PUBLIC_DEV_ROLE
const normalizedDevRole = rawDevRole?.trim().toUpperCase()
const DEV_ROLE =
  normalizedDevRole && normalizedDevRole.length > 0
    ? normalizedDevRole
    : process.env.NODE_ENV !== 'production'
      ? 'ADMIN'
      : undefined

const rawDevSub = process.env.NEXT_PUBLIC_DEV_SUB
const DEV_SUB =
  rawDevSub && rawDevSub.trim().length > 0
    ? rawDevSub.trim()
    : process.env.NODE_ENV !== 'production'
      ? 'demo-user'
      : undefined

export interface ApiFetchError {
  ok: false
  status: number
  statusText: string
  headers: Headers
  error: Error
  json: () => Promise<never>
  text: () => Promise<never>
}

export type ApiFetchResponse = Response | ApiFetchError

export function isApiFetchError(
  response: ApiFetchResponse,
): response is ApiFetchError {
  return response.ok === false && 'error' in response
}

function resolveDefaultProtocol(): string {
  if (typeof window !== 'undefined' && window.location?.protocol) {
    return window.location.protocol
  }

  return 'http:'
}

function normalizeBaseUrl(base: string | undefined): string | undefined {
  if (!base) {
    return undefined
  }

  const trimmed = base.trim()
  if (!trimmed) {
    return undefined
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `${resolveDefaultProtocol()}${trimmed}`
  }

  if (!trimmed.includes('://') && /^[^/]+:[0-9]+/.test(trimmed)) {
    return `${resolveDefaultProtocol()}//${trimmed}`
  }

  return trimmed
}

function buildUrl(base: string | undefined, path: string): string {
  if (!base || base.length === 0) {
    return path
  }

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  if (!path || path.length === 0) {
    return normalizedBase
  }

  if (path.startsWith('/')) {
    return `${normalizedBase}${path}`
  }

  return `${normalizedBase}/${path}`
}

function resolveInternalBase(): string {
  const normalizedInternal = normalizeBaseUrl(API_BASE_INTERNAL)
  if (normalizedInternal && normalizedInternal.length > 0) {
    return normalizedInternal
  }

  const normalizedExternal = normalizeBaseUrl(API_BASE_EXTERNAL)
  if (normalizedExternal && normalizedExternal.length > 0) {
    return normalizedExternal
  }

  return 'http://localhost:8000'
}

function resolveExternalBase(): string | undefined {
  const normalizedExternal = normalizeBaseUrl(API_BASE_EXTERNAL)
  if (normalizedExternal && normalizedExternal.length > 0) {
    return normalizedExternal
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return undefined
}

function resolveFallbackBases(base: string | undefined): string[] {
  if (typeof window === 'undefined' || !base) {
    return []
  }

  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(base)
  if (!hasProtocol) {
    return []
  }

  try {
    const parsed = new URL(base)
    if (parsed.hostname === 'api') {
      const fallbackHost = window.location?.hostname || 'localhost'
      const port = parsed.port ? `:${parsed.port}` : ''
      return [`${parsed.protocol}//${fallbackHost}${port}`]
    }
  } catch {
    // Ignore invalid bases; no fallback available.
  }

  return []
}

function buildBaseCandidates(base: string | undefined): (string | undefined)[] {
  const fallbacks = resolveFallbackBases(base)
  const candidates: (string | undefined)[] = []
  const seen = new Set<string>()
  let hasUndefined = false

  const pushCandidate = (candidate: string | undefined) => {
    if (!candidate) {
      if (!hasUndefined) {
        hasUndefined = true
        candidates.push(undefined)
      }
      return
    }

    if (!seen.has(candidate)) {
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  pushCandidate(base)
  for (const fallback of fallbacks) {
    pushCandidate(fallback)
  }

  if (candidates.length === 0) {
    candidates.push(undefined)
  }

  return candidates
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<ApiFetchResponse> {
  const headers = {
    ...(init.headers || {}),
  } as Record<string, string>

  const base =
    typeof window === 'undefined' ? resolveInternalBase() : resolveExternalBase()

  const baseCandidates = buildBaseCandidates(base)

  const hasHeader = (name: string) => {
    const lowerName = name.toLowerCase()
    return Object.keys(headers).some((key) => key.toLowerCase() === lowerName)
  }

  const tenantId = resolveTenantId()
  if (tenantId && !hasHeader(TENANT_HEADER_NAME)) {
    headers[TENANT_HEADER_NAME] = tenantId
  }

  const ensureDevHeader = (name: string, value: string | undefined) => {
    if (!value) return
    if (!hasHeader(name)) {
      headers[name] = value
    }
  }

  const ensureDevAuthHeaders = () => {
    ensureDevHeader('X-Dev-Role', DEV_ROLE)
    ensureDevHeader('X-Dev-Sub', DEV_SUB)
  }

  const performRequest = async () => {
    let lastNetworkError: Error | null = null

    for (let index = 0; index < baseCandidates.length; index += 1) {
      const candidate = baseCandidates[index]
      try {
        const url = buildUrl(candidate, path)
        const response = await fetch(url, { ...init, headers })

        // Do not force navigation on 401; let callers handle unauthorized cases.
        return response
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error('Unknown network error while performing apiFetch')
        lastNetworkError = err

        const isLastAttempt = index === baseCandidates.length - 1
        if (!isLastAttempt) {
          const descriptor = candidate ?? '(relative path)'
          console.warn(
            `apiFetch network attempt failed for ${path} via ${descriptor}; retrying with fallback base.`,
            err,
          )
        }
      }
    }

    const finalError =
      lastNetworkError ?? new Error('Unknown network error while performing apiFetch')
    console.error(`apiFetch failed for ${path}`, finalError)

    const fallback: ApiFetchError = {
      ok: false,
      status: 0,
      statusText: 'Network request failed',
      headers: new Headers(),
      error: finalError,
      json: async () => {
        throw finalError
      },
      text: async () => {
        throw finalError
      },
    }

    return fallback
  }

  const hasAuthHeader = hasHeader('Authorization')

  if (DEV_ROLE && !hasAuthHeader) {
    ensureDevAuthHeaders()
    return performRequest()
  }

  try {
    let accessToken: string | undefined

    if (typeof window === 'undefined') {
      // Server-side: fetch token directly from the session
      const token = await getAccessToken()
      accessToken = token.accessToken
    } else {
      // Client-side: retrieve access token through dedicated API route
      const res = await fetch('/api/auth/token')
      if (res.ok) {
        const data = (await res.json()) as { accessToken?: string }
        accessToken = data.accessToken
      }
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    } else {
      // Development fallback: use headers recognized by DEV_FAKE_AUTH
      ensureDevAuthHeaders()
    }
  } catch (err) {
    // No token available; proceed without Authorization header
    ensureDevAuthHeaders()
  }

  return performRequest()
}
