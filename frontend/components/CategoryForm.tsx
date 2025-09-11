'use client'

import { useState } from 'react'
import { TariffCategory } from './types'

type Props = {
  initialCategory?: TariffCategory
  onSubmit: (category: TariffCategory) => void
  onCancel: () => void
}

export default function CategoryForm({
  initialCategory,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialCategory?.name ?? '')
  const [price, setPrice] = useState(initialCategory?.price ?? '')
  const [enseignes, setEnseignes] = useState<string[]>(
    initialCategory?.enseignes ?? [],
  )
  const [enseigneInput, setEnseigneInput] = useState('')

  const handleEnseigneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && enseigneInput.trim()) {
      e.preventDefault()
      setEnseignes([...enseignes, enseigneInput.trim()])
      setEnseigneInput('')
    }
  }

  const removeEnseigne = (index: number) => {
    setEnseignes(enseignes.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      id: initialCategory?.id ?? crypto.randomUUID(),
      name,
      price: price ? parseFloat(price).toFixed(2) : '0.00',
      enseignes,
      color: initialCategory?.color ?? '',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 w-full rounded border p-4">
      <div className="mb-4">
        <label className="mb-1 block font-medium" htmlFor="name">
          Nom de la catégorie
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border p-2"
          placeholder="Nom de la catégorie (ex : Colis standard, Cartons ...)"
          required
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block font-medium" htmlFor="price">
          Tarif
        </label>
        <input
          id="price"
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={(e) =>
            setPrice(
              e.target.value ? parseFloat(e.target.value).toFixed(2) : '0.00',
            )
          }
          className="w-full rounded border p-2"
          placeholder="Tarif en €"
          required
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block font-medium">Enseignes associées</label>
        <div className="mb-2 flex flex-wrap gap-2">
          {enseignes.map((tag, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeEnseigne(i)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={enseigneInput}
          onChange={(e) => setEnseigneInput(e.target.value)}
          onKeyDown={handleEnseigneKeyDown}
          className="w-full rounded border p-2"
          placeholder="Tapez une enseigne et appuyez sur Entrée"
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
          {initialCategory ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
