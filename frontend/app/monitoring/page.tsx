'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { PageLayout } from '../../components/PageLayout'
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
  const hasSupervisionAccess = roles.includes('GLOBAL_SUPERVISION')

  const [overview, setOverview] = useState<MonitoringOverview | null>(null)
  const [state, setState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!hasSupervisionAccess) return

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
  }, [hasSupervisionAccess])

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
      <PageLayout title="Chargement en cours">
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Ouverture de la supervision globale…</p>
        </div>
      </PageLayout>
    )
  }

  if (authError) {
    return (
      <PageLayout
        title="Une erreur est survenue"
        description="Impossible de vérifier vos droits de supervision."
        actions={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      >
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {authError.message}
        </div>
      </PageLayout>
    )
  }

  if (!hasSupervisionAccess) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Cette page est réservée à l&apos;équipe Delivops en charge de la supervision globale."
        actions={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      >
        <p className="text-sm text-slate-600">
          Veuillez contacter l&apos;équipe Delivops si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Supervision Delivops"
      description="Visualisez l&apos;activité agrégée des administrateurs et des chauffeurs sans exposer de données sensibles."
      actions={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Retour au tableau de bord
        </Link>
      }
    >
      {state === 'loading' && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Actualisation des indicateurs en cours…
        </div>
      )}

      {state === 'error' && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {kpis.map((kpi) => (
          <article
            key={kpi.title}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {kpi.title}
            </h2>
            <p className="mt-3 text-3xl font-bold text-slate-900">{kpi.value}</p>
            <p className="mt-2 text-sm text-slate-600">{kpi.subtitle}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">
              Dernière activité : {kpi.lastActivity}
            </p>
          </article>
        ))}
      </section>

      {overview && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Flux récents</h2>
              <p className="text-sm text-slate-600">
                Dernières interactions enregistrées sur la plateforme.
              </p>
            </div>
          </div>
          <div className="p-5">
            {overview.recent_events.length === 0 ? (
              <p className="text-sm text-slate-600">Aucune activité enregistrée pour le moment.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700">Horodatage</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700">Rôle</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700">Action</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700">Ressource</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {overview.recent_events.map((event, index) => (
                        <tr key={`${event.timestamp}-${event.entity}-${index}`} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatEventTimestamp(event.timestamp)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {event.actor_role}
                            {!event.has_authenticated_actor && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-600">
                                Anonyme
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
                            {event.action}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-700">
                            {event.entity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {overview && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          <h2 className="text-base font-semibold">Conformité RGPD</h2>
          <p className="mt-1">{overview.gdpr_notice}</p>
        </section>
      )}
    </PageLayout>
  )
}
