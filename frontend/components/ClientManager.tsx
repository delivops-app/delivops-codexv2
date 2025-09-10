'use client'

import { useState } from 'react'
import ClientForm from './ClientForm'
import ClientCard from './ClientCard'
import { Client } from './types'

export default function ClientManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)

  const handleSubmit = (client: Client) => {
    if (editing) {
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? client : c))
      )
    } else {
      setClients((prev) => [client, ...prev])
    }
    setEditing(null)
    setShowForm(false)
  }

  const handleEdit = (client: Client) => {
    setEditing(client)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="mt-8 w-full max-w-3xl">
      <button
        onClick={() => {
          setEditing(null)
          setShowForm(true)
        }}
        className="mb-4 rounded bg-blue-600 px-4 py-2 text-white"
      >
        Ajouter un client donneur d&apos;ordre
      </button>

      {showForm && (
        <ClientForm
          initialClient={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditing(null)
            setShowForm(false)
          }}
        />
      )}

      {clients.length > 0 && (
        <h2 className="mb-2 text-2xl font-semibold">
          Récapitulatif des clients
        </h2>
      )}

      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
