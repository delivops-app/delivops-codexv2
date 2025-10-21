'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { normalizeRoles } from '../../lib/roles'

export default function AdminHomePage() {
  const { user, error, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const hasSupervisionAccess = roles.includes('GLOBAL_SUPERVISION')

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p>Chargement…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-red-600" role="alert">
          {error.message}
        </p>
      </main>
    )
  }

  if (!hasSupervisionAccess) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <h1 className="mb-4 text-3xl font-bold">Accès restreint</h1>
        <p className="mb-4 max-w-xl text-center">
          Cette section est réservée à l&apos;équipe Delivops en charge de la
          supervision globale.
        </p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour à l&apos;accueil
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Espace Delivops</h1>
          <p className="mt-2 text-lg text-gray-700">
            Retrouvez les outils dédiés à la supervision globale.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/monitoring"
            className="rounded border border-indigo-100 bg-indigo-50 p-4 text-center text-indigo-900 transition hover:border-indigo-200 hover:bg-indigo-100"
          >
            <h2 className="text-xl font-semibold">Supervision globale</h2>
            <p className="mt-2 text-sm">
              Vue d&apos;ensemble sur l&apos;activité des administrateurs et des chauffeurs.
            </p>
          </Link>
          <Link
            href="/admin/tenants-users"
            className="rounded border border-teal-100 bg-teal-50 p-4 text-center text-teal-900 transition hover:border-teal-200 hover:bg-teal-100"
          >
            <h2 className="text-xl font-semibold">Correspondance utilisateurs / tenants</h2>
            <p className="mt-2 text-sm">
              Consultez les administrateurs rattachés à chaque tenant.
            </p>
          </Link>
        </section>

        <div className="mt-10 text-center">
          <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  )
}

