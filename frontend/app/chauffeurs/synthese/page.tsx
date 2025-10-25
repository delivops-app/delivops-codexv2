'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'
import { PageLayout } from '../../../components/PageLayout'
import { apiFetch, isApiFetchError } from '../../../lib/api'
import { normalizeRoles } from '../../../lib/roles'

interface DeclarationRow {
  tourId: number
  tourItemId: number | null
  date: string
  driverName: string
  clientName: string
  tariffGroupDisplayName: string
  pickupQuantity: number
  deliveryQuantity: number
  differenceQuantity: number
  estimatedAmountEur: string
  unitPriceExVat: string
  unitMarginExVat: string
  marginAmountEur: string
  status: 'IN_PROGRESS' | 'COMPLETED'
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
  marginExVat: string | number | null
}

interface ClientOption {
  id: number
  name: string
  isActive: boolean
  categories: ClientCategoryOption[]
}

interface ClientOptionApiPayload {
  id: number
  name: string
  isActive?: boolean
  categories: ClientCategoryOption[]
}

interface ClientHistoryEntry {
  id: number
  name: string
  isActive: boolean
  lastDeclarationDate: string
  declarationCount: number
}

type DateFilterMode = 'day' | 'month' | 'range'

interface FiltersState {
  dateMode: DateFilterMode
  day: string
  month: string
  dateFrom: string
  dateTo: string
  driverId: string
  clientId: string
  tariffGroupName: string
}

const getCurrentMonthString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

const createDefaultFiltersState = (): FiltersState => ({
  dateMode: 'month',
  day: '',
  month: getCurrentMonthString(),
  dateFrom: '',
  dateTo: '',
  driverId: '',
  clientId: '',
  tariffGroupName: '',
})

const mapClientFromApi = (client: ClientOptionApiPayload): ClientOption => ({
  id: client.id,
  name: client.name,
  isActive: client.isActive ?? true,
  categories: (client.categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    unitPriceExVat: category.unitPriceExVat,
    marginExVat: category.marginExVat,
  })),
})

const formatIsoDateToFr = (value: string) => {
  if (!value) return ''
  const parts = value.split('-')
  if (parts.length !== 3) {
    return value
  }
  const [year, month, day] = parts
  if (!year || !month || !day) {
    return value
  }
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
}

const escapeHtml = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const parseAmountForExport = (value: string) => {
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) {
    return ''
  }
  return parsed
}

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
const selectClass = inputClass
const badgeClass =
  'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600'
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
const tableButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'

