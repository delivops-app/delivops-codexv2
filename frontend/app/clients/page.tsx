'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { PageLayout } from '../../components/PageLayout'
import ClientManager from '../../components/ClientManager'
import { apiFetch, isApiFetchError } from '../../lib/api'
import { normalizeRoles } from '../../lib/roles'

type ClientHistoryEntry = {
  id: number
  name: string
  isActive: boolean
  lastDeclarationDate: string
  declarationCount: number
}

const formatIsoDateToFr = (value: string) => {
  if (!value) return ''
  const parts = value.split('-')
  if (parts.length !== 3) {
    return value
  }
  const [year, month, day] = parts
  if (!year || !month || !day) {
    return value
  }
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
}

export default function ClientsPage() {
  const { user, error, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const isAdmin = roles.includes('ADMIN')
  const [history, setHistory] = useState<ClientHistoryEntry[]>([])
  const [historyError, setHistoryError] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<number | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const res = await apiFetch('/clients/history')
    if (res.ok) {
      const json = (await res.json()) as ClientHistoryEntry[]
      setHistory(json)
      setHistoryError('')
    } else if (isApiFetchError(res)) {
      console.error('Failed to load client history', res.error)
      setHistoryError("Impossible de charger l'historique des donneurs d'ordre. Vérifiez votre connexion et réessayez.")
    } else {
      setHistoryError("Erreur lors du chargement de l'historique des donneurs d'ordre.")
    }
    setIsLoadingHistory(false)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetchHistory()
  }, [fetchHistory, isAdmin])

  const handleReactivate = useCallback(
    async (clientId: number) => {
      setReactivatingId(clientId)
      try {
        const res = await apiFetch(`/clients/${clientId}/reactivate`, {
          method: 'POST',
        })
        if (res.ok) {
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === clientId ? { ...entry, isActive: true } : entry,
            ),
          )
          setHistoryError('')
          setRefreshToken((prev) => prev + 1)
        } else if (isApiFetchError(res)) {
          console.error('Failed to reactivate client', res.error)
          setHistoryError("Impossible de réactiver le donneur d'ordre. Vérifiez votre connexion et réessayez.")
        } else {
          setHistoryError("Erreur lors de la réactivation du donneur d'ordre.")
        }
      } catch (reactivateError: unknown) {
        console.error('Unexpected error while reactivating client', reactivateError)
        setHistoryError("Erreur inattendue lors de la réactivation du donneur d'ordre.")
      }
      setReactivatingId(null)
    },
    [],
  )

  const pendingHistoryMessage = useMemo(() => {
    if (isLoadingHistory) {
      return "Chargement de l'historique…"
    }
    if (history.length === 0) {
      return 'Aucune déclaration enregistrée pour le moment.'
    }
    return ''
  }, [history.length, isLoadingHistory])

  if (isLoading) {
    return (
      <PageLayout title="Chargement en cours">
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Préparation du paramétrage clients…</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout
        title="Une erreur est survenue"
        description="Impossible de charger la gestion des clients."
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
          {error.message}
        </div>
      </PageLayout>
    )
  }

  if (!isAdmin) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Cette page est réservée aux administrateurs Delivops."
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
          Veuillez contacter un administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Paramétrage & récapitulatif des clients"
      description="Gérez vos donneurs d&apos;ordre, réactivez leurs accès et consultez leur activité récente."
      actions={
        <>
          <Link
            href="/chauffeurs/synthese"
            className="inline-flex items-center justify-center rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Voir la synthèse des chauffeurs
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
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Paramétrage des clients</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ajoutez ou mettez à jour vos donneurs d&apos;ordre et configurez leurs catégories de tournées.
        </p>
        <div className="mt-4">
          <ClientManager refreshToken={refreshToken} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Récapitulatif des clients</h2>
            <p className="text-sm text-slate-600">
              Consultez l&apos;historique des déclarations et réactivez un compte en un clic.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchHistory}
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoadingHistory}
          >
            {isLoadingHistory ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
        <div className="px-5 pb-5">
          {historyError && (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {historyError}
            </p>
          )}
          {pendingHistoryMessage ? (
            <p className="text-sm text-slate-600">{pendingHistoryMessage}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-700">Donneur d&apos;ordre</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-700">Statut</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-700">Dernière déclaration</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-700">Déclarations</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {history.map((entry) => {
                      const isReactivating = reactivatingId === entry.id
                      return (
                        <tr key={entry.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{entry.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {entry.isActive ? (
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
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatIsoDateToFr(entry.lastDeclarationDate) || entry.lastDeclarationDate}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{entry.declarationCount}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {entry.isActive ? (
                              <span className="text-sm text-slate-500">Actif</span>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleReactivate(entry.id)}
                                disabled={isReactivating}
                              >
                                {isReactivating ? 'Réactivation…' : 'Réactiver'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  )
}
