'use client'

import { useState } from 'react'
import { Client, TariffCategory } from './types'

const COLORS = ['bg-red-100', 'bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-purple-100', 'bg-pink-100']

type Props = {
  initialClient?: Client
  onSubmit: (client: Client) => void
  onCancel: () => void
}

export default function ClientForm({ initialClient, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialClient?.name ?? '')
  const [enseignes, setEnseignes] = useState<string[]>(initialClient?.enseignes ?? [])
  const [enseigneInput, setEnseigneInput] = useState('')
  const [categories, setCategories] = useState<TariffCategory[]>(
    initialClient?.categories ?? []
  )

  const addCategory = () => {
    setCategories([
      ...categories,
      {
        id: crypto.randomUUID(),
        name: '',
        price: '',
        color: COLORS[categories.length % COLORS.length],
      },
    ])
  }

  const updateCategory = (
    id: string,
    field: 'name' | 'price',
    value: string
  ) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === id
          ? { ...cat, [field]: field === 'price' ? value : value }
          : cat
      )
    )
  }

  const removeCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id))
  }

  const handleEnseigneKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
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
      id: initialClient?.id ?? crypto.randomUUID(),
      name,
      enseignes,
      categories: categories.map((c) => ({
        ...c,
        price: c.price ? parseFloat(c.price).toFixed(2) : '0.00',
      })),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 w-full rounded border p-4"
    >
      <div className="mb-4">
        <label className="mb-1 block font-medium" htmlFor="name">
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

      <div className="mb-4">
        <label className="mb-1 block font-medium">Enseignes associées</label>
        <div className="flex flex-wrap gap-2 mb-2">
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

      <div className="mb-4">
        <button
          type="button"
          onClick={addCategory}
          className="rounded bg-green-600 px-3 py-1 text-white"
        >
          Ajouter une catégorie de groupe tarifaire
        </button>
      </div>

      {categories.map((cat) => (
        <div
          key={cat.id}
          className={`mb-4 rounded p-4 ${cat.color} border`}
        >
          <div className="mb-2 flex justify-between">
            <span className="font-medium">Catégorie de colis</span>
            <button
              type="button"
              onClick={() => removeCategory(cat.id)}
              className="text-sm text-red-600 hover:underline"
            >
              Supprimer
            </button>
          </div>
          <div className="mb-2">
            <input
              type="text"
              value={cat.name}
              onChange={(e) => updateCategory(cat.id, 'name', e.target.value)}
              placeholder="Nom de la catégorie"
              className="w-full rounded border p-2"
              required
            />
          </div>
          <div>
            <input
              type="number"
              step="0.01"
              value={cat.price}
              onChange={(e) => updateCategory(cat.id, 'price', e.target.value)}
              onBlur={(e) =>
                updateCategory(
                  cat.id,
                  'price',
                  e.target.value
                    ? parseFloat(e.target.value).toFixed(2)
                    : '0.00'
                )
              }
              placeholder="Tarif"
              className="w-full rounded border p-2"
              required
            />
          </div>
        </div>
      ))}

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
