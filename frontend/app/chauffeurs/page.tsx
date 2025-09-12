'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
import { apiFetch } from '../../lib/api'

interface Chauffeur {
  id: number
  email: string
  display_name: string
  is_active: boolean
}

export default function ChauffeursPage() {
  const { user } = useUser()
  const roles = (user?.['https://delivops/roles'] as string[]) || []
  const isAdmin = roles.includes('ADMIN')
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])

  useEffect(() => {
    if (!isAdmin) return
    const fetchChauffeurs = async () => {
      const res = await apiFetch('/chauffeurs/')
      if (res.ok) {
        const data = await res.json()
        setChauffeurs(data)
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
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Nom</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">Actif</th>
          </tr>
        </thead>
        <tbody>
          {chauffeurs.map((c) => (
            <tr key={c.id}>
              <td className="border px-4 py-2">{c.display_name}</td>
              <td className="border px-4 py-2">{c.email}</td>
              <td className="border px-4 py-2">
                {c.is_active ? 'Oui' : 'Non'}
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
