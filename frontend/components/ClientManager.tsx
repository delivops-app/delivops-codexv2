'use client'

import { useEffect, useState } from 'react'
import ClientForm from './ClientForm'
import CategoryForm from './CategoryForm'
import ClientCard from './ClientCard'
import {
  Client,
  TariffCategory,
  ClientApiPayload,
  ClientCategoryApiPayload,
} from './types'
import { apiFetch, isApiFetchError } from '../lib/api'

const COLORS = [
  'bg-red-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-yellow-100',
  'bg-purple-100',
  'bg-pink-100',
]

const formatUnitPrice = (
  value?: string | number | null,
): string => {
  if (value === null || value === undefined) {
    return '0.00'
  }
  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(value)
  if (Number.isNaN(parsed)) {
    return '0.00'
  }
  return parsed.toFixed(2)
}

const toUnitPricePayload = (price: string): number => {
  if (!price) return 0
  const parsed = Number.parseFloat(price)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return Number(parsed.toFixed(2))
}

const mapCategoryFromApi = (
  category: ClientCategoryApiPayload,
  color: string,
): TariffCategory => ({
  id: category.id,
  name: category.name,
  price: formatUnitPrice(category.unitPriceExVat),
  color,
})

const mapClientFromApi = (client: ClientApiPayload): Client => ({
  id: client.id,
  name: client.name,
  isActive: client.isActive ?? true,
  categories: client.categories.map((cat, idx) =>
    mapCategoryFromApi(cat, COLORS[idx % COLORS.length]),
  ),
})

