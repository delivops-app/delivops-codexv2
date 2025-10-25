'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

interface AuthButtonProps {
  className?: string
}

function classNames(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ')
}

export default function AuthButton({ className }: AuthButtonProps) {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return null
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={classNames(
          'inline-flex items-center justify-center rounded-md border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
          className,
        )}
      >
        Se connecter
      </Link>
    )
  }

  return (
    <Link
      href="/api/auth/logout"
      className={classNames(
        'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        className,
      )}
    >
      Se déconnecter
    </Link>
  )
}
