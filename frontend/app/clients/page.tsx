'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

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
      setHistoryError(
        "Impossible de charger l'historique des donneurs d'ordre. Vérifiez votre connexion et réessayez.",
      )
    } else {
      setHistoryError(
        "Erreur lors du chargement de l'historique des donneurs d'ordre.",
      )
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
          setHistoryError(
            "Impossible de réactiver le donneur d'ordre. Vérifiez votre connexion et réessayez.",
          )
        } else {
          setHistoryError(
            "Erreur lors de la réactivation du donneur d'ordre.",
          )
        }
      } catch (reactivateError: unknown) {
        console.error('Unexpected error while reactivating client', reactivateError)
        setHistoryError(
          "Erreur inattendue lors de la réactivation du donneur d'ordre.",
        )
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

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="mb-4 text-3xl font-bold">Accès restreint</h1>
        <p className="mb-6 max-w-xl text-center">
          Cette page est réservée aux administrateurs Delivops.
        </p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour à l&apos;accueil
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-5xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Paramétrage &amp; récapitulatif des clients</h1>
          <p className="text-gray-700">
            Gérez vos donneurs d&apos;ordre et consultez leur activité récente.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/chauffeurs/synthese"
              className="rounded bg-purple-600 px-4 py-2 text-white"
            >
              Voir la synthèse des chauffeurs
            </Link>
            <Link
              href="/"
              className="rounded bg-gray-600 px-4 py-2 text-white"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Paramétrage des clients</h2>
          <ClientManager refreshToken={refreshToken} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Récapitulatif des clients</h2>
            <button
              type="button"
              onClick={fetchHistory}
              className="rounded bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50"
              disabled={isLoadingHistory}
            >
              Actualiser
            </button>
          </div>
          {historyError && (
            <p className="text-sm text-red-600" role="alert">
              {historyError}
            </p>
          )}
          {pendingHistoryMessage ? (
            <p className="text-sm text-gray-600">{pendingHistoryMessage}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Donneur d&apos;ordre
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Statut
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Dernière déclaration
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Déclarations
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => {
                    const isReactivating = reactivatingId === entry.id
                    return (
                      <tr key={entry.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2 text-sm text-gray-900">{entry.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {entry.isActive ? 'Actif' : 'Inactif'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {formatIsoDateToFr(entry.lastDeclarationDate) ||
                            entry.lastDeclarationDate}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {entry.declarationCount}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {entry.isActive ? (
                            <span className="text-sm text-gray-500">Actif</span>
                          ) : (
                            <button
                              type="button"
                              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
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
          )}
        </section>
      </div>
    </main>
  )
}
