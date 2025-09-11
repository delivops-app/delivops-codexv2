'use client'

import { useState } from 'react'
import { Client } from './types'

type Props = {
  initialClient?: Client
  onSubmit: (client: Client) => void
  onCancel: () => void
}

export default function ClientForm({
  initialClient,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialClient?.name ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      id: initialClient?.id ?? crypto.randomUUID(),
      name,
      categories: initialClient?.categories ?? [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 w-full rounded border p-4">
      <div className="mb-4">
        <label htmlFor="name" className="mb-1 block font-medium">
          Nom du client donneur d&apos;ordre
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border p-2"
          required
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          {initialClient ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
