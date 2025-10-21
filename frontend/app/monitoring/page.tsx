'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { apiFetch, isApiFetchError } from '../../lib/api'
import { normalizeRoles } from '../../lib/roles'

interface ActivitySummary {
  total: number
  active: number
  inactive: number
  last_activity_at: string | null
}

interface ChauffeurSummary extends ActivitySummary {
  active_last_24h: number
}

interface MonitoringEvent {
  timestamp: string | null
  actor_role: string
  entity: string
  action: string
  has_authenticated_actor: boolean
}

interface MonitoringOverview {
  admins: ActivitySummary
  chauffeurs: ChauffeurSummary
  recent_events: MonitoringEvent[]
  gdpr_notice: string
}

type FetchState = 'idle' | 'loading' | 'error'

function formatDate(value: string | null): string {
  if (!value) return 'Aucune activité récente'
  try {
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    return formatter.format(new Date(value))
  } catch (error) {
    console.warn('Impossible de formater la date', error)
    return value
  }
}

function formatEventTimestamp(value: string | null): string {
  if (!value) return '—'
  try {
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    })
    return formatter.format(new Date(value))
  } catch (error) {
    console.warn('Impossible de formater la date', error)
    return value
  }
}

export default function MonitoringPage() {
  const { user, error: authError, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const isAdmin = roles.includes('ADMIN')

  const [overview, setOverview] = useState<MonitoringOverview | null>(null)
  const [state, setState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isAdmin) return

    const loadOverview = async () => {
      setState('loading')
      const response = await apiFetch('/monitoring/overview')
      if (response.ok) {
        const data = (await response.json()) as MonitoringOverview
        setOverview(data)
        setState('idle')
        setErrorMessage('')
        return
      }

      if (isApiFetchError(response)) {
        console.error('Erreur réseau', response.error)
        setErrorMessage('Impossible de récupérer les indicateurs. Merci de réessayer.')
      } else {
        setErrorMessage("Une erreur est survenue lors du chargement des indicateurs.")
      }
      setState('error')
    }

    void loadOverview()
  }, [isAdmin])

  const kpis = useMemo(() => {
    if (!overview) return []
    return [
      {
        title: 'Administrateurs actifs',
        value: `${overview.admins.active} / ${overview.admins.total}`,
        subtitle: `${overview.admins.inactive} inactif${
          overview.admins.inactive === 1 ? '' : 's'
        }`,
        lastActivity: formatDate(overview.admins.last_activity_at),
      },
      {
        title: 'Chauffeurs actifs',
        value: `${overview.chauffeurs.active} / ${overview.chauffeurs.total}`,
        subtitle: `${overview.chauffeurs.active_last_24h} actif${
          overview.chauffeurs.active_last_24h === 1 ? '' : 's'
        } (24h)`,
        lastActivity: formatDate(overview.chauffeurs.last_activity_at),
      },
    ]
  }, [overview])

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p>Chargement…</p>
      </main>
    )
  }

  if (authError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-red-600" role="alert">
          {authError.message}
        </p>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <h1 className="mb-4 text-3xl font-bold">Accès restreint</h1>
        <p className="mb-4 text-center">
          Cette page est réservée aux administrateurs en charge de la supervision globale.
        </p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour à l&apos;accueil
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-8">
      <div className="w-full max-w-6xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Supervision Delivops</h1>
          <p className="mt-2 text-lg text-gray-700">
            Visualisez l&apos;activité agrégée des administrateurs et des chauffeurs sans exposer de données sensibles.
          </p>
        </header>

        {state === 'loading' && (
          <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4 text-blue-900">
            Actualisation des indicateurs en cours…
          </div>
        )}

        {state === 'error' && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-2">
          {kpis.map((kpi) => (
            <article
              key={kpi.title}
              className="rounded border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold">{kpi.title}</h2>
              <p className="mt-2 text-3xl font-bold text-green-700">{kpi.value}</p>
              <p className="mt-1 text-sm text-gray-600">{kpi.subtitle}</p>
              <p className="mt-4 text-sm text-gray-500">
                Dernière activité&nbsp;: {kpi.lastActivity}
              </p>
            </article>
          ))}
        </section>

        {overview && (
          <section className="mb-8">
            <h2 className="mb-3 text-2xl font-semibold">Flux récents</h2>
            {overview.recent_events.length === 0 ? (
              <p className="text-gray-600">Aucune activité enregistrée pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 px-4 py-2">Horodatage</th>
                      <th className="border border-gray-200 px-4 py-2">Rôle</th>
                      <th className="border border-gray-200 px-4 py-2">Action</th>
                      <th className="border border-gray-200 px-4 py-2">Ressource</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent_events.map((event, index) => (
                      <tr key={`${event.timestamp}-${event.entity}-${index}`} className="odd:bg-white even:bg-gray-50">
                        <td className="border border-gray-200 px-4 py-2">
                          {formatEventTimestamp(event.timestamp)}
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          {event.actor_role}
                          {!event.has_authenticated_actor && (
                            <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs uppercase text-gray-700">
                              Anonyme
                            </span>
                          )}
                        </td>
                        <td className="border border-gray-200 px-4 py-2 uppercase">{event.action}</td>
                        <td className="border border-gray-200 px-4 py-2 font-mono text-sm">{event.entity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {overview && (
          <section className="mb-8 rounded border border-blue-200 bg-blue-50 p-4 text-blue-900">
            <h2 className="mb-2 text-xl font-semibold">Conformité RGPD</h2>
            <p>{overview.gdpr_notice}</p>
          </section>
        )}

        <div className="flex justify-end">
          <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  )
}
