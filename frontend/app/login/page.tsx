'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@auth0/nextjs-auth0/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [email, setEmail] = useState(() => {
    return searchParams.get('login_hint') ?? user?.email ?? ''
  })
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const returnTo = useMemo(() => {
    return searchParams.get('returnTo') ?? '/'
  }, [searchParams])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    const params = new URLSearchParams()
    params.set('prompt', 'login')
    params.set('returnTo', returnTo)
    if (email.trim()) {
      params.set('login_hint', email.trim())
    }

    router.push(`/api/auth/login?${params.toString()}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-semibold">Connexion</h1>
        <p className="mb-6 text-sm text-slate-600">
          {user ? (
            <>
              Vous êtes actuellement connecté en tant que{' '}
              <span className="font-medium">{user.name ?? user.email}</span>. Utilisez le
              formulaire ci-dessous pour changer de compte.
            </>
          ) : (
            <>Connectez-vous pour accéder à la plateforme.</>
          )}
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring"
              placeholder="nom@exemple.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring"
              placeholder="Votre mot de passe"
              autoComplete="current-password"
            />
            <p className="mt-1 text-xs text-slate-500">
              Vous serez redirigé vers la page sécurisée d&apos;authentification pour finaliser la connexion.
            </p>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Redirection en cours...' : 'Continuer'}
          </button>
        </form>
        <div className="mt-6 space-y-2 text-sm">
          <Link href={returnTo} className="text-blue-600 hover:underline">
            Retourner à l&apos;accueil
          </Link>
          {user && (
            <div>
              <Link
                href={`/api/auth/logout?returnTo=${encodeURIComponent('/login')}`}
                className="text-blue-600 hover:underline"
              >
                Se déconnecter de ce compte
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