export default function SyntheseChauffeursPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isAdmin = roles.includes('ADMIN')
  const [rows, setRows] = useState<DeclarationRow[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientHistory, setClientHistory] = useState<ClientHistoryEntry[]>([])
  const [filters, setFilters] = useState<FiltersState>(() =>
    createDefaultFiltersState(),
  )
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState({
    pickupQuantity: '',
    deliveryQuantity: '',
    estimatedAmountEur: '',
  })
  const [editingUnitPrice, setEditingUnitPrice] = useState('')
  const [editingUnitMargin, setEditingUnitMargin] = useState('')
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
  const [showClientHistory, setShowClientHistory] = useState(false)
  const [isLoadingClientHistory, setIsLoadingClientHistory] = useState(false)
  const [clientHistoryError, setClientHistoryError] = useState('')
  const [hasLoadedClientHistory, setHasLoadedClientHistory] = useState(false)
  const [reactivatingClientId, setReactivatingClientId] = useState<number | null>(
    null,
  )
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const newDeclarationDateInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isCreating) {
      return
    }

    const container = tableContainerRef.current
    if (container) {
      container.scrollTo({ left: 0, behavior: 'smooth' })
    }

    const dateInput = newDeclarationDateInputRef.current
    if (dateInput) {
      requestAnimationFrame(() => {
        dateInput.focus({ preventScroll: true })
      })
    }
  }, [isCreating])

  const fetchDeclarations = useCallback(async () => {
    const res = await apiFetch('/reports/declarations')
    if (res.ok) {
      const json: DeclarationRow[] = await res.json()
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
    const res = await apiFetch('/clients/?include_inactive=true')
    if (res.ok) {
      const json = (await res.json()) as ClientOptionApiPayload[]
      setClients(json.map((client) => mapClientFromApi(client)))
    } else if (isApiFetchError(res)) {
      console.error('Failed to load clients for declarations summary', res.error)
      setError(
        'Impossible de charger les clients. Vérifiez votre connexion et réessayez.',
      )
    } else {
      setError('Erreur lors du chargement des clients.')
    }
  }, [])

  const fetchClientHistory = useCallback(async () => {
    setIsLoadingClientHistory(true)
    const res = await apiFetch('/clients/history')
    if (res.ok) {
      const json = (await res.json()) as ClientHistoryEntry[]
      setClientHistory(json)
      setClientHistoryError('')
      setHasLoadedClientHistory(true)
    } else if (isApiFetchError(res)) {
      console.error('Failed to load client history', res.error)
      setClientHistoryError(
        'Impossible de charger l\'historique des donneurs d\'ordres. Vérifiez votre connexion et réessayez.',
      )
      setHasLoadedClientHistory(false)
    } else {
      setClientHistoryError(
        "Erreur lors du chargement de l'historique des donneurs d'ordres.",
      )
      setHasLoadedClientHistory(false)
    }
    setIsLoadingClientHistory(false)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetchDeclarations()
    fetchDrivers()
    fetchClientsData()
  }, [isAdmin, fetchDeclarations, fetchDrivers, fetchClientsData])

  const handleOpenClientHistory = useCallback(() => {
    setShowClientHistory(true)
    if (!hasLoadedClientHistory) {
      fetchClientHistory()
    }
  }, [fetchClientHistory, hasLoadedClientHistory])

  const handleCloseClientHistory = useCallback(() => {
    setShowClientHistory(false)
  }, [])

  const handleReactivateClient = useCallback(
    async (clientId: number) => {
      setReactivatingClientId(clientId)
      try {
        const res = await apiFetch(`/clients/${clientId}/reactivate`, {
          method: 'POST',
        })
        if (res.ok) {
          const json = (await res.json()) as ClientOptionApiPayload
          const mapped = mapClientFromApi(json)
          setClients((prev) => {
            const existingIndex = prev.findIndex((client) => client.id === mapped.id)
            if (existingIndex === -1) {
              return [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name))
            }
            const next = [...prev]
            next[existingIndex] = mapped
            return next
          })
          setClientHistory((prev) =>
            prev.map((entry) =>
              entry.id === clientId ? { ...entry, isActive: true } : entry,
            ),
          )
          setClientHistoryError('')
        } else if (isApiFetchError(res)) {
          console.error('Failed to reactivate client', res.error)
          setClientHistoryError(
            'Impossible de réactiver le client. Vérifiez votre connexion et réessayez.',
          )
        } else {
          setClientHistoryError('Erreur lors de la réactivation du client.')
        }
      } finally {
        setReactivatingClientId(null)
      }
    },
    [],
  )

  const handleFilterChange = (field: keyof FiltersState, value: string) => {
    setFilters((prev) => {
      if (field === 'clientId') {
        return { ...prev, clientId: value, tariffGroupName: '' }
      }
      if (field === 'dateMode') {
        return {
          ...prev,
          dateMode: value as FiltersState['dateMode'],
          day: '',
          month: value === 'month' ? getCurrentMonthString() : '',
          dateFrom: '',
          dateTo: '',
        }
      }
      if (field === 'dateFrom') {
        const nextDateFrom = value
        const nextDateTo =
          prev.dateTo && nextDateFrom && nextDateFrom > prev.dateTo
            ? nextDateFrom
            : prev.dateTo
        return { ...prev, dateFrom: nextDateFrom, dateTo: nextDateTo }
      }
      if (field === 'dateTo') {
        const nextDateTo = value
        const nextDateFrom =
          prev.dateFrom && nextDateTo && prev.dateFrom > nextDateTo
            ? nextDateTo
            : prev.dateFrom
        return { ...prev, dateTo: nextDateTo, dateFrom: nextDateFrom }
      }
      return { ...prev, [field]: value } as FiltersState
    })
  }

  const resetFilters = () => {
    setFilters(createDefaultFiltersState())
  }

  const rowsMatchingDateFilters = useMemo(() => {
    return rows.filter((row) => {
      if (filters.dateMode === 'day') {
        if (filters.day && row.date !== filters.day) {
          return false
        }
        return true
      }

      if (filters.dateMode === 'month') {
        if (filters.month && row.date.slice(0, 7) !== filters.month) {
          return false
        }
        return true
      }

      if (filters.dateMode === 'range') {
        if (filters.dateFrom && row.date < filters.dateFrom) {
          return false
        }
        if (filters.dateTo && row.date > filters.dateTo) {
          return false
        }
        return true
      }

      return true
    })
  }, [rows, filters.dateMode, filters.day, filters.month, filters.dateFrom, filters.dateTo])

  const availableDriverNames = useMemo(() => {
    const names = new Set<string>()
    rowsMatchingDateFilters.forEach((row) => {
      if (row.driverName) {
        names.add(row.driverName)
      }
    })
    return names
  }, [rowsMatchingDateFilters])

  const driverFilterOptions = useMemo(
    () =>
      drivers
        .filter((driver) => availableDriverNames.has(driver.displayName))
        .slice()
        .sort((a, b) => {
          if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1
          }
          return a.displayName.localeCompare(b.displayName, 'fr', {
            sensitivity: 'base',
          })
        }),
    [drivers, availableDriverNames],
  )


  const availableClientNames = useMemo(() => {
    const names = new Set<string>()
    rowsMatchingDateFilters.forEach((row) => {
      if (row.clientName) {
        names.add(row.clientName)
      }
    })
    return names
  }, [rowsMatchingDateFilters])

  const clientFilterOptions = useMemo(() => {
    return clients
      .filter((client) => availableClientNames.has(client.name))
      .slice()
      .sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1
        }
        return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      })
  }, [clients, availableClientNames])

  const selectedFilterClient = useMemo(
    () =>
      filters.clientId
        ? clients.find(
            (client) => client.id === Number.parseInt(filters.clientId, 10),
          )
        : undefined,
    [filters.clientId, clients],
  )

  const availableTariffGroupNames = useMemo(() => {
    const names = new Set<string>()
    const relevantRows = selectedFilterClient
      ? rowsMatchingDateFilters.filter(
          (row) => row.clientName === selectedFilterClient.name,
        )
      : rowsMatchingDateFilters
    relevantRows.forEach((row) => {
      if (row.tariffGroupDisplayName) {
        names.add(row.tariffGroupDisplayName)
      }
    })
    return names
  }, [rowsMatchingDateFilters, selectedFilterClient])

  const tariffGroupFilterOptions = useMemo(() => {
    return Array.from(availableTariffGroupNames).sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    )
  }, [availableTariffGroupNames])

  useEffect(() => {

    if (!filters.driverId) {
      return
    }
    const selectedDriver = drivers.find(
      (driver) => driver.id === Number.parseInt(filters.driverId, 10),
    )
    if (!selectedDriver) {
      return
    }
    if (!availableDriverNames.has(selectedDriver.displayName)) {
      setFilters((prev) => ({ ...prev, driverId: '' }))
    }
  }, [filters.driverId, drivers, availableDriverNames])

  useEffect(() => {

    if (!filters.clientId) {
      return
    }
    const selectedClient = clients.find(
      (client) => client.id === Number.parseInt(filters.clientId, 10),
    )
    if (!selectedClient) {
      return
    }
    if (!availableClientNames.has(selectedClient.name)) {
      setFilters((prev) => ({ ...prev, clientId: '', tariffGroupName: '' }))
    }
  }, [filters.clientId, clients, availableClientNames])

  useEffect(() => {
    if (!filters.tariffGroupName) {
      return
    }
    if (!availableTariffGroupNames.has(filters.tariffGroupName)) {
      setFilters((prev) => ({ ...prev, tariffGroupName: '' }))
    }
  }, [filters.tariffGroupName, availableTariffGroupNames])

  const filteredRows = useMemo(() => {
    const driverNameById = new Map<number, string>()
    drivers.forEach((driver) => {
      driverNameById.set(driver.id, driver.displayName)
    })
    const clientNameById = new Map<number, string>()
    clients.forEach((client) => {
      clientNameById.set(client.id, client.name)
    })

    const driverId = filters.driverId
      ? Number.parseInt(filters.driverId, 10)
      : undefined
    const clientId = filters.clientId
      ? Number.parseInt(filters.clientId, 10)
      : undefined

    return rowsMatchingDateFilters.filter((row) => {
      if (driverId !== undefined && !Number.isNaN(driverId)) {
        const driverName = driverNameById.get(driverId)
        if (!driverName || row.driverName !== driverName) {
          return false
        }
      }

      if (clientId !== undefined && !Number.isNaN(clientId)) {
        const clientName = clientNameById.get(clientId)
        if (!clientName || row.clientName !== clientName) {
          return false
        }
      }

      if (
        filters.tariffGroupName &&
        row.tariffGroupDisplayName !== filters.tariffGroupName
      ) {
        return false
      }

      return true
    })
  }, [rowsMatchingDateFilters, filters, drivers, clients])

  const totalEstimatedAmount = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const value = Number.parseFloat(row.estimatedAmountEur)
      if (Number.isNaN(value)) {
        return acc
      }
      return acc + value
    }, 0)
  }, [filteredRows])

  const totalMarginAmount = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const value = Number.parseFloat(row.marginAmountEur)
      if (Number.isNaN(value)) {
        return acc
      }
      return acc + value
    }, 0)
  }, [filteredRows])

  const formattedTotalEstimatedAmount = useMemo(
    () =>
      totalEstimatedAmount.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [totalEstimatedAmount],
  )

  const formattedTotalMarginAmount = useMemo(
    () =>
      totalMarginAmount.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [totalMarginAmount],
  )

  const hasDateFilter =
    (filters.dateMode === 'day' && filters.day.trim().length > 0) ||
    (filters.dateMode === 'month' && filters.month.trim().length > 0) ||
    (filters.dateMode === 'range' &&
      (filters.dateFrom.trim().length > 0 || filters.dateTo.trim().length > 0))

  const handleExport = useCallback(() => {
    if (filteredRows.length === 0) {
      return
    }

    const headers = [
      'Date',
      'Chauffeur',
      "Client donneur d'ordre",
      'Catégorie de groupe tarifaire',
      'Colis récupérés',
      'Colis livrés',
      'Écart',
      'Montant estimé (€)',
      'Marge (€)',
      'Statut',
    ]

    const rowsHtml = filteredRows
      .map((row) => {
        const deliveryValue =
          row.status === 'IN_PROGRESS'
            ? 'En cours de livraison'
            : row.deliveryQuantity

        const statusLabel =
          row.status === 'IN_PROGRESS' ? 'En cours de livraison' : 'Livrée'

        const cells = [
          formatIsoDateToFr(row.date),
          row.driverName,
          row.clientName,
          row.tariffGroupDisplayName,
          row.pickupQuantity,
          deliveryValue,
          row.differenceQuantity,
          parseAmountForExport(row.estimatedAmountEur),
          parseAmountForExport(row.marginAmountEur),
          statusLabel,
        ]

        const cellsHtml = cells
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')

        return `<tr>${cellsHtml}</tr>`
      })
      .join('')

    const headerHtml = `<tr>${headers
      .map((header) => `<th>${escapeHtml(header)}</th>`)
      .join('')}</tr>`

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body><table>${headerHtml}${rowsHtml}</table></body></html>`

    const blob = new Blob([htmlContent], {
      type: 'application/vnd.ms-excel',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const today = new Date()
    const formattedDate = today
      .toLocaleDateString('fr-FR')
      .replace(/\//g, '-')
    link.href = url
    link.download = `synthese_chauffeurs_${formattedDate}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }, [filteredRows])

  const hasActiveFilters = Boolean(
    hasDateFilter || filters.driverId || filters.clientId || filters.tariffGroupName,
  )

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
    if (row.status === 'IN_PROGRESS' || row.tourItemId === null) {

      return
    }
    setEditingId(row.tourItemId)
    setFormValues({
      pickupQuantity: row.pickupQuantity.toString(),
      deliveryQuantity: row.deliveryQuantity.toString(),
      estimatedAmountEur: Number(row.estimatedAmountEur || 0).toFixed(2),
    })
    setEditingUnitPrice(row.unitPriceExVat)
    setEditingUnitMargin(row.unitMarginExVat)
    setIsEditingAmountDirty(false)
    setError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsSaving(false)
    setEditingUnitPrice('')
    setEditingUnitMargin('')
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
    if (deletingId !== null || row.tourItemId === null) return
    const confirmed = window.confirm(
      `Confirmez-vous la suppression de la déclaration du ${formatIsoDateToFr(row.date)} pour ${row.driverName} ?`,
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
        setEditingUnitMargin('')
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
  const selectedCategoryForNewRow = selectedClientForNewRow
    ? selectedClientForNewRow.categories.find(
        (category) => category.id === Number(newFormValues.tariffGroupId),
      )
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
  const unitMarginValue = selectedCategoryForNewRow?.marginExVat
  const newUnitMargin =
    unitMarginValue === null || unitMarginValue === undefined
      ? Number.NaN
      : parseFloat(unitMarginValue.toString())
  const newMarginAmount =
    Number.isNaN(newUnitMargin) || Number.isNaN(newDeliveryQuantity)
      ? null
      : newUnitMargin * newDeliveryQuantity
  const isEditingRow = editingId !== null

  if (!isAdmin) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Cette page est réservée aux administrateurs Delivops autorisés."
        actions={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      >
        <p className="text-sm text-slate-600">
          Veuillez contacter un administrateur Delivops si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Synthèse des chauffeurs"
      description="Analysez les déclarations de tournées, suivez les marges et exportez vos données en quelques clics."
      actions={
        <>
          <Link
            href="/clients"
            className="inline-flex items-center justify-center rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Paramétrage clients
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        </>
      }
    >
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filtres et indicateurs</h2>
            <p className="text-sm text-slate-600">
              Ajustez les données affichées et consultez les totaux en temps réel.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            onClick={handleOpenClientHistory}
          >
            Historique des donneurs d&apos;ordres
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-date-mode" className="text-sm font-medium text-slate-700">
                Type de période
              </label>
              <select
                id="filter-date-mode"
                className={selectClass}
                value={filters.dateMode}
                onChange={(e) => handleFilterChange('dateMode', e.target.value)}
              >
                <option value="day">Jour</option>
                <option value="month">Mois</option>
                <option value="range">Période</option>
              </select>
            </div>
            {filters.dateMode === 'day' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-date-day" className="text-sm font-medium text-slate-700">
                  Date
                </label>
                <input
                  id="filter-date-day"
                  type="date"
                  className={inputClass}
                  value={filters.day}
                  onChange={(e) => handleFilterChange('day', e.target.value)}
                />
              </div>
            )}
            {filters.dateMode === 'month' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-date-month" className="text-sm font-medium text-slate-700">
                  Mois
                </label>
                <input
                  id="filter-date-month"
                  type="month"
                  className={inputClass}
                  value={filters.month}
                  onChange={(e) => handleFilterChange('month', e.target.value)}
                />
              </div>
            )}
            {filters.dateMode === 'range' && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-date-from" className="text-sm font-medium text-slate-700">
                    Du
                  </label>
                  <input
                    id="filter-date-from"
                    type="date"
                    className={inputClass}
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-date-to" className="text-sm font-medium text-slate-700">
                    Au
                  </label>
                  <input
                    id="filter-date-to"
                    type="date"
                    className={inputClass}
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-driver" className="text-sm font-medium text-slate-700">
                Chauffeur
              </label>
              <select
                id="filter-driver"
                className={selectClass}
                value={filters.driverId}
                onChange={(e) => handleFilterChange('driverId', e.target.value)}
              >
                <option value="">Tous les chauffeurs</option>
                {driverFilterOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.displayName}
                    {!driver.isActive ? ' (inactif)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-client" className="text-sm font-medium text-slate-700">
                Client donneur d&apos;ordre
              </label>
              <select
                id="filter-client"
                className={selectClass}
                value={filters.clientId}
                onChange={(e) => handleFilterChange('clientId', e.target.value)}
              >
                <option value="">Tous les clients</option>
                {clientFilterOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {!client.isActive ? ' (inactif)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-tariff-group" className="text-sm font-medium text-slate-700">
                Catégorie de groupe tarifaire
              </label>
              <select
                id="filter-tariff-group"
                className={selectClass}
                value={filters.tariffGroupName}
                onChange={(e) => handleFilterChange('tariffGroupName', e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {tariffGroupFilterOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              Réinitialiser les filtres
            </button>
            <div className="space-y-1 text-sm text-slate-600 sm:text-right">
              <p>
                Montant estimé total :{' '}
                <span className="text-base font-semibold text-slate-900">
                  {formattedTotalEstimatedAmount} €
                </span>
              </p>
              <p>
                Marge totale :{' '}
                <span className="text-base font-semibold text-slate-900">
                  {formattedTotalMarginAmount} €
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Déclarations de tournées</h2>
            <p className="text-sm text-slate-600">
              Modifiez les déclarations existantes, ajoutez des tournées manuelles ou exportez vos données.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${secondaryButtonClass} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
              onClick={handleExport}
              disabled={filteredRows.length === 0}
            >
              Exporter au format Excel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={startCreating}
              disabled={isCreating || isEditingRow}
            >
              Ajouter une déclaration
            </button>
          </div>
        </div>
        <div className="p-5" ref={tableContainerRef}>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Chauffeur</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Client donneur d&apos;ordre
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Catégorie de groupe tarifaire
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                      Colis récupérés
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                      Colis livrés
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                      Écart
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                      Montant estimé (€)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                      Marge (€)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {isCreating && (
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          ref={newDeclarationDateInputRef}
                          type="date"
                          className={`${inputClass} w-32`}
                          value={newFormValues.date}
                          onChange={(e) => handleNewFieldChange('date', e.target.value)}
                          disabled={isSavingNewRow}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={`${selectClass} w-48`}
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
                      <td className="px-4 py-3">
                        <select
                          className={`${selectClass} w-56`}
                          value={newFormValues.clientId}
                          onChange={(e) => handleNewFieldChange('clientId', e.target.value)}
                          disabled={isSavingNewRow}
                        >
                          <option value="">Sélectionner</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id} disabled={!client.isActive}>
                              {client.name}
                              {!client.isActive ? ' (inactif)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={`${selectClass} w-56`}
                          value={newFormValues.tariffGroupId}
                          onChange={(e) => handleNewFieldChange('tariffGroupId', e.target.value)}
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
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          className={`${inputClass} w-28 text-right`}
                          value={newFormValues.pickupQuantity}
                          onChange={(e) => handleNewFieldChange('pickupQuantity', e.target.value)}
                          disabled={isSavingNewRow}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={deliveryMax}
                          className={`${inputClass} w-28 text-right`}
                          value={newFormValues.deliveryQuantity}
                          onChange={(e) => handleNewFieldChange('deliveryQuantity', e.target.value)}
                          disabled={isSavingNewRow}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {newDifference !== null ? newDifference : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={`${inputClass} w-32 text-right`}
                          value={newFormValues.estimatedAmountEur}
                          onChange={(e) => handleNewFieldChange('estimatedAmountEur', e.target.value)}
                          disabled={isSavingNewRow}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {newMarginAmount !== null ? newMarginAmount.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`${tableButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                            onClick={handleCreateSave}
                            disabled={isSavingNewRow}
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            className={tableButtonClass}
                            onClick={cancelCreating}
                            disabled={isSavingNewRow}
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredRows.map((row) => {
                    const key =
                      row.tourItemId !== null
                        ? `item-${row.tourItemId}`
                        : `tour-${row.tourId}`
                    const isEditingCurrent = editingId === row.tourItemId
                    const isPending = row.status === 'IN_PROGRESS'
                    const deliveryCell = isPending ? (
                      <span className={`${badgeClass} border-amber-200 bg-amber-50 text-amber-700`}>
                        En cours de livraison
                      </span>
                    ) : (
                      row.deliveryQuantity
                    )

                    return (
                      <tr key={key} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {formatIsoDateToFr(row.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{row.driverName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{row.clientName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {row.tariffGroupDisplayName}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">
                          {isEditingCurrent ? (
                            <input
                              type="number"
                              min={0}
                              className={`${inputClass} w-24 text-right`}
                              value={formValues.pickupQuantity}
                              onChange={(e) => handleInputChange('pickupQuantity', e.target.value)}
                            />
                          ) : (
                            row.pickupQuantity
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">
                          {isEditingCurrent ? (
                            <input
                              type="number"
                              min={0}
                              className={`${inputClass} w-24 text-right`}
                              value={formValues.deliveryQuantity}
                              onChange={(e) => handleInputChange('deliveryQuantity', e.target.value)}
                            />
                          ) : (
                            deliveryCell
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">
                          {isEditingCurrent
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
                        <td className="px-4 py-3 text-right text-sm text-slate-700">
                          {isEditingCurrent ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={`${inputClass} w-28 text-right`}
                              value={formValues.estimatedAmountEur}
                              onChange={(e) => handleInputChange('estimatedAmountEur', e.target.value)}
                            />
                          ) : (
                            Number(row.estimatedAmountEur || 0).toFixed(2)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">
                          {isEditingCurrent
                            ? (() => {
                                const delivery = parseInt(formValues.deliveryQuantity, 10)
                                const unitMargin = parseFloat(editingUnitMargin || '')
                                if (Number.isNaN(delivery) || Number.isNaN(unitMargin)) {
                                  return '—'
                                }
                                return (unitMargin * delivery).toFixed(2)
                              })()
                            : Number(row.marginAmountEur || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {isEditingCurrent ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={`${tableButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                                onClick={handleSave}
                                disabled={isSaving}
                              >
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                className={tableButtonClass}
                                onClick={cancelEditing}
                                disabled={isSaving}
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={tableButtonClass}
                                onClick={() => startEditing(row)}
                                disabled={
                                  isCreating ||
                                  deletingId === row.tourItemId ||
                                  isPending ||
                                  row.tourItemId === null
                                }
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className={`${tableButtonClass} border-red-200 text-red-700 hover:bg-red-50 focus-visible:outline-red-500`}
                                onClick={() => handleDelete(row)}
                                disabled={deletingId === row.tourItemId || row.tourItemId === null}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRows.length === 0 && !isCreating && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-600" colSpan={10}>
                        {rows.length === 0
                          ? 'Aucune déclaration disponible.'
                          : 'Aucune déclaration ne correspond aux filtres.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900" colSpan={7}>
                      Totaux
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formattedTotalEstimatedAmount} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formattedTotalMarginAmount} €
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>
      {showClientHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Historique des donneurs d&apos;ordres</h2>
                <p className="text-sm text-slate-600">
                  Consultez la dernière déclaration enregistrée et réactivez un donneur d&apos;ordre inactif si nécessaire.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={handleCloseClientHistory}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  className={`${secondaryButtonClass} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
                  onClick={fetchClientHistory}
                  disabled={isLoadingClientHistory}
                >
                  {isLoadingClientHistory ? 'Actualisation…' : 'Actualiser'}
                </button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              {clientHistoryError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {clientHistoryError}
                </div>
              )}
              {isLoadingClientHistory ? (
                <p className="text-sm text-slate-600">Chargement de l&apos;historique…</p>
              ) : clientHistory.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Aucune déclaration enregistrée pour le moment.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="max-w-full overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Donneur d&apos;ordre
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Statut
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Dernière déclaration
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                            Déclarations
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {clientHistory.map((entry) => {
                          const isReactivating = reactivatingClientId === entry.id
                          return (
                            <tr key={entry.id} className="transition hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm text-slate-900">{entry.name}</td>
                              <td className="px-4 py-3">
                                {entry.isActive ? (
                                  <span className={`${badgeClass} border-emerald-200 bg-emerald-50 text-emerald-700`}>
                                    Actif
                                  </span>
                                ) : (
                                  <span className={`${badgeClass} border-amber-200 bg-amber-50 text-amber-700`}>
                                    Inactif
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                {formatIsoDateToFr(entry.lastDeclarationDate) || entry.lastDeclarationDate || '—'}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700">
                                {entry.declarationCount}
                              </td>
                              <td className="px-4 py-3">
                                {entry.isActive ? (
                                  <span className="text-sm text-slate-500">Actif</span>
                                ) : (
                                  <button
                                    type="button"
                                    className={`${tableButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                                    onClick={() => handleReactivateClient(entry.id)}
                                    disabled={isReactivating}
                                  >
                                    {isReactivating ? 'Réactivation…' : 'Réactiver'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
