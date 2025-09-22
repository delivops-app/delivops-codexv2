'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
import { apiFetch, isApiFetchError } from '../../../lib/api'
import { normalizeRoles } from '../../../lib/roles'

interface DeclarationRow {
  date: string
  driverName: string
  clientName: string
  tariffGroupDisplayName: string
  pickupQuantity: number
  deliveryQuantity: number
  differenceQuantity: number
  estimatedAmountEur: string
}

export default function SyntheseChauffeursPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isAdmin = roles.includes('ADMIN')
  const [rows, setRows] = useState<DeclarationRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    const fetchDeclarations = async () => {
      const res = await apiFetch('/reports/declarations')
      if (res.ok) {
        const json = await res.json()
        setRows(json)
        setError('')
      } else if (isApiFetchError(res)) {
        console.error('Failed to load declarations summary', res.error)
        setError('Impossible de charger la synthèse. Vérifiez votre connexion et réessayez.')
      } else {
        setError('Erreur lors du chargement de la synthèse.')
      }
    }
    fetchDeclarations()
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
      <h1 className="mb-6 text-3xl font-bold">Synthèse des chauffeurs</h1>
      {error && (
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>
      )}
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Chauffeur</th>
            <th className="border px-4 py-2">Client donneur d&apos;ordre</th>
            <th className="border px-4 py-2">Catégorie de groupe tarifaire</th>
            <th className="border px-4 py-2">Colis récupérés</th>
            <th className="border px-4 py-2">Colis livrés</th>
            <th className="border px-4 py-2">Écart</th>
            <th className="border px-4 py-2">Montant estimé (€)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="border px-4 py-2">{row.date}</td>
              <td className="border px-4 py-2">{row.driverName}</td>
              <td className="border px-4 py-2">{row.clientName}</td>
              <td className="border px-4 py-2">{row.tariffGroupDisplayName}</td>
              <td className="border px-4 py-2">{row.pickupQuantity}</td>
              <td className="border px-4 py-2">{row.deliveryQuantity}</td>
              <td className="border px-4 py-2">{row.differenceQuantity}</td>
              <td className="border px-4 py-2">
                {Number(row.estimatedAmountEur).toFixed(2)}
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
