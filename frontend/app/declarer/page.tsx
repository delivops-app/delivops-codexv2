'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
import { apiFetch, isApiFetchError } from '../../lib/api'
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

const DEV_DRIVER_SUB =
  process.env.NEXT_PUBLIC_DEV_DRIVER_SUB?.trim() || 'dev|driver'

const DEV_DRIVER_HEADERS: Record<string, string> = {
  'X-Dev-Role': 'CHAUFFEUR',
}

if (DEV_DRIVER_SUB) {
  DEV_DRIVER_HEADERS['X-Dev-Sub'] = DEV_DRIVER_SUB
}

export default function DeclarerPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isDriver = roles.includes('CHAUFFEUR')
  const [clients, setClients] = useState<Client[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isDriver) return
    const fetchClients = async () => {
      const res = await apiFetch('/clients/', { headers: DEV_DRIVER_HEADERS })
      if (res.ok) {
        const data = await res.json()
        setClients(data)
        setError('')
      } else if (isApiFetchError(res)) {
        console.error('Failed to load clients for declaration page', res.error)
        setError('Impossible de charger les clients. Vérifiez votre connexion et réessayez.')
      } else {
        setError('Erreur lors du chargement des clients.')
      }
    }
    fetchClients()
  }, [isDriver])

  const handleClick = async (client: Client, cat: Category) => {
    const qtyStr = prompt(`Nombre de colis pour ${client.name} - ${cat.name} ?`)
    if (!qtyStr) return
    const quantity = Number(qtyStr)
    if (isNaN(quantity) || quantity < 0) return

    const pickupRes = await apiFetch('/tours/pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...DEV_DRIVER_HEADERS },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        clientId: client.id,
        items: [{ tariffGroupId: cat.id, pickupQuantity: quantity }],
      }),
    })

    if (!pickupRes.ok) {
      if (isApiFetchError(pickupRes)) {
        console.error('Failed to submit pickup declaration', pickupRes.error)
        setError('Impossible de contacter le serveur. Veuillez réessayer plus tard.')
      } else {
        const errJson = await pickupRes.json().catch(() => null)
        setError(errJson?.detail ?? "Erreur lors de l'enregistrement")
      }
      setMessage('')
      return
    }

    const pickupData = await pickupRes.json()
    const deliveryRes = await apiFetch(`/tours/${pickupData.tourId}/delivery`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...DEV_DRIVER_HEADERS },
      body: JSON.stringify({
        items: [{ tariffGroupId: cat.id, deliveryQuantity: quantity }],
      }),
    })

    if (deliveryRes.ok) {
      setMessage('Déclaration enregistrée')
      setError('')
    } else if (isApiFetchError(deliveryRes)) {
      console.error('Failed to submit delivery declaration', deliveryRes.error)
      setError('Impossible de contacter le serveur. Veuillez réessayer plus tard.')
      setMessage('')
    } else {
      const errJson = await deliveryRes.json().catch(() => null)
      setError(errJson?.detail ?? "Erreur lors de l'enregistrement")
      setMessage('')
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
      {error && (
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>
      )}
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
