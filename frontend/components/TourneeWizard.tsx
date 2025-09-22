'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch, isApiFetchError } from '../lib/api'

interface Category {
  id: number
  name: string
  unitPriceExVat?: string
}

interface Client {
  id: number
  name: string
  categories: Category[]
}

type Mode = 'pickup' | 'delivery'

interface PendingTourItem {
  tariffGroupId: number
  displayName: string
  pickupQuantity: number
  deliveryQuantity: number
}

interface PendingTour {
  tourId: number
  date: string
  client: { id: number; name: string }
  items: PendingTourItem[]
}

const DEV_DRIVER_SUB =
  process.env.NEXT_PUBLIC_DEV_DRIVER_SUB?.trim() || 'dev|driver'

const DEV_DRIVER_HEADERS: Record<string, string> = {
  'X-Dev-Role': 'CHAUFFEUR',
}

if (DEV_DRIVER_SUB) {
  DEV_DRIVER_HEADERS['X-Dev-Sub'] = DEV_DRIVER_SUB
}

function PickupWizard() {
  const [step, setStep] = useState(1)
  const [clients, setClients] = useState<Client[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [selectedCats, setSelectedCats] = useState<Category[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [tourDate, setTourDate] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchClients = async () => {
      const res = await apiFetch('/clients/', { headers: DEV_DRIVER_HEADERS })
      if (res.ok) {
        const data = await res.json()
        setClients(data)
        setError('')
      } else if (isApiFetchError(res)) {
        console.error('Failed to load clients for tour wizard', res.error)
        setError('Impossible de charger les clients. Vérifiez votre connexion et réessayez.')
      } else if (res.status === 401) {
        setError('Accès non autorisé')
      } else {
        setError('Erreur lors du chargement des clients.')
      }
    }
    fetchClients()
  }, [])

  const selectClient = (c: Client) => {
    setClient(c)
    setSelectedCats([])
    setQuantities({})
    setStep(2)
  }

  const toggleCategory = (cat: Category) => {
    setSelectedCats((prev) =>
      prev.some((c) => c.id === cat.id)
        ? prev.filter((c) => c.id !== cat.id)
        : [...prev, cat],
    )
  }

  const nextFromCategories = () => {
    if (selectedCats.length === 0) {
      setError('Sélectionnez au moins une catégorie')
      return
    }
    setError('')
    setStep(3)
  }

  const changeQty = (id: number, value: number) => {
    setQuantities((prev) => ({ ...prev, [id]: value }))
  }

  const nextFromQuantities = () => {
    for (const cat of selectedCats) {
      const val = quantities[cat.id]
      if (val === undefined || isNaN(val)) {
        setError('Veuillez remplir tous les champs')
        return
      }
      if (val < 0) {
        setError('Les quantités doivent être positives')
        return
      }
    }
    setError('')
    setStep(4)
  }

  const validate = async () => {
    if (!client) return
    if (!tourDate) {
      setError('Veuillez sélectionner une date pour la tournée')
      return
    }
    setSaving(true)
    const items = selectedCats.map((cat) => ({
      tariffGroupId: cat.id,
      pickupQuantity: quantities[cat.id],
    }))
    const res = await apiFetch('/tours/pickup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...DEV_DRIVER_HEADERS,
      },
      body: JSON.stringify({
        date: tourDate,
        clientId: client.id,
        items,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setStep(5)
      setError('')
    } else if (isApiFetchError(res)) {
      console.error('Failed to submit tour declaration', res.error)
      setError('Impossible de contacter le serveur. Veuillez réessayer plus tard.')
    } else {
      setError("Erreur lors de l'enregistrement")
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      {step < 5 && (
        <div className="mb-6 flex flex-col items-center">
          <label
            htmlFor="tour-date-pickup"
            className="mb-2 text-lg font-semibold text-gray-800"
          >
            Date de récupération
          </label>
          <input
            id="tour-date-pickup"
            type="date"
            value={tourDate}
            onChange={(e) => {
              setTourDate(e.target.value)
              if (error === 'Veuillez sélectionner une date pour la tournée') {
                setError('')
              }
            }}
            className="rounded border px-3 py-2"
          />
        </div>
      )}
      {step === 1 && (
        <>
          <h1 className="mb-6 text-3xl font-bold">Choisissez un client</h1>
          {error && <p className="mb-4 text-red-600">{error}</p>}
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => selectClient(c)}
              className="mb-2 rounded bg-blue-600 px-4 py-2 text-white"
            >
              {c.name}
            </button>
          ))}
        </>
      )}

      {step === 2 && client && (
        <>
          <h1 className="mb-4 text-2xl font-semibold">
            Sélectionnez des catégories
          </h1>
          {client.categories.map((cat) => (
            <label key={cat.id} className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCats.some((c) => c.id === cat.id)}
                onChange={() => toggleCategory(cat)}
              />
              {cat.name}
            </label>
          ))}
          {error && <p className="mb-2 text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="rounded bg-gray-600 px-4 py-2 text-white"
            >
              Retour
            </button>
            <button
              onClick={nextFromCategories}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Suivant
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mb-4 text-2xl font-semibold">
            Nombre de colis récupérés
          </h1>
          {selectedCats.map((cat) => (
            <div key={cat.id} className="mb-2 flex flex-col">
              <label className="mb-1">{cat.name}</label>
              <input
                type="number"
                min="0"
                value={quantities[cat.id] ?? ''}
                onChange={(e) => changeQty(cat.id, Number(e.target.value))}
                className="w-48 rounded border px-2 py-1"
              />
            </div>
          ))}
          {error && <p className="mb-2 text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="rounded bg-gray-600 px-4 py-2 text-white"
            >
              Retour
            </button>
            <button
              onClick={nextFromQuantities}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Suivant
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="mb-4 text-2xl font-semibold">Récapitulatif</h1>
          <p className="mb-4">
            <span className="font-semibold">Date :</span>{' '}
            {tourDate || 'Non définie'}
          </p>
          <ul className="mb-4">
            {selectedCats.map((cat) => (
              <li key={cat.id}>
                {cat.name}: {quantities[cat.id]}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(3)}
              className="rounded bg-gray-600 px-4 py-2 text-white"
            >
              Modifier
            </button>
            <button
              onClick={validate}
              disabled={saving}
              className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Valider'}
            </button>
          </div>
          {error && <p className="mt-2 text-red-600">{error}</p>}
        </>
      )}

      {step === 5 && (
        <>
          <p className="mb-4 text-center text-xl font-semibold">
            La récupération de votre tournée a été enregistrée avec succès.
          </p>
          <Link
            href="/"
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Retour à l&apos;accueil
          </Link>
        </>
      )}

      {step >= 1 && step < 5 && (
        <Link
          href="/"
          className="mt-6 rounded bg-blue-600 px-4 py-2 text-white"
        >
          Retour à l&apos;accueil
        </Link>
      )}
    </main>
  )
}

function DeliveryWizard() {
  const [step, setStep] = useState(1)
  const [pendingTours, setPendingTours] = useState<PendingTour[]>([])
  const [selectedTour, setSelectedTour] = useState<PendingTour | null>(null)
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<number, number>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTours = useMemo(
    () =>
      async function loadTours() {
        const res = await apiFetch('/tours/pending', {
          headers: DEV_DRIVER_HEADERS,
        })
        if (res.ok) {
          const data = await res.json()
          setPendingTours(data)
          setError('')
        } else if (isApiFetchError(res)) {
          console.error('Failed to load pending tours', res.error)
          setError('Impossible de charger les tournées en cours. Vérifiez votre connexion et réessayez.')
        } else if (res.status === 401) {
          setError('Accès non autorisé')
        } else {
          setError('Erreur lors du chargement des tournées en cours.')
        }
        setLoading(false)
      },
    [],
  )

  useEffect(() => {
    void fetchTours()
  }, [fetchTours])

  const resetSelection = () => {
    setSelectedTour(null)
    setDeliveryQuantities({})
    setStep(1)
  }

  const selectTour = (tour: PendingTour) => {
    setSelectedTour(tour)
    const initial: Record<number, number> = {}
    tour.items.forEach((item) => {
      initial[item.tariffGroupId] = item.deliveryQuantity || item.pickupQuantity
    })
    setDeliveryQuantities(initial)
    setError('')
    setStep(2)
  }

  const changeQty = (id: number, value: number) => {
    setDeliveryQuantities((prev) => ({ ...prev, [id]: value }))
  }

  const nextFromQuantities = () => {
    if (!selectedTour) return
    for (const item of selectedTour.items) {
      const value = deliveryQuantities[item.tariffGroupId]
      if (value === undefined || isNaN(value)) {
        setError('Veuillez remplir tous les champs')
        return
      }
      if (value < 0) {
        setError('Les quantités doivent être positives')
        return
      }
      if (value > item.pickupQuantity) {
        setError('Les colis livrés ne peuvent pas dépasser les colis récupérés')
        return
      }
    }
    setError('')
    setStep(3)
  }

  const submitDelivery = async () => {
    if (!selectedTour) return
    setSaving(true)
    const items = selectedTour.items.map((item) => ({
      tariffGroupId: item.tariffGroupId,
      deliveryQuantity: deliveryQuantities[item.tariffGroupId] ?? 0,
    }))
    const res = await apiFetch(`/tours/${selectedTour.tourId}/delivery`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...DEV_DRIVER_HEADERS,
      },
      body: JSON.stringify({ items }),
    })
    setSaving(false)
    if (res.ok) {
      setError('')
      setPendingTours((prev) =>
        prev.filter((tour) => tour.tourId !== selectedTour.tourId),
      )
      setStep(4)
    } else if (isApiFetchError(res)) {
      console.error('Failed to submit delivery quantities', res.error)
      setError('Impossible de contacter le serveur. Veuillez réessayer plus tard.')
    } else if (res.status === 400) {
      const json = await res.json()
      setError(json.detail ?? 'Quantités invalides')
    } else {
      setError("Erreur lors de l'enregistrement")
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      {step === 1 && (
        <>
          <h1 className="mb-6 text-3xl font-bold">Sélectionnez une tournée</h1>
          {loading && <p>Chargement...</p>}
          {!loading && pendingTours.length === 0 && (
            <p className="mb-4 text-center">
              Aucune tournée en attente de clôture pour le moment.
            </p>
          )}
          {error && <p className="mb-4 text-red-600">{error}</p>}
          <div className="flex flex-col items-stretch gap-2">
            {pendingTours.map((tour) => (
              <button
                key={tour.tourId}
                onClick={() => selectTour(tour)}
                className="rounded bg-blue-600 px-4 py-2 text-white"
              >
                {tour.client.name} – {tour.date}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && selectedTour && (
        <>
          <h1 className="mb-4 text-2xl font-semibold">
            Colis livrés pour {selectedTour.client.name}
          </h1>
          <p className="mb-2">Date de récupération : {selectedTour.date}</p>
          {selectedTour.items.map((item) => (
            <div key={item.tariffGroupId} className="mb-2 flex flex-col">
              <label className="mb-1">
                {item.displayName} (récupérés : {item.pickupQuantity})
              </label>
              <input
                type="number"
                min="0"
                max={item.pickupQuantity}
                value={deliveryQuantities[item.tariffGroupId] ?? ''}
                onChange={(e) => changeQty(item.tariffGroupId, Number(e.target.value))}
                className="w-48 rounded border px-2 py-1"
              />
            </div>
          ))}
          {error && <p className="mb-2 text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={resetSelection}
              className="rounded bg-gray-600 px-4 py-2 text-white"
            >
              Retour
            </button>
            <button
              onClick={nextFromQuantities}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Suivant
            </button>
          </div>
        </>
      )}

      {step === 3 && selectedTour && (
        <>
          <h1 className="mb-4 text-2xl font-semibold">Récapitulatif</h1>
          <p className="mb-2">Client : {selectedTour.client.name}</p>
          <p className="mb-4">Date de récupération : {selectedTour.date}</p>
          <ul className="mb-4">
            {selectedTour.items.map((item) => (
              <li key={item.tariffGroupId}>
                {item.displayName} : récupérés {item.pickupQuantity} – livrés{' '}
                {deliveryQuantities[item.tariffGroupId] ?? 0}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="rounded bg-gray-600 px-4 py-2 text-white"
            >
              Modifier
            </button>
            <button
              onClick={submitDelivery}
              disabled={saving}
              className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Valider'}
            </button>
          </div>
          {error && <p className="mt-2 text-red-600">{error}</p>}
        </>
      )}

      {step === 4 && (
        <>
          <p className="mb-4 text-center text-xl font-semibold">
            La clôture de votre tournée a été enregistrée avec succès.
          </p>
          {pendingTours.length > 0 ? (
            <button
              onClick={() => {
                setStep(1)
                setSelectedTour(null)
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Clôturer une autre tournée
            </button>
          ) : (
            <Link
              href="/"
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Retour à l&apos;accueil
            </Link>
          )}
        </>
      )}

      {step < 4 && (
        <Link
          href="/"
          className="mt-6 rounded bg-blue-600 px-4 py-2 text-white"
        >
          Retour à l&apos;accueil
        </Link>
      )}
    </main>
  )
}

export default function TourneeWizard({ mode }: { mode: Mode }) {
  if (mode === 'pickup') {
    return <PickupWizard />
  }
  return <DeliveryWizard />
}
