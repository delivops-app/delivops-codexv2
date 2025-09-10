'use client'

import { useState } from 'react'
import ClientForm from './ClientForm'
import CategoryForm from './CategoryForm'
import ClientCard from './ClientCard'
import { Client, TariffCategory } from './types'

const COLORS = ['bg-red-100','bg-blue-100','bg-green-100','bg-yellow-100','bg-purple-100','bg-pink-100']

export default function ClientManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryClient, setCategoryClient] = useState<Client | null>(null)
  const [editingCategory, setEditingCategory] = useState<TariffCategory | null>(null)

  const handleClientSubmit = (client: Client) => {
    if (editingClient) {
      setClients(prev => prev.map(c => c.id === client.id ? client : c))
    } else {
      setClients(prev => [client, ...prev])
    }
    setEditingClient(null)
    setShowClientForm(false)
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setShowClientForm(true)
  }

  const handleDeleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id))
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

  const handleDeleteCategory = (clientId: string, categoryId: string) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, categories: c.categories.filter(cat => cat.id !== categoryId) } : c
    ))
  }

  const handleCategorySubmit = (category: TariffCategory) => {
    if (!categoryClient) return
    setClients(prev => prev.map(c => {
      if (c.id !== categoryClient.id) return c
      const categories = editingCategory
        ? c.categories.map(cat => cat.id === category.id ? { ...category, color: editingCategory.color } : cat)
        : [...c.categories, { ...category, color: COLORS[c.categories.length % COLORS.length] }]
      return { ...c, categories }
    }))
    setEditingCategory(null)
    setCategoryClient(null)
    setShowCategoryForm(false)
  }

  const cancelForms = () => {
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
          initialClient={editingClient ?? undefined}
          onSubmit={handleClientSubmit}
          onCancel={cancelForms}
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
          <h2 className="mb-2 text-2xl font-semibold">Récapitulatif des clients</h2>
          {clients.map(client => (
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
