'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

export default function Home() {
  const { user, error, isLoading } = useUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-4xl font-bold">Delivops Frontend</h1>
      <p className="mb-6 text-center text-lg">Votre plateforme de gestion de livraisons</p>
      {isLoading && <p>Chargement...</p>}
      {error && <p>Erreur: {error.message}</p>}
      {!user && (
        <Link
          href="/api/auth/login"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Se connecter
        </Link>
      )}
      {user && (
        <>
          <p className="mb-4">Bonjour {user.name}</p>
          <Link
            href="/api/auth/logout"
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Se déconnecter
          </Link>
        </>
      )}
    </main>
  )
}
