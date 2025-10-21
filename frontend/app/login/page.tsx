'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('prompt', 'login')

    const returnTo = searchParams.get('returnTo') ?? '/'
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
          Veuillez patienter pendant que nous vous redirigeons vers notre page d'authentification
          sécurisée.
        </p>
      </div>
    </main>
  )
}
