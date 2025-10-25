'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { PageLayout } from '../../components/PageLayout'
import { apiFetch, isApiFetchError } from '../../lib/api'
import { normalizeRoles } from '../../lib/roles'
import { formatRelativeLastSeen } from '../../lib/relativeTime'

interface Chauffeur {
  id: number
  email: string
  display_name: string
  is_active: boolean
  last_seen_at: string | null
}

export default function ChauffeursPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const isAdmin = roles.includes('ADMIN')
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const fetchChauffeurs = useCallback(async () => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const res = await apiFetch('/chauffeurs/')
      if (res.ok) {
        const data = (await res.json()) as Chauffeur[]
        setChauffeurs(data)
        setError('')
        return
      }

      if (isApiFetchError(res)) {
        console.error('Failed to load chauffeurs', res.error)
        setError('Impossible de charger les chauffeurs. Vérifiez votre connexion et réessayez.')
      } else {
        setError('Erreur lors du chargement des chauffeurs.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    void fetchChauffeurs()
  }, [fetchChauffeurs, isAdmin])

  const activeCount = useMemo(
    () => chauffeurs.filter((chauffeur) => chauffeur.is_active).length,
    [chauffeurs],
  )

  const totalCount = chauffeurs.length
  const inactiveCount = Math.max(totalCount - activeCount, 0)

  const mostRecentActivity = useMemo(() => {
    let latest: string | null = null
    chauffeurs.forEach((chauffeur) => {
      if (!chauffeur.last_seen_at) return
      const current = new Date(chauffeur.last_seen_at)
      if (!latest || current > new Date(latest)) {
        latest = chauffeur.last_seen_at
      }
    })
    return latest
  }, [chauffeurs])

  const metrics = useMemo(
    () => [
      {
        title: 'Chauffeurs enregistrés',
        value: totalCount,
        description: 'Comptes présents dans votre espace',
      },
      {
        title: 'Chauffeurs actifs',
        value: activeCount,
        description: `${inactiveCount} inactif${inactiveCount > 1 ? 's' : ''}`,
      },
      {
        title: 'Dernière activité',
        value: mostRecentActivity
          ? formatRelativeLastSeen(mostRecentActivity)
          : 'Aucune activité récente',
        description: 'Mise à jour automatiquement à chaque connexion',
      },
    ],
    [activeCount, inactiveCount, mostRecentActivity, totalCount],
  )

  if (!isAdmin) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Cette page est réservée aux administrateurs Delivops autorisés."
        actions={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      />
    )
  }

  return (
    <PageLayout
      title="Gestion des chauffeurs"
      description="Consultez l&apos;activité de vos chauffeurs et invitez de nouveaux collaborateurs en quelques clics."
      actions={
        <>
          <Link
            href="/chauffeurs/invite"
            className="inline-flex items-center justify-center rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Inviter un chauffeur
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        </>
      }
    >
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.title}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {metric.title}
            </h2>
            <p className="mt-3 text-3xl font-bold text-slate-900">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-600">{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chauffeurs enregistrés</h2>
            <p className="text-sm text-slate-600">
              Retrouvez la liste complète des chauffeurs et leur dernière activité connue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchChauffeurs()}
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
        <div className="overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Nom</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Statut</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Dernière activité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {chauffeurs.map((chauffeur) => (
                  <tr key={chauffeur.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {chauffeur.display_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className="break-all">{chauffeur.email}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {chauffeur.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatRelativeLastSeen(chauffeur.last_seen_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && chauffeurs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-600">
              Aucun chauffeur n&apos;a encore été enregistré.
            </p>
          ) : null}
        </div>
      </section>
    </PageLayout>
  )
}
