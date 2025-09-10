'use client'

import { Client } from './types'

type Props = {
  client: Client
  onEdit: (client: Client) => void
  onDelete: (id: string) => void
}

export default function ClientCard({ client, onEdit, onDelete }: Props) {
  return (
    <div className="mb-4 rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{client.name}</h3>
        <div className="space-x-2 text-sm">
          <button
            onClick={() => onEdit(client)}
            className="text-blue-600 hover:underline"
          >
            Modifier
          </button>
          <button
            onClick={() => onDelete(client.id)}
            className="text-red-600 hover:underline"
          >
            Supprimer
          </button>
        </div>
      </div>

      {client.enseignes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {client.enseignes.map((tag, i) => (
            <span
              key={i}
              className="rounded bg-gray-200 px-2 py-1 text-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {client.categories.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {client.categories.map((cat) => (
            <div key={cat.id} className={`rounded p-2 ${cat.color}`}>
              <p className="font-medium">{cat.name}</p>
              <p>{parseFloat(cat.price).toFixed(2)} €</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
