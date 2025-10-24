'use client'

import { useCallback, useState } from 'react'

import {
  createBillingCheckoutSession,
  createBillingPortalSession,
} from '../lib/api'
import { useBillingContext } from './BillingProvider'

function formatStatusMessage(
  subscriptionStatus: string,
  isSuspended: boolean,
  isReadOnly: boolean,
  graceDays?: number | null,
): { title: string; description: string } {
  if (isSuspended) {
    if (subscriptionStatus === 'CANCELED') {
      return {
        title: 'Abonnement résilié',
        description:
          "Votre abonnement est résilié. Relancez un paiement pour réactiver l'accès.",
      }
    }
    return {
      title: 'Compte suspendu',
      description:
        "Votre abonnement est suspendu. Merci de régulariser la facturation pour retrouver l’accès complet.",
    }
  }

  if (isReadOnly) {
    const extra =
      typeof graceDays === 'number'
        ? ` (${graceDays} jour${graceDays > 1 ? 's' : ''} de retard)`
        : ''
    return {
      title: 'Paiement en retard',
      description:
        `Certaines actions sont temporairement désactivées le temps de régulariser votre abonnement${extra}.`,
    }
  }

  if (subscriptionStatus === 'PAST_DUE') {
    return {
      title: 'Paiement en attente',
      description:
        "Votre paiement récent n’a pas abouti. Veuillez vérifier vos informations de facturation.",
    }
  }

  if (subscriptionStatus === 'PAUSED') {
    return {
      title: 'Abonnement en pause',
      description: 'Votre plan est actuellement en pause. Relancez la facturation pour reprendre l’accès.',
    }
  }

  return {
    title: 'Action requise',
    description: "Merci de mettre à jour votre moyen de paiement pour continuer à utiliser Delivops.",
  }
}

export function BillingBanner() {
  const { state, loading, error, refresh, isReadOnly, isSuspended } =
    useBillingContext()
  const [pendingAction, setPendingAction] = useState<'checkout' | 'portal' | null>(
    null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const showErrorBanner = Boolean(error) && !loading
  if (showErrorBanner) {
    return (
      <div className="bg-red-100 text-red-900 border-b border-red-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 text-sm">
          <div>
            <p className="font-semibold">Erreur de facturation</p>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  if (loading && !state) {
    return null
  }

  if (!state) {
    return null
  }

  const needsBanner =
    state.subscriptionStatus !== 'ACTIVE' || state.gate.access !== 'active'
  if (!needsBanner) {
    return null
  }

  const { title, description } = formatStatusMessage(
    state.subscriptionStatus,
    isSuspended,
    isReadOnly,
    state.gate.graceDays ?? undefined,
  )

  const handleCheckout = useCallback(async () => {
    setActionError(null)
    setPendingAction('checkout')
    try {
      const url = await createBillingCheckoutSession()
      window.location.assign(url)
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Impossible de démarrer la session de paiement',
      )
    } finally {
      setPendingAction(null)
    }
  }, [])

  const handlePortal = useCallback(async () => {
    setActionError(null)
    setPendingAction('portal')
    try {
      const url = await createBillingPortalSession()
      window.location.assign(url)
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Impossible d’ouvrir le portail client',
      )
    } finally {
      setPendingAction(null)
    }
  }, [])

  const checkoutDisabled = pendingAction !== null
  const portalDisabled = pendingAction !== null

  const bannerTone = isSuspended
    ? 'bg-red-50 border-red-200 text-red-900'
    : isReadOnly
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-amber-50 border-amber-200 text-amber-900'

  return (
    <div className={`${bannerTone} border-b`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p>{description}</p>
          {typeof state.gate.graceDays === 'number' && (
            <p className="mt-1 text-xs opacity-80">
              Retard cumulé : {state.gate.graceDays} jour
              {state.gate.graceDays > 1 ? 's' : ''}.
            </p>
          )}
          {actionError && (
            <p className="mt-2 text-xs text-red-700">{actionError}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheckout}
            data-billing-allow="true"
            disabled={checkoutDisabled}
            className="rounded bg-indigo-600 px-4 py-2 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'checkout'
              ? 'Redirection en cours…'
              : 'Payer mon abonnement'}
          </button>
          <button
            type="button"
            onClick={handlePortal}
            data-billing-allow="true"
            disabled={portalDisabled}
            className="rounded border border-indigo-200 px-4 py-2 text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'portal'
              ? 'Ouverture du portail…'
              : 'Gérer ma facturation'}
          </button>
        </div>
      </div>
    </div>
  )
}
