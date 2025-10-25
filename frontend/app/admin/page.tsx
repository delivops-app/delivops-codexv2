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

  const navigationLinks = [
    {
      href: '/chauffeurs/synthese',
      label: 'Synthèse des tournées',
    },
    {
      href: '/chauffeurs/invite',
      label: 'Ajouter un chauffeur',
    },
    {
      href: '/chauffeurs',
      label: 'Liste des chauffeurs',
    },
    {
      href: '/aide/admin',
      label: 'FAQ des administrateurs',
    },
    {
      href: '/settings/billing',
      label: 'Paramétrage',
    },
    {
      href: '/clients',
      label: 'Liste des clients',
    },
    {
      href: '/monitoring',
      label: 'Supervision globale',
    },
    {
      href: '/admin/tenants-users',
      label: 'Correspondance utilisateurs / tenants',
    },
  ] as const

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="mb-8 text-center text-4xl font-bold">Espace Delivops</h1>
        <nav aria-label="Navigation administrateur" className="flex flex-col gap-4">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded bg-indigo-600 px-6 py-4 text-center text-lg font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}

