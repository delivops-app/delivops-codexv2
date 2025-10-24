'use client'

import { useCallback, useMemo, useState } from 'react'

import {
  createBillingCheckoutSession,
  createBillingPortalSession,
} from '../../../lib/api'
import { useBillingContext } from '../../../components/BillingProvider'

function translateStatus(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Actif'
    case 'TRIALING':
      return 'Période d’essai'
    case 'PAST_DUE':
      return 'Paiement en retard'
    case 'CANCELED':
      return 'Résilié'
    case 'PAUSED':
      return 'En pause'
    default:
      return status
  }
}

function formatPlan(plan: string): string {
  switch (plan) {
    case 'EARLY_PARTNER':
      return 'Early Partner'
    case 'START':
      return 'Start'
    case 'PRO':
      return 'Pro'
    case 'BUSINESS':
      return 'Business'
    case 'ENTERPRISE':
      return 'Enterprise'
    default:
      return plan
  }
}

export default function BillingSettingsPage() {
  const { state, loading, error, refresh, isReadOnly, isSuspended } =
    useBillingContext()
  const [pendingAction, setPendingAction] = useState<'checkout' | 'portal' | null>(
    null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const entitlementsList = useMemo(() => {
    if (!state?.entitlements) {
      return []
    }
    return Object.entries(state.entitlements).map(([key, value]) => ({
      key,
      value,
    }))
  }, [state?.entitlements])

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

  const statusLabel = state ? translateStatus(state.subscriptionStatus) : ''
  const planLabel = state ? formatPlan(state.plan) : ''

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Facturation</h1>
          <p className="text-sm text-slate-600">
            Consultez l’état de votre abonnement et gérez la facturation Stripe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          data-billing-allow="true"
        >
          Rafraîchir
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Résumé</h2>
          {loading && !state ? (
            <p className="mt-2 text-sm text-slate-500">Chargement…</p>
          ) : error ? (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          ) : state ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Plan</dt>
                <dd className="font-medium text-slate-900">{planLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Statut</dt>
                <dd className="font-medium text-slate-900">{statusLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Paywall</dt>
                <dd className="font-medium text-slate-900">
                  {isSuspended
                    ? 'Suspension complète'
                    : isReadOnly
                      ? 'Mode lecture seule'
                      : 'Accès complet'}
                </dd>
              </div>
              {typeof state.gate.graceDays === 'number' && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Jours de retard</dt>
                  <dd className="font-medium text-slate-900">
                    {state.gate.graceDays}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Aucune donnée de facturation disponible.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Actions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mettez à jour votre abonnement ou consultez vos factures depuis Stripe.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCheckout}
              data-billing-allow="true"
              disabled={pendingAction !== null}
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
              disabled={pendingAction !== null}
              className="rounded border border-indigo-200 px-4 py-2 text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'portal'
                ? 'Ouverture du portail…'
                : 'Gérer ma facturation'}
            </button>
          </div>
          {actionError && (
            <p className="mt-3 text-sm text-red-600">{actionError}</p>
          )}
          {state?.stripePortalReturnUrl && (
            <p className="mt-4 text-xs text-slate-500">
              Redirection par défaut : {state.stripePortalReturnUrl}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Entitlements</h2>
        {entitlementsList.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucun entitlement provisionné pour le moment.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Clé</th>
                  <th className="px-4 py-2">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entitlementsList.map(({ key, value }) => (
                  <tr key={key}>
                    <td className="px-4 py-2 font-medium text-slate-700">{key}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {typeof value === 'boolean'
                        ? value
                          ? 'Activé'
                          : 'Désactivé'
                        : String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
