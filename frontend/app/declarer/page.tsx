'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
import { apiFetch } from '../../lib/api'
import { normalizeRoles } from '../../lib/roles'

interface Category {
  id: number
  name: string
}

interface Client {
  id: number
  name: string
  categories: Category[]
}

export default function DeclarerPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isDriver = roles.includes('CHAUFFEUR')
  const [clients, setClients] = useState<Client[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isDriver) return
    const fetchClients = async () => {
      const res = await apiFetch('/clients/')
      if (res.ok) {
        const data = await res.json()
        setClients(data)
      }
    }
    fetchClients()
  }, [isDriver])

  const handleClick = async (client: Client, cat: Category) => {
    const qtyStr = prompt(`Nombre de colis pour ${client.name} - ${cat.name} ?`)
    if (!qtyStr) return
    const quantity = Number(qtyStr)
    if (isNaN(quantity)) return
    const res = await apiFetch('/tours/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        clientId: client.id,
        items: [{ tariffGroupId: cat.id, quantity }],
      }),
    })
    if (res.ok) {
      setMessage('Déclaration enregistrée')
    } else {
      setMessage("Erreur lors de l'enregistrement")
    }
  }

  if (!isDriver) {
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
      <h1 className="mb-6 text-3xl font-bold">Déclaration</h1>
      {message && <p className="mb-4">{message}</p>}
      {clients.map((c) => (
        <div key={c.id} className="mb-4 w-full max-w-md">
          <h2 className="mb-2 text-xl font-semibold">{c.name}</h2>
          <div className="flex flex-wrap gap-2">
            {c.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleClick(c, cat)}
                className="rounded bg-blue-600 px-3 py-1 text-white"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Link href="/" className="mt-4 rounded bg-gray-600 px-4 py-2 text-white">
        Retour
      </Link>
    </main>
  )
}

