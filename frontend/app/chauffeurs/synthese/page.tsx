'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '../../../lib/api'

interface SyntheseRow {
  date: string
  chauffeur: string
  client: string
  groups: Record<string, number>
  total: number
}

export default function SyntheseChauffeursPage() {
  const [rows, setRows] = useState<SyntheseRow[]>([])
  const [groups, setGroups] = useState<string[]>([])

  useEffect(() => {
    const fetchSynthese = async () => {
      const res = await apiFetch('/tournees/synthese')
      if (res.ok) {
        const json = await res.json()
        setRows(json.data)
        setGroups(json.groups)
      }
    }
    fetchSynthese()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="mb-6 text-3xl font-bold">Synthèse des chauffeurs</h1>
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Chauffeur</th>
            <th className="border px-4 py-2">Client</th>
            {groups.map((g) => (
              <th key={g} className="border px-4 py-2">
                {g}
              </th>
            ))}
            <th className="border px-4 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="border px-4 py-2">{row.date}</td>
              <td className="border px-4 py-2">{row.chauffeur}</td>
              <td className="border px-4 py-2">{row.client}</td>
              {groups.map((g) => (
                <td key={g} className="border px-4 py-2">
                  {row.groups[g] ?? 0}
                </td>
              ))}
              <td className="border px-4 py-2">{row.total}</td>
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

