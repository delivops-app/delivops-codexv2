'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch, isApiFetchError } from '../lib/api'
import { PageLayout } from './PageLayout'

interface Category {
  id: number
  name: string
  unitPriceExVat?: string
  marginExVat?: string
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

const formatDateForDisplay = (date: string | null | undefined) => {
  if (!date) {
    return ''
  }

  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  const parsed = new Date(date)
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed.toLocaleDateString('fr-FR')
  }

  return date
}

const cardClass = 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm'
const alertClass = 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
const infoCardClass = 'rounded-lg border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-900'
const successCardClass = 'rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900'
const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70'
const selectClass = inputClass
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
const mutedButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'

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
    void fetchClients()
  }, [])

  const selectClient = (selectedClient: Client) => {
    setClient(selectedClient)
    setSelectedCats([])
    setQuantities({})
    setError('')
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

  const changeQty = (id: number, value: string) => {
    setQuantities((prev) => {
      if (value === '') {
        const updated = { ...prev }
        delete updated[id]
        return updated
      }

      return { ...prev, [id]: Number(value) }
    })
  }

  const nextFromQuantities = () => {
    for (const cat of selectedCats) {
      const val = quantities[cat.id]
      if (val === undefined || Number.isNaN(val)) {
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

  const resetWizard = () => {
    setStep(1)
    setClient(null)
    setSelectedCats([])
    setQuantities({})
    setError('')
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

  let content: JSX.Element

  if (step === 1) {
    content = (
      <section className={cardClass}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Choisissez un donneur d&apos;ordre
              </h2>
              <p className="text-sm text-slate-600">
                Sélectionnez le client pour lequel vous allez récupérer des colis.
              </p>
            </div>
            <div className="w-full sm:w-60">
              <label
                htmlFor="tour-date-pickup"
                className="mb-1 block text-sm font-medium text-slate-700"
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
                className={inputClass}
              />
            </div>
          </div>
          {clients.length === 0 ? (
            <div className={infoCardClass}>
              Aucun donneur d&apos;ordre disponible pour le moment. Vérifiez auprès d&apos;un administrateur que des clients vous ont été attribués.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectClient(c)}
                  className="group flex h-full flex-col items-start rounded-md border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span className="text-base font-semibold text-slate-900">{c.name}</span>
                  <span className="mt-2 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
                    Choisir ce client
                    <span className="ml-1" aria-hidden>
                      →
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {error && <div className={alertClass}>{error}</div>}
        </div>
      </section>
    )
  } else if (step === 2 && client) {
    content = (
      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-slate-900">Catégories de colis</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sélectionnez toutes les catégories que vous allez récupérer pour {client.name}.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {client.categories.map((cat) => {
            const checked = selectedCats.some((c) => c.id === cat.id)
            return (
              <label
                key={cat.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-indigo-300 hover:bg-white"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCategory(cat)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">{cat.name}</span>
              </label>
            )
          })}
        </div>
        {error && <div className={`${alertClass} mt-4`}>{error}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStep(1)
              setError('')
            }}
            className={secondaryButtonClass}
          >
            Retour
          </button>
          <button
            type="button"
            onClick={nextFromCategories}
            className={primaryButtonClass}
          >
            Continuer
          </button>
        </div>
      </section>
    )
  } else if (step === 3) {
    content = (
      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-slate-900">Quantités à récupérer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Indiquez le nombre de colis récupérés pour chaque catégorie.
        </p>
        <div className="mt-4 space-y-4">
          {selectedCats.map((cat) => (
            <div
              key={cat.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">{cat.name}</p>
              </div>
              <input
                type="number"
                min={0}
                value={quantities[cat.id] ?? ''}
                onChange={(e) => changeQty(cat.id, e.target.value)}
                className={`${inputClass} sm:w-32`}
              />
            </div>
          ))}
        </div>
        {error && <div className={`${alertClass} mt-4`}>{error}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStep(2)
              setError('')
            }}
            className={secondaryButtonClass}
          >
            Retour
          </button>
          <button
            type="button"
            onClick={nextFromQuantities}
            className={primaryButtonClass}
          >
            Continuer
          </button>
        </div>
      </section>
    )
  } else if (step === 4 && client) {
    content = (
      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-slate-900">Récapitulatif</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vérifiez les informations de la tournée avant validation.
        </p>
        <dl className="mt-4 space-y-2 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-slate-900">Client :</dt>
            <dd>{client.name}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-slate-900">Date :</dt>
            <dd>{tourDate ? formatDateForDisplay(tourDate) : 'Non définie'}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-2">
          {selectedCats.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <span>{cat.name}</span>
              <span className="font-semibold text-slate-900">
                {quantities[cat.id] ?? 0} colis
              </span>
            </li>
          ))}
        </ul>
        {error && <div className={`${alertClass} mt-4`}>{error}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStep(3)
              setError('')
            }}
            className={secondaryButtonClass}
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={validate}
            disabled={saving}
            className={primaryButtonClass}
          >
            {saving ? 'Enregistrement…' : 'Valider la récupération'}
          </button>
        </div>
      </section>
    )
  } else {
    content = (
      <div className={successCardClass}>
        <h2 className="text-lg font-semibold">Récupération enregistrée</h2>
        <p className="mt-2">
          La récupération de votre tournée a été enregistrée avec succès. Vous pouvez dès maintenant clôturer la tournée ou en récupérer une nouvelle.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={resetWizard} className={primaryButtonClass}>
            Nouvelle récupération
          </button>
          <Link href="/cloturer" className={secondaryButtonClass}>
            Clôturer une tournée
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PageLayout
      title="Récupérer une tournée"
      description="Acceptez une tournée, saisissez les quantités récupérées et validez en quelques étapes."
      actions={
        <Link href="/" className={secondaryButtonClass}>
          Retour à l&apos;accueil
        </Link>
      }
    >
      <div className="space-y-5">{content}</div>
    </PageLayout>
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
        setLoading(true)
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
    setError('')
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

  const changeQty = (id: number, value: string) => {
    setDeliveryQuantities((prev) => {
      if (value === '') {
        const updated = { ...prev }
        delete updated[id]
        return updated
      }

      return { ...prev, [id]: Number(value) }
    })
  }

  const nextFromQuantities = () => {
    if (!selectedTour) return
    for (const item of selectedTour.items) {
      const value = deliveryQuantities[item.tariffGroupId]
      if (value === undefined || Number.isNaN(value)) {
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

  const handleCloseAnother = () => {
    resetSelection()
    void fetchTours()
  }

  let content: JSX.Element

  if (step === 1) {
    content = (
      <section className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Tournées en attente de clôture
            </h2>
            <p className="text-sm text-slate-600">
              Sélectionnez la tournée à clôturer puis indiquez les colis livrés.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchTours()}
            className={mutedButtonClass}
            disabled={loading}
          >
            {loading ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
        {loading ? (
          <div className={`${infoCardClass} mt-4`}>
            Chargement des tournées en cours…
          </div>
        ) : pendingTours.length === 0 ? (
          <div className={`${infoCardClass} mt-4`}>
            Aucune tournée en attente de clôture pour le moment. Revenez plus tard ou contactez votre administrateur.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pendingTours.map((tour) => (
              <button
                key={tour.tourId}
                type="button"
                onClick={() => selectTour(tour)}
                className="group flex h-full flex-col items-start rounded-md border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span className="text-base font-semibold text-slate-900">
                  {tour.client.name}
                </span>
                <span className="mt-1 text-sm text-slate-600">
                  Récupérée le {formatDateForDisplay(tour.date)}
                </span>
                <span className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
                  Clôturer cette tournée
                  <span className="ml-1" aria-hidden>
                    →
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {error && <div className={`${alertClass} mt-4`}>{error}</div>}
      </section>
    )
  } else if (step === 2 && selectedTour) {
    content = (
      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-slate-900">
          Colis livrés pour {selectedTour.client.name}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Date de récupération : {formatDateForDisplay(selectedTour.date)}
        </p>
        <div className="mt-4 space-y-4">
          {selectedTour.items.map((item) => (
            <div
              key={item.tariffGroupId}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {item.displayName}
                </p>
                <p className="text-xs text-slate-500">
                  Récupérés : {item.pickupQuantity}
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={item.pickupQuantity}
                value={deliveryQuantities[item.tariffGroupId] ?? ''}
                onChange={(e) => changeQty(item.tariffGroupId, e.target.value)}
                className={`${inputClass} sm:w-32`}
              />
            </div>
          ))}
        </div>
        {error && <div className={`${alertClass} mt-4`}>{error}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={resetSelection} className={secondaryButtonClass}>
            Retour
          </button>
          <button type="button" onClick={nextFromQuantities} className={primaryButtonClass}>
            Continuer
          </button>
        </div>
      </section>
    )
  } else if (step === 3 && selectedTour) {
    content = (
      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-slate-900">Récapitulatif</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vérifiez les informations avant de valider la clôture de la tournée.
        </p>
        <dl className="mt-4 space-y-2 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-slate-900">Client :</dt>
            <dd>{selectedTour.client.name}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-slate-900">Date :</dt>
            <dd>{formatDateForDisplay(selectedTour.date)}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-2">
          {selectedTour.items.map((item) => {
            const delivered = deliveryQuantities[item.tariffGroupId] ?? 0
            const returns = Math.max(item.pickupQuantity - delivered, 0)
            return (
              <li
                key={item.tariffGroupId}
                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span>{item.displayName}</span>
                  <span className="font-semibold text-slate-900">{delivered} livrés</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Retours : {returns}</p>
              </li>
            )
          })}
        </ul>
        {error && <div className={`${alertClass} mt-4`}>{error}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => setStep(2)} className={secondaryButtonClass}>
            Modifier
          </button>
          <button
            type="button"
            onClick={submitDelivery}
            disabled={saving}
            className={primaryButtonClass}
          >
            {saving ? 'Enregistrement…' : 'Valider la clôture'}
          </button>
        </div>
      </section>
    )
  } else {
    content = (
      <div className={successCardClass}>
        <h2 className="text-lg font-semibold">Clôture enregistrée</h2>
        <p className="mt-2">
          La tournée a été clôturée avec succès. Les informations ont été transmises à l&apos;administration.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {pendingTours.length > 0 ? (
            <button type="button" onClick={handleCloseAnother} className={primaryButtonClass}>
              Clôturer une autre tournée
            </button>
          ) : null}
          <Link href="/recuperer" className={secondaryButtonClass}>
            Récupérer une nouvelle tournée
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PageLayout
      title="Clôturer une tournée"
      description="Déclarez les colis livrés, signalez les retours et finalisez votre tournée."
      actions={
        <Link href="/" className={secondaryButtonClass}>
          Retour à l&apos;accueil
        </Link>
      }
    >
      <div className="space-y-5">{content}</div>
    </PageLayout>
  )
}

export default function TourneeWizard({ mode }: { mode: Mode }) {
  if (mode === 'pickup') {
    return <PickupWizard />
  }
  return <DeliveryWizard />
}
