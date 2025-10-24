'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { BillingState } from '../lib/api'
import { fetchBillingState } from '../lib/api'

interface BillingContextValue {
  state?: BillingState
  loading: boolean
  error?: string
  refresh: () => Promise<void>
  isReadOnly: boolean
  isSuspended: boolean
  hasEntitlement: (key: string) => boolean
}

const BillingContext = createContext<BillingContextValue | undefined>(undefined)

const DEFAULT_CONTEXT: BillingContextValue = {
  state: undefined,
  loading: true,
  error: undefined,
  refresh: async () => {
    // No-op placeholder used before provider initialisation.
  },
  isReadOnly: false,
  isSuspended: false,
  hasEntitlement: () => false,
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BillingState | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (isMounted.current) {
      setLoading(true)
    }

    try {
      const payload = await fetchBillingState()
      if (!isMounted.current) {
        return
      }
      setState(payload)
      setError(undefined)
    } catch (err) {
      if (!isMounted.current) {
        return
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Impossible de récupérer les informations de facturation'
      setError(message)
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      // Les erreurs sont déjà gérées dans refresh.
    })
  }, [refresh])

  const isSuspended = state?.gate.access === 'suspended'
  const isReadOnly = state?.gate.access === 'read_only'

  const hasEntitlement = useCallback(
    (key: string) => {
      if (!state?.entitlements) {
        return false
      }
      const rawValue = state.entitlements[key]
      if (typeof rawValue === 'boolean') {
        return rawValue
      }
      return rawValue !== undefined
    },
    [state?.entitlements],
  )

  const value = useMemo<BillingContextValue>(() => {
    if (!state && !loading && !error) {
      return {
        ...DEFAULT_CONTEXT,
        loading,
        error,
        refresh,
      }
    }

    return {
      state,
      loading,
      error,
      refresh,
      isReadOnly: Boolean(isReadOnly),
      isSuspended: Boolean(isSuspended),
      hasEntitlement,
    }
  }, [state, loading, error, refresh, isReadOnly, isSuspended, hasEntitlement])

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBillingContext(): BillingContextValue {
  const context = useContext(BillingContext)
  if (!context) {
    return DEFAULT_CONTEXT
  }
  return context
}

export function useBillingAccess() {
  const { isReadOnly, isSuspended, loading } = useBillingContext()
  return {
    isReadOnly,
    isSuspended,
    loading,
  }
}

export function useHasEntitlement(key: string): boolean {
  const { hasEntitlement } = useBillingContext()
  return hasEntitlement(key)
}

export function BillingContent({ children }: { children: ReactNode }) {
  const { isReadOnly, isSuspended } = useBillingContext()
  const mode = isSuspended ? 'suspended' : isReadOnly ? 'read-only' : 'active'
  const className = `min-h-full ${isSuspended ? 'opacity-60' : ''}`

  return (
    <div data-billing-mode={mode} className={className} aria-disabled={isSuspended}>
      {children}
    </div>
  )
}
