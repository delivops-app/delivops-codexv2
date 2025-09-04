'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import AuthButton from '../components/AuthButton'

export default function Home() {
  const { user, error, isLoading } = useUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-4xl font-bold">Delivops Frontend</h1>
      <p className="mb-6 text-center text-lg">Votre plateforme de gestion de livraisons</p>
      {isLoading && <p>Chargement...</p>}
      {error && <p>Erreur: {error.message}</p>}
      {user && <p className="mb-4">Bonjour {user.name}</p>}
      <AuthButton />
    </main>
  )
}
