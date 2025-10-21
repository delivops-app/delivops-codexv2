'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { extractTenantIdFromSearch, rememberTenantId } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('prompt', 'login')

    const searchString = searchParams.toString()
    const fromQuery =
      searchString.length > 0
        ? extractTenantIdFromSearch(`?${searchString}`)
        : undefined

    const returnTo = searchParams.get('returnTo') ?? '/'
    let tenantFromReturnTo: string | undefined
    if (returnTo) {
      try {
        const maybeUrl = new URL(
          returnTo,
          typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        )
        tenantFromReturnTo = extractTenantIdFromSearch(maybeUrl.search)
      } catch {
        tenantFromReturnTo = undefined
      }
    }

    const tenantCandidate = fromQuery ?? tenantFromReturnTo
    if (tenantCandidate) {
      rememberTenantId(tenantCandidate)
    }

    if (returnTo) {
      params.set('returnTo', returnTo)
    }

    const loginHint = searchParams.get('login_hint')
    if (loginHint) {
      params.set('login_hint', loginHint)
    }

    router.replace(`/api/auth/login?${params.toString()}`)
  }, [router, searchParams])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-semibold">Redirection en cours...</h1>
        <p className="text-sm text-slate-600">
          Veuillez patienter pendant que nous vous redirigeons vers notre page d&apos;authentification
          sécurisée.
        </p>
      </div>
    </main>
  )
}
