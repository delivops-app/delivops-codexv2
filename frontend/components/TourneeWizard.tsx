'use client'

import { useEffect, useState } from 'react'
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

const DEV_DRIVER_SUB =
  process.env.NEXT_PUBLIC_DEV_DRIVER_SUB?.trim() || 'dev|driver'

const DEV_DRIVER_HEADERS: Record<string, string> = {
  'X-Dev-Role': 'CHAUFFEUR',
}

if (DEV_DRIVER_SUB) {
  DEV_DRIVER_HEADERS['X-Dev-Sub'] = DEV_DRIVER_SUB
}

export default function TourneeWizard({ mode }: { mode: Mode }) {
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
      const res = await apiFetch('/clients/')
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

  const labelQty =
    mode === 'pickup'
      ? 'Nombre de colis récupérés'
      : 'Nombre de colis livrés'
  const successMsg =
    mode === 'pickup'
      ? 'La récupération de votre tournée a été enregistrée avec succès.'
      : 'La clôture de votre tournée a été enregistrée avec succès.'
  const dateLabel =
    mode === 'pickup' ? 'Date de récupération' : 'Date de clôture'
  const dateInputId = mode === 'pickup' ? 'tour-date-pickup' : 'tour-date-delivery'

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
      quantity: quantities[cat.id],
    }))
    const res = await apiFetch('/tours/', {
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
            htmlFor={dateInputId}
            className="mb-2 text-lg font-semibold text-gray-800"
          >
            {dateLabel}
          </label>
          <input
            id={dateInputId}
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
          <h1 className="mb-4 text-2xl font-semibold">{labelQty}</h1>
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
          <p className="mb-4 text-center text-xl font-semibold">{successMsg}</p>
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

