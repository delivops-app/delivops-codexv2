'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { apiFetch, isApiFetchError } from '../../../lib/api'
import { normalizeRoles } from '../../../lib/roles'

interface InProgressTour {
  tourId: number
  date: string
  driverName: string
  clientName: string
  totalPickup: number
  totalDelivery: number
}

interface TourActivitySummary {
  inProgressTours: InProgressTour[]
  closedToursCount: number
  returnCount: number
}

type FetchState = 'idle' | 'loading' | 'error'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }
  } catch (error) {
    console.warn('Impossible de formater la date', error)
  }
  return value
}

export default function ChauffeurActivityPage() {
  const { user, error: authError, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )

  const hasAdminPrivileges = roles.includes('GLOBAL_SUPERVISION') || roles.includes('ADMIN')

  const [summary, setSummary] = useState<TourActivitySummary | null>(null)
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!hasAdminPrivileges) {
      return
    }

    const loadSummary = async () => {
      setFetchState('loading')
      const response = await apiFetch('/tours/activity-summary')
      if (response.ok) {
        const data = (await response.json()) as TourActivitySummary
        setSummary(data)
        setFetchState('idle')
        setErrorMessage('')
        return
      }

      if (isApiFetchError(response)) {
        console.error('Erreur réseau', response.error)
        setErrorMessage('Impossible de récupérer la synthèse. Merci de réessayer.')
      } else {
        setErrorMessage('Une erreur est survenue lors du chargement de la synthèse.')
      }
      setFetchState('error')
    }

    void loadSummary()
  }, [hasAdminPrivileges])

  const metrics = useMemo(
    () => [
      {
        title: 'Tournées en cours',
        value: summary ? summary.inProgressTours.length : '—',
        description: 'Chauffeurs actuellement en livraison',
      },
      {
        title: 'Tournées clôturées',
        value: summary ? summary.closedToursCount : '—',
        description: 'Tournées complétées sur la période',
      },
      {
        title: 'Retours enregistrés',
        value: summary ? summary.returnCount : '—',
        description: 'Colis non livrés signalés',
      },
    ],
    [summary],
  )

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

  if (!hasAdminPrivileges) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <h1 className="mb-4 text-3xl font-bold">Accès restreint</h1>
        <p className="mb-4 max-w-xl text-center">
          Cette page est réservée aux administrateurs Delivops autorisés.
        </p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour à l&apos;accueil
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">Activité des chauffeurs</h1>
            <p className="mt-2 text-gray-700">
              Visualisez en un coup d&apos;œil les tournées en cours, les clôtures réalisées et les retours signalés.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded border border-indigo-200 px-4 py-2 text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            ← Retour à l&apos;espace admin
          </Link>
        </header>

        {fetchState === 'loading' && (
          <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4 text-blue-900">
            Récupération des indicateurs en cours…
          </div>
        )}

        {fetchState === 'error' && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <article
              key={metric.title}
              className="rounded border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-700">{metric.title}</h2>
              <p className="mt-3 text-3xl font-bold text-indigo-600">{metric.value}</p>
              <p className="mt-2 text-sm text-gray-500">{metric.description}</p>
            </article>
          ))}
        </section>

        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold">Tournées en cours de livraison</h2>
            <span className="text-sm text-gray-500">
              Dernière mise à jour : {formatDate(summary?.inProgressTours?.[0]?.date)}
            </span>
          </div>

          {summary && summary.inProgressTours.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summary.inProgressTours.map((tour) => {
                const remaining = Math.max(tour.totalPickup - tour.totalDelivery, 0)
                return (
                  <article
                    key={tour.tourId}
                    className="flex flex-col justify-between rounded border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm uppercase tracking-wide text-gray-500">Chauffeur</p>
                        <p className="text-xl font-semibold text-gray-900">{tour.driverName}</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        En livraison
                      </span>
                    </div>
                    <dl className="grid gap-2 text-sm text-gray-700">
                      <div className="flex items-center justify-between">
                        <dt className="font-medium text-gray-600">Client</dt>
                        <dd className="text-right text-gray-900">{tour.clientName || '—'}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="font-medium text-gray-600">Date</dt>
                        <dd className="text-right text-gray-900">{formatDate(tour.date)}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="font-medium text-gray-600">Colis récupérés</dt>
                        <dd className="text-right text-gray-900">{tour.totalPickup}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="font-medium text-gray-600">Colis livrés</dt>
                        <dd className="text-right text-gray-900">{tour.totalDelivery}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="font-medium text-gray-600">Retours potentiels</dt>
                        <dd className="text-right text-gray-900">{remaining}</dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="rounded border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-gray-600">
              Aucune tournée en cours de livraison pour le moment.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
