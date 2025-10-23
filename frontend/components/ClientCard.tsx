'use client'

import { Client, TariffCategory } from './types'

type Props = {
  client: Client
  onEdit: (client: Client) => void
  onDelete: (id: number) => void
  onAddCategory: (client: Client) => void
  onEditCategory: (client: Client, category: TariffCategory) => void
  onDeleteCategory: (clientId: number, categoryId: number) => void
}

export default function ClientCard({
  client,
  onEdit,
  onDelete,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: Props) {
  const formatAmount = (value: string) => {
    const parsed = Number.parseFloat(value)
    if (Number.isNaN(parsed)) {
      return '0.00'
    }
    return parsed.toFixed(2)
  }

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

      <div className="mt-2">
        <button
          onClick={() => onAddCategory(client)}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white"
        >
          Ajouter une catégorie de groupe tarifaire
        </button>
      </div>

      {client.categories.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {client.categories.map((cat) => (
            <div key={cat.id} className={`rounded p-2 ${cat.color}`}>
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">{cat.name}</p>
                  <p>
                    Tarif chauffeur (par colis, hors marge) :
                    {' '}
                    {formatAmount(cat.price)} €
                  </p>
                  <p>
                    Marge (bénéfice par colis) : {formatAmount(cat.margin)} €
                  </p>
                </div>
                <div className="space-x-2 text-sm">
                  <button
                    onClick={() => onEditCategory(client, cat)}
                    className="text-blue-600 hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => onDeleteCategory(client.id, cat.id)}
                    className="text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
