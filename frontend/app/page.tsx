'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import AuthButton from '../components/AuthButton'
import ClientManager from '../components/ClientManager'
import Link from 'next/link'

export default function Home() {
  const { user, error, isLoading } = useUser()
  const roles = (user?.['https://delivops/roles'] as string[]) || []
  const isAdmin = roles.includes('ADMIN')
  const isDriver = roles.includes('CHAUFFEUR')

  const handleInvite = () => {
    window.location.href = '/api/chauffeurs/invite'
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="mb-2 text-4xl font-bold">Delivops</h1>
      <p className="mb-6 text-center text-lg">
        Votre plateforme de gestion de livraisons
      </p>
      {isLoading && <p>Chargement...</p>}
      {error && <p>Erreur: {error.message}</p>}
      {user && <p className="mb-4">Bonjour {user.name}</p>}
      <AuthButton />
      {isAdmin && (
        <div className="mt-4 flex flex-col items-center">
          <button
            onClick={handleInvite}
            className="rounded bg-green-600 px-4 py-2 text-white"
          >
            Inviter un chauffeur
          </button>
          <Link
            href="/chauffeurs"
            className="mt-2 rounded bg-blue-600 px-4 py-2 text-white"
          >
            Voir les chauffeurs
          </Link>
          <Link
            href="/chauffeurs/synthese"
            className="mt-2 rounded bg-purple-600 px-4 py-2 text-white"
          >
            Synthèse des chauffeurs
          </Link>
        </div>
      )}
      {isDriver && (
        <div className="mt-4 flex flex-col items-center">
          <Link
            href="/recuperer"
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Je récupère une tournée
          </Link>
          <Link
            href="/cloturer"
            className="mt-2 rounded bg-purple-600 px-4 py-2 text-white"
          >
            Je clôture une tournée
          </Link>
        </div>
      )}
      {isAdmin && <ClientManager />}
    </main>
  )
}
