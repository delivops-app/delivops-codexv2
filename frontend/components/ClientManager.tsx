'use client'

import { useEffect, useState } from 'react'
import ClientForm from './ClientForm'
import CategoryForm from './CategoryForm'
import ClientCard from './ClientCard'
import { Client, TariffCategory } from './types'
import { apiFetch } from '../lib/api'

const COLORS = [
  'bg-red-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-yellow-100',
  'bg-purple-100',
  'bg-pink-100',
]

export default function ClientManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryClient, setCategoryClient] = useState<Client | null>(null)
  const [editingCategory, setEditingCategory] = useState<TariffCategory | null>(
    null,
  )

  useEffect(() => {
    const load = async () => {
      const res = await apiFetch('/clients/')
      if (res.ok) {
        const data = await res.json()
        const mapped: Client[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          categories: c.categories.map((cat: any, idx: number) => ({
            id: cat.id,
            name: cat.name,
            price: '0.00',
            enseignes: [],
            color: COLORS[idx % COLORS.length],
          })),
        }))
        setClients(mapped)
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
        setClientError("Impossible d'enregistrer le client")
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
        setClientError("Impossible d'ajouter le client")
        return
      }
      const data = await res.json()
      setClients((prev) => [{ ...data, categories: [] }, ...prev])
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
    await apiFetch(`/clients/${id}`, { method: 'DELETE' })
    setClients((prev) => prev.filter((c) => c.id !== id))
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
    await apiFetch(`/clients/${clientId}/categories/${categoryId}`, {
      method: 'DELETE',
    })
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
  }

  const handleCategorySubmit = async (category: TariffCategory) => {
    if (!categoryClient) return
    if (editingCategory) {
      await apiFetch(
        `/clients/${categoryClient.id}/categories/${editingCategory.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: category.name }),
        },
      )
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== categoryClient.id) return c
          return {
            ...c,
            categories: c.categories.map((cat) =>
              cat.id === editingCategory.id
                ? { ...cat, name: category.name }
                : cat,
            ),
          }
        }),
      )
    } else {
      const res = await apiFetch(`/clients/${categoryClient.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: category.name }),
      })
      if (res.ok) {
        const data = await res.json()
        setClients((prev) =>
          prev.map((c) =>
            c.id === categoryClient.id
              ? {
                  ...c,
                  categories: [
                    ...c.categories,
                    {
                      id: data.id,
                      name: data.name,
                      price: category.price,
                      enseignes: category.enseignes,
                      color:
                        COLORS[c.categories.length % COLORS.length],
                    },
                  ],
                }
              : c,
          ),
        )
      }
    }
    setEditingCategory(null)
    setCategoryClient(null)
    setShowCategoryForm(false)
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
