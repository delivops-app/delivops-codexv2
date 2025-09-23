'use client'

import { useCallback, useEffect, useState } from 'react'
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
  unitPriceExVat: string
}

interface DriverOption {
  id: number
  displayName: string
  isActive: boolean
}

interface ClientCategoryOption {
  id: number
  name: string
  unitPriceExVat: string | number | null
}

interface ClientOption {
  id: number
  name: string
  categories: ClientCategoryOption[]
}

export default function SyntheseChauffeursPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isAdmin = roles.includes('ADMIN')
  const [rows, setRows] = useState<DeclarationRow[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState({
    pickupQuantity: '',
    deliveryQuantity: '',
    estimatedAmountEur: '',
  })
  const [editingUnitPrice, setEditingUnitPrice] = useState('')
  const [isEditingAmountDirty, setIsEditingAmountDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newFormValues, setNewFormValues] = useState({
    date: '',
    driverId: '',
    clientId: '',
    tariffGroupId: '',
    pickupQuantity: '',
    deliveryQuantity: '',
    estimatedAmountEur: '',
  })
  const [isNewAmountDirty, setIsNewAmountDirty] = useState(false)
  const [isSavingNewRow, setIsSavingNewRow] = useState(false)

  const fetchDeclarations = useCallback(async () => {
    const res = await apiFetch('/reports/declarations')
    if (res.ok) {
      const json = await res.json()
      setRows(json)
      setError('')
    } else if (isApiFetchError(res)) {
      console.error('Failed to load declarations summary', res.error)
      setError(
        'Impossible de charger la synthèse. Vérifiez votre connexion et réessayez.',
      )
    } else {
      setError('Erreur lors du chargement de la synthèse.')
    }
  }, [])

  const fetchDrivers = useCallback(async () => {
    const res = await apiFetch('/chauffeurs/')
    if (res.ok) {
      const json: { id: number; display_name: string; is_active: boolean }[] =
        await res.json()
      setDrivers(
        json.map((driver) => ({
          id: driver.id,
          displayName: driver.display_name,
          isActive: driver.is_active,
        })),
      )
    } else if (isApiFetchError(res)) {
      console.error('Failed to load drivers for declarations', res.error)
      setError(
        'Impossible de charger les chauffeurs. Vérifiez votre connexion et réessayez.',
      )
    } else {
      setError('Erreur lors du chargement des chauffeurs.')
    }
  }, [])

  const fetchClientsData = useCallback(async () => {
    const res = await apiFetch('/clients/')
    if (res.ok) {
      const json = await res.json()
      setClients(json)
    } else if (isApiFetchError(res)) {
      console.error('Failed to load clients for declarations summary', res.error)
      setError(
        'Impossible de charger les clients. Vérifiez votre connexion et réessayez.',
      )
    } else {
      setError('Erreur lors du chargement des clients.')
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetchDeclarations()
    fetchDrivers()
    fetchClientsData()
  }, [isAdmin, fetchDeclarations, fetchDrivers, fetchClientsData])

  const resetNewForm = () => {
    setNewFormValues({
      date: '',
      driverId: '',
      clientId: '',
      tariffGroupId: '',
      pickupQuantity: '',
      deliveryQuantity: '',
      estimatedAmountEur: '',
    })
    setIsNewAmountDirty(false)
  }

  const startEditing = (row: DeclarationRow) => {
    setEditingId(row.tourItemId)
    setFormValues({
      pickupQuantity: row.pickupQuantity.toString(),
      deliveryQuantity: row.deliveryQuantity.toString(),
      estimatedAmountEur: Number(row.estimatedAmountEur || 0).toFixed(2),
    })
    setEditingUnitPrice(row.unitPriceExVat)
    setIsEditingAmountDirty(false)
    setError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsSaving(false)
    setEditingUnitPrice('')
    setIsEditingAmountDirty(false)
  }

  const handleInputChange = (
    field: 'pickupQuantity' | 'deliveryQuantity' | 'estimatedAmountEur',
    value: string,
  ) => {
    if (field === 'estimatedAmountEur') {
      setIsEditingAmountDirty(true)
    }
    setFormValues((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'deliveryQuantity' && !isEditingAmountDirty) {
        const delivery = parseInt(value, 10)
        const unitPrice = parseFloat(editingUnitPrice || '')
        if (!Number.isNaN(delivery) && !Number.isNaN(unitPrice)) {
          next.estimatedAmountEur = (unitPrice * delivery).toFixed(2)
        } else if (value.trim().length === 0) {
          next.estimatedAmountEur = ''
        }
      }
      return next
    })
  }

  const handleSave = async () => {
    if (editingId === null || isSaving) {
      return
    }

    const pickupQuantity = parseInt(formValues.pickupQuantity, 10)
    const deliveryQuantity = parseInt(formValues.deliveryQuantity, 10)
    const hasAmount = formValues.estimatedAmountEur.trim().length > 0
    const estimatedAmount = hasAmount
      ? parseFloat(formValues.estimatedAmountEur)
      : undefined

    if (Number.isNaN(pickupQuantity) || Number.isNaN(deliveryQuantity)) {
      setError('Les quantités doivent être des nombres valides.')
      return
    }
    if (deliveryQuantity > pickupQuantity) {
      setError('Le nombre de colis livrés ne peut pas dépasser les récupérations.')
      return
    }
    if (hasAmount && (estimatedAmount === undefined || Number.isNaN(estimatedAmount))) {
      setError('Le montant estimé doit être un nombre valide.')
      return
    }

    setIsSaving(true)
    const payload: Record<string, unknown> = {
      pickupQuantity,
      deliveryQuantity,
    }
    if (hasAmount && estimatedAmount !== undefined) {
      payload.estimatedAmountEur = Number(estimatedAmount.toFixed(2))
    }
    const res = await apiFetch(`/reports/declarations/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
      setEditingUnitPrice('')
      setIsEditingAmountDirty(false)
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

  const startCreating = () => {
    if (isCreating || editingId !== null) {
      return
    }
    setIsCreating(true)
    setNewFormValues({
      date: new Date().toISOString().split('T')[0],
      driverId: '',
      clientId: '',
      tariffGroupId: '',
      pickupQuantity: '',
      deliveryQuantity: '',
      estimatedAmountEur: '',
    })
    setIsNewAmountDirty(false)
    setError('')
  }

  const cancelCreating = () => {
    setIsCreating(false)
    setIsSavingNewRow(false)
    resetNewForm()
  }

  const handleNewFieldChange = (
    field:
      | 'date'
      | 'driverId'
      | 'clientId'
      | 'tariffGroupId'
      | 'pickupQuantity'
      | 'deliveryQuantity'
      | 'estimatedAmountEur',
    value: string,
  ) => {
    const shouldResetAmount = field === 'clientId' || field === 'tariffGroupId'
    setNewFormValues((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'clientId') {
        next.tariffGroupId = ''
        next.estimatedAmountEur = ''
      }
      const selectedClientId = Number(next.clientId || 0)
      const selectedTariffGroupId = Number(next.tariffGroupId || 0)
      const selectedClient = clients.find((c) => c.id === selectedClientId)
      const selectedCategory = selectedClient?.categories.find(
        (cat) => cat.id === selectedTariffGroupId,
      )
      const unitPriceValue = selectedCategory?.unitPriceExVat
      const unitPrice =
        unitPriceValue === null || unitPriceValue === undefined
          ? Number.NaN
          : parseFloat(unitPriceValue.toString())
      const deliveryQty = parseInt(next.deliveryQuantity, 10)
      const amountDirty = shouldResetAmount ? false : isNewAmountDirty

      if (!amountDirty) {
        if (!Number.isNaN(unitPrice) && !Number.isNaN(deliveryQty)) {
          next.estimatedAmountEur = (unitPrice * deliveryQty).toFixed(2)
        } else if (shouldResetAmount || next.deliveryQuantity.trim().length === 0) {
          next.estimatedAmountEur = ''
        }
      } else if (shouldResetAmount) {
        next.estimatedAmountEur = ''
      }

      return next
    })
    if (field === 'estimatedAmountEur') {
      setIsNewAmountDirty(true)
    } else if (shouldResetAmount) {
      setIsNewAmountDirty(false)
    }
  }

  const handleCreateSave = async () => {
    if (isSavingNewRow) {
      return
    }
    if (
      !newFormValues.date ||
      !newFormValues.driverId ||
      !newFormValues.clientId ||
      !newFormValues.tariffGroupId
    ) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }

    const pickupQuantity = parseInt(newFormValues.pickupQuantity, 10)
    const deliveryQuantity = parseInt(newFormValues.deliveryQuantity, 10)

    if (Number.isNaN(pickupQuantity) || Number.isNaN(deliveryQuantity)) {
      setError('Les quantités doivent être des nombres valides.')
      return
    }
    if (deliveryQuantity > pickupQuantity) {
      setError('Le nombre de colis livrés ne peut pas dépasser les récupérations.')
      return
    }

    const hasAmount = newFormValues.estimatedAmountEur.trim().length > 0
    const estimatedAmount = hasAmount
      ? parseFloat(newFormValues.estimatedAmountEur)
      : undefined

    if (hasAmount && (estimatedAmount === undefined || Number.isNaN(estimatedAmount))) {
      setError('Le montant estimé doit être un nombre valide.')
      return
    }

    setIsSavingNewRow(true)
    const payload: Record<string, unknown> = {
      date: newFormValues.date,
      driverId: Number(newFormValues.driverId),
      clientId: Number(newFormValues.clientId),
      tariffGroupId: Number(newFormValues.tariffGroupId),
      pickupQuantity,
      deliveryQuantity,
    }
    if (hasAmount && estimatedAmount !== undefined) {
      payload.estimatedAmountEur = Number(estimatedAmount.toFixed(2))
    }

    const res = await apiFetch('/reports/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      await fetchDeclarations()
      setIsCreating(false)
      resetNewForm()
      setError('')
    } else if (isApiFetchError(res)) {
      console.error('Failed to create declaration', res.error)
      setError('Impossible de créer la déclaration. Réessayez plus tard.')
    } else {
      try {
        const data = await res.json()
        if (data?.detail) {
          setError(data.detail)
        } else {
          setError('Erreur lors de la création de la déclaration.')
        }
      } catch {
        setError('Erreur lors de la création de la déclaration.')
      }
    }
    setIsSavingNewRow(false)
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
        setEditingUnitPrice('')
        setIsEditingAmountDirty(false)
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

  const selectedClientId = newFormValues.clientId
    ? Number(newFormValues.clientId)
    : undefined
  const selectedClientForNewRow = selectedClientId
    ? clients.find((client) => client.id === selectedClientId)
    : undefined
  const newPickupQuantity = parseInt(newFormValues.pickupQuantity, 10)
  const newDeliveryQuantity = parseInt(newFormValues.deliveryQuantity, 10)
  const newDifference =
    Number.isNaN(newPickupQuantity) || Number.isNaN(newDeliveryQuantity)
      ? null
      : newPickupQuantity - newDeliveryQuantity
  const deliveryMax = Number.isNaN(newPickupQuantity)
    ? undefined
    : newPickupQuantity
  const isEditingRow = editingId !== null

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
      <div className="mb-4 flex w-full justify-end">
        <button
          type="button"
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
          onClick={startCreating}
          disabled={isCreating || isEditingRow}
        >
          Ajouter une déclaration
        </button>
      </div>
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
          {isCreating && (
            <tr>
              <td className="border px-4 py-2">
                <input
                  type="date"
                  className="w-40 rounded border px-2 py-1"
                  value={newFormValues.date}
                  onChange={(e) => handleNewFieldChange('date', e.target.value)}
                  disabled={isSavingNewRow}
                />
              </td>
              <td className="border px-4 py-2">
                <select
                  className="w-48 rounded border px-2 py-1"
                  value={newFormValues.driverId}
                  onChange={(e) => handleNewFieldChange('driverId', e.target.value)}
                  disabled={isSavingNewRow}
                >
                  <option value="">Sélectionner</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.displayName}
                      {!driver.isActive ? ' (inactif)' : ''}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border px-4 py-2">
                <select
                  className="w-48 rounded border px-2 py-1"
                  value={newFormValues.clientId}
                  onChange={(e) => handleNewFieldChange('clientId', e.target.value)}
                  disabled={isSavingNewRow}
                >
                  <option value="">Sélectionner</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border px-4 py-2">
                <select
                  className="w-56 rounded border px-2 py-1"
                  value={newFormValues.tariffGroupId}
                  onChange={(e) =>
                    handleNewFieldChange('tariffGroupId', e.target.value)
                  }
                  disabled={isSavingNewRow || !newFormValues.clientId}
                >
                  <option value="">Sélectionner</option>
                  {(selectedClientForNewRow?.categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border px-4 py-2">
                <input
                  type="number"
                  min={0}
                  className="w-24 rounded border px-2 py-1"
                  value={newFormValues.pickupQuantity}
                  onChange={(e) =>
                    handleNewFieldChange('pickupQuantity', e.target.value)
                  }
                  disabled={isSavingNewRow}
                />
              </td>
              <td className="border px-4 py-2">
                <input
                  type="number"
                  min={0}
                  max={deliveryMax}
                  className="w-24 rounded border px-2 py-1"
                  value={newFormValues.deliveryQuantity}
                  onChange={(e) =>
                    handleNewFieldChange('deliveryQuantity', e.target.value)
                  }
                  disabled={isSavingNewRow}
                />
              </td>
              <td className="border px-4 py-2">
                {newDifference !== null ? newDifference : '—'}
              </td>
              <td className="border px-4 py-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-28 rounded border px-2 py-1"
                  value={newFormValues.estimatedAmountEur}
                  onChange={(e) =>
                    handleNewFieldChange('estimatedAmountEur', e.target.value)
                  }
                  disabled={isSavingNewRow}
                />
              </td>
              <td className="border px-4 py-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
                    onClick={handleCreateSave}
                    disabled={isSavingNewRow}
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    className="rounded bg-gray-500 px-3 py-1 text-white disabled:opacity-50"
                    onClick={cancelCreating}
                    disabled={isSavingNewRow}
                  >
                    Annuler
                  </button>
                </div>
              </td>
            </tr>
          )}
          {rows.map((row) => (
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
                      disabled={isCreating || deletingId === row.tourItemId}
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
          {rows.length === 0 && !isCreating && (
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
