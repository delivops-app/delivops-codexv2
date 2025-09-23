'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
import { apiFetch, isApiFetchError } from '../../../lib/api'
import { normalizeRoles } from '../../../lib/roles'

interface DeclarationRow {
  tourId: number
  tourItemId: number
  date: string
  driverName: string
  clientName: string
  tariffGroupDisplayName: string
  pickupQuantity: number
  deliveryQuantity: number
  differenceQuantity: number
  estimatedAmountEur: string
}

export default function SyntheseChauffeursPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isAdmin = roles.includes('ADMIN')
  const [rows, setRows] = useState<DeclarationRow[]>([])
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState({
    pickupQuantity: '',
    deliveryQuantity: '',
    estimatedAmountEur: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    const fetchDeclarations = async () => {
      const res = await apiFetch('/reports/declarations')
      if (res.ok) {
        const json = await res.json()
        setRows(json)
        setError('')
      } else if (isApiFetchError(res)) {
        console.error('Failed to load declarations summary', res.error)
        setError('Impossible de charger la synthèse. Vérifiez votre connexion et réessayez.')
      } else {
        setError('Erreur lors du chargement de la synthèse.')
      }
    }
    fetchDeclarations()
  }, [isAdmin])

  const startEditing = (row: DeclarationRow) => {
    setEditingId(row.tourItemId)
    setFormValues({
      pickupQuantity: row.pickupQuantity.toString(),
      deliveryQuantity: row.deliveryQuantity.toString(),
      estimatedAmountEur: Number(row.estimatedAmountEur || 0).toFixed(2),
    })
    setError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsSaving(false)
  }

  const handleInputChange = (
    field: 'pickupQuantity' | 'deliveryQuantity' | 'estimatedAmountEur',
    value: string,
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (editingId === null || isSaving) {
      return
    }

    const pickupQuantity = parseInt(formValues.pickupQuantity, 10)
    const deliveryQuantity = parseInt(formValues.deliveryQuantity, 10)
    const estimatedAmount = parseFloat(formValues.estimatedAmountEur)

    if (Number.isNaN(pickupQuantity) || Number.isNaN(deliveryQuantity)) {
      setError('Les quantités doivent être des nombres valides.')
      return
    }
    if (deliveryQuantity > pickupQuantity) {
      setError('Le nombre de colis livrés ne peut pas dépasser les récupérations.')
      return
    }
    if (Number.isNaN(estimatedAmount)) {
      setError('Le montant estimé doit être un nombre valide.')
      return
    }

    setIsSaving(true)
    const res = await apiFetch(`/reports/declarations/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupQuantity,
        deliveryQuantity,
        estimatedAmountEur: estimatedAmount,
      }),
    })

    if (res.ok) {
      const updatedRow: DeclarationRow = await res.json()
      setRows((prev) =>
        prev.map((row) =>
          row.tourItemId === updatedRow.tourItemId ? updatedRow : row,
        ),
      )
      setEditingId(null)
      setFormValues({ pickupQuantity: '', deliveryQuantity: '', estimatedAmountEur: '' })
      setError('')
    } else if (isApiFetchError(res)) {
      console.error('Failed to update declaration', res.error)
      setError('Impossible de mettre à jour la déclaration. Réessayez plus tard.')
    } else {
      try {
        const data = await res.json()
        if (data?.detail) {
          setError(data.detail)
        } else {
          setError('Erreur lors de la mise à jour de la déclaration.')
        }
      } catch {
        setError('Erreur lors de la mise à jour de la déclaration.')
      }
    }
    setIsSaving(false)
  }

  const handleDelete = async (row: DeclarationRow) => {
    if (deletingId !== null) return
    const confirmed = window.confirm(
      `Confirmez-vous la suppression de la déclaration du ${row.date} pour ${row.driverName} ?`,
    )
    if (!confirmed) return

    setDeletingId(row.tourItemId)
    const res = await apiFetch(`/reports/declarations/${row.tourItemId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.tourItemId !== row.tourItemId))
      setError('')
      if (editingId === row.tourItemId) {
        setEditingId(null)
      }
    } else if (isApiFetchError(res)) {
      console.error('Failed to delete declaration', res.error)
      setError('Impossible de supprimer la déclaration. Réessayez plus tard.')
    } else {
      try {
        const data = await res.json()
        if (data?.detail) {
          setError(data.detail)
        } else {
          setError('Erreur lors de la suppression de la déclaration.')
        }
      } catch {
        setError('Erreur lors de la suppression de la déclaration.')
      }
    }

    setDeletingId(null)
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <p className="mb-4">Accès refusé</p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="mb-6 text-3xl font-bold">Synthèse des chauffeurs</h1>
      {error && (
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>
      )}
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Date</th>
            <th className="border px-4 py-2">Chauffeur</th>
            <th className="border px-4 py-2">Client donneur d&apos;ordre</th>
            <th className="border px-4 py-2">Catégorie de groupe tarifaire</th>
            <th className="border px-4 py-2">Colis récupérés</th>
            <th className="border px-4 py-2">Colis livrés</th>
            <th className="border px-4 py-2">Écart</th>
            <th className="border px-4 py-2">Montant estimé (€)</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.tourItemId}>
              <td className="border px-4 py-2">{row.date}</td>
              <td className="border px-4 py-2">{row.driverName}</td>
              <td className="border px-4 py-2">{row.clientName}</td>
              <td className="border px-4 py-2">{row.tariffGroupDisplayName}</td>
              <td className="border px-4 py-2">
                {editingId === row.tourItemId ? (
                  <input
                    type="number"
                    min={0}
                    className="w-24 rounded border px-2 py-1"
                    value={formValues.pickupQuantity}
                    onChange={(e) =>
                      handleInputChange('pickupQuantity', e.target.value)
                    }
                  />
                ) : (
                  row.pickupQuantity
                )}
              </td>
              <td className="border px-4 py-2">
                {editingId === row.tourItemId ? (
                  <input
                    type="number"
                    min={0}
                    className="w-24 rounded border px-2 py-1"
                    value={formValues.deliveryQuantity}
                    onChange={(e) =>
                      handleInputChange('deliveryQuantity', e.target.value)
                    }
                  />
                ) : (
                  row.deliveryQuantity
                )}
              </td>
              <td className="border px-4 py-2">
                {editingId === row.tourItemId
                  ? (() => {
                      const pickup = parseInt(formValues.pickupQuantity, 10)
                      const delivery = parseInt(formValues.deliveryQuantity, 10)
                      if (Number.isNaN(pickup) || Number.isNaN(delivery)) {
                        return '—'
                      }
                      return pickup - delivery
                    })()
                  : row.differenceQuantity}
              </td>
              <td className="border px-4 py-2">
                {editingId === row.tourItemId ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28 rounded border px-2 py-1"
                    value={formValues.estimatedAmountEur}
                    onChange={(e) =>
                      handleInputChange('estimatedAmountEur', e.target.value)
                    }
                  />
                ) : (
                  Number(row.estimatedAmountEur || 0).toFixed(2)
                )}
              </td>
              <td className="border px-4 py-2">
                {editingId === row.tourItemId ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      className="rounded bg-gray-500 px-3 py-1 text-white disabled:opacity-50"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
                      onClick={() => startEditing(row)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
                      onClick={() => handleDelete(row)}
                      disabled={deletingId === row.tourItemId}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="border px-4 py-6 text-center" colSpan={9}>
                Aucune déclaration disponible.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Link href="/" className="mt-4 rounded bg-gray-600 px-4 py-2 text-white">
        Retour
      </Link>
    </main>
  )
}
