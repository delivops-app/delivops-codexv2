const API_BASE_EXTERNAL =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
const API_BASE_INTERNAL = process.env.API_BASE_INTERNAL || 'http://api:8000'
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || '1'

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = {
    'X-Tenant-Id': TENANT_ID,
    ...(init.headers || {}),
  } as HeadersInit
  const base = typeof window === 'undefined' ? API_BASE_INTERNAL : API_BASE_EXTERNAL
  return fetch(`${base}${path}`, { ...init, headers })
}
