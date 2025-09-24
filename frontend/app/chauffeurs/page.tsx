'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
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
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isAdmin = roles.includes('ADMIN')
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    const fetchChauffeurs = async () => {
      const res = await apiFetch('/chauffeurs/')
      if (res.ok) {
        const data = await res.json()
        setChauffeurs(data)
        setError('')
      } else if (isApiFetchError(res)) {
        console.error('Failed to load chauffeurs', res.error)
        setError('Impossible de charger les chauffeurs. Vérifiez votre connexion et réessayez.')
      } else {
        setError('Erreur lors du chargement des chauffeurs.')
      }
    }
    fetchChauffeurs()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <p className="mb-4">Accès refusé</p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="mb-6 text-3xl font-bold">Chauffeurs</h1>
      {error && (
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>
      )}
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Nom</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">Dernière activité</th>
            <th className="border px-4 py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {chauffeurs.map((c) => (
            <tr key={c.id}>
              <td className="border px-4 py-2">{c.display_name}</td>
              <td className="border px-4 py-2">{c.email}</td>
              <td className="border px-4 py-2">
                {formatRelativeLastSeen(c.last_seen_at)}
              </td>
              <td className="border px-4 py-2">
                {c.is_active ? 'Actif' : 'Inactif'}
              </td>
          </tr>
          ))}
        </tbody>
      </table>
      <Link href="/" className="mt-4 rounded bg-gray-600 px-4 py-2 text-white">
        Retour
      </Link>
    </main>
  )
}
