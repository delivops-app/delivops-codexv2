'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

export default function AuthButton() {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return null
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Se connecter
      </Link>
    )
  }

  return (
    <Link
      href="/api/auth/logout"
      className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
    >
      Se déconnecter
    </Link>
  )
}
