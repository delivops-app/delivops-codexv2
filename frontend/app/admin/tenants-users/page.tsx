'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { apiFetch, isApiFetchError } from '../../../lib/api'
import { normalizeRoles } from '../../../lib/roles'

interface UserTenantLink {
  userId: number
  email: string
  role: string
  isActive: boolean
  tenantId: number
  tenantName: string
  tenantSlug: string
}

type FetchState = 'idle' | 'loading' | 'error'

export default function UserTenantMappingsPage() {
  const { user, error: authError, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const hasSupervisionAccess = roles.includes('GLOBAL_SUPERVISION')

  const [rows, setRows] = useState<UserTenantLink[]>([])
  const [state, setState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!hasSupervisionAccess) return

    const loadMappings = async () => {
      setState('loading')
      const response = await apiFetch('/admin/user-tenants')
      if (response.ok) {
        const data = (await response.json()) as UserTenantLink[]
        setRows(data)
        setState('idle')
        setErrorMessage('')
        return
      }

      if (isApiFetchError(response)) {
        console.error('Erreur lors du chargement des correspondances', response.error)
        setErrorMessage(
          "Impossible de récupérer les correspondances utilisateurs/tenants. Merci de réessayer.",
        )
      } else {
        setErrorMessage(
          "Une erreur est survenue lors du chargement des correspondances utilisateurs/tenants.",
        )
      }
      setState('error')
    }

    void loadMappings()
  }, [hasSupervisionAccess])

  const grouped = useMemo(() => {
    const groups = new Map<
      number,
      { tenantName: string; tenantSlug: string; members: UserTenantLink[] }
    >()

    for (const row of rows) {
      const existing = groups.get(row.tenantId)
      if (existing) {
        existing.members.push(row)
      } else {
        groups.set(row.tenantId, {
          tenantName: row.tenantName,
          tenantSlug: row.tenantSlug,
          members: [row],
        })
      }
    }

    return Array.from(groups.entries())
      .map(([tenantId, info]) => ({
        tenantId,
        tenantName: info.tenantName,
        tenantSlug: info.tenantSlug,
        members: [...info.members].sort((a, b) => a.email.localeCompare(b.email)),
      }))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName))
  }, [rows])

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

  if (!hasSupervisionAccess) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <h1 className="mb-4 text-3xl font-bold">Accès restreint</h1>
        <p className="mb-4 max-w-xl text-center">
          Cette page est réservée à l&apos;équipe Delivops en charge de la supervision globale.
        </p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour à l&apos;accueil
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-8">
      <div className="w-full max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Correspondance utilisateurs / tenants</h1>
          <p className="mt-2 text-lg text-gray-700">
            Retrouvez en un coup d&apos;œil les administrateurs rattachés à chaque tenant.
          </p>
        </header>

        {state === 'loading' && (
          <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4 text-blue-900">
            Chargement des correspondances…
          </div>
        )}

        {state === 'error' && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
            {errorMessage}
          </div>
        )}

        {grouped.length === 0 && state === 'idle' ? (
          <p className="text-gray-600">
            Aucune correspondance disponible pour le moment.
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ tenantId, tenantName, tenantSlug, members }) => (
              <section
                key={tenantId}
                className="rounded border border-slate-200 bg-white p-4 shadow-sm"
              >
                <header className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{tenantName}</h2>
                    <p className="text-sm text-gray-600">
                      Slug&nbsp;: {tenantSlug} — ID&nbsp;: {tenantId}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600">
                    {members.length} utilisateur{members.length > 1 ? 's' : ''}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-700">
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Rôle</th>
                        <th className="px-4 py-2">Statut</th>
                        <th className="px-4 py-2">Identifiant utilisateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map((member) => (
                        <tr key={member.userId} className="text-sm text-gray-800">
                          <td className="px-4 py-2 font-medium">{member.email}</td>
                          <td className="px-4 py-2">{member.role}</td>
                          <td className="px-4 py-2">
                            {member.isActive ? (
                              <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                                Actif
                              </span>
                            ) : (
                              <span className="rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700">
                                Inactif
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600">{member.userId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  )
}
