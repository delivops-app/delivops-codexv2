'use client'

import { useState } from 'react'
type Props = {
  initialName?: string
  onSubmit: (name: string) => void
  onCancel: () => void
  error?: string
}

export default function ClientForm({
  initialName,
  onSubmit,
  onCancel,
  error,
}: Props) {
  const [name, setName] = useState(initialName ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(name)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 w-full rounded border p-4">
      {error && <p className="mb-4 text-red-600">{error}</p>}
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
          {initialName ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
