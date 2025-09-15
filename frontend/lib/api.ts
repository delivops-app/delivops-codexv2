import { getAccessToken } from '@auth0/nextjs-auth0'

const API_BASE_EXTERNAL =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
const API_BASE_INTERNAL = process.env.API_BASE_INTERNAL || 'http://localhost:8000'
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || '1'
const DEV_ROLE = process.env.NEXT_PUBLIC_DEV_ROLE
const DEV_SUB = process.env.NEXT_PUBLIC_DEV_SUB

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

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<ApiFetchResponse> {
  const headers = {
    'X-Tenant-Id': TENANT_ID,
    ...(init.headers || {}),
  } as Record<string, string>

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
      if (DEV_ROLE) headers['X-Dev-Role'] = DEV_ROLE
      if (DEV_SUB) headers['X-Dev-Sub'] = DEV_SUB
    }
  } catch (err) {
    // No token available; proceed without Authorization header
    if (DEV_ROLE) headers['X-Dev-Role'] = DEV_ROLE
    if (DEV_SUB) headers['X-Dev-Sub'] = DEV_SUB
  }

  const base = typeof window === 'undefined' ? API_BASE_INTERNAL : API_BASE_EXTERNAL

  try {
    const response = await fetch(`${base}${path}`, { ...init, headers })

    // Do not force navigation on 401; let callers handle unauthorized cases.
    return response
  } catch (error) {
    const err =
      error instanceof Error
        ? error
        : new Error('Unknown network error while performing apiFetch')
    console.error(`apiFetch failed for ${path}`, err)

    const fallback: ApiFetchError = {
      ok: false,
      status: 0,
      statusText: 'Network request failed',
      headers: new Headers(),
      error: err,
      json: async () => {
        throw err
      },
      text: async () => {
        throw err
      },
    }

    return fallback
  }
}
