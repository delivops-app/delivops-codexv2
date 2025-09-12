'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '../../../lib/api'

interface DeclarationRow {
  date: string
  driverName: string
  clientName: string
  tariffGroupDisplayName: string
  quantity: number
  estimatedAmountEur: string
}

export default function SyntheseChauffeursPage() {
  const [rows, setRows] = useState<DeclarationRow[]>([])

  useEffect(() => {
    const fetchDeclarations = async () => {
      const res = await apiFetch('/reports/declarations')
      if (res.ok) {
        const json = await res.json()
        setRows(json)
      }
    }
    fetchDeclarations()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="mb-6 text-3xl font-bold">Synthèse des chauffeurs</h1>
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Chauffeur</th>
            <th className="border px-4 py-2">Client donneur d&apos;ordre</th>
            <th className="border px-4 py-2">Catégorie de groupe tarifaire</th>
            <th className="border px-4 py-2">Nombre de colis livrés</th>
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
              <td className="border px-4 py-2">{row.quantity}</td>
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

