import { getAccessToken } from '@auth0/nextjs-auth0'

const API_BASE_EXTERNAL =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
const API_BASE_INTERNAL = process.env.API_BASE_INTERNAL || 'http://api:8000'
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || '1'

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = {
    'X-Tenant-Id': TENANT_ID,
    ...(init.headers || {}),
  } as Record<string, string>

  try {
    const { accessToken } = await getAccessToken()
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
  } catch (err) {
    // No token available; proceed without Authorization header
  }

  const base = typeof window === 'undefined' ? API_BASE_INTERNAL : API_BASE_EXTERNAL
  const response = await fetch(`${base}${path}`, { ...init, headers })

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/login'
    } else {
      throw new Error('Unauthorized')
    }
  }

  return response
}
