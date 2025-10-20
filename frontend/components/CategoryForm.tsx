'use client'

import { useState, FormEvent } from 'react'
import { TariffCategory } from './types'

type Props = {
  initialCategory?: TariffCategory
  onSubmit: (category: TariffCategory) => void
  onCancel: () => void
}

const formatPrice = (value: string): string => {
  if (!value) return '0.00'
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) {
    return '0.00'
  }
  return parsed.toFixed(2)
}

export default function CategoryForm({
  initialCategory,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialCategory?.name ?? '')
  const [price, setPrice] = useState(initialCategory?.price ?? '')
  const [margin, setMargin] = useState(initialCategory?.margin ?? '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      id: initialCategory?.id ?? 0,
      name,
      price: formatPrice(price),
      margin: formatPrice(margin),
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
          Tarif chauffeur (hors marge)
        </label>
        <p className="mb-2 text-sm text-gray-600">
          Correspond au montant versé au chauffeur. La marge est ajoutée en
          supplément.
        </p>
        <input
          id="price"
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={(e) => setPrice(formatPrice(e.target.value))}
          className="w-full rounded border p-2"
          placeholder="Tarif chauffeur en € (hors marge)"
          required
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block font-medium" htmlFor="margin">
          Marge
        </label>
        <p className="mb-2 text-sm text-gray-600">
          Montant que l'entreprise ajoute au tarif chauffeur et conserve.
        </p>
        <input
          id="margin"
          type="number"
          step="0.01"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          onBlur={(e) => setMargin(formatPrice(e.target.value))}
          className="w-full rounded border p-2"
          placeholder="Marge en € (ajoutée au tarif chauffeur)"
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
          {initialCategory ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