export default function ClientManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryClient, setCategoryClient] = useState<Client | null>(null)
  const [editingCategory, setEditingCategory] = useState<TariffCategory | null>(
    null,
  )

  useEffect(() => {
    const load = async () => {
      const res = await apiFetch('/clients/')
      if (res.ok) {
        const data = (await res.json()) as ClientApiPayload[]
        const mapped: Client[] = data.map((c) => mapClientFromApi(c))
        setClients(mapped)
        setGlobalError(null)
      } else if (isApiFetchError(res)) {
        console.error('Failed to load clients', res.error)
        setGlobalError('Impossible de charger les clients. Vérifiez votre connexion et réessayez.')
      } else {
        setGlobalError('Erreur lors du chargement des clients.')
      }
    }
    load()
  }, [])

  const handleClientSubmit = async (name: string) => {
    if (editingClient) {
      const res = await apiFetch(`/clients/${editingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        if (isApiFetchError(res)) {
          console.error('Failed to update client', res.error)
          setClientError('Connexion au serveur impossible. Réessayez plus tard.')
        } else {
          setClientError("Impossible d'enregistrer le client")
        }
        return
      }
      setClients((prev) =>
        prev.map((c) => (c.id === editingClient.id ? { ...c, name } : c)),
      )
    } else {
      const res = await apiFetch('/clients/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        if (isApiFetchError(res)) {
          console.error('Failed to create client', res.error)
          setClientError('Connexion au serveur impossible. Réessayez plus tard.')
        } else {
          setClientError("Impossible d'ajouter le client")
        }
        return
      }
      const data = (await res.json()) as ClientApiPayload
      const mapped = mapClientFromApi(data)
      setClients((prev) => [mapped, ...prev])
    }
    setClientError(null)
    setEditingClient(null)
    setShowClientForm(false)
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setShowClientForm(true)
  }

  const handleDeleteClient = async (id: number) => {
    const res = await apiFetch(`/clients/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      if (isApiFetchError(res)) {
        console.error('Failed to delete client', res.error)
        setGlobalError('Suppression impossible : connexion au serveur échouée.')
      } else {
        setGlobalError("Impossible de supprimer le client.")
      }
      return
    }
    setClients((prev) => prev.filter((c) => c.id !== id))
    setGlobalError(null)
  }

  const handleAddCategory = (client: Client) => {
    setCategoryClient(client)
    setEditingCategory(null)
    setShowCategoryForm(true)
  }

  const handleEditCategory = (client: Client, category: TariffCategory) => {
    setCategoryClient(client)
    setEditingCategory(category)
    setShowCategoryForm(true)
  }

  const handleDeleteCategory = async (clientId: number, categoryId: number) => {
    const res = await apiFetch(`/clients/${clientId}/categories/${categoryId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      if (isApiFetchError(res)) {
        console.error('Failed to delete category', res.error)
        setGlobalError('Suppression de la catégorie impossible : vérifiez votre connexion.')
      } else {
        setGlobalError("Impossible de supprimer la catégorie.")
      }
      return
    }
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              categories: c.categories.filter((cat) => cat.id !== categoryId),
            }
          : c,
      ),
    )
    setGlobalError(null)
  }

  const handleCategorySubmit = async (category: TariffCategory) => {
    if (!categoryClient) return
    if (editingCategory) {
      const res = await apiFetch(
        `/clients/${categoryClient.id}/categories/${editingCategory.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: category.name,
            unitPriceExVat: toUnitPricePayload(category.price),
          }),
        },
      )
      if (!res.ok) {
        if (isApiFetchError(res)) {
          console.error('Failed to update category', res.error)
          setGlobalError('Mise à jour impossible : connexion au serveur échouée.')
        } else {
          setGlobalError("Impossible de mettre à jour la catégorie.")
        }
        return
      }
      const data = (await res.json()) as ClientCategoryApiPayload
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== categoryClient.id) return c
          return {
            ...c,
            categories: c.categories.map((cat) =>
              cat.id === editingCategory.id
                ? mapCategoryFromApi(data, cat.color)
                : cat,
            ),
          }
        }),
      )
      setGlobalError(null)
    } else {
      const res = await apiFetch(`/clients/${categoryClient.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: category.name,
          unitPriceExVat: toUnitPricePayload(category.price),
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as ClientCategoryApiPayload
        setClients((prev) =>
          prev.map((c) =>
            c.id === categoryClient.id
              ? {
                  ...c,
                  categories: [
                    ...c.categories,
                    mapCategoryFromApi(
                      data,
                      COLORS[c.categories.length % COLORS.length],
                    ),
                  ],
                }
              : c,
          ),
        )
        setGlobalError(null)
      } else if (isApiFetchError(res)) {
        console.error('Failed to create category', res.error)
        setGlobalError('Ajout impossible : connexion au serveur échouée.')
        return
      } else {
        setGlobalError("Impossible d'ajouter la catégorie.")
        return
      }
    }
    setEditingCategory(null)
    setCategoryClient(null)
    setShowCategoryForm(false)
    setGlobalError(null)
  }

  const cancelForms = () => {
    setClientError(null)
    setEditingClient(null)
    setShowClientForm(false)
    setEditingCategory(null)
    setCategoryClient(null)
    setShowCategoryForm(false)
  }

  return (
    <div className="mt-8 w-full max-w-3xl">
      {globalError && (
        <p className="mb-4 text-red-600" role="alert">
          {globalError}
        </p>
      )}
      <button
        onClick={() => {
          setEditingClient(null)
          setShowClientForm(true)
        }}
        className="mb-4 rounded bg-blue-600 px-4 py-2 text-white"
      >
        Ajouter un client donneur d&apos;ordre
      </button>

      {showClientForm && (
        <ClientForm
          initialName={editingClient?.name}
          onSubmit={handleClientSubmit}
          onCancel={cancelForms}
          error={clientError ?? undefined}
        />
      )}

      {showCategoryForm && (
        <CategoryForm
          initialCategory={editingCategory ?? undefined}
          onSubmit={handleCategorySubmit}
          onCancel={cancelForms}
        />
      )}

      {!showClientForm && !showCategoryForm && clients.length > 0 && (
        <>
          <h2 className="mb-2 text-2xl font-semibold">
            Récapitulatif des clients
          </h2>
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          ))}
        </>
      )}
    </div>
  )
}
