'use client'

import { ReactNode } from 'react'

import { useBillingContext } from './BillingProvider'

interface WithEntitlementProps {
  entitlement: string
  allowDuringReadOnly?: boolean
  fallback?: ReactNode
  children: ReactNode
}

export function WithEntitlement({
  entitlement,
  allowDuringReadOnly = false,
  fallback = null,
  children,
}: WithEntitlementProps) {
  const { hasEntitlement, isReadOnly, isSuspended, loading } = useBillingContext()

  if (loading) {
    return null
  }

  if (isSuspended) {
    return <>{fallback}</>
  }

  if (!allowDuringReadOnly && isReadOnly) {
    return <>{fallback}</>
  }

  if (!hasEntitlement(entitlement)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
