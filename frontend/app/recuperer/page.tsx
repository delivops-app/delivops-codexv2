'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import Link from 'next/link'
import TourneeWizard from '../../components/TourneeWizard'
import { PageLayout } from '../../components/PageLayout'
import { normalizeRoles } from '../../lib/roles'

export default function RecupererPage() {
  const { user, error, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const isDriver = roles.includes('CHAUFFEUR')

  if (isLoading) {
    return (
      <PageLayout title="Chargement de l'assistant">
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Ouverture de l&apos;assistant de récupération…</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !isDriver) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Cette page est réservée aux chauffeurs Delivops autorisés."
        actions={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          {error?.message ?? 'Vous devez disposer d\'un accès chauffeur pour récupérer une tournée.'}
        </div>
      </PageLayout>
    )
  }

  return <TourneeWizard mode="pickup" />
}

