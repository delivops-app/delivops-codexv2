const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || '1'

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = {
    'X-Tenant-Id': TENANT_ID,
    ...(init.headers || {}),
  } as HeadersInit
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}
